import { sourcePriority } from "@/lib/scrapers/source-priority";
import type {
  CivicDataProvider,
  FetchWindow,
  ProviderResult,
  RawBillRecord,
  RawPoliticianRecord
} from "@/lib/scrapers/types";
import { coerceDate, emptyPayload, fetchJson, limitRecords, normalizeName, parseParty } from "@/lib/scrapers/utils";

interface ProPublicaMembersResponse {
  results?: Array<{
    congress?: string;
    chamber?: string;
    members?: Array<{
      id?: string;
      first_name?: string;
      middle_name?: string;
      last_name?: string;
      party?: string;
      state?: string;
      district?: string;
      title?: string;
      url?: string;
      next_election?: string;
      in_office?: boolean;
    }>;
  }>;
}

interface ProPublicaBillsResponse {
  results?: Array<{
    num_results?: number;
    bills?: Array<{
      bill_id?: string;
      short_title?: string;
      title?: string;
      summary?: string;
      latest_major_action_date?: string;
      introduced_date?: string;
      congressdotgov_url?: string;
    }>;
  }>;
}

export class ProPublicaConnector implements CivicDataProvider {
  readonly id = "propublica-congress-api";
  readonly source = "propublica" as const;
  readonly priority = sourcePriority(this.source);
  readonly trustTier = "OFFICIAL_AGGREGATOR" as const;

  constructor(private readonly apiKey = process.env.PROPUBLICA_API_KEY) {}

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
        note: "PROPUBLICA_API_KEY is not configured. Skipping ProPublica Congress ingestion.",
        payload: emptyPayload()
      };
    }

    const congress = process.env.PROPUBLICA_CONGRESS_SESSION?.trim() || "119";
    const headers = { "X-API-Key": this.apiKey as string };
    const query = normalizeName(window.query ?? "");

    try {
      const [houseMembers, senateMembers, houseBills, senateBills] = await Promise.allSettled([
        fetchJson<ProPublicaMembersResponse>(
          `https://api.propublica.org/congress/v1/${congress}/house/members.json`,
          { headers }
        ),
        fetchJson<ProPublicaMembersResponse>(
          `https://api.propublica.org/congress/v1/${congress}/senate/members.json`,
          { headers }
        ),
        fetchJson<ProPublicaBillsResponse>(
          `https://api.propublica.org/congress/v1/${congress}/house/bills/introduced.json`,
          { headers }
        ),
        fetchJson<ProPublicaBillsResponse>(
          `https://api.propublica.org/congress/v1/${congress}/senate/bills/introduced.json`,
          { headers }
        )
      ]);

      const politicians: RawPoliticianRecord[] = [];
      const bills: RawBillRecord[] = [];

      for (const response of [houseMembers, senateMembers]) {
        if (response.status !== "fulfilled") {
          continue;
        }

        const chamber = response.value.results?.[0]?.chamber?.toUpperCase() ?? "";
        for (const member of response.value.results?.[0]?.members ?? []) {
          const id = member.id;
          const fullName = [member.first_name, member.middle_name, member.last_name]
            .filter(Boolean)
            .join(" ")
            .trim();

          if (!id || !fullName) {
            continue;
          }

          const normalized = normalizeName(fullName);
          if (query && !`${normalized} ${normalizeName(member.state ?? "")}`.includes(query)) {
            continue;
          }

          politicians.push({
            source: this.source,
            sourceRecordId: id,
            fullName,
            normalizedFullName: normalized,
            party: parseParty(member.party),
            officeTitle: chamber === "HOUSE" ? "U.S. House Representative" : "U.S. Senator",
            chamber: chamber === "HOUSE" ? "House" : "Senate",
            jurisdictionLevel: "NATIONAL",
            jurisdictionState: member.state,
            districtLabel: chamber === "HOUSE" ? `${member.state ?? "US"}-${member.district ?? "At-Large"}` : `${member.state ?? "US"}-At-Large`,
            candidateStatus: member.in_office === false ? "FORMER_OFFICEHOLDER" : "OFFICEHOLDER",
            incumbentChallengerStatus: member.in_office === false ? "UNKNOWN" : "INCUMBENT",
            officeSought: chamber === "HOUSE" ? "U.S. House" : "U.S. Senate",
            electionYear: member.next_election ? Number(member.next_election) : undefined,
            latestActivitySummary: "ProPublica Congress API member profile.",
            sourceUrl: member.url,
            sourceLabel: "ProPublica Congress API"
          });
        }
      }

      for (const [response, chamber] of [
        [houseBills, "House"],
        [senateBills, "Senate"]
      ] as const) {
        if (response.status !== "fulfilled") {
          continue;
        }

        for (const bill of response.value.results?.[0]?.bills ?? []) {
          if (!bill.bill_id || !(bill.title ?? bill.short_title)) {
            continue;
          }

          bills.push({
            source: this.source,
            sourceRecordId: bill.bill_id,
            billCode: bill.bill_id.toUpperCase(),
            title: bill.short_title ?? bill.title ?? bill.bill_id,
            summary: bill.summary ?? bill.title ?? bill.bill_id,
            issueTags: inferIssueTags(`${bill.title ?? ""} ${bill.summary ?? ""}`),
            jurisdictionLevel: "NATIONAL",
            chamber,
            introducedAt: coerceDate(bill.introduced_date),
            latestActionAt: coerceDate(bill.latest_major_action_date),
            sourceUrl: bill.congressdotgov_url
          });
        }
      }

      const status: ProviderResult["status"] =
        houseMembers.status === "fulfilled" || senateMembers.status === "fulfilled" ? "ok" : "partial";

      return {
        providerId: this.id,
        source: this.source,
        priority: this.priority,
        trustTier: this.trustTier,
        fetchedAt,
        status,
        note: `Fetched ${politicians.length} members and ${bills.length} bills from ProPublica Congress API for Congress ${congress}.`,
        payload: {
          ...emptyPayload(),
          politicians: limitRecords(politicians, window.maxRecords),
          bills: limitRecords(bills, Math.min(window.maxRecords ?? 40, 40))
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
        note: `ProPublica fetch failed: ${error instanceof Error ? error.message : "unknown error"}`,
        payload: emptyPayload()
      };
    }
  }
}

function inferIssueTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];

  const keywords: Array<[string, string]> = [
    ["health", "healthcare"],
    ["climate", "climate"],
    ["energy", "energy"],
    ["tax", "tax"],
    ["education", "education"],
    ["housing", "housing"],
    ["immigration", "immigration"],
    ["defense", "defense"],
    ["veteran", "veterans"],
    ["privacy", "privacy"]
  ];

  for (const [needle, tag] of keywords) {
    if (lower.includes(needle)) {
      tags.push(tag);
    }
  }

  return tags.length > 0 ? tags : ["general_legislation"];
}
