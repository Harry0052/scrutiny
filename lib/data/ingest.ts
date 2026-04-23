import { buildDatabaseReadyBatch, normalizeSourcePayload } from "@/lib/data/normalize";
import { persistDatabaseReadyBatch } from "@/lib/data/persist";
import type { DatabaseReadyBatch } from "@/lib/data/types";
import { logParserRun } from "@/lib/integrity/audit";
import { createSourceConnectors } from "@/lib/scrapers";
import { sourcePriority } from "@/lib/scrapers/source-priority";
import type {
  FetchWindow,
  ProviderResult,
  RawPoliticianRecord,
  SourcePayload
} from "@/lib/scrapers/types";
import { emptyPayload, normalizeName } from "@/lib/scrapers/utils";

export interface IngestionRunResult {
  sourceNotes: string[];
  providerResults: ProviderResult[];
  databaseReadyBatch: DatabaseReadyBatch;
  persisted: boolean;
  persistSummary?: Awaited<ReturnType<typeof persistDatabaseReadyBatch>>;
}

function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }

  return output;
}

function politicianMergeKey(record: RawPoliticianRecord): string {
  return [
    normalizeName(record.fullName),
    record.jurisdictionState?.toUpperCase() ?? "",
    normalizeName(record.officeSought ?? record.officeTitle),
    normalizeName(record.districtLabel ?? "")
  ].join("|");
}

function mergeProviderPayloads(providerResults: ProviderResult[]): SourcePayload {
  const merged: SourcePayload = emptyPayload();
  const sorted = [...providerResults].sort((a, b) => b.priority - a.priority);

  const politicianByKey = new Map<string, RawPoliticianRecord>();
  for (const result of sorted) {
    for (const politician of result.payload.politicians) {
      const key = politicianMergeKey(politician);
      const existing = politicianByKey.get(key);

      if (!existing) {
        politicianByKey.set(key, politician);
        continue;
      }

      const existingPriority = sourcePriority(existing.source);
      const incomingPriority = sourcePriority(politician.source);
      if (incomingPriority > existingPriority) {
        politicianByKey.set(key, {
          ...politician,
          aliases: [...new Set([...(existing.aliases ?? []), ...(politician.aliases ?? [])])],
          issueFocusTags: [
            ...new Set([...(existing.issueFocusTags ?? []), ...(politician.issueFocusTags ?? [])])
          ]
        });
      } else {
        politicianByKey.set(key, {
          ...existing,
          aliases: [...new Set([...(existing.aliases ?? []), ...(politician.aliases ?? [])])],
          issueFocusTags: [
            ...new Set([...(existing.issueFocusTags ?? []), ...(politician.issueFocusTags ?? [])])
          ],
          sourceUrl: existing.sourceUrl ?? politician.sourceUrl,
          latestActivitySummary: existing.latestActivitySummary ?? politician.latestActivitySummary
        });
      }
    }

    merged.statements.push(...result.payload.statements);
    merged.bills.push(...result.payload.bills);
    merged.votes.push(...result.payload.votes);
    merged.donorContributions.push(...result.payload.donorContributions);
    merged.financialDisclosures.push(...result.payload.financialDisclosures);
  }

  merged.politicians = Array.from(politicianByKey.values());
  merged.statements = dedupeByKey(merged.statements, (item) => `${item.source}:${item.sourceRecordId}`);
  merged.bills = dedupeByKey(merged.bills, (item) => `${item.source}:${item.sourceRecordId}`);
  merged.votes = dedupeByKey(merged.votes, (item) => `${item.source}:${item.sourceRecordId}`);
  merged.donorContributions = dedupeByKey(
    merged.donorContributions,
    (item) => `${item.source}:${item.sourceRecordId}`
  );
  merged.financialDisclosures = dedupeByKey(
    merged.financialDisclosures,
    (item) => `${item.source}:${item.sourceRecordId}`
  );

  return merged;
}

function hasRecords(batch: DatabaseReadyBatch): boolean {
  return (
    batch.politicians.length > 0 ||
    batch.bills.length > 0 ||
    batch.statements.length > 0 ||
    batch.votes.length > 0 ||
    batch.donorContributions.length > 0 ||
    batch.financialDisclosures.length > 0
  );
}

export async function buildIngestionBatch(window: FetchWindow = {}): Promise<IngestionRunResult> {
  const providers = createSourceConnectors();
  const providerResults = await Promise.all(providers.map((provider) => provider.fetch(window)));

  const mergedPayload = mergeProviderPayloads(providerResults);
  const normalizedPayload = normalizeSourcePayload(mergedPayload);
  const databaseReadyBatch = buildDatabaseReadyBatch(normalizedPayload);

  await Promise.all(
    providerResults.map((result) =>
      logParserRun({
        sourceType: result.source,
        sourceUrl: undefined,
        parserVersion: `provider-${result.providerId}-1.0.0`,
        status:
          result.status === "error"
            ? "FAILED"
            : result.status === "ok"
              ? "SUCCESS"
              : "PARTIAL",
        confidenceScore: result.status === "ok" ? 0.9 : result.status === "partial" ? 0.65 : 0.3,
        message: result.note,
        rawOutputSnapshot: {
          provider_id: result.providerId,
          trust_tier: result.trustTier,
          priority: result.priority,
          status: result.status,
          records: {
            politicians: result.payload.politicians.length,
            bills: result.payload.bills.length,
            votes: result.payload.votes.length,
            statements: result.payload.statements.length,
            donorContributions: result.payload.donorContributions.length,
            financialDisclosures: result.payload.financialDisclosures.length
          }
        }
      })
    )
  );

  return {
    sourceNotes: providerResults.map((result) => `${result.providerId}: ${result.note}`),
    providerResults,
    databaseReadyBatch,
    persisted: false
  };
}

export async function runIngestion(window: FetchWindow = {}): Promise<IngestionRunResult> {
  const prepared = await buildIngestionBatch(window);

  if (!hasRecords(prepared.databaseReadyBatch)) {
    return prepared;
  }

  const persistSummary = await persistDatabaseReadyBatch(prepared.databaseReadyBatch);
  return {
    ...prepared,
    persisted: true,
    persistSummary
  };
}

export async function runLivePeopleIngestion(input: {
  query: string;
  stateCode?: string;
  address?: string;
  maxRecords?: number;
}): Promise<IngestionRunResult> {
  return runIngestion({
    query: input.query,
    stateCode: input.stateCode,
    address: input.address,
    maxRecords: input.maxRecords ?? 40
  });
}
