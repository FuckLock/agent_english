"use client";

import { Flame, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import type { CollectionModel } from "@/server/collection/collection-service";

type SkillTreePanelProps = {
  collection: CollectionModel;
};

export function SkillTreePanel({ collection }: SkillTreePanelProps) {
  const [reviewItems, setReviewItems] = useState(collection.reviewItems);
  const skills = Object.entries(collection.progress.skills);

  async function markDone(id: string) {
    const response = await fetch("/api/collection", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_review_status", id, status: "done" })
    });
    const result = (await response.json()) as { collection?: CollectionModel };
    if (response.ok && result.collection) {
      setReviewItems(result.collection.reviewItems);
    }
  }

  return (
    <section className="collection-panel" aria-label="技能树和推荐复习">
      <div className="collection-panel__heading">
        <Sparkles aria-hidden="true" size={19} />
        <div>
          <p className="section-kicker">Skill Tree</p>
          <h2>技能树与复习</h2>
        </div>
      </div>

      <div className="skill-tree-list">
        {skills.map(([key, value]) => (
          <div className="skill-tree-row" key={key}>
            <span>{key}</span>
            <i aria-label={`${key} ${value}%`}>
              <b style={{ width: `${value}%` }} />
            </i>
            <strong>{value}%</strong>
          </div>
        ))}
      </div>

      <div className="review-queue">
        {reviewItems.filter((item) => item.status === "open").map((item) => (
          <article key={item.id}>
            <RotateCcw aria-hidden="true" size={16} />
            <div>
              <strong>{item.skillKey}</strong>
              <span>{item.suggestedAction}</span>
            </div>
            <button onClick={() => markDone(item.id)} type="button">
              完成
            </button>
          </article>
        ))}
      </div>

      <div className="boss-queue">
        {collection.bossItems.map((item) => (
          <article key={item.id}>
            <Flame aria-hidden="true" size={16} />
            <div>
              <strong>{item.title}</strong>
              <span>{item.prompt}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
