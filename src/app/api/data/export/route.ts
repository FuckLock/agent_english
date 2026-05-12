import { NextResponse } from "next/server";

import { exportLearningData } from "@/server/data/export-service";

export async function GET() {
  return NextResponse.json(exportLearningData(), {
    headers: {
      "Content-Disposition": `attachment; filename="agent-english-learning-export.json"`
    }
  });
}
