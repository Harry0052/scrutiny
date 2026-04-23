import { createSourceConnectors } from "@/lib/scrapers";
import type { FetchWindow, RawPoliticianRecord } from "@/lib/scrapers/types";
import { normalizeName, slugify } from "@/lib/scrapers/utils";
import { parsePeopleQuery } from "@/lib/services/search/query-intent";
import type { PeopleSearchResult } from "@/lib/services/search/types";

const POLITICAL_OFFICE_KEYWORDS = [
  "senator",
  "representative",
  "house",
  "congress",
  "governor",
  "attorney general",
  "secretary of state",
  "mayor",
  "city council",
  "school board",
  "county",
  "supervisor",
  "commissioner",
  "sheriff",
  "district attorney",
  "assembly",
  "state senate",
  "state house",
  "president",
  "candidate"
] as const;

interface LiveSearchInput {
  query: string;
  limit?: number;
  stateCode?: string;
  address?: string;
}

interface LiveSearchResult {
  results: PeopleSearchResult[];
  providerNotes: string[];
}

interface ScoredCandidate {
  result: PeopleSearchResult;
  queryScore: number;
  politicalScore: number;
  finalScore: number;
}

export async function searchPeopleFromLiveProviders(input: LiveSearchInput): Promise<LiveSearchResult> {
  const parsedQuery = parsePeopleQuery(input.query);
  if (!parsedQuery.normalized) {
    return { results: [], providerNotes: [] };
  }

  const window: FetchWindow = {
    query: parsedQuery.raw,
    stateCode: input.stateCode,
    address: input.address,
    maxRecords: Math.min(Math.max((input.limit ?? 20) * 4, 20), 120)
  };

  const providers = createSourceConnectors();
  const providerResults = await Promise.all(providers.map((provider) => provider.fetch(window)));
  const providerNotes = providerResults.map((result) => `${result.providerId}: ${result.note}`);

  const candidates = providerResults.flatMap((providerResult) =>
    providerResult.payload.politicians.map((record) => ({ record, providerResult }))
  );

  const deduped = dedupeCandidates(
    candidates.map(({ record, providerResult }) => ({
      ...record,
      __sourcePriority: providerResult.priority
    }))
  );

  const scored = deduped
    .map<ScoredCandidate>((record) => {
      const mapped = mapToSearchResult(record);
      mapped.relevanceReason = buildQueryReason(mapped, parsedQuery) ?? mapped.relevanceReason;
      const queryScore = computeQueryScore(mapped, parsedQuery);
      const politicalScore = computePoliticalScore(mapped, record.__sourcePriority, parsedQuery);
      return {
        result: mapped,
        queryScore,
        politicalScore,
        finalScore: queryScore * 0.72 + politicalScore * 0.58
      };
    })
    .filter((row) => row.queryScore >= 14 && row.politicalScore >= 24 && matchesIntentConstraints(row.result, parsedQuery))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, Math.min(Math.max(input.limit ?? 20, 1), 100))
    .map((row) => ({
      ...row.result,
      relevanceScore: row.finalScore,
      politicalRelevanceScore: row.politicalScore
    }));

  return {
    results: scored,
    providerNotes
  };
}

function dedupeCandidates(
  records: Array<RawPoliticianRecord & { __sourcePriority: number }>
): Array<RawPoliticianRecord & { __sourcePriority: number }> {
  const byKey = new Map<string, RawPoliticianRecord & { __sourcePriority: number }>();
  for (const record of records) {
    const key = [
      normalizeName(record.fullName),
      record.jurisdictionState?.toUpperCase() ?? "",
      normalizeName(record.officeSought ?? record.officeTitle),
      normalizeName(record.districtLabel ?? "")
    ].join("|");

    const existing = byKey.get(key);
    if (!existing || record.__sourcePriority > existing.__sourcePriority) {
      byKey.set(key, record);
    }
  }
  return Array.from(byKey.values());
}

function mapToSearchResult(record: RawPoliticianRecord & { __sourcePriority: number }): PeopleSearchResult {
  const slug = slugify(
    `${record.fullName}-${record.jurisdictionLevel}-${record.jurisdictionState ?? ""}-${record.officeSought ?? record.officeTitle}-${
      record.districtLabel ?? ""
    }`
  );

  const relevanceReason =
    record.candidateStatus === "OFFICEHOLDER"
      ? "official officeholder directory evidence"
      : record.candidateStatus === "CANDIDATE"
        ? "candidate filing evidence"
        : "former officeholder evidence";

  return {
    id: `live:${record.source}:${record.sourceRecordId}`,
    politicianId: `live:${record.source}:${record.sourceRecordId}`,
    slug: slug || `live-${record.sourceRecordId.toLowerCase()}`,
    fullName: record.fullName,
    officeDisplay: record.officeSought ?? record.officeTitle,
    officeHeld: record.officeTitle,
    officeSought: record.officeSought ?? null,
    jurisdictionLevel: record.jurisdictionLevel,
    city: record.city ?? null,
    county: record.county ?? null,
    state: record.jurisdictionState ?? null,
    district: record.districtLabel ?? null,
    chamber: record.chamber ?? null,
    party: record.party ?? null,
    candidateStatus: record.candidateStatus,
    incumbentChallengerStatus: record.incumbentChallengerStatus ?? "UNKNOWN",
    electionYear: record.electionYear ?? null,
    issueTags: record.issueFocusTags ?? [],
    honestyScore: null,
    donorVolumeUsd: 0,
    recentVotesCount: 0,
    latestDisclosureYear: null,
    latestActivityAt: record.latestActivityAt ?? null,
    latestActivitySummary: record.latestActivitySummary ?? null,
    relevanceScore: 0,
    politicalRelevanceScore: 0,
    relevanceReason
  };
}

