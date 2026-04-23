import { sourcePriority } from "@/lib/scrapers/source-priority";
import type { CivicDataProvider, FetchWindow, ProviderResult, RawPoliticianRecord } from "@/lib/scrapers/types";
import { emptyPayload, fetchJson, limitRecords, normalizeName, parseParty, slugify } from "@/lib/scrapers/utils";

interface GoogleCivicResponse {
  offices?: Array<{
    name?: string;
    divisionId?: string;
    officialIndices?: number[];
  }>;
  officials?: Array<{
    name?: string;
    party?: string;
    urls?: string[];
  }>;
}

export class GoogleCivicConnector implements CivicDataProvider {
  readonly id = "google-civic-api";
  readonly source = "google_civic" as const;
  readonly priority = sourcePriority(this.source);
  readonly trustTier = "OFFICIAL_AGGREGATOR" as const;

  constructor(private readonly apiKey = process.env.GOOGLE_CIVIC_API_KEY) {}

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
        note: "GOOGLE_CIVIC_API_KEY is not configured. Skipping Google Civic local/state/national officeholder ingestion.",
        payload: emptyPayload()
      };
    }

    const address = window.address ?? process.env.CIVICWATCH_DEFAULT_ADDRESS;
    if (!address) {
      return {
        providerId: this.id,
        source: this.source,
        priority: this.priority,
        trustTier: this.trustTier,
        fetchedAt,
        status: "partial",
        note: "Google Civic requires an address. Set CIVICWATCH_DEFAULT_ADDRESS or pass window.address.",
        payload: emptyPayload()
      };
    }

    try {
      const params = new URLSearchParams();
      params.set("address", address);
      params.set("key", this.apiKey as string);

      const url = `https://www.googleapis.com/civicinfo/v2/representatives?${params.toString()}`;
      const response = await fetchJson<GoogleCivicResponse>(url);
      const query = normalizeName(window.query ?? "");

      const politicians: RawPoliticianRecord[] = [];
      for (const office of response.offices ?? []) {
        for (const index of office.officialIndices ?? []) {
          const official = response.officials?.[index];
          if (!official?.name || !office.name) {
            continue;
          }

          const division = parseDivisionId(office.divisionId);
          const normalized = normalizeName(official.name);
          if (query && !`${normalized} ${normalizeName(office.name)} ${normalizeName(division.state ?? "")}`.includes(query)) {
            continue;
          }

          const sourceRecordId = slugify(`${official.name}-${office.name}-${office.divisionId ?? "division"}`);
          politicians.push({
            source: this.source,
            sourceRecordId,
            fullName: official.name,
            normalizedFullName: normalized,
            party: parseParty(official.party),
            officeTitle: office.name,
            chamber: division.chamber,
            jurisdictionLevel: division.jurisdictionLevel,
            jurisdictionState: division.state,
            city: division.city,
            county: division.county,
            districtLabel: division.districtLabel,
            candidateStatus: "OFFICEHOLDER",
            incumbentChallengerStatus: "INCUMBENT",
            officeSought: office.name,
            latestActivitySummary: `Google Civic officeholder listing for address: ${address}`,
            sourceUrl: official.urls?.[0],
            sourceLabel: "Google Civic Information API"
          });
        }
      }

      return {
        providerId: this.id,
        source: this.source,
        priority: this.priority,
        trustTier: this.trustTier,
        fetchedAt,
        status: "ok",
        note: `Fetched ${politicians.length} Google Civic officeholder records for configured address scope.`,
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
        note: `Google Civic fetch failed: ${error instanceof Error ? error.message : "unknown error"}`,
        payload: emptyPayload()
      };
    }
  }
}

function parseDivisionId(divisionId?: string): {
  jurisdictionLevel: "NATIONAL" | "STATE" | "LOCAL";
  state?: string;
  city?: string;
  county?: string;
  districtLabel?: string;
  chamber?: string;
} {
  if (!divisionId) {
    return { jurisdictionLevel: "LOCAL" };
  }

  const stateMatch = divisionId.match(/state:([a-z]{2})/i);
  const countyMatch = divisionId.match(/county:([a-z0-9_]+)/i);
  const cityMatch = divisionId.match(/place:([a-z0-9_]+)/i);
  const cdMatch = divisionId.match(/cd:([0-9]+)/i);
  const slduMatch = divisionId.match(/sldu:([a-z0-9_]+)/i);
  const sldlMatch = divisionId.match(/sldl:([a-z0-9_]+)/i);

  let jurisdictionLevel: "NATIONAL" | "STATE" | "LOCAL" = "LOCAL";
  if (cdMatch) {
    jurisdictionLevel = "NATIONAL";
  } else if (slduMatch || sldlMatch || stateMatch) {
    jurisdictionLevel = "STATE";
  }

  return {
    jurisdictionLevel,
    state: stateMatch?.[1]?.toUpperCase(),
    city: cityMatch?.[1]?.replaceAll("_", " "),
    county: countyMatch?.[1]?.replaceAll("_", " "),
    districtLabel: cdMatch?.[1] ?? slduMatch?.[1] ?? sldlMatch?.[1],
    chamber: slduMatch ? "State Senate" : sldlMatch ? "State House" : undefined
  };
}
