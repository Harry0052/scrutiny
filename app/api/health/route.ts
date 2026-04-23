import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/services/dashboard";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "civicwatch-mvp",
    databaseConfigured: isDatabaseConfigured()
  });
}
