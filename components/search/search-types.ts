import type { FigureStatus, IncumbentStatus, SearchScope, SearchSortBy } from "@/lib/services/search/types";

export interface SearchFilterState {
  query: string;
  scope: SearchScope;
  city: string;
  county: string;
  state: string;
  district: string;
  chamber: string;
  office: string;
  party: string;
  issueTag: string;
  electionYear: string;
  incumbentStatus: IncumbentStatus;
  figureStatus: FigureStatus;
  scoreMin: string;
  scoreMax: string;
  recentActivityDays: string;
  sortBy: SearchSortBy;
  limit: string;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilterState = {
  query: "",
  scope: "all",
  city: "",
  county: "",
  state: "",
  district: "",
  chamber: "",
  office: "",
  party: "",
  issueTag: "",
  electionYear: "",
  incumbentStatus: "all",
  figureStatus: "all",
  scoreMin: "",
  scoreMax: "",
  recentActivityDays: "",
  sortBy: "relevance",
  limit: "80"
};

function addParam(params: URLSearchParams, key: string, value: string, defaultValue?: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }

  if (defaultValue && trimmed === defaultValue) {
    return;
  }

  params.set(key, trimmed);
}

export function buildSearchParams(filters: SearchFilterState): URLSearchParams {
  const params = new URLSearchParams();

  addParam(params, "q", filters.query);
  addParam(params, "scope", filters.scope, "all");
  addParam(params, "city", filters.city);
  addParam(params, "county", filters.county);
  addParam(params, "state", filters.state);
  addParam(params, "district", filters.district);
  addParam(params, "chamber", filters.chamber);
  addParam(params, "office", filters.office);
  addParam(params, "party", filters.party);
  addParam(params, "issueTag", filters.issueTag);
  addParam(params, "electionYear", filters.electionYear);
  addParam(params, "incumbentStatus", filters.incumbentStatus, "all");
  addParam(params, "figureStatus", filters.figureStatus, "all");
  addParam(params, "scoreMin", filters.scoreMin);
  addParam(params, "scoreMax", filters.scoreMax);
  addParam(params, "recentActivityDays", filters.recentActivityDays);
  addParam(params, "sortBy", filters.sortBy, "relevance");
  addParam(params, "limit", filters.limit, "80");

  return params;
}

export function countActiveFilters(filters: SearchFilterState): number {
  const params = buildSearchParams(filters);
  const ignoreKeys = new Set(["q", "sortBy", "limit"]);

  return Array.from(params.keys()).filter((key) => !ignoreKeys.has(key)).length;
}

export function parseSearchFilterState(input: Record<string, string | string[] | undefined>): SearchFilterState {
  const read = (key: string) => {
    const raw = input[key];
    if (Array.isArray(raw)) {
      return raw[0] ?? "";
    }
    return raw ?? "";
  };

  const query = read("q") || read("query");

  const scope = read("scope");
  const figureStatus = read("figureStatus");
  const incumbentStatus = read("incumbentStatus");
  const sortBy = read("sortBy");

  return {
    ...DEFAULT_SEARCH_FILTERS,
    query,
    scope: (["all", "local", "state", "federal", "national"].includes(scope) ? scope : "all") as SearchScope,
    city: read("city"),
    county: read("county"),
    state: read("state"),
    district: read("district"),
    chamber: read("chamber"),
    office: read("office"),
    party: read("party"),
    issueTag: read("issueTag"),
    electionYear: read("electionYear"),
    incumbentStatus: (["all", "INCUMBENT", "CHALLENGER", "OPEN_SEAT", "UNKNOWN"].includes(incumbentStatus)
      ? incumbentStatus
      : "all") as IncumbentStatus,
    figureStatus: (["all", "CANDIDATE", "OFFICEHOLDER", "FORMER_OFFICEHOLDER"].includes(figureStatus)
      ? figureStatus
      : "all") as FigureStatus,
    scoreMin: read("scoreMin"),
    scoreMax: read("scoreMax"),
    recentActivityDays: read("recentActivityDays"),
    sortBy: (["relevance", "score", "donor_volume", "recent_votes", "disclosure_year"].includes(sortBy)
      ? sortBy
      : "relevance") as SearchSortBy,
    limit: read("limit") || "80"
  };
}
