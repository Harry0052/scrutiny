import { Prisma, PublicFigureStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeSearchText, parsePeopleQuery } from "@/lib/services/search/query-intent";
import type { PeopleSearchFilters, PeopleSearchResult, PeopleSuggestion } from "@/lib/services/search/types";

export type { PeopleSearchFilters, PeopleSearchResult, PeopleSuggestion } from "@/lib/services/search/types";

const POLITICAL_OFFICE_KEYWORDS = [
  "senator",
  "representative",
  "house",
  "congress",
  "governor",
  "lt governor",
  "lieutenant governor",
  "attorney general",
  "secretary of state",
  "treasurer",
  "comptroller",
  "auditor",
  "mayor",
  "city council",
  "council",
  "school board",
  "county",
  "supervisor",
  "commissioner",
  "sheriff",
  "district attorney",
  "state senate",
  "state assembly",
  "state house",
  "assembly",
  "legislator",
  "president",
  "campaign"
] as const;

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function scopeToJurisdiction(scope?: PeopleSearchFilters["scope"]) {
  if (!scope || scope === "all") {
    return undefined;
  }
  if (scope === "local") {
    return "LOCAL" as const;
  }
  if (scope === "state") {
    return "STATE" as const;
  }
  if (scope === "federal" || scope === "national") {
    return "NATIONAL" as const;
  }
  return undefined;
}

function statusToEnum(status?: PeopleSearchFilters["figureStatus"]) {
  if (!status || status === "all") {
    return undefined;
  }
  if (status === "OFFICEHOLDER") {
    return PublicFigureStatus.OFFICEHOLDER;
  }
  if (status === "CANDIDATE") {
    return PublicFigureStatus.CANDIDATE;
  }
  return PublicFigureStatus.FORMER_OFFICEHOLDER;
}

function statusHintToEnum(
  hints: Array<"CANDIDATE" | "OFFICEHOLDER" | "FORMER_OFFICEHOLDER">
): PublicFigureStatus | undefined {
  if (hints.includes("CANDIDATE")) {
    return PublicFigureStatus.CANDIDATE;
  }
  if (hints.includes("OFFICEHOLDER")) {
    return PublicFigureStatus.OFFICEHOLDER;
  }
  if (hints.includes("FORMER_OFFICEHOLDER")) {
    return PublicFigureStatus.FORMER_OFFICEHOLDER;
  }
  return undefined;
}

function requestedLimit(limit?: number): number {
  return Math.min(Math.max(limit ?? 24, 1), 100);
}

function parseIngestionMeta(value: Prisma.JsonValue | null): {
  sourceType?: string;
  sourcePriority?: number;
  trustType?: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const profile = value as Record<string, unknown>;
  const ingestion =
    profile.ingestion && typeof profile.ingestion === "object" && !Array.isArray(profile.ingestion)
      ? (profile.ingestion as Record<string, unknown>)
      : undefined;

  const sourceType = typeof ingestion?.sourceType === "string" ? ingestion.sourceType : undefined;
  const sourcePriority = typeof ingestion?.sourcePriority === "number" ? ingestion.sourcePriority : undefined;
  const trustType = typeof ingestion?.trustType === "string" ? ingestion.trustType : undefined;

  return { sourceType, sourcePriority, trustType };
}

