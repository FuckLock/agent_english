import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BattleDialogueArena } from "@/components/battle/battle-dialogue-arena";
import { BattleInputPanel } from "@/components/battle/battle-input-panel";
import { EquipmentSkillBar } from "@/components/battle/equipment-skill-bar";
import { MonsterObjectiveCard } from "@/components/battle/monster-objective-card";
import { getBattlePageModel } from "@/server/battles/battle-model";

export const dynamic = "force-dynamic";

type BattlePageProps = {
  params: Promise<{ battleId: string }>;
};

export default async function BattlePage({ params }: BattlePageProps) {
  const { battleId } = await params;
  const battle = getBattlePageModel(battleId);
  if (!battle) notFound();

  return (
    <main className="battle-shell">
      <header className="battle-topbar">
        <Link href={`/lessons/${battle.lessonId}`}>
          <ArrowLeft aria-hidden="true" size={17} />
          回到漫画
        </Link>
        <span>
          {battle.title} · {battle.level}
        </span>
      </header>

      <div className="battle-grid">
        <div className="battle-main-column">
          <MonsterObjectiveCard battle={battle} />
          <BattleDialogueArena battle={battle} />
        </div>

        <aside className="battle-side-column" aria-label="战斗操作区">
          <EquipmentSkillBar equipment={battle.equipment} />
          <BattleInputPanel
            battleId={battle.id}
            disabled={battle.status === "completed"}
            rescue={battle.rescue}
          />
        </aside>
      </div>
    </main>
  );
}
