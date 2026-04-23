import { NextRequest, NextResponse } from "next/server";

import { runLivePeopleIngestion } from "@/lib/data";
import { discoverPeopleFromWeb, isWebDiscoveryAvailable } from "@/lib/search-providers";
import type { WebDiscoveryResult } from "@/lib/search-providers";
import { fetchGoogleNewsCrossCheck } from "@/lib/services/search/news-crosscheck";
import { searchPeopleFromLiveProviders } from "@/lib/services/search/live-provider-search";
import { parsePeopleQuery } from "@/lib/services/search/query-intent";
import { searchPeople } from "@/lib/services/search";
import type { PeopleSearchResult } from "@/lib/services/search/types";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

function parseNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Merge web discovery results with existing results.
 *
 * Web-discovered people are appended after DB/live-provider results
 * and deduplicated by normalized name + state + office. DB results
 * always take priority over web-discovered results.
 */
function mergeWebDiscovery(
  existing: PeopleSearchResult[],
  discovery: WebDiscoveryResult,
  limit: number
): PeopleSearchResult[] {
  if (discovery.results.length === 0) {
    return existing;
  }

  // Build dedup keys from existing results
  const existingKeys = new Set(
    existing.map((r) =>
      [
        r.fullName.toLowerCase().replace(/\s+/g, " ").trim(),
        (r.state ?? "").toUpperCase(),
        r.officeDisplay.toLowerCase(),
      ].join("|")
    )
  );

  // Filter out web results that duplicate existing records
  const newResults = discovery.results.filter((webResult) => {
    const key = [
      webResult.fullName.toLowerCase().replace(/\s+/g, " ").trim(),
      (webResult.state ?? "").toUpperCase(),
      webResult.officeDisplay.toLowerCase(),
    ].join("|");
    return !existingKeys.has(key);
  });

  // Combine: existing first (higher trust), web-discovered after
  return [...existing, ...newResults].slice(0, limit);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    const databaseConfigured = isDatabaseConfigured();
    const baseFilters = {
      query: params.get("q") ?? undefined,
      scope: (params.get("scope") as "all" | "local" | "state" | "federal" | "national" | null) ?? "all",
      city: params.get("city") ?? undefined,
      county: params.get("county") ?? undefined,
      state: params.get("state") ?? undefined,
      district: params.get("district") ?? undefined,
      chamber: params.get("chamber") ?? undefined,
      office: params.get("office") ?? undefined,
      party: params.get("party") ?? undefined,
      issueTag: params.get("issueTag") ?? undefined,
      electionYear: parseNumber(params.get("electionYear")),
      incumbentStatus: (params.get("incumbentStatus") as
        | "all"
        | "INCUMBENT"
        | "CHALLENGER"
        | "OPEN_SEAT"
        | "UNKNOWN"
        | null) ?? "all",
      figureStatus: (params.get("figureStatus") as
        | "all"
        | "CANDIDATE"
        | "OFFICEHOLDER"
        | "FORMER_OFFICEHOLDER"
        | null) ?? "all",
      scoreMin: parseNumber(params.get("scoreMin")),
      scoreMax: parseNumber(params.get("scoreMax")),
      recentActivityDays: parseNumber(params.get("recentActivityDays")),
      sortBy: (params.get("sortBy") as
        | "relevance"
        | "score"
        | "donor_volume"
        | "recent_votes"
        | "disclosure_year"
        | null) ?? "relevance",
      limit: parseNumber(params.get("limit"))
    } as const;

    const queryText = baseFilters.query?.trim() ?? "";
    const parsedQuery = parsePeopleQuery(queryText);
    const inferredStateCode = baseFilters.state ?? parsedQuery.stateHints[0];
    const limit = Math.min(Math.max(baseFilters.limit ?? 24, 1), 100);

    // Should we use web discovery as a fallback layer?
    const useWebDiscovery = params.get("discover") === "1" || params.get("hydrate") === "1";

    // ────────────────────────────────────────────────────────────────
    // Path A: No database configured → live providers + web discovery
    // ────────────────────────────────────────────────────────────────
    if (!databaseConfigured) {
      if (!queryText) {
        return NextResponse.json({
          results: [],
          count: 0,
          hydrated: false,
          webDiscovery: null,
          hydrationSummary: {
            persisted: false,
            providerNotes: ["No query provided."],
            mode: "live_no_db"
          }
        });
      }

      // Run live provider search and web discovery in parallel
      const [liveSearch, webDiscovery, newsCrossCheck] = await Promise.all([
        searchPeopleFromLiveProviders({
          query: queryText,
          limit: baseFilters.limit,
          stateCode: inferredStateCode ?? undefined,
          address: params.get("address") ?? undefined
        }),
        useWebDiscovery && queryText.length >= 3
          ? discoverPeopleFromWeb({
              query: queryText,
              stateCode: inferredStateCode,
              officeHint: parsedQuery.officeHints[0],
              maxResults: 10,
            })
          : Promise.resolve(null),
        fetchGoogleNewsCrossCheck(queryText, 5),
      ]);

      let allResults = liveSearch.results;
      const allNotes = [...liveSearch.providerNotes];

      if (webDiscovery && webDiscovery.results.length > 0) {
        allResults = mergeWebDiscovery(allResults, webDiscovery, limit);
        allNotes.push(...webDiscovery.providerNotes);
      }

      return NextResponse.json({
        results: allResults,
        count: allResults.length,
        hydrated: true,
        webDiscovery: webDiscovery ? {
          providerUsed: webDiscovery.providerUsed,
          rawResultCount: webDiscovery.rawResultCount,
          validatedResultCount: webDiscovery.validatedResultCount,
          resultCount: webDiscovery.results.length,
          providerNotes: webDiscovery.providerNotes,
        } : null,
        hydrationSummary: {
          persisted: false,
          providerNotes: allNotes,
          mode: "live_no_db"
        },
        newsCrossCheck
      });
    }

    // ────────────────────────────────────────────────────────────────
    // Path B: Database configured → DB first, then fallback layers
    // ────────────────────────────────────────────────────────────────
    let results = await searchPeople(baseFilters);
    let hydrated = false;
    let hydrationSummary: unknown = null;
    let webDiscoverySummary: unknown = null;
    let newsCrossCheck: Awaited<ReturnType<typeof fetchGoogleNewsCrossCheck>> = null;

    const shouldHydrate =
      params.get("hydrate") === "1" &&
      queryText.length >= 3 &&
      results.length === 0;

    if (shouldHydrate) {
      const liveIngestion = await runLivePeopleIngestion({
        query: baseFilters.query as string,
        stateCode: inferredStateCode ?? undefined,
        maxRecords: Math.min(Math.max(baseFilters.limit ?? 80, 20), 120),
        address: params.get("address") ?? undefined
      });

      hydrated = liveIngestion.persisted;
      hydrationSummary = {
        persisted: liveIngestion.persisted,
        providerNotes: liveIngestion.sourceNotes,
        persistSummary: liveIngestion.persistSummary
      };

      results = await searchPeople(baseFilters);
    }

    // ── Web discovery fallback ──────────────────────────────────────
    // If DB + live providers still returned insufficient results,
    // try Google-based web discovery as a final discovery layer.
    const shouldDiscover =
      useWebDiscovery &&
      queryText.length >= 3 &&
      results.length < 3 &&
      isWebDiscoveryAvailable();

    if (shouldDiscover) {
      const webDiscovery = await discoverPeopleFromWeb({
        query: queryText,
        stateCode: inferredStateCode,
        officeHint: parsedQuery.officeHints[0],
        maxResults: 10,
      });

      if (webDiscovery.results.length > 0) {
        results = mergeWebDiscovery(results, webDiscovery, limit);
      }

      webDiscoverySummary = {
        providerUsed: webDiscovery.providerUsed,
        rawResultCount: webDiscovery.rawResultCount,
        validatedResultCount: webDiscovery.validatedResultCount,
        resultCount: webDiscovery.results.length,
        providerNotes: webDiscovery.providerNotes,
      };
    }

    const shouldCrossCheckNews = (params.get("hydrate") === "1" || results.length > 0) && queryText.length >= 3;
    if (shouldCrossCheckNews) {
      newsCrossCheck = await fetchGoogleNewsCrossCheck(queryText, 5);
    }

    return NextResponse.json({
      results,
      count: results.length,
      hydrated,
      hydrationSummary,
      webDiscovery: webDiscoverySummary,
      newsCrossCheck,
    });
  } catch (error) {
    console.error("People search failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
