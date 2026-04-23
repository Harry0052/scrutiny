import { NextResponse } from "next/server";

import { ScrutinyController } from "@/lib/scrutiny/scrutiny-controller";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const topic = url.searchParams.get("topic")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ error: "q is required." }, { status: 400 });
  }

  try {
    const controller = new ScrutinyController();
    const statement = await controller.fetchRandomStatement({
      politicianQuery: q,
      topic,
    });

    if (!statement) {
      return NextResponse.json({ statement: null, note: "No live statements found." });
    }

    return NextResponse.json({ statement });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to refresh statement." },
      { status: 500 }
    );
  }
}
