"use client";

import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type GenerationActionButtonProps = {
  action: "extend_panels" | "retry_images" | "queue_tts";
  children: ReactNode;
  className?: string;
  lessonId: string;
};

export function GenerationActionButton({
  action,
  children,
  className = "",
  lessonId
}: GenerationActionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function runAction() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, lessonId })
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? "任务提交失败。");
        return;
      }

      router.refresh();
    });
  }

  return (
    <span className="lesson-action-wrap">
      <button
        className={["lesson-action-button", className].filter(Boolean).join(" ")}
        disabled={isPending}
        onClick={runAction}
        type="button"
      >
        <RefreshCw aria-hidden="true" size={15} />
        {isPending ? "处理中" : children}
      </button>
      {error ? <span className="lesson-action-error">{error}</span> : null}
    </span>
  );
}
