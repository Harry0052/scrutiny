import { sourcePriority } from "@/lib/scrapers/source-priority";
import type {
  CivicDataProvider,
  FetchWindow,
  ProviderResult,
  RawDonorContributionRecord,
  RawPoliticianRecord
} from "@/lib/scrapers/types";
import { emptyPayload, fetchJson, limitRecords, normalizeName, parseParty } from "@/lib/scrapers/utils";

const FEC_PUBLIC_DEMO_KEY = "DEMO_KEY";

interface FecCandidateSearchResponse {
  results?: Array<{
    candidate_id?: string;
    name?: string;
    party_full?: string;
    office?: string;
    office_full?: string;
    state?: string;
    district?: string;
    incumbent_challenge_full?: string;
    election_years?: number[];
    has_raised_funds?: boolean;
    candidate_inactive?: boolean;
    active_through?: number;
    cycles?: number[];
  }>;
}

interface FecScheduleAResponse {
  results?: Array<{
    sub_id?: string;
    contributor_name?: string;
    contributor_type?: string;
    committee_name?: string;
    contribution_receipt_amount?: number;
    contribution_receipt_date?: string;
    two_year_transaction_period?: number;
    receipt_type_desc?: string;
  }>;
}

export class FecConnector implements CivicDataProvider {
  readonly id = "fec-official-api";
  readonly source = "fec" as const;
  readonly priority = sourcePriority(this.source);
  readonly trustTier = "OFFICIAL" as const;

  constructor(private readonly configuredApiKey = process.env.FEC_API_KEY) {}

  isConfigured(): boolean {
    return true;
  }