function computeQueryScore(
  document: {
    fullName: string;
    normalizedFullName: string;
    aliases: string[];
    officeDisplay: string;
    city: string | null;
    county: string | null;
    jurisdictionState: string | null;
    districtLabel: string | null;
    chamber: string | null;
    party: string | null;
    searchBlob: string;
  },
  query: ReturnType<typeof parsePeopleQuery>
): number {
  if (!query.normalized) {
    return 0;
  }

  const aliases = document.aliases.map(normalizeSearchText);
  const fieldsCombined = normalizeSearchText(
    [
      document.normalizedFullName,
      aliases.join(" "),
      document.officeDisplay,
      document.city ?? "",
      document.county ?? "",
      document.jurisdictionState ?? "",
      document.districtLabel ?? "",
      document.chamber ?? "",
      document.party ?? "",
      document.searchBlob
    ].join(" ")
  );

  const queryTokens = query.tokens;
  let score = 0;
  const normalizedFullName = normalizeSearchText(document.normalizedFullName || document.fullName);
  const officeNormalized = normalizeSearchText(document.officeDisplay);
  const locationNormalized = normalizeSearchText(
    [document.city ?? "", document.county ?? "", document.jurisdictionState ?? "", document.districtLabel ?? ""].join(" ")
  );

  if (normalizedFullName === query.normalized) {
    score += 180;
  }

  if (normalizedFullName.startsWith(query.normalized)) {
    score += 70;
  }

  if (fieldsCombined.includes(query.normalized)) {
    score += 50;
  }

  const tokenMatches = queryTokens.filter((token) => fieldsCombined.includes(token)).length;
  if (tokenMatches > 0) {
    score += tokenMatches * 12;
  }

  if (queryTokens.length > 0 && queryTokens.every((token) => fieldsCombined.includes(token))) {
    score += 20;
  }

  if (
    query.nameHints.length > 0 &&
    query.nameHints.every((token) => normalizedFullName.includes(token) || aliases.some((alias) => alias.includes(token)))
  ) {
    score += 52;
  }

  if (query.officeHints.length > 0) {
    const officeMatches = query.officeHints.filter((hint) => officeNormalized.includes(hint)).length;
    score += officeMatches * 26;
  }

  if (query.stateHints.length > 0 && document.jurisdictionState) {
    const state = document.jurisdictionState.toUpperCase();
    if (query.stateHints.includes(state)) {
      score += 40;
    }
  }

  if (
    query.locationHints.length > 0 &&
    query.locationHints.filter((token) => locationNormalized.includes(token)).length > 0
  ) {
    score += query.locationHints.filter((token) => locationNormalized.includes(token)).length * 12;
  }

  if (
    query.districtHints.length > 0 &&
    document.districtLabel &&
    query.districtHints.some((hint) => normalizeSearchText(document.districtLabel ?? "").includes(hint.toLowerCase()))
  ) {
    score += 36;
  }

  if (query.statusHints.length > 0) {
    if (query.statusHints.includes("CANDIDATE") && officeNormalized.includes("candidate")) {
      score += 24;
    }
    if (query.statusHints.includes("OFFICEHOLDER") && !officeNormalized.includes("candidate")) {
      score += 18;
    }
  }

  const distances = [normalizedFullName, ...aliases].filter(Boolean).map((item) => levenshtein(item, query.normalized));
  if (distances.length > 0) {
    score += Math.max(0, 30 - Math.min(...distances) * 2);
  }

  return score;
}

