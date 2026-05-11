import { NextResponse } from "next/server";
import { z } from "zod";

import { createBattleFromLesson } from "@/server/battles/battle-service";

const createBattleSchema = z
  .object({
    lessonId: z.string().trim().min(1).optional(),
    dungeonId: z.string().trim().min(1).optional()
  })
  .refine((value) => value.lessonId || value.dungeonId, {
    message: "需要 lessonId 或 dungeonId。"
  });

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createBattleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "创建战斗参数无效。", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const battle = createBattleFromLesson(parsed.data);
  if (!battle) {
    return NextResponse.json({ ok: false, error: "未找到可挑战的副本。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, battle });
}
