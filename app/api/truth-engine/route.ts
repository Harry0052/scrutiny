import { NextRequest, NextResponse } from "next/server";

import { runTruthEngine } from "@/lib/ai/TruthEngine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim() ?? "";
  const slug = params.get("slug")?.trim() || undefined;
  const topic = params.get("topic")?.trim() || undefined;

  if (!query && !slug) {
    return NextResponse.json({ error: "Provide q or slug." }, { status: 400 });
  }

  try {
    const payload = await runTruthEngine({
      query: query || slug || "",
      slug,
      topic,
    });

    if (payload.status === "not_found") {
      return NextResponse.json(payload, { status: 404 });
    }

    if (payload.status === "unavailable") {
      return NextResponse.json(payload, { status: 503 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Truth engine request failed:", error);
    return NextResponse.json(
      { error: "Truth engine execution failed." },
      { status: 500 }
    );
  }
}
