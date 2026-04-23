/**
 * Search Provider Abstraction
 *
 * Defines a pluggable interface for web-based discovery providers.
 * Providers return raw web results; political relevance validation
 * and normalization happen downstream.
 */

export type SearchProviderName = "google_custom_search" | "fallback_none";

export type TrustLevel =
  | "official_government"      // .gov domains, official legislative sites
  | "official_campaign"        // candidate campaign sites, FEC-linked
  | "official_election"        // state SOS, election boards, ballotpedia
  | "trusted_civic"            // established nonpartisan civic data orgs
  | "news_media"               // recognized news organizations
  | "unverified_web"           // anything else from web search
  | "rejected";                // failed relevance check

export interface WebSearchResult {
  /** Title of the search result */
  title: string;
  /** URL of the result page */
  link: string;
  /** Snippet/description from the search engine */
  snippet: string;
  /** Display link (domain) */
  displayLink: string;
  /** Assigned trust level based on domain analysis */
  trustLevel: TrustLevel;
  /** Position in search results (1-indexed) */
  resultPosition: number;
}

export interface SearchProviderQuery {
  /** The raw query string from the user */
  query: string;
  /** Optional state filter */
  stateCode?: string;
  /** Optional office type filter */
  officeHint?: string;
  /** Max results to return from provider */
  maxResults?: number;
}

export interface SearchProviderResponse {
  provider: SearchProviderName;
  query: string;
  results: WebSearchResult[];
  totalResults: number;
  fetchedAt: string;
  status: "ok" | "error" | "unconfigured" | "rate_limited";
  note: string;
}

export interface SearchProvider {
  readonly name: SearchProviderName;
  /** Check if provider has valid credentials configured */
  isConfigured(): boolean;
  /** Execute a web search for political people discovery */
  search(query: SearchProviderQuery): Promise<SearchProviderResponse>;
}
