"use client";

import { AlertTriangle, CheckCircle2, FileText, Link as LinkIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { discoveryCategories, modeFilters } from "@/lib/discovery-options";

type ManualNotice = {
  tone: "success" | "error";
  text: string;
};

type ManualApiResult = {
  error?: string;
  candidate?: {
    title: string;
    category: string;
    mode: string;
  };
};

export function ManualInputFallback() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<"text" | "url">("text");
  const [notice, setNotice] = useState<ManualNotice | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitManualContent(formData: FormData) {
    const text = String(formData.get("text") ?? "");
    const url = String(formData.get("url") ?? "");

    startTransition(async () => {
      const response = await fetch("/api/content/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          title: String(formData.get("title") ?? "") || undefined,
          url: sourceType === "url" ? url : undefined,
          text,
          category: formData.get("category"),
          mode: formData.get("mode")
        })
      });
      const result = (await response.json()) as ManualApiResult;

      setNotice({
        tone: response.ok ? "success" : "error",
        text: response.ok
          ? `已生成候选：${result.candidate?.title ?? "Manual Quest"}`
          : result.error ?? "创建失败。"
      });
      if (response.ok) {
        const candidate = result.candidate;
        const query = new URLSearchParams({
          q: candidate?.title ?? "Manual Quest",
          category: candidate?.category ?? "today",
          mode: candidate?.mode ?? "quest"
        });
        router.push(`/discover?${query.toString()}`);
      }
    });
  }

  return (
    <section className="discover-panel manual-fallback" aria-labelledby="manual-fallback-title">
      <div className="discover-panel__heading">
        <p className="section-kicker">Manual Fallback</p>
        <h2 id="manual-fallback-title">粘贴内容也能开局</h2>
      </div>

      <div className="source-switch" role="tablist">
        <button
          aria-selected={sourceType === "text"}
          onClick={() => setSourceType("text")}
          type="button"
        >
          <FileText aria-hidden="true" size={15} />
          英文文本
        </button>
        <button aria-selected={sourceType === "url"} onClick={() => setSourceType("url")} type="button">
          <LinkIcon aria-hidden="true" size={15} />
          URL
        </button>
      </div>

      <form action={submitManualContent} className="manual-form">
        <input name="title" placeholder="标题，可不填" />
        {sourceType === "url" ? <input name="url" placeholder="https://example.com/story" /> : null}
        <textarea name="text" placeholder="Paste English text here..." />

        <div className="manual-form__row">
          <select defaultValue="today" name="category">
            {discoveryCategories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <select defaultValue="quest" name="mode">
            {modeFilters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <button disabled={isPending} type="submit">
          生成候选
        </button>
      </form>

      {notice ? <ManualNoticeBox notice={notice} /> : null}
    </section>
  );
}

function ManualNoticeBox({ notice }: { notice: ManualNotice }) {
  const Icon = notice.tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`manual-notice manual-notice--${notice.tone}`}>
      <Icon aria-hidden="true" size={16} />
      <span>{notice.text}</span>
    </div>
  );
}
