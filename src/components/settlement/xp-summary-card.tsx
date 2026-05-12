import { Gauge, Star, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import type { SettlementRewardModel } from "@/server/game/reward-service";

type XpSummaryCardProps = {
  settlement: SettlementRewardModel;
};

export function XpSummaryCard({ settlement }: XpSummaryCardProps) {
  const speaking = settlement.progress.skillProgress.speaking ?? 0;
  const reading = settlement.progress.skillProgress.reading ?? 0;

  return (
    <section className="settlement-card" aria-label="XP 和技能进度">
      <div className="settlement-card__title">
        <Star aria-hidden="true" size={18} />
        <strong>XP 增长</strong>
      </div>

      <div className="xp-total">
        <span>本次 +{settlement.xp.earnedXp} XP</span>
        <strong>Lv. {settlement.progress.level}</strong>
        <small>距离下一级 {settlement.progress.xpToNextLevel} XP</small>
      </div>

      <div className="xp-breakdown">
        <span>阅读 +{settlement.xp.read.xpDelta}</span>
        <span>战斗 +{settlement.xp.battle.xpDelta}</span>
        <span>表达 +{settlement.xp.expression.xpDelta}</span>
        <span>无救援 +{settlement.xp.noRescueBonus.xpDelta}</span>
      </div>

      {settlement.xp.read.duplicateBlocked ? (
        <small className="xp-note">这篇内容的阅读 XP 已领取，本次只记录复习行为。</small>
      ) : null}

      <div className="skill-progress-list">
        <SkillRow icon={<TrendingUp aria-hidden="true" size={16} />} label="Speaking" value={speaking} />
        <SkillRow icon={<Gauge aria-hidden="true" size={16} />} label="Reading" value={reading} />
      </div>
    </section>
  );
}

function SkillRow({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="skill-row">
      <span>
        {icon}
        {label}
      </span>
      <div className="skill-meter" aria-label={`${label} ${value}%`}>
        <i style={{ width: `${value}%` }} />
      </div>
      <strong>{value}%</strong>
    </div>
  );
}
