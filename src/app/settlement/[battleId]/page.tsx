import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookMarked, HeartPulse, Sparkles } from "lucide-react";

import { getBattlePageModel } from "@/server/battles/battle-model";

export const dynamic = "force-dynamic";

type SettlementPageProps = {
  params: Promise<{ battleId: string }>;
};

export default async function SettlementPage({ params }: SettlementPageProps) {
  const { battleId } = await params;
  const battle = getBattlePageModel(battleId);
  if (!battle) notFound();
  if (battle.status !== "completed") redirect(`/battles/${battle.id}`);

  const lastTurn = battle.turns.at(-1);

  return (
    <main className="battle-shell">
      <header className="battle-topbar">
        <Link href={`/lessons/${battle.lessonId}`}>
          <ArrowLeft aria-hidden="true" size={17} />
          回到漫画
        </Link>
        <span>{battle.title} · 结算</span>
      </header>

      <section className="settlement-panel" aria-label="通关结算">
        <p className="section-kicker">Quest Clear</p>
        <h1>怪兽退场了</h1>
        <p>你已经用英文完成这次挑战。先收下本轮表达记录。</p>

        <div className="settlement-stat-row">
          <span>
            <HeartPulse aria-hidden="true" size={16} />
            HP 清零
          </span>
          <span>
            <Sparkles aria-hidden="true" size={16} />
            中文救援 {battle.rescueCount} 次
          </span>
          <span>
            <BookMarked aria-hidden="true" size={16} />
            {battle.turns.length} 轮回答
          </span>
        </div>

        {lastTurn ? (
          <div className="settlement-expression">
            <small>本轮可复用表达</small>
            <strong>{lastTurn.feedback.rewrite}</strong>
            <span>{lastTurn.feedback.explanationZh}</span>
          </div>
        ) : null}

        <div className="settlement-actions">
          <Link href="/discover">继续找副本</Link>
          <Link href={`/lessons/${battle.lessonId}`}>再读一遍漫画</Link>
        </div>
      </section>
    </main>
  );
}