function computePoliticalRelevance(document: {
  candidateStatus: PeopleSearchResult["candidateStatus"];
  officeDisplay: string;
  jurisdictionLevel: PeopleSearchResult["jurisdictionLevel"];
  jurisdictionState: string | null;
  city: string | null;
  county: string | null;
  districtLabel: string | null;
  chamber: string | null;
  electionYear: number | null;
  donorVolumeUsd: number;
  recentVotesCount: number;
  latestDisclosureYear: number | null;
  issueTags: string[];
  externalProfiles: Prisma.JsonValue | null;
}): { score: number; evidenceCount: number; reason: string } {
  let score = 0;
  let evidenceCount = 0;
  const reasons: string[] = [];

  if (document.candidateStatus === "OFFICEHOLDER") {
    score += 38;
    evidenceCount += 1;
    reasons.push("current officeholder");
  } else if (document.candidateStatus === "CANDIDATE") {
    score += 34;
    evidenceCount += 1;
    reasons.push("candidate record");
  } else {
    score += 24;
    evidenceCount += 1;
    reasons.push("former officeholder");
  }

  const officeLower = document.officeDisplay.toLowerCase();
  const officeMatch = POLITICAL_OFFICE_KEYWORDS.find((keyword) => officeLower.includes(keyword));
  if (officeMatch) {
    score += 22;
    evidenceCount += 1;
    reasons.push(document.officeDisplay.toLowerCase().includes("candidate") ? "office sought listing" : "official office listing");
  }

  if (document.jurisdictionLevel) {
    score += 8;
  }

  if (document.jurisdictionState || document.city || document.county || document.districtLabel || document.chamber) {
    score += 8;
    evidenceCount += 1;
  }

  if (document.electionYear) {
    score += 10;
    evidenceCount += 1;
    reasons.push("election metadata");
  }

  if (document.recentVotesCount > 0) {
    score += 14;
    evidenceCount += 1;
    reasons.push("legislative voting activity");
  }

  if (document.donorVolumeUsd > 0) {
    score += 8;
    evidenceCount += 1;
    reasons.push("campaign finance records");
  }

  if (document.latestDisclosureYear) {
    score += 6;
    evidenceCount += 1;
  }

  if (document.issueTags.length > 0) {
    score += 4;
  }

  const ingestion = parseIngestionMeta(document.externalProfiles);
  if (typeof ingestion.sourcePriority === "number") {
    score += Math.min(20, Math.round(ingestion.sourcePriority / 5));
    evidenceCount += 1;
  }

  if (ingestion.trustType === "official_record") {
    score += 12;
    evidenceCount += 1;
    reasons.push("official public office source");
  }

  if (
    ingestion.sourceType === "official_house" ||
    ingestion.sourceType === "official_senate" ||
    ingestion.sourceType === "fec"
  ) {
    score += 12;
    evidenceCount += 1;
    reasons.push("official government or election source");
  }

  const reason = reasons[0] ?? "political record evidence";
  return { score, evidenceCount, reason };
}

function buildQueryReason(
  document: {
    fullName: string;
    officeDisplay: string;
    jurisdictionState: string | null;
    city: string | null;
    county: string | null;
    districtLabel: string | null;
  },
  parsedQuery: ReturnType<typeof parsePeopleQuery>
): string | undefined {
  if (!parsedQuery.normalized) {
    return undefined;
  }

  const reasons: string[] = [];
  const fullName = normalizeSearchText(document.fullName);
  const officeDisplay = normalizeSearchText(document.officeDisplay);
  const location = normalizeSearchText(
    [document.city ?? "", document.county ?? "", document.jurisdictionState ?? "", document.districtLabel ?? ""].join(" ")
  );

  if (parsedQuery.nameHints.length > 0 && parsedQuery.nameHints.every((token) => fullName.includes(token))) {
    reasons.push("name match");
  }

  if (parsedQuery.officeHints.some((hint) => officeDisplay.includes(hint))) {
    reasons.push("office match");
  }

  if (parsedQuery.stateHints.length > 0 && document.jurisdictionState && parsedQuery.stateHints.includes(document.jurisdictionState)) {
    reasons.push("state match");
  } else if (parsedQuery.locationHints.some((token) => location.includes(token))) {
    reasons.push("location match");
  }

  if (
    parsedQuery.districtHints.length > 0 &&
    document.districtLabel &&
    parsedQuery.districtHints.some((hint) => normalizeSearchText(document.districtLabel ?? "").includes(hint.toLowerCase()))
  ) {
    reasons.push("district match");
  }

  return reasons[0];
}

