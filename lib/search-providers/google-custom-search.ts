/**
 * Google Custom Search (Programmable Search) Provider
 *
 * Uses the Google Custom Search JSON API for political people discovery.
 * Requires user-supplied credentials via environment variables:
 *   - GOOGLE_CSE_API_KEY: Google API key with Custom Search API enabled
 *   - GOOGLE_CSE_ENGINE_ID: Programmable Search Engine ID (cx)
 *
 * The search engine should ideally be configured to prioritize
 * government, civic, and election-related domains, but a general
 * engine works too — political relevance filtering happens downstream.
 *
 * Rate limits: Free tier = 100 queries/day. Paid tier available.
 */

import { classifyDomainTrust } from "@/lib/search-providers/trust-classifier";
import type {
  SearchProvider,
  SearchProviderName,
  SearchProviderQuery,
  SearchProviderResponse,
  WebSearchResult,
} from "@/lib/search-providers/types";

interface GoogleCseItem {
  title?: string;
  link?: string;
  snippet?: string;
  displayLink?: string;
  pagemap?: {
    metatags?: Array<Record<string, string>>;
  };
}

interface GoogleCseResponse {
  searchInformation?: {
    totalResults?: string;
  };
  items?: GoogleCseItem[];
  error?: {
    code?: number;
    message?: string;
  };
}

const GOOGLE_CSE_API_URL = "https://www.googleapis.com/customsearch/v1";

/**
 * Constructs a politically-scoped search query.
 * Appends political context terms to improve result relevance
 * without overriding the user's intent.
 */
function buildPoliticalQuery(input: SearchProviderQuery): string {
  const parts = [input.query.trim()];

  // Add political context if the query doesn't already contain
  // obvious political terms
  const lowerQuery = input.query.toLowerCase();
  const hasPoliticalContext = [
    "senator", "representative", "governor", "mayor", "council",
    "congress", "candidate", "election", "campaign", "political",
    "legislat", "assembly", "state house", "state senate",
    "officeholder", "incumbent", "vote", "ballot",
  ].some((term) => lowerQuery.includes(term));

  if (!hasPoliticalContext) {
    parts.push("politician OR candidate OR elected official");
  }

  if (input.stateCode) {
    parts.push(input.stateCode);
  }

  if (input.officeHint) {
    parts.push(input.officeHint);
  }

  return parts.join(" ");
}

export class GoogleCustomSearchProvider implements SearchProvider {
  readonly name: SearchProviderName = "google_custom_search";

  constructor(
    private readonly apiKey = process.env.GOOGLE_CSE_API_KEY,
    private readonly engineId = process.env.GOOGLE_CSE_ENGINE_ID
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.apiKey &&
      this.engineId &&
      !this.apiKey.startsWith("replace-with") &&
      !this.engineId.startsWith("replace-with")
    );
  }

  async search(query: SearchProviderQuery): Promise<SearchProviderResponse> {
    const fetchedAt = new Date().toISOString();

    if (!this.isConfigured()) {
      return {
        provider: this.name,
        query: query.query,
        results: [],
        totalResults: 0,
        fetchedAt,
        status: "unconfigured",
        note: "GOOGLE_CSE_API_KEY or GOOGLE_CSE_ENGINE_ID not configured. Google web discovery unavailable.",
      };
    }

    try {
      const maxResults = Math.min(query.maxResults ?? 10, 10); // CSE API max is 10 per request
      const politicalQuery = buildPoliticalQuery(query);

      const params = new URLSearchParams({
        key: this.apiKey!,
        cx: this.engineId!,
        q: politicalQuery,
        num: String(maxResults),
        safe: "active",
        // Prefer English results for US politics
        lr: "lang_en",
        gl: "us",
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);

      let response: Response;
      try {
        response = await fetch(`${GOOGLE_CSE_API_URL}?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        if (response.status === 429) {
          return {
            provider: this.name,
            query: query.query,
            results: [],
            totalResults: 0,
            fetchedAt,
            status: "rate_limited",
            note: "Google Custom Search API rate limit reached. Free tier allows 100 queries/day.",
          };
        }

        const errorBody = await response.text().catch(() => "");
        return {
          provider: this.name,
          query: query.query,
          results: [],
          totalResults: 0,
          fetchedAt,
          status: "error",
          note: `Google CSE API returned HTTP ${response.status}: ${errorBody.slice(0, 200)}`,
        };
      }

      const data = (await response.json()) as GoogleCseResponse;

      if (data.error) {
        return {
          provider: this.name,
          query: query.query,
          results: [],
          totalResults: 0,
          fetchedAt,
          status: "error",
          note: `Google CSE API error: ${data.error.message ?? "unknown"}`,
        };
      }

      const results: WebSearchResult[] = (data.items ?? [])
        .filter((item): item is GoogleCseItem & { link: string } => Boolean(item.link))
        .map((item, index) => ({
          title: item.title ?? "",
          link: item.link,
          snippet: item.snippet ?? "",
          displayLink: item.displayLink ?? new URL(item.link).hostname,
          trustLevel: classifyDomainTrust(item.link),
          resultPosition: index + 1,
        }));

      const totalResults = Number(data.searchInformation?.totalResults ?? results.length);

      return {
        provider: this.name,
        query: query.query,
        results,
        totalResults,
        fetchedAt,
        status: "ok",
        note: `Google CSE returned ${results.length} results for political query.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return {
        provider: this.name,
        query: query.query,
        results: [],
        totalResults: 0,
        fetchedAt,
        status: "error",
        note: `Google CSE fetch failed: ${message}`,
      };
    }
  }
}
