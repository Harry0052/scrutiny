import type { DatabaseReadyBatch, NormalizedPayload } from "@/lib/data/types";
import type { TraceMetadata } from "@/lib/data/types";
import { sourceTrustDescription } from "@/lib/scrapers/source-priority";
import type { SourceName, SourcePayload } from "@/lib/scrapers/types";
import { normalizeName, slugify } from "@/lib/scrapers/utils";
import { sanitizeExtractedText, sanitizeUrl } from "@/lib/integrity/sanitize";
import type { Prisma } from "@prisma/client";

function toDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function uniqueIssueTags(input: string[]): string[] {
  return [...new Set(input.map((tag) => tag.toLowerCase().trim()).filter(Boolean))];
}

function toJsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function sourceConfidence(source: SourceName): number {
  if (source === "official_house" || source === "official_senate" || source === "fec") {
    return 0.97;
  }
  if (source === "openstates" || source === "propublica") {
    return 0.9;
  }
  if (source === "google_civic") {
    return 0.8;
  }
  if (source === "opensecrets") {
    return 0.72;
  }

  return 0.68;
}

function sourceVerificationState(source: SourceName): TraceMetadata["verificationState"] {
  if (source === "official_house" || source === "official_senate" || source === "fec") {
    return "VERIFIED";
  }
  if (source === "google_civic" || source === "opensecrets") {
    return "NEEDS_VERIFICATION";
  }

  return "UNVERIFIED";
}

function buildTraceMetadata(input: {
  source: SourceName;
  sourceUrl?: string;
  rawRecord: unknown;
  rawTextSnapshot?: string;
  extractionStatus?: TraceMetadata["extractionStatus"];
  parserVersion: string;
  note: string;
}): TraceMetadata {
  return {
    sourceType: input.source,
    sourceUrl: sanitizeUrl(input.sourceUrl),
    retrievalDate: new Date(),
    parserVersion: input.parserVersion,
    extractionStatus: input.extractionStatus ?? "SUCCESS",
    confidenceScore: sourceConfidence(input.source),
    verificationState: sourceVerificationState(input.source),
    rawTextSnapshot: input.rawTextSnapshot,
    rawJsonSnapshot: toJsonSnapshot(input.rawRecord),
    notes: `${input.note}; trust=${sourceTrustDescription(input.source)}`
  };
}

function buildPoliticianSlug(input: {
  fullName: string;
  jurisdictionLevel: "NATIONAL" | "STATE" | "LOCAL";
  jurisdictionState?: string;
  officeTitle: string;
  districtLabel?: string;
  sourceRecordId: string;
}): string {
  const base = slugify(
    `${input.fullName}-${input.jurisdictionLevel}-${input.jurisdictionState ?? ""}-${input.officeTitle}-${
      input.districtLabel ?? ""
    }`
  );

  if (base.length >= 4) {
    return base;
  }

  return slugify(`${input.fullName}-${input.sourceRecordId}`);
}

