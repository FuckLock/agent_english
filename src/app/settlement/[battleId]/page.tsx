import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EquipmentDropCard } from "@/components/settlement/equipment-drop-card";
import { ReviewItemsCard } from "@/components/settlement/review-items-card";
import { RewardHero } from "@/components/settlement/reward-hero";
import { XpSummaryCard } from "@/components/settlement/xp-summary-card";
import { getBattlePageModel } from "@/server/battles/battle-model";
import { getSettlementRewardModel } from "@/server/game/reward-service";

export const dynamic = "force-dynamic";

type SettlementPageProps = {
  params: Promise<{ battleId: string }>;
};

export default async function SettlementPage({ params }: SettlementPageProps) {
  const { battleId } = await params;
  const battle = getBattlePageModel(battleId);
  if (!battle) notFound();
  if (battle.status !== "completed") redirect(`/battles/${battle.id}`);

  const settlement = getSettlementRewardModel(battle.id);
  if (!settlement) notFound();

  return (
    <main className="battle-shell">
      <header className="battle-topbar">
        <Link href={`/lessons/${battle.lessonId}`}>
          <ArrowLeft aria-hidden="true" size={17} />
          回到漫画
        </Link>
        <span>{battle.title} · 结算</span>
      </header>

      <div className="settlement-layout">
        <RewardHero settlement={settlement} />
        <XpSummaryCard settlement={settlement} />
        <EquipmentDropCard settlement={settlement} />
        <ReviewItemsCard settlement={settlement} />

        <div className="settlement-actions">
          {settlement.nextActions.map((item) => (
            <span key={item}>{item}</span>
          ))}
          <Link href="/discover">继续找副本</Link>
          <Link href={`/lessons/${battle.lessonId}`}>再读一遍漫画</Link>
        </div>
      </div>
    </main>
  );
}
