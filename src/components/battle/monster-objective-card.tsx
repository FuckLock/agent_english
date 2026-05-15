import { Flame, HeartPulse, Shield, Sparkles, Zap } from "lucide-react";

import type { BattlePageModel } from "@/server/battles/battle-model";
import type { HitType, MonsterState } from "@/server/ai/battle-feedback-generator";

type MonsterObjectiveCardProps = {
  battle: BattlePageModel;
};

export function MonsterObjectiveCard({ battle }: MonsterObjectiveCardProps) {
  const hpPercent = Math.max(0, Math.min(100, battle.hpRemaining));
  const stateClass = battle.monsterState.replace("_", "-");

  return (
    <section
      className={`monster-card monster-card--${stateClass}`}
      aria-label="怪兽任务卡"
    >
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
          {battle.comboCount > 0 ? (
            <span className="monster-card__combo">
              <Flame aria-hidden="true" size={16} />
              Combo x{battle.comboCount}
            </span>
          ) : null}
          {battle.lastHitType && battle.lastHitType !== "miss" ? (
            <span className={`hit-badge hit-badge--${battle.lastHitType}`}>
              <Zap aria-hidden="true" size={14} />
              {formatHitType(battle.lastHitType)}
              {battle.lastDamage > 0 ? ` -${battle.lastDamage}` : ""}
            </span>
          ) : null}
        </div>

        <p className={`monster-state-label monster-state-label--${stateClass}`}>
          {formatMonsterState(battle.monsterState)}
        </p>

        <div className="monster-hp" aria-label={`怪兽剩余生命 ${hpPercent}%`}>
          <span style={{ width: `${hpPercent}%` }} />
        </div>
      </div>
    </section>
  );
}

function formatHitType(hitType: HitType): string {
  const labels: Record<HitType, string> = {
    miss: "未命中",
    graze: "擦伤",
    hit: "命中",
    critical: "暴击",
    stagger: "击破"
  };
  return labels[hitType];
}

function formatMonsterState(state: MonsterState): string {
  const labels: Record<MonsterState, string> = {
    normal: "状态：普通",
    angry: "状态：怒气，伤害将增加",
    near_death: "状态：濒死，再补一击",
    dead: "状态：已击败"
  };
  return labels[state];
}
