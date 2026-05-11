import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

import { DungeonResultCard } from "@/components/discovery/dungeon-result-card";
import { ManualInputFallback } from "@/components/discovery/manual-input-fallback";
import { SearchQuestPanel } from "@/components/discovery/search-quest-panel";
import {
  searchDiscoveryCandidates,
  type DiscoveryFilters
} from "@/server/content/content-pipeline";

export const dynamic = "force-dynamic";

type DiscoverPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const params = (await searchParams) ?? {};
  const result = searchDiscoveryCandidates(readFilters(params));

  return (
    <main className="discover-shell">
      <section className="discover-hero" aria-labelledby="discover-title">
        <div>
          <p className="section-kicker">Discovery</p>
          <h1 id="discover-title">把真实英文变成副本</h1>
          <p>搜索、URL、粘贴文本都走同一条内容管线，先做短摘录和风险判断。</p>
        </div>
        <Link className="settings-link-button" href="/">
          <ArrowLeft aria-hidden="true" size={17} strokeWidth={2.6} />
          返回地图
        </Link>
      </section>

      <div className="discover-grid">
        <div className="discover-main">
          <SearchQuestPanel
            filters={result.filters}
            message={result.message}
            providerMode={result.providerMode}
          />

          <section className="discover-panel" aria-labelledby="results-title">
            <div className="discover-panel__heading discover-panel__heading--row">
              <div>
                <p className="section-kicker">Dungeon Results</p>
                <h2 id="results-title">候选副本</h2>
              </div>
              <span>{result.candidates.length} 个候选</span>
            </div>

            {result.candidates.length > 0 ? (
              <div className="dungeon-result-list">
                {result.candidates.map((candidate) => (
                  <DungeonResultCard candidate={candidate} key={candidate.sourceId} />
                ))}
              </div>
            ) : (
              <div className="no-results">
                <Compass aria-hidden="true" size={26} strokeWidth={2.5} />
                <strong>这组条件暂时没有候选</strong>
                <p>{result.fallbackActions.join(" / ")}</p>
              </div>
            )}
          </section>
        </div>

        <ManualInputFallback />
      </div>
    </main>
  );
}

function readFilters(params: Record<string, string | string[] | undefined>): DiscoveryFilters {
  return {
    q: readParam(params.q),
    category: readParam(params.category) as DiscoveryFilters["category"],
    length: readParam(params.length) as DiscoveryFilters["length"],
    difficulty: readParam(params.difficulty) as DiscoveryFilters["difficulty"],
    mode: readParam(params.mode) as DiscoveryFilters["mode"]
  };
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
