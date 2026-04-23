import { NextRequest, NextResponse } from "next/server";

import { runLivePeopleIngestion } from "@/lib/data";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as {
      query?: string;
      stateCode?: string;
      address?: string;
      maxRecords?: number;
    };

    if (!body.query?.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const result = await runLivePeopleIngestion({
      query: body.query.trim(),
      stateCode: body.stateCode?.trim() || undefined,
      address: body.address?.trim() || undefined,
      maxRecords: body.maxRecords
    });

    return NextResponse.json({
      persisted: result.persisted,
      sourceNotes: result.sourceNotes,
      persistSummary: result.persistSummary,
      providerResults: result.providerResults.map((item) => ({
        providerId: item.providerId,
        source: item.source,
        status: item.status,
        trustTier: item.trustTier,
        priority: item.priority,
        note: item.note,
        counts: {
          politicians: item.payload.politicians.length,
          bills: item.payload.bills.length,
          votes: item.payload.votes.length,
          statements: item.payload.statements.length,
          donorContributions: item.payload.donorContributions.length,
          financialDisclosures: item.payload.financialDisclosures.length
        }
      }))
    });
  } catch (error) {
    console.error("People ingestion failed:", error);
    return NextResponse.json({ error: "People ingestion failed" }, { status: 500 });
  }
}