function matchesIntentConstraints(
  document: {
    fullName: string;
    aliases: string[];
    officeDisplay: string;
    chamber: string | null;
    jurisdictionState: string | null;
    city: string | null;
    county: string | null;
    districtLabel: string | null;
  },
  parsedQuery: ReturnType<typeof parsePeopleQuery>
): boolean {
  if (!parsedQuery.normalized) {
    return true;
  }

  const fullName = normalizeSearchText(document.fullName);
  const aliases = document.aliases.map(normalizeSearchText).join(" ");
  const office = normalizeSearchText(`${document.officeDisplay} ${document.chamber ?? ""}`);
  const location = normalizeSearchText(
    [document.city ?? "", document.county ?? "", document.jurisdictionState ?? "", document.districtLabel ?? ""].join(" ")
  );

  if (
    parsedQuery.nameHints.length > 0 &&
    !parsedQuery.nameHints.every((token) => fullName.includes(token) || aliases.includes(token))
  ) {
    return false;
  }

  if (parsedQuery.officeHints.length > 0 && !parsedQuery.officeHints.some((hint) => office.includes(hint))) {
    return false;
  }

  if (parsedQuery.stateHints.length > 0) {
    if (!document.jurisdictionState || !parsedQuery.stateHints.includes(document.jurisdictionState.toUpperCase())) {
      return false;
    }
  }

  if (
    parsedQuery.districtHints.length > 0 &&
    (!document.districtLabel ||
      !parsedQuery.districtHints.some((hint) =>
        normalizeSearchText(document.districtLabel ?? "").includes(hint.toLowerCase())
      ))
  ) {
    return false;
  }

  if (
    parsedQuery.locationHints.length > 0 &&
    parsedQuery.nameHints.length > 0 &&
    !parsedQuery.locationHints.some((token) => location.includes(token))
  ) {
    return false;
  }

  return true;
}

type RankedDocument = Prisma.PublicFigureSearchDocumentGetPayload<{
  include: {
    politician: {
      select: {
        slug: true;
        externalProfiles: true;
      };
    };
  };
}> & {
  queryScore: number;
  politicalRelevanceScore: number;
  finalScore: number;
  evidenceCount: number;
  relevanceReason: string;
};

function toSearchResult(document: RankedDocument): PeopleSearchResult {
  return {
    id: document.id,
    politicianId: document.politicianId,
    slug: document.politician.slug,
    fullName: document.fullName,
    officeDisplay: document.officeDisplay,
    officeHeld: document.officeHeld,
    officeSought: document.officeSought,
    jurisdictionLevel: document.jurisdictionLevel,
    city: document.city,
    county: document.county,
    state: document.jurisdictionState,
    district: document.districtLabel,
    chamber: document.chamber,
    party: document.party,
    candidateStatus: document.candidateStatus,
    incumbentChallengerStatus: document.incumbentChallengerStatus,
    electionYear: document.electionYear,
    issueTags: document.issueTags,
    honestyScore: document.honestyScore,
    donorVolumeUsd: document.donorVolumeUsd,
    recentVotesCount: document.recentVotesCount,
    latestDisclosureYear: document.latestDisclosureYear,
    latestActivityAt: document.latestActivityAt,
    latestActivitySummary: document.latestActivitySummary,
    relevanceScore: document.finalScore,
    politicalRelevanceScore: document.politicalRelevanceScore,
    relevanceReason: document.relevanceReason
  };
}

