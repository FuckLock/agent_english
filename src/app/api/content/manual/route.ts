import { NextResponse } from "next/server";
import { z } from "zod";

import { createManualContent } from "@/server/content/content-pipeline";

const manualContentSchema = z.object({
  sourceType: z.enum(["url", "text"]),
  title: z.string().trim().min(1).optional(),
  url: z.string().url().optional(),
  text: z.string().optional(),
  category: z.enum(["today", "weird", "movie", "tech", "culture", "people", "travel"]).optional(),
  mode: z.enum(["quest", "read"]).optional()
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = manualContentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "手动内容参数无效。", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const text = parsed.data.text?.trim() ?? "";
  if (parsed.data.sourceType === "text" && !text) {
    return NextResponse.json({ ok: false, error: "请粘贴英文文本。" }, { status: 400 });
  }

  const candidate = createManualContent({ ...parsed.data, text });

  return NextResponse.json({ ok: true, candidate });
}
