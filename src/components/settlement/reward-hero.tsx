import { PartyPopper, Sparkles } from "lucide-react";

import type { SettlementRewardModel } from "@/server/game/reward-service";

type RewardHeroProps = {
  settlement: SettlementRewardModel;
};

export function RewardHero({ settlement }: RewardHeroProps) {
  const hasNewXp = settlement.xp.newlyAwardedXp > 0;

  return (
    <section className="reward-hero" aria-label="通关庆祝">
      <div className="reward-hero__crest" aria-hidden="true">
        <PartyPopper size={36} />
      </div>
      <div>
        <p className="section-kicker">Quest Clear</p>
        <h1>{hasNewXp ? "怪兽退场了" : "战利品已领取"}</h1>
        <p>
          {hasNewXp
            ? `你拿到 ${settlement.xp.newlyAwardedXp} XP，表达已经转成可带走的装备。`
            : "这场已经结算过，刷新不会重复刷 XP。"}
        </p>
      </div>
      <span className="reward-hero__badge">
        <Sparkles aria-hidden="true" size={15} />
        {settlement.battle.rescueCount === 0 ? "无救援通关" : `救援 ${settlement.battle.rescueCount} 次`}
      </span>
    </section>
  );
}
