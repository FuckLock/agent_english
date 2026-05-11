import { NextResponse } from "next/server";
import { z } from "zod";

import { requestBattleRescue, submitBattleTurn } from "@/server/battles/battle-service";

type BattleTurnRouteContext = {
  params: Promise<{ battleId: string }>;
};

const turnPostSchema = z.object({
  action: z.enum(["answer", "rescue"]).default("answer"),
  userAnswer: z.string().optional()
});

export async function POST(request: Request, context: BattleTurnRouteContext) {
  const { battleId } = await context.params;
  const body = await request.json();
  const parsed = turnPostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "战斗回合参数无效。", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (parsed.data.action === "rescue") {
    const battle = requestBattleRescue(battleId);
    if (!battle) {
      return NextResponse.json({ ok: false, error: "当前战斗不能使用中文救援。" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, rescue: battle.rescue, battle });
  }

  const userAnswer = parsed.data.userAnswer?.trim() ?? "";
  if (userAnswer.length < 2) {
    return NextResponse.json({ ok: false, error: "请先输入一句英文回答。" }, { status: 400 });
  }

  const battle = submitBattleTurn({ battleId, userAnswer });
  if (!battle) {
    return NextResponse.json({ ok: false, error: "当前战斗不能提交回答。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, battle });
}
