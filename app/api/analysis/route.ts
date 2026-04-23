import { NextRequest, NextResponse } from "next/server";

import { getDashboardData, isDatabaseConfigured } from "@/lib/services/dashboard";

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured. Set DATABASE_URL and DIRECT_URL in .env.local." },
      { status: 503 }
    );
  }

  const slug = request.nextUrl.searchParams.get("slug") ?? undefined;
  const data = await getDashboardData(slug);

  if (!data) {
    return NextResponse.json({ error: "Politician not found" }, { status: 404 });
  }

  return NextResponse.json({
    politician_id: data.politician.id,
    politician_slug: data.politician.slug,
    honesty_summary: data.summary,
    methodology: data.methodology,
    results: data.statementVoteResults
  });
}
