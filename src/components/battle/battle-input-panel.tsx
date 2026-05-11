"use client";

import { HelpCircle, SendHorizonal } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import type { BattleRescue } from "@/server/ai/battle-feedback-generator";

type BattleInputPanelProps = {
  battleId: string;
  disabled: boolean;
  rescue: BattleRescue;
};

type BattleTurnResponse = {
  ok?: boolean;
  error?: string;
  rescue?: BattleRescue;
};

export function BattleInputPanel({ battleId, disabled, rescue }: BattleInputPanelProps) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [rescueHint, setRescueHint] = useState<BattleRescue | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRescuing, setIsRescuing] = useState(false);
  const [error, setError] = useState("");

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = answer.trim();
    if (!trimmed) {
      setError("请先输入一句英文回答。");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const result = await postTurn(battleId, { action: "answer", userAnswer: trimmed });
      if (!result.ok) {
        setError(result.error ?? "回答提交失败。");
        return;
      }

      setAnswer("");
      setRescueHint(null);
      router.refresh();
    } catch {
      setError("网络异常，稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestRescue() {
    setIsRescuing(true);
    setError("");

    try {
      const result = await postTurn(battleId, { action: "rescue" });
      if (!result.ok || !result.rescue) {
        setError(result.error ?? "中文救援暂时不可用。");
        return;
      }

      setRescueHint(result.rescue);
      router.refresh();
    } catch {
      setError("网络异常，稍后再试。");
    } finally {
      setIsRescuing(false);
    }
  }

  return (
    <form className="battle-input-panel" onSubmit={submitAnswer}>
      <div className="battle-rescue-note">
        <strong>中文救援</strong>
        <span>{rescueHint?.hintZh ?? rescue.hintZh}</span>
        <button disabled={disabled || isRescuing} onClick={requestRescue} type="button">
          <HelpCircle aria-hidden="true" size={16} />
          {isRescuing ? "救援中" : "求救"}
        </button>
      </div>

      {rescueHint ? (
        <div className="battle-starter">
          <small>英文起手式</small>
          <span>{rescueHint.starterEnglish}</span>
        </div>
      ) : null}

      <label htmlFor="battle-answer">英文回应</label>
      <div className="battle-answer-row">
        <textarea
          disabled={disabled || isSubmitting}
          id="battle-answer"
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Type your English answer..."
          rows={3}
          value={answer}
        />
        <button disabled={disabled || isSubmitting} type="submit">
          <SendHorizonal aria-hidden="true" size={18} />
          {isSubmitting ? "判定中" : "攻击"}
        </button>
      </div>

      {disabled ? <span className="battle-input-status">战斗已通关，可进入结算。</span> : null}
      {error ? <span className="battle-input-error">{error}</span> : null}
    </form>
  );
}

async function postTurn(battleId: string, body: Record<string, string>) {
  const response = await fetch(`/api/battles/${battleId}/turns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  return (await response.json()) as BattleTurnResponse;
}
