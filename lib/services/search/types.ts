export type SearchScope = "all" | "local" | "state" | "federal" | "national";

export type IncumbentStatus = "all" | "INCUMBENT" | "CHALLENGER" | "OPEN_SEAT" | "UNKNOWN";

export type FigureStatus = "all" | "CANDIDATE" | "OFFICEHOLDER" | "FORMER_OFFICEHOLDER";

export type SearchSortBy = "relevance" | "score" | "donor_volume" | "recent_votes" | "disclosure_year";

export interface PeopleSearchFilters {
  query?: string;
  scope?: SearchScope;
  city?: string;
  county?: string;
  state?: string;
  district?: string;
  chamber?: string;
  office?: string;
  party?: string;
  issueTag?: string;
  electionYear?: number;
  incumbentStatus?: IncumbentStatus;
  figureStatus?: FigureStatus;
  scoreMin?: number;
  scoreMax?: number;
  recentActivityDays?: number;
  sortBy?: SearchSortBy;
  limit?: number;
}

export interface PeopleSearchResult {
  id: string;
  politicianId: string;
  slug: string;
  fullName: string;
  officeDisplay: string;
  officeHeld: string | null;
  officeSought: string | null;
  jurisdictionLevel: "LOCAL" | "STATE" | "NATIONAL";
  city: string | null;
  county: string | null;
  state: string | null;
  district: string | null;
  chamber: string | null;
  party: string | null;
  candidateStatus: "CANDIDATE" | "OFFICEHOLDER" | "FORMER_OFFICEHOLDER";
  incumbentChallengerStatus: "INCUMBENT" | "CHALLENGER" | "OPEN_SEAT" | "UNKNOWN";
  electionYear: number | null;
  issueTags: string[];
  honestyScore: number | null;
  donorVolumeUsd: number;
  recentVotesCount: number;
  latestDisclosureYear: number | null;
  latestActivityAt: Date | string | null;
  latestActivitySummary: string | null;
  relevanceScore: number;
  politicalRelevanceScore: number;
  relevanceReason: string;
}

export interface PeopleSuggestion {
  id: string;
  fullName: string;
  officeDisplay: string;
  state: string | null;
  slug: string;
  candidateStatus: "CANDIDATE" | "OFFICEHOLDER" | "FORMER_OFFICEHOLDER";
}