function computeQueryScore(result: PeopleSearchResult, query: ReturnType<typeof parsePeopleQuery>): number {
  const normalizedQuery = query.normalized;
  if (!normalizedQuery) {
    return 0;
  }

  const tokens = query.tokens;
  const fullName = normalizeName(result.fullName);
  const office = normalizeName(result.officeDisplay);
  const location = normalizeName([result.city ?? "", result.county ?? "", result.state ?? "", result.district ?? ""].join(" "));
  const combined = `${fullName} ${office} ${location}`.trim();
  let score = 0;

  if (fullName === normalizedQuery) {
    score += 140;
  }
  if (fullName.startsWith(normalizedQuery)) {
    score += 64;
  }
  if (combined.includes(normalizedQuery)) {
    score += 44;
  }

  const tokenMatches = tokens.filter((token) => combined.includes(token)).length;
  if (tokenMatches > 0) {
    score += tokenMatches * 16;
  }
  if (tokens.length > 0 && tokens.every((token) => combined.includes(token))) {
    score += 20;
  }

  if (
    query.nameHints.length > 0 &&
    query.nameHints.every((token) => fullName.includes(token))
  ) {
    score += 52;
  }

  if (query.officeHints.length > 0) {
    const officeMatches = query.officeHints.filter((hint) => office.includes(hint)).length;
    score += officeMatches * 28;
  }

  if (query.stateHints.length > 0 && result.state && query.stateHints.includes(result.state.toUpperCase())) {
    score += 38;
  }

  if (query.districtHints.length > 0 && result.district) {
    const normalizedDistrict = normalizeName(result.district);
    if (query.districtHints.some((hint) => normalizedDistrict.includes(hint.toLowerCase()))) {
      score += 36;
    }
  }

  if (query.locationHints.length > 0) {
    score += query.locationHints.filter((token) => location.includes(token)).length * 12;
  }

  return score;
}

function buildQueryReason(
  result: PeopleSearchResult,
  query: ReturnType<typeof parsePeopleQuery>
): string | undefined {
  const fullName = normalizeName(result.fullName);
  const office = normalizeName(result.officeDisplay);
  const location = normalizeName([result.city ?? "", result.county ?? "", result.state ?? "", result.district ?? ""].join(" "));

  if (query.nameHints.length > 0 && query.nameHints.every((token) => fullName.includes(token))) {
    return "name match";
  }
  if (query.officeHints.some((hint) => office.includes(hint))) {
    return "office match";
  }
  if (query.stateHints.length > 0 && result.state && query.stateHints.includes(result.state.toUpperCase())) {
    return "state match";
  }
  if (query.locationHints.some((token) => location.includes(token))) {
    return "location match";
  }
  if (query.districtHints.length > 0 && result.district) {
    const normalizedDistrict = normalizeName(result.district);
    if (query.districtHints.some((hint) => normalizedDistrict.includes(hint.toLowerCase()))) {
      return "district match";
    }
  }
  return undefined;
}

function matchesIntentConstraints(
  result: PeopleSearchResult,
  query: ReturnType<typeof parsePeopleQuery>
): boolean {
  if (!query.normalized) {
    return true;
  }

  const fullName = normalizeName(result.fullName);
  const office = normalizeName(`${result.officeDisplay} ${result.chamber ?? ""}`);
  const state = (result.state ?? "").toUpperCase();
  const location = normalizeName([result.city ?? "", result.county ?? "", result.state ?? "", result.district ?? ""].join(" "));
  const district = normalizeName(result.district ?? "");

  if (query.nameHints.length > 0 && !query.nameHints.every((token) => fullName.includes(token))) {
    return false;
  }
  if (query.officeHints.length > 0 && !query.officeHints.some((hint) => office.includes(hint))) {
    return false;
  }
  if (query.stateHints.length > 0 && !query.stateHints.includes(state)) {
    return false;
  }
  if (query.districtHints.length > 0 && !query.districtHints.some((hint) => district.includes(hint.toLowerCase()))) {
    return false;
  }
  if (query.locationHints.length > 0 && query.nameHints.length > 0 && !query.locationHints.some((hint) => location.includes(hint))) {
    return false;
  }

  return true;
}

function computePoliticalScore(
  result: PeopleSearchResult,
  sourcePriorityScore: number,
  query: ReturnType<typeof parsePeopleQuery>
): number {
  let score = 0;
  if (result.candidateStatus === "OFFICEHOLDER") {
    score += 40;
  } else if (result.candidateStatus === "CANDIDATE") {
    score += 36;
  } else {
    score += 28;
  }

  if (POLITICAL_OFFICE_KEYWORDS.some((keyword) => result.officeDisplay.toLowerCase().includes(keyword))) {
    score += 20;
  }

  if (result.state || result.city || result.county || result.district) {
    score += 8;
  }

  if (result.electionYear) {
    score += 10;
  }

  score += Math.min(24, Math.round(sourcePriorityScore / 4));
  if (sourcePriorityScore >= 95) {
    score += 10;
  }

  if (query.statusHints.length > 0) {
    if (query.statusHints.includes(result.candidateStatus)) {
      score += 20;
    } else {
      score -= 10;
    }
  }

  if (query.jurisdictionHints.length > 0) {
    if (query.jurisdictionHints.includes(result.jurisdictionLevel)) {
      score += 16;
    } else {
      score -= 8;
    }
  }

  return score;
}
