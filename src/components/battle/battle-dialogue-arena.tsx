import Link from "next/link";
import { Bot, CheckCircle2, Flame, MessageCircle, Swords, Zap } from "lucide-react";

import type { BattlePageModel, BattleTurnView } from "@/server/battles/battle-model";
import type { HitType } from "@/server/ai/battle-feedback-generator";

type BattleDialogueArenaProps = {
  battle: BattlePageModel;
};

export function BattleDialogueArena({ battle }: BattleDialogueArenaProps) {
  return (
    <section className="battle-arena" aria-label="战斗对话区">
      <div className="battle-arena__intro">
        <Swords aria-hidden="true" size={18} />
        <div>
          <strong>{battle.title}</strong>
          <span>用英文完成任务，中文救援只负责帮你开口。</span>
        </div>
      </div>

      <div className="battle-turn-list">
        {battle.turns.length === 0 ? (
          <div className="battle-empty-turn">
            <MessageCircle aria-hidden="true" size={20} />
            <p>怪兽正在等你的第一句英文回应。</p>
          </div>
        ) : null}

        {battle.turns.map((turn) => (
          <article className="battle-turn" key={turn.id}>
            <div className="battle-bubble battle-bubble--user">
              <span>你</span>
              <p>{turn.userAnswer}</p>
            </div>

            <div className="battle-bubble battle-bubble--ai">
              <span>
                <Bot aria-hidden="true" size={15} />
                反馈
              </span>
              <BattleImpactRow turn={turn} />
              <strong>{turn.feedback.communicationResult}</strong>
              <p>{turn.feedback.explanationZh}</p>
              <div className="battle-rewrite">
                <small>更自然</small>
                <span>{turn.feedback.rewrite}</span>
              </div>
              {turn.feedback.stuckPoint ? (
                <em>卡住点：{formatStuckPoint(turn.feedback.stuckPoint)}</em>
              ) : null}
            </div>
          </article>
        ))}

        {battle.status === "completed" ? (
          <div className="battle-clear-banner" id="settlement-next-phase">
            <CheckCircle2 aria-hidden="true" size={20} />
            <div>
              <strong>通关完成</strong>
              <span>本轮回答已记录，去看这次挑战留下了什么。</span>
            </div>
            <Link href={`/settlement/${battle.id}`} prefetch={false}>
              进入结算
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BattleImpactRow({ turn }: { turn: BattleTurnView }) {
  return (
    <div className="battle-impact" aria-label="本回合命中">
      <span className={`hit-badge hit-badge--${turn.hitType}`}>
        <Zap aria-hidden="true" size={14} />
        {formatHitType(turn.hitType)}
      </span>
      {turn.damage > 0 ? <strong>-{turn.damage} HP</strong> : null}
      {turn.comboAfter > 0 ? (
        <span className="battle-impact__combo">
          <Flame aria-hidden="true" size={14} />
          Combo x{turn.comboAfter}
        </span>
      ) : null}
      {turn.rescueUsedThisRound ? <em>救援后伤害减半</em> : null}
    </div>
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

function formatStuckPoint(value: string) {
  if (value === "zh_only") return "用了中文，必须回到英文输出";
  if (value === "too_short") return "英文信息太短";
  if (value === "needs_polite_frame") return "缺少自然礼貌框架";
  return value;
}