export function normalizeSourcePayload(payload: SourcePayload): NormalizedPayload {
  const politicians = payload.politicians.map((politician) => {
    const fullName = sanitizeExtractedText(politician.fullName);
    const normalizedFullName = politician.normalizedFullName
      ? normalizeName(politician.normalizedFullName)
      : normalizeName(fullName);

    return {
      externalId: `${politician.source}:${politician.sourceRecordId}`,
      slug: buildPoliticianSlug({
        fullName,
        jurisdictionLevel: politician.jurisdictionLevel,
        jurisdictionState: politician.jurisdictionState,
        officeTitle: politician.officeTitle,
        districtLabel: politician.districtLabel,
        sourceRecordId: politician.sourceRecordId
      }),
      fullName,
      normalizedFullName,
      aliases: [...new Set((politician.aliases ?? []).map((alias) => sanitizeExtractedText(alias)).filter(Boolean))],
      party: politician.party ? sanitizeExtractedText(politician.party) : undefined,
      officeTitle: sanitizeExtractedText(politician.officeTitle),
      chamber: politician.chamber ? sanitizeExtractedText(politician.chamber) : undefined,
      jurisdictionLevel: politician.jurisdictionLevel,
      jurisdictionState: politician.jurisdictionState?.toUpperCase(),
      city: politician.city ? sanitizeExtractedText(politician.city) : undefined,
      county: politician.county ? sanitizeExtractedText(politician.county) : undefined,
      districtLabel: politician.districtLabel ? sanitizeExtractedText(politician.districtLabel) : undefined,
      candidateStatus: politician.candidateStatus,
      incumbentChallengerStatus: politician.incumbentChallengerStatus ?? "UNKNOWN",
      officeSought: politician.officeSought ? sanitizeExtractedText(politician.officeSought) : undefined,
      electionYear: politician.electionYear,
      issueFocusTags: uniqueIssueTags(politician.issueFocusTags ?? []),
      latestActivityAt: toDate(politician.latestActivityAt),
      latestActivitySummary: politician.latestActivitySummary
        ? sanitizeExtractedText(politician.latestActivitySummary)
        : undefined,
      sourceLabel: politician.sourceLabel,
      sourceUrl: sanitizeUrl(politician.sourceUrl),
      trace: buildTraceMetadata({
        source: politician.source,
        sourceUrl: politician.sourceUrl,
        rawRecord: politician,
        parserVersion: "ingestion-normalizer-1.0.0",
        note: "Normalized political person record"
      }),
      raw: politician
    };
  });

  const bills = payload.bills.map((bill) => ({
    externalId: `${bill.source}:${bill.sourceRecordId}`,
    billCode: bill.billCode.toUpperCase().replace(/\s+/g, "-"),
    title: sanitizeExtractedText(bill.title),
    summary: sanitizeExtractedText(bill.summary),
    issueTags: uniqueIssueTags(bill.issueTags),
    jurisdictionLevel: bill.jurisdictionLevel,
    jurisdictionState: bill.jurisdictionState?.toUpperCase(),
    chamber: bill.chamber,
    introducedAt: toDate(bill.introducedAt),
    latestActionAt: toDate(bill.latestActionAt),
    sourceUrl: sanitizeUrl(bill.sourceUrl),
    trace: buildTraceMetadata({
      source: bill.source,
      sourceUrl: bill.sourceUrl,
      rawRecord: bill,
      parserVersion: "ingestion-normalizer-1.0.0",
      note: "Normalized bill record"
    }),
    raw: bill
  }));

  const statements = payload.statements.map((statement) => ({
    externalId: `${statement.source}:${statement.sourceRecordId}`,
    politicianExternalId: statement.politicianExternalId,
    text: sanitizeExtractedText(statement.text),
    issueTags: uniqueIssueTags(statement.issueTags),
    sourceType: "OTHER" as const,
    sourceUrl: sanitizeUrl(statement.sourceUrl),
    sourceLabel: statement.sourceLabel,
    madeAt: toDate(statement.madeAt) ?? new Date(),
    trace: buildTraceMetadata({
      source: statement.source,
      sourceUrl: statement.sourceUrl,
      rawRecord: statement,
      rawTextSnapshot: sanitizeExtractedText(statement.text),
      parserVersion: "ingestion-normalizer-1.0.0",
      note: "Normalized statement record"
    }),
    raw: statement
  }));

  const votes = payload.votes.map((vote) => ({
    externalId: `${vote.source}:${vote.sourceRecordId}`,
    politicianExternalId: vote.politicianExternalId,
    billCode: vote.billCode.toUpperCase().replace(/\s+/g, "-"),
    votePosition: vote.votePosition,
    rollCallReference: vote.rollCallReference ? sanitizeExtractedText(vote.rollCallReference) : undefined,
    votedAt: toDate(vote.votedAt) ?? new Date(),
    sourceUrl: sanitizeUrl(vote.sourceUrl),
    trace: buildTraceMetadata({
      source: vote.source,
      sourceUrl: vote.sourceUrl,
      rawRecord: vote,
      parserVersion: "ingestion-normalizer-1.0.0",
      note: "Normalized vote record"
    }),
    raw: vote
  }));

  const donorContributions = payload.donorContributions.map((contribution) => ({
    donorExternalId: `${contribution.source}:${contribution.donorExternalId}`,
    donorName: sanitizeExtractedText(contribution.donorName),
    donorType: contribution.donorType,
    sector: contribution.sector,
    contributionExternalId: `${contribution.source}:${contribution.sourceRecordId}`,
    politicianExternalId: contribution.politicianExternalId,
    amountUsd: contribution.amountUsd,
    electionCycle: contribution.electionCycle,
    contributionDate: toDate(contribution.contributionDate) ?? new Date(),
    contributionType: contribution.contributionType,
    sourceSystem: contribution.source,
    sourceUrl: sanitizeUrl(contribution.sourceUrl),
    trace: buildTraceMetadata({
      source: contribution.source,
      sourceUrl: contribution.sourceUrl,
      rawRecord: contribution,
      parserVersion: "ingestion-normalizer-1.0.0",
      note: "Normalized donor contribution record"
    }),
    raw: contribution
  }));

  const financialDisclosures = payload.financialDisclosures.map((disclosure) => ({
    externalId: `${disclosure.source}:${disclosure.sourceRecordId}`,
    politicianExternalId: disclosure.politicianExternalId,
    filingYear: disclosure.filingYear,
    reportType: sanitizeExtractedText(disclosure.reportType),
    sourceUrl: sanitizeUrl(disclosure.sourceUrl),
    rawPdfPath: disclosure.rawPdfPath,
    filedAt: toDate(disclosure.filedAt),
    extractionStatus: "PENDING" as const,
    trace: buildTraceMetadata({
      source: disclosure.source,
      sourceUrl: disclosure.sourceUrl,
      rawRecord: disclosure,
      extractionStatus: "PENDING",
      parserVersion: "ingestion-normalizer-1.0.0",
      note: "Disclosure metadata normalized before parsing"
    }),
    raw: disclosure
  }));

  return {
    politicians,
    bills,
    statements,
    votes,
    donorContributions,
    financialDisclosures
  };
}

export function buildDatabaseReadyBatch(payload: NormalizedPayload): DatabaseReadyBatch {
  const stripRaw = <T extends { raw: unknown }>(record: T): Omit<T, "raw"> => {
    const { raw, ...rest } = record;
    void raw;
    return rest;
  };

  return {
    politicians: payload.politicians.map(stripRaw),
    bills: payload.bills.map(stripRaw),
    statements: payload.statements.map(stripRaw),
    votes: payload.votes.map(stripRaw),
    donorContributions: payload.donorContributions.map(stripRaw),
    financialDisclosures: payload.financialDisclosures.map(stripRaw)
  };
}
