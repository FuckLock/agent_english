import { NextResponse } from "next/server";

import { runPrivacyAudit } from "@/server/audit/privacy-audit";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(runPrivacyAudit());
}
