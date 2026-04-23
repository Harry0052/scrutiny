import { NextRequest, NextResponse } from "next/server";

import { getRecordAuditTrace } from "@/lib/integrity/audit";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  const recordType = request.nextUrl.searchParams.get("recordType");
  const recordId = request.nextUrl.searchParams.get("recordId");

  if (!recordType || !recordId) {
    return NextResponse.json({ error: "recordType and recordId are required" }, { status: 400 });
  }

  const trace = await getRecordAuditTrace(recordType, recordId);
  return NextResponse.json(trace);
}
