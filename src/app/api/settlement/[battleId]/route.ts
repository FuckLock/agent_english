import { NextResponse } from "next/server";

import { getSettlementRewardModel } from "@/server/game/reward-service";

type SettlementRouteContext = {
  params: Promise<{ battleId: string }>;
};

export async function GET(_request: Request, context: SettlementRouteContext) {
  const { battleId } = await context.params;
  return respondWithSettlement(battleId);
}

export async function POST(_request: Request, context: SettlementRouteContext) {
  const { battleId } = await context.params;
  return respondWithSettlement(battleId);
}

function respondWithSettlement(battleId: string) {
  const settlement = getSettlementRewardModel(battleId);
  if (!settlement) {
    return NextResponse.json({ ok: false, error: "未找到可结算的已通关战斗。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, settlement });
}
