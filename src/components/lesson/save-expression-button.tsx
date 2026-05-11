"use client";

import { BookmarkCheck } from "lucide-react";
import { useState, useTransition } from "react";

type SaveExpressionButtonProps = {
  expression: string;
  lessonId: string;
  meaningZh: string;
  sourceText: string;
};

export function SaveExpressionButton({
  expression,
  lessonId,
  meaningZh,
  sourceText
}: SaveExpressionButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function saveExpression() {
    startTransition(async () => {
      const response = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_expression",
          expression,
          meaningZh,
          sourceText
        })
      });

      setSaved(response.ok);
    });
  }

  return (
    <button
      className={saved ? "expression-save is-saved" : "expression-save"}
      disabled={isPending || saved}
      onClick={saveExpression}
      type="button"
    >
      <BookmarkCheck aria-hidden="true" size={14} />
      {saved ? "已收藏" : "收藏表达"}
    </button>
  );
}
