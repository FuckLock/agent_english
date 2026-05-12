"use client";

import { Download, Trash2 } from "lucide-react";
import { useState } from "react";

import type { getDataManagementSummary } from "@/server/data/export-service";

type DataSummary = ReturnType<typeof getDataManagementSummary>;

type DataManagementPanelProps = {
  summary: DataSummary;
};

export function DataManagementPanel({ summary }: DataManagementPanelProps) {
  const [data, setData] = useState(summary);
  const [message, setMessage] = useState("");

  async function runAction(body: Record<string, string>) {
    setMessage("处理中...");
    const response = await fetch("/api/data/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = (await response.json()) as { data?: DataSummary; error?: string };
    if (!response.ok || !result.data) {
      setMessage(result.error ?? "操作失败。");
      return;
    }
    setData(result.data);
    setMessage("已更新。");
  }

  function exportData() {
    window.location.href = "/api/data/export";
  }

  return (
    <section className="settings-panel data-management" aria-label="数据管理">
      <div className="settings-panel__heading">
        <p className="section-kicker">Data</p>
        <h2>学习数据管理</h2>
      </div>

      <div className="data-location">
        <strong>SQLite 位置</strong>
        <span>{data.databasePath}</span>
      </div>

      <div className="data-count-grid">
        <span>{data.counts.learningRecords} 条学习记录</span>
        <span>{data.counts.savedExpressions} 个表达</span>
        <span>{data.counts.equipment} 件装备</span>
        <span>{data.counts.bossItems} 个 Boss 项</span>
      </div>

      <div className="data-actions">
        <button onClick={exportData} type="button">
          <Download aria-hidden="true" size={16} />
          导出学习数据
        </button>
        <button onClick={() => runAction({ action: "clear_learning_records" })} type="button">
          <Trash2 aria-hidden="true" size={16} />
          清空学习记录
        </button>
      </div>

      <div className="lesson-delete-list">
        {data.storyLessons.slice(0, 6).map((lesson) => (
          <button
            key={lesson.id}
            onClick={() => runAction({ action: "delete_story_lesson", lessonId: lesson.id })}
            type="button"
          >
            删除 {lesson.title}
          </button>
        ))}
      </div>

      {data.recentFailures.length > 0 ? (
        <div className="failure-log-list">
          {data.recentFailures.map((item) => (
            <span key={item.id}>
              {item.eventType}: {item.errorSummary || "失败记录"}
            </span>
          ))}
        </div>
      ) : (
        <p className="empty-state">暂无失败日志。</p>
      )}

      {message ? <p className="data-message">{message}</p> : null}
    </section>
  );
}