  async fetch(window: FetchWindow = {}): Promise<ProviderResult> {
    const fetchedAt = new Date().toISOString();
    const apiKey = resolveFecApiKey(this.configuredApiKey);
    const usingDemoKey = apiKey === FEC_PUBLIC_DEMO_KEY;

    const query = window.query?.trim();
    if (!query && !window.stateCode) {
      return {
        providerId: this.id,
        source: this.source,
        priority: this.priority,
        trustTier: this.trustTier,
        fetchedAt,
        status: "partial",
        note: "FEC provider requires a query or stateCode to retrieve candidate records cost-efficiently.",
        payload: emptyPayload()
      };
    }

    try {
      const params = new URLSearchParams();
      if (query) {
        params.set("q", query);
      }
      if (window.stateCode) {
        params.set("state", window.stateCode.toUpperCase());
      }
      params.set("per_page", String(Math.min(Math.max(window.maxRecords ?? 15, 5), 30)));
      params.set("sort", "name");
      params.set("api_key", apiKey);

      const searchUrl = `https://api.open.fec.gov/v1/candidates/search/?${params.toString()}`;
      const candidateResponse = await fetchJson<FecCandidateSearchResponse>(searchUrl);
      const candidates = candidateResponse.results ?? [];

      const politicians = candidates
        .map((candidate): RawPoliticianRecord | null => {
          const candidateId = candidate.candidate_id;
          const name = candidate.name;
          if (!candidateId || !name) {
            return null;
          }

          if (!isMeaningfulFecCandidate(candidate)) {
            return null;
          }

          const parsedName = parseFecName(name);
          const officeCode = (candidate.office ?? "").toUpperCase();

          return {
            source: this.source,
            sourceRecordId: candidateId,
            fullName: parsedName,
            normalizedFullName: normalizeName(parsedName),
            party: parseParty(candidate.party_full),
            officeTitle: mapOfficeTitle(officeCode, candidate.office_full),
            chamber: mapChamber(officeCode),
            jurisdictionLevel: "NATIONAL",
            jurisdictionState: candidate.state ?? undefined,
            districtLabel: candidate.district ? `${candidate.state ?? "US"}-${candidate.district}` : undefined,
            candidateStatus: "CANDIDATE",
            incumbentChallengerStatus: mapIncumbentStatus(candidate.incumbent_challenge_full),
            officeSought: candidate.office_full ?? mapOfficeTitle(officeCode, candidate.office_full),
            electionYear: latestElectionYear(candidate.election_years, candidate.cycles, candidate.active_through),
            latestActivitySummary: "FEC candidate filing record.",
            sourceUrl: `https://www.fec.gov/data/candidate/${candidateId}/`,
            sourceLabel: "FEC Candidate Search API"
          };
        })
        .filter((record): record is RawPoliticianRecord => Boolean(record));

      const donorContributions: RawDonorContributionRecord[] = [];
      const candidatesForContributions = limitRecords(candidates, Math.min(5, politicians.length));
      const contributionFetchErrors: string[] = [];

      for (const candidate of candidatesForContributions) {
        if (!candidate.candidate_id) {
          continue;
        }

        const contributionParams = new URLSearchParams();
        contributionParams.set("candidate_id", candidate.candidate_id);
        contributionParams.set("per_page", "10");
        contributionParams.set("sort", "-contribution_receipt_date");
        contributionParams.set("api_key", apiKey);

        try {
          const contributionUrl = `https://api.open.fec.gov/v1/schedules/schedule_a/?${contributionParams.toString()}`;
          const contributionResponse = await fetchJson<FecScheduleAResponse>(contributionUrl);

          for (const contribution of contributionResponse.results ?? []) {
            if (!contribution.contributor_name || typeof contribution.contribution_receipt_amount !== "number") {
              continue;
            }

            donorContributions.push({
              source: this.source,
              sourceRecordId:
                contribution.sub_id ?? `${candidate.candidate_id}-${contribution.contributor_name}-${contribution.contribution_receipt_date ?? "unknown"}`,
              donorExternalId: `${candidate.candidate_id}:${normalizeName(contribution.contributor_name)}`,
              donorName: contribution.contributor_name,
              donorType: mapFecDonorType(contribution.contributor_type),
              sector: contribution.committee_name ? "committee" : undefined,
              politicianExternalId: `fec:${candidate.candidate_id}`,
              amountUsd: contribution.contribution_receipt_amount,
              electionCycle: String(contribution.two_year_transaction_period ?? window.electionYear ?? new Date().getFullYear()),
              contributionDate: contribution.contribution_receipt_date ?? fetchedAt,
              contributionType: contribution.receipt_type_desc,
              sourceUrl: "https://api.open.fec.gov/developers/"
            });
          }
        } catch (error) {
          contributionFetchErrors.push(
            `${candidate.candidate_id}: ${error instanceof Error ? error.message : "unknown contribution fetch error"}`
          );
        }
      }

      const status: ProviderResult["status"] = contributionFetchErrors.length > 0 ? "partial" : "ok";
      const contributionErrorSuffix =
        contributionFetchErrors.length > 0
          ? ` Contribution fetch skipped for ${contributionFetchErrors.length} candidate(s).`
          : "";

      return {
        providerId: this.id,
        source: this.source,
        priority: this.priority,
        trustTier: this.trustTier,
        fetchedAt,
        status,
        note: usingDemoKey
          ? `Fetched ${politicians.length} FEC candidate records and ${donorContributions.length} contribution records using public DEMO_KEY.${contributionErrorSuffix}`
          : `Fetched ${politicians.length} FEC candidate records and ${donorContributions.length} contribution records.${contributionErrorSuffix}`,
        payload: {
          ...emptyPayload(),
          politicians,
          donorContributions
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
        note: usingDemoKey
          ? `FEC API fetch failed with DEMO_KEY: ${error instanceof Error ? error.message : "unknown error"}`
          : `FEC API fetch failed: ${error instanceof Error ? error.message : "unknown error"}`,
        payload: emptyPayload()
      };
    }
  }
}

function resolveFecApiKey(input?: string): string {
  const trimmed = input?.trim();
  if (!trimmed || trimmed.startsWith("replace-with")) {
    return FEC_PUBLIC_DEMO_KEY;
  }
  return trimmed;
}

function parseFecName(name: string): string {
  if (!name.includes(",")) {
    return name.trim();
  }

  const [last, first] = name.split(",");
  return `${first?.trim() ?? ""} ${last.trim()}`.trim();
}

function mapOfficeTitle(officeCode: string, officeFull?: string): string {
  if (officeFull) {
    return officeFull;
  }

  if (officeCode === "P") {
    return "President of the United States";
  }
  if (officeCode === "S") {
    return "U.S. Senate Candidate";
  }
  if (officeCode === "H") {
    return "U.S. House Candidate";
  }

  return "Federal Candidate";
}

function mapChamber(officeCode: string): string | undefined {
  if (officeCode === "S") {
    return "Senate";
  }
  if (officeCode === "H") {
    return "House";
  }
  return undefined;
}

function mapIncumbentStatus(value?: string): "INCUMBENT" | "CHALLENGER" | "OPEN_SEAT" | "UNKNOWN" {
  const normalized = value?.toLowerCase().trim();
  if (!normalized) {
    return "UNKNOWN";
  }
  if (normalized.includes("incumbent")) {
    return "INCUMBENT";
  }
  if (normalized.includes("challenger")) {
    return "CHALLENGER";
  }
  if (normalized.includes("open")) {
    return "OPEN_SEAT";
  }

  return "UNKNOWN";
}

function mapFecDonorType(value?: string): RawDonorContributionRecord["donorType"] {
  const normalized = value?.toUpperCase().trim();
  if (!normalized) {
    return "OTHER";
  }

  if (normalized.includes("INDIVIDUAL")) {
    return "INDIVIDUAL";
  }
  if (normalized.includes("COMMITTEE") || normalized.includes("PAC")) {
    return "PAC";
  }
  if (normalized.includes("ASSOCIATION")) {
    return "ASSOCIATION";
  }
  if (normalized.includes("NONPROFIT")) {
    return "NONPROFIT";
  }

  return "OTHER";
}

function isMeaningfulFecCandidate(candidate: {
  candidate_inactive?: boolean;
  has_raised_funds?: boolean;
  election_years?: number[];
  cycles?: number[];
  active_through?: number;
}): boolean {
  if (candidate.candidate_inactive === true) {
    return false;
  }

  // Filters out trivial/test filings that do not show campaign activity.
  if (candidate.has_raised_funds !== true) {
    return false;
  }

  const currentYear = new Date().getFullYear();
  const years = [...(candidate.election_years ?? []), ...(candidate.cycles ?? [])].filter(
    (value): value is number => typeof value === "number"
  );

  if (years.some((year) => year >= currentYear - 4)) {
    return true;
  }

  if (typeof candidate.active_through === "number" && candidate.active_through >= currentYear - 2) {
    return true;
  }

  return false;
}

function latestElectionYear(
  electionYears?: number[],
  cycles?: number[],
  activeThrough?: number
): number | undefined {
  const combined = [...(electionYears ?? []), ...(cycles ?? [])].filter(
    (value): value is number => typeof value === "number"
  );

  if (combined.length > 0) {
    return Math.max(...combined);
  }

  return typeof activeThrough === "number" ? activeThrough : undefined;
}
