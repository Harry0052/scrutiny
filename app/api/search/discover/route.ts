import { NextRequest, NextResponse } from "next/server";

import { discoverPeopleFromWeb, isWebDiscoveryAvailable } from "@/lib/search-providers";
import { parsePeopleQuery } from "@/lib/services/search/query-intent";

export const dynamic = "force-dynamic";

/**
 * GET /api/search/discover
 *
 * Dedicated web discovery endpoint. Uses Google Custom Search
 * (when configured) to find political people from the open web,
 * validates results for political relevance, and returns normalized
 * CivicWatch person records.
 *
 * Query params:
 *   q          - search query (required, min 3 chars)
 *   state      - optional state code filter
 *   limit      - max results (1-20, default 10)
 *
 * This endpoint is for discovery only — results require verification
 * and are marked with their trust level and source URLs.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  try {
    const queryText = params.get("q")?.trim() ?? "";

    if (queryText.length < 3) {
      return NextResponse.json({
        results: [],
        count: 0,
        available: isWebDiscoveryAvailable(),
        note: "Query must be at least 3 characters.",
      });
    }

    if (!isWebDiscoveryAvailable()) {
      return NextResponse.json({
        results: [],
        count: 0,
        available: false,
        note: "Web discovery not configured. Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ENGINE_ID.",
      });
    }

    const parsedQuery = parsePeopleQuery(queryText);
    const stateCode = params.get("state") ?? parsedQuery.stateHints[0];
    const limit = Math.min(Math.max(Number(params.get("limit")) || 10, 1), 20);

    const discovery = await discoverPeopleFromWeb({
      query: queryText,
      stateCode,
      officeHint: parsedQuery.officeHints[0],
      maxResults: limit,
    });

    return NextResponse.json({
      results: discovery.results.slice(0, limit),
      count: Math.min(discovery.results.length, limit),
      available: true,
      providerUsed: discovery.providerUsed,
      rawResultCount: discovery.rawResultCount,
      validatedResultCount: discovery.validatedResultCount,
      providerNotes: discovery.providerNotes,
    });
  } catch (error) {
    console.error("Web discovery failed:", error);
    return NextResponse.json(
      { error: "Web discovery failed", results: [], count: 0 },
      { status: 500 }
    );
  }
}
