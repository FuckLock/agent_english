import { AlertTriangle, Bookmark, BookOpenText, Swords } from "lucide-react";
import Link from "next/link";

import type { DiscoveryCandidate } from "@/server/content/content-pipeline";

type DungeonResultCardProps = {
  candidate: DiscoveryCandidate;
};

export function DungeonResultCard({ candidate }: DungeonResultCardProps) {
  return (
    <article className="dungeon-result-card">
      <div className="dungeon-result-card__top">
        <span>{candidate.categoryLabel}</span>
        <strong>{candidate.difficultyLabel}</strong>
      </div>

      <h3>{candidate.title}</h3>
      <p>{candidate.summary}</p>

      <div className="dungeon-result-card__meta">
        <span>{candidate.originName}</span>
        <span>{candidate.lengthLabel}</span>
        <span>{candidate.wordCount} words</span>
      </div>

      <div className="risk-strip">
        <span>版权 {candidate.copyrightRisk}</span>
        <span>长期保存 {candidate.longTermStorageRisk}</span>
      </div>

      {!candidate.suitableForDungeon ? (
        <div className="result-warning">
          <AlertTriangle aria-hidden="true" size={16} />
          <span>{candidate.reasons[0] ?? "更适合生成摘要学习卡。"}</span>
        </div>
      ) : null}

      <div className="result-actions">
        <Link href={`/lessons/${candidate.sourceId}`}>
          <BookOpenText aria-hidden="true" size={15} />
          阅读
        </Link>
        {candidate.suitableForDungeon ? (
          <Link href={`/lessons/${candidate.sourceId}`}>
            <Swords aria-hidden="true" size={15} />
            生成副本
          </Link>
        ) : (
          <button disabled type="button">
            <Swords aria-hidden="true" size={15} />
            生成副本
          </button>
        )}
        <button type="button">
          <Bookmark aria-hidden="true" size={15} />
          收藏
        </button>
      </div>
    </article>
  );
}