export async function searchPeople(filters: PeopleSearchFilters): Promise<PeopleSearchResult[]> {
  const parsedQuery = parsePeopleQuery(filters.query ?? "");
  const normalizedQuery = parsedQuery.normalized;
  const queryTokens = parsedQuery.tokens;
  const jurisdictionLevel = scopeToJurisdiction(filters.scope);
  const figureStatus = statusToEnum(filters.figureStatus) ?? statusHintToEnum(parsedQuery.statusHints);

  const queryConditions: Prisma.PublicFigureSearchDocumentWhereInput[] = [];
  if (normalizedQuery) {
    const rawQuery = filters.query?.trim() ?? normalizedQuery;
    queryConditions.push(
      { normalizedFullName: { contains: normalizedQuery, mode: "insensitive" } },
      { fullName: { contains: rawQuery, mode: "insensitive" } },
      { aliases: { hasSome: [rawQuery, normalizedQuery] } },
      { officeDisplay: { contains: rawQuery, mode: "insensitive" } },
      { city: { contains: rawQuery, mode: "insensitive" } },
      { county: { contains: rawQuery, mode: "insensitive" } },
      { jurisdictionState: { contains: rawQuery, mode: "insensitive" } },
      { districtLabel: { contains: rawQuery, mode: "insensitive" } },
      { chamber: { contains: rawQuery, mode: "insensitive" } },
      { searchBlob: { contains: normalizedQuery, mode: "insensitive" } }
    );

    for (const token of queryTokens) {
      queryConditions.push({ searchBlob: { contains: token, mode: "insensitive" } });
    }

    for (const officeHint of parsedQuery.officeHints) {
      queryConditions.push({ officeDisplay: { contains: officeHint, mode: "insensitive" } });
      queryConditions.push({ chamber: { contains: officeHint, mode: "insensitive" } });
    }

    for (const districtHint of parsedQuery.districtHints) {
      queryConditions.push({ districtLabel: { contains: districtHint, mode: "insensitive" } });
    }

    for (const stateHint of parsedQuery.stateHints) {
      queryConditions.push({ jurisdictionState: { equals: stateHint } });
    }
  }

  const hintedJurisdiction = jurisdictionLevel ?? parsedQuery.jurisdictionHints[0];

  const where: Prisma.PublicFigureSearchDocumentWhereInput = {
    ...(hintedJurisdiction ? { jurisdictionLevel: hintedJurisdiction } : {}),
    ...(figureStatus ? { candidateStatus: figureStatus } : {}),
    ...(queryConditions.length > 0 ? { OR: queryConditions } : {})
  };

  const limit = requestedLimit(filters.limit);
  const fetchLimit = normalizedQuery ? Math.min(Math.max(limit * 8, 200), 1200) : limit;

  const documents = await prisma.publicFigureSearchDocument.findMany({
    where,
    include: {
      politician: {
        select: {
          slug: true,
          externalProfiles: true
        }
      }
    },
    take: fetchLimit
  });

  const ranked = documents
    .map<RankedDocument>((document) => {
      const queryScore = computeQueryScore(document, parsedQuery);
      const political = computePoliticalRelevance({
        ...document,
        externalProfiles: document.politician.externalProfiles
      });
      const finalScore = queryScore * 0.75 + political.score * 0.55;

      return {
        ...document,
        queryScore,
        politicalRelevanceScore: political.score,
        finalScore,
        evidenceCount: political.evidenceCount,
        relevanceReason: buildQueryReason(document, parsedQuery) ?? political.reason
      };
    })
    .filter((document) => {
      const queryThreshold = normalizedQuery ? (normalizedQuery.length <= 2 ? 8 : parsedQuery.tokens.length <= 2 ? 12 : 18) : 0;
      const passesQuery = !normalizedQuery || document.queryScore >= queryThreshold;
      const passesPolitical = document.politicalRelevanceScore >= 24 && document.evidenceCount >= 1;
      const passesIntent = matchesIntentConstraints(document, parsedQuery);
      return passesQuery && passesPolitical && passesIntent;
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);

  return ranked.map(toSearchResult);
}

export async function suggestPeople(query: string, limit = 8): Promise<PeopleSuggestion[]> {
  const results = await searchPeople({
    query,
    limit: Math.min(Math.max(limit * 2, 8), 20)
  });

  return results.slice(0, Math.min(Math.max(limit, 1), 20)).map((result) => ({
    id: result.id,
    fullName: result.fullName,
    officeDisplay: result.officeDisplay,
    state: result.state,
    slug: result.slug,
    candidateStatus: result.candidateStatus
  }));
}
