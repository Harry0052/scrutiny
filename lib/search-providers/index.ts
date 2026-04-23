/**
 * Search Provider Registry
 *
 * Central module for managing web-based discovery providers.
 * Provides a unified interface to search for political people
 * via external web APIs (Google Custom Search, etc.) when internal
 * records are insufficient.
 *
 * Architecture:
 * 1. User enters a search query
 * 2. Internal DB records are checked first (existing pipeline)
 * 3. If results are insufficient, this module runs web discovery
 * 4. Results are validated for political relevance
 * 5. Accepted results are normalized into PeopleSearchResult format
 * 6. Normalized results are returned for display or ingestion
 */

export { GoogleCustomSearchProvider } from "@/lib/search-providers/google-custom-search";
export { classifyDomainTrust, trustLevelWeight } from "@/lib/search-providers/trust-classifier";
export {
  validatePoliticalRelevance,
  filterByPoliticalRelevance,
} from "@/lib/search-providers/political-relevance";
export { normalizeWebResult, normalizeWebResults } from "@/lib/search-providers/normalize-results";
export type {
  SearchProvider,
  SearchProviderName,
  SearchProviderQuery,
  SearchProviderResponse,
  WebSearchResult,
  TrustLevel,
} from "@/lib/search-providers/types";
export type { RelevanceResult, RelevanceSignal } from "@/lib/search-providers/political-relevance";

import { GoogleCustomSearchProvider } from "@/lib/search-providers/google-custom-search";
import { filterByPoliticalRelevance } from "@/lib/search-providers/political-relevance";
import { normalizeWebResults } from "@/lib/search-providers/normalize-results";
import type { SearchProviderQuery } from "@/lib/search-providers/types";
import type { PeopleSearchResult } from "@/lib/services/search/types";

export interface WebDiscoveryResult {
  /** Normalized results ready for display */
  results: Array<PeopleSearchResult & { sourceUrls: string[]; discoverySource: string }>;
  /** Provider status notes for debugging */
  providerNotes: string[];
  /** Whether a provider was actually configured and used */
  providerUsed: boolean;
  /** Total raw results before filtering */
  rawResultCount: number;
  /** Results that passed political relevance validation */
  validatedResultCount: number;
}

/**
 * Run web-based discovery for political people.
 *
 * This is the primary entry point for the discovery layer.
 * It handles the full pipeline:
 *   query → Google CSE → relevance filter → normalization → deduplication
 *
 * Falls back gracefully if Google credentials are missing.
 */
export async function discoverPeopleFromWeb(
  query: SearchProviderQuery
): Promise<WebDiscoveryResult> {
  const providerNotes: string[] = [];

  // Currently Google Custom Search is the only web provider.
  // The abstraction supports adding more in the future.
  const provider = new GoogleCustomSearchProvider();

  if (!provider.isConfigured()) {
    providerNotes.push(
      "Google Custom Search not configured. Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ENGINE_ID to enable web discovery."
    );
    return {
      results: [],
      providerNotes,
      providerUsed: false,
      rawResultCount: 0,
      validatedResultCount: 0,
    };
  }

  const response = await provider.search(query);
  providerNotes.push(`${response.provider}: ${response.note}`);

  if (response.status !== "ok" || response.results.length === 0) {
    return {
      results: [],
      providerNotes,
      providerUsed: true,
      rawResultCount: response.results.length,
      validatedResultCount: 0,
    };
  }

  // Filter by political relevance
  const validated = filterByPoliticalRelevance(response.results);
  providerNotes.push(
    `Political relevance filter: ${validated.length}/${response.results.length} results passed.`
  );

  // Log trust levels for debugging
  const trustBreakdown = validated.reduce<Record<string, number>>((acc, r) => {
    acc[r.relevance.trustLevel] = (acc[r.relevance.trustLevel] ?? 0) + 1;
    return acc;
  }, {});
  providerNotes.push(
    `Trust breakdown: ${Object.entries(trustBreakdown)
      .map(([level, count]) => `${level}=${count}`)
      .join(", ") || "none"}`
  );

  // Normalize into PeopleSearchResult format
  const normalized = normalizeWebResults(validated);
  providerNotes.push(
    `Normalized ${normalized.length} unique political people from web results.`
  );

  return {
    results: normalized,
    providerNotes,
    providerUsed: true,
    rawResultCount: response.results.length,
    validatedResultCount: validated.length,
  };
}

/**
 * Check if any web discovery provider is configured and available.
 */
export function isWebDiscoveryAvailable(): boolean {
  return new GoogleCustomSearchProvider().isConfigured();
}
