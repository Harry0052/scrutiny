import { sourcePriority } from "@/lib/scrapers/source-priority";
import type { CivicDataProvider, FetchWindow, ProviderResult, RawPoliticianRecord } from "@/lib/scrapers/types";
import { emptyPayload, fetchJson, limitRecords, normalizeName, parseParty } from "@/lib/scrapers/utils";

interface OpenStatesPeopleResponse {
  results?: Array<{
    id?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    party?: Array<{ name?: string }>;
    current_role?: {
      title?: string;
      org_classification?: string;
      district?: string;
      jurisdiction?: string;
    };
    links?: Array<{ url?: string }>;
  }>;
}

export class StateLocalConnector implements CivicDataProvider {
  readonly id = "openstates-api";
  readonly source = "openstates" as const;
  readonly priority = sourcePriority(this.source);
  readonly trustTier = "OFFICIAL_AGGREGATOR" as const;

  constructor(private readonly apiKey = process.env.OPENSTATES_API_KEY) {}

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
        note: "OPENSTATES_API_KEY is not configured. Skipping OpenStates ingestion.",
        payload: emptyPayload()
      };
    }

    try {
      const params = new URLSearchParams();
      params.set("per_page", String(Math.min(Math.max(window.maxRecords ?? 20, 5), 50)));

      if (window.query) {
        params.set("q", window.query);
        params.set("name", window.query);
      }

      if (window.stateCode) {
        params.set("jurisdiction", `ocd-jurisdiction/country:us/state:${window.stateCode.toLowerCase()}/government`);
      }

      const url = `https://v3.openstates.org/people?${params.toString()}`;
      const response = await fetchJson<OpenStatesPeopleResponse>(url, {
        headers: { "X-API-KEY": this.apiKey as string }
      });

      const politicians = (response.results ?? [])
        .map((person): RawPoliticianRecord | null => {
          const personId = person.id;
          const name = person.name ?? [person.given_name, person.family_name].filter(Boolean).join(" ").trim();
          if (!personId || !name) {
            return null;
          }

          const stateMatch = person.current_role?.jurisdiction?.match(/state:([a-z]{2})/i);
          const stateCode = stateMatch?.[1]?.toUpperCase();
          const officeTitle =
            person.current_role?.title ??
            (person.current_role?.org_classification
              ? `State ${person.current_role.org_classification.replaceAll("_", " ")}`
              : "State Legislator");

          return {
            source: this.source,
            sourceRecordId: personId,
            fullName: name,
            normalizedFullName: normalizeName(name),
            party: parseParty(person.party?.[0]?.name),
            officeTitle,
            chamber: person.current_role?.org_classification?.replaceAll("_", " "),
            jurisdictionLevel: "STATE",
            jurisdictionState: stateCode,
            districtLabel: person.current_role?.district,
            candidateStatus: "OFFICEHOLDER",
            incumbentChallengerStatus: "INCUMBENT",
            officeSought: officeTitle,
            latestActivitySummary: "OpenStates person record.",
            sourceUrl: person.links?.[0]?.url,
            sourceLabel: "OpenStates API"
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
        note: `Fetched ${politicians.length} OpenStates records.`,
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
        note: `OpenStates fetch failed: ${error instanceof Error ? error.message : "unknown error"}`,
        payload: emptyPayload()
      };
    }
  }
}
