import { NextRequest, NextResponse } from "next/server";

import { searchPeopleFromLiveProviders } from "@/lib/services/search/live-provider-search";
import { suggestPeople } from "@/lib/services/search";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    if (!query.trim()) {
      return NextResponse.json({ suggestions: [] });
    }

    if (!isDatabaseConfigured()) {
      const live = await searchPeopleFromLiveProviders({ query, limit: 8 });
      const suggestions = live.results.slice(0, 8).map((result) => ({
        id: result.id,
        fullName: result.fullName,
        officeDisplay: result.officeDisplay,
        state: result.state,
        slug: result.slug,
        candidateStatus: result.candidateStatus
      }));
      return NextResponse.json({ suggestions });
    }

    const suggestions = await suggestPeople(query);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("People suggestion failed:", error);
    return NextResponse.json({ error: "Suggestion lookup failed" }, { status: 500 });
  }
}
