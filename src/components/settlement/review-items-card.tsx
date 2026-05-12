import { Flame, RotateCcw } from "lucide-react";

import type { SettlementRewardModel } from "@/server/game/reward-service";

type ReviewItemsCardProps = {
  settlement: SettlementRewardModel;
};

export function ReviewItemsCard({ settlement }: ReviewItemsCardProps) {
  return (
    <section className="settlement-card review-card" aria-label="复习项和 Boss 线索">
      <div className="settlement-card__title">
        <RotateCcw aria-hidden="true" size={18} />
        <strong>复习线索</strong>
      </div>

      {settlement.reviewItems.length > 0 ? (
        <div className="review-list">
          {settlement.reviewItems.map((item) => (
            <article key={item.id}>
              <span>{item.triggerType}</span>
              <strong>{item.skillKey}</strong>
              <p>{item.suggestedAction}</p>
              <small>卡住 {item.stuckCount} 次</small>
            </article>
          ))}
        </div>
      ) : (
        <p className="review-card__empty">这次没有明显卡住点，继续保持输出节奏。</p>
      )}

      {settlement.bossItems.length > 0 ? (
        <div className="boss-list">
          {settlement.bossItems.map((item) => (
            <article key={item.id}>
              <Flame aria-hidden="true" size={17} />
              <div>
                <strong>{item.title}</strong>
                <span>{item.prompt}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
