"use client";

import { Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type StartBattleButtonProps = {
  dungeonId: string | null;
  lessonId: string;
};

export function StartBattleButton({ dungeonId, lessonId }: StartBattleButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function startBattle() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dungeonId ? { dungeonId, lessonId } : { lessonId })
      });
      const result = (await response.json()) as {
        ok?: boolean;
        battle?: { id: string };
        error?: string;
      };

      if (!response.ok || !result.battle) {
        setError(result.error ?? "副本入口暂时打不开。");
        return;
      }

      router.push(`/battles/${result.battle.id}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <span className="lesson-challenge-wrap">
      <button className="lesson-challenge-button" disabled={isLoading} onClick={startBattle} type="button">
        <Swords aria-hidden="true" size={18} />
        {isLoading ? "进入中" : "进入副本挑战"}
      </button>
      {error ? <span className="lesson-action-error">{error}</span> : null}
    </span>
  );
}
