import { sourcePriority } from "@/lib/scrapers/source-priority";
import type { CivicDataProvider, FetchWindow, ProviderResult, RawPoliticianRecord } from "@/lib/scrapers/types";
import { emptyPayload, fetchJson, limitRecords, normalizeName, parseParty } from "@/lib/scrapers/utils";

interface OpenSecretsResponse {
  response?: {
    legislators?: {
      legislator?:
        | Array<{ "@attributes"?: Record<string, string> }>
        | { "@attributes"?: Record<string, string> };
    };
  };
}

export class OpenSecretsConnector implements CivicDataProvider {
  readonly id = "opensecrets-api";
  readonly source = "opensecrets" as const;
  readonly priority = sourcePriority(this.source);
  readonly trustTier = "PUBLIC_AGGREGATOR" as const;

  constructor(private readonly apiKey = process.env.OPENSECRETS_API_KEY) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && !this.apiKey.startsWith("replace-with"));
  }

  async fetch(window: FetchWindow = {}): Promise<ProviderResult> {
    const fetchedAt = new Date().toISOString();

    if (!this.isConfigured()) {
      return {
        providerId: this.id,
        source: this.source,
        priority: this.priority,
        trustTier: this.trustTier,
        fetchedAt,
        status: "unconfigured",
        note: "OPENSECRETS_API_KEY is not configured. Skipping OpenSecrets connector.",
        payload: emptyPayload()
      };
    }

    try {
      const state = (window.stateCode ?? "NY").toUpperCase();
      const params = new URLSearchParams();
      params.set("method", "getLegislators");
      params.set("id", state);
      params.set("apikey", this.apiKey as string);
      params.set("output", "json");

      const url = `https://www.opensecrets.org/api/?${params.toString()}`;
      const response = await fetchJson<OpenSecretsResponse>(url);

      const legislatorsRaw = response.response?.legislators?.legislator;
      const legislators = Array.isArray(legislatorsRaw)
        ? legislatorsRaw
        : legislatorsRaw
          ? [legislatorsRaw]
          : [];

      const query = normalizeName(window.query ?? "");
      const politicians = legislators
        .map((entry): RawPoliticianRecord | null => {
          const attributes = entry["@attributes"] ?? {};
          const name = attributes.firstlast;
          const cid = attributes.cid;

          if (!name || !cid) {
            return null;
          }

          const normalized = normalizeName(name);
          if (query && !normalized.includes(query)) {
            return null;
          }

          const office = attributes.office?.toLowerCase().includes("sen") ? "U.S. Senator" : "U.S. House Representative";

          return {
            source: this.source,
            sourceRecordId: cid,
            fullName: name,
            normalizedFullName: normalized,
            party: parseParty(attributes.party),
            officeTitle: office,
            chamber: office.includes("Senator") ? "Senate" : "House",
            jurisdictionLevel: "NATIONAL",
            jurisdictionState: attributes.state,
            districtLabel: attributes.district ? `${attributes.state ?? "US"}-${attributes.district}` : undefined,
            candidateStatus: "OFFICEHOLDER",
            incumbentChallengerStatus: "UNKNOWN",
            officeSought: office,
            latestActivitySummary: "OpenSecrets legislator listing.",
            sourceUrl: `https://www.opensecrets.org/members-of-congress/${cid}/summary`,
            sourceLabel: "OpenSecrets API"
          };
        })
        .filter((record): record is RawPoliticianRecord => Boolean(record));

      return {
        providerId: this.id,
        source: this.source,
        priority: this.priority,
        trustTier: this.trustTier,
        fetchedAt,
        status: "ok",
        note: `Fetched ${politicians.length} OpenSecrets legislator records for state ${state}.`,
        payload: {
          ...emptyPayload(),
          politicians: limitRecords(politicians, window.maxRecords)
        }
      };
    } catch (error) {
      return {
        providerId: this.id,
        source: this.source,
        priority: this.priority,
        trustTier: this.trustTier,
        fetchedAt,
        status: "error",
        note: `OpenSecrets fetch failed: ${error instanceof Error ? error.message : "unknown error"}`,
        payload: emptyPayload()
      };
    }
  }
}
