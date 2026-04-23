import { NextResponse } from "next/server";

import { getOverviewByPoliticianIdentifier, isDatabaseConfigured } from "@/lib/services/dashboard";

export async function GET(_: Request, context: { params: { id: string } }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured. Set DATABASE_URL and DIRECT_URL in .env.local." },
      { status: 503 }
    );
  }

  const overview = await getOverviewByPoliticianIdentifier(context.params.id);

  if (!overview) {
    return NextResponse.json({ error: "Politician not found" }, { status: 404 });
  }

  return NextResponse.json(overview);
}
