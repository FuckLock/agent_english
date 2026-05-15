import { HeartPulse, Shield, Sparkles } from "lucide-react";

import type { BattlePageModel } from "@/server/battles/battle-model";

type MonsterObjectiveCardProps = {
  battle: BattlePageModel;
};

export function MonsterObjectiveCard({ battle }: MonsterObjectiveCardProps) {
  const hpPercent = Math.max(0, Math.min(100, battle.hpRemaining));

  return (
    <section className="monster-card" aria-label="怪兽任务卡">
      <div className="monster-card__art" aria-hidden="true">
        {battle.monsterImageUrl ? (
          <img alt="" src={battle.monsterImageUrl} />
        ) : (
          <div className="monster-card__face">
            <span />
            <span />
          </div>
        )}
      </div>

      <div className="monster-card__body">
        <p className="section-kicker section-kicker--dark">Battle Quest</p>
        <h1>{battle.monsterName}</h1>
        <p>{battle.objectiveText}</p>

        <div className="monster-card__stats" aria-label="战斗状态">
          <span>
            <HeartPulse aria-hidden="true" size={16} />
            HP {battle.hpRemaining}
          </span>
          <span>
            <Shield aria-hidden="true" size={16} />
            Round {battle.currentRound}/{battle.totalRounds}
          </span>
          <span>
            <Sparkles aria-hidden="true" size={16} />
            Rescue {battle.rescueCount}
          </span>
        </div>

        <div className="monster-hp" aria-label={`怪兽剩余生命 ${hpPercent}%`}>
          <span style={{ width: `${hpPercent}%` }} />
        </div>
      </div>
    </section>
  );
}
