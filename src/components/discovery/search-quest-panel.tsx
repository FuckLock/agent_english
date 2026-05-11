import { Search } from "lucide-react";

import {
  difficultyFilters,
  discoveryCategories,
  lengthFilters,
  modeFilters
} from "@/lib/discovery-options";
import type { DiscoveryFilters } from "@/server/content/content-pipeline";

type SearchQuestPanelProps = {
  filters: Required<DiscoveryFilters>;
  message: string;
  providerMode: string;
};

export function SearchQuestPanel({ filters, message, providerMode }: SearchQuestPanelProps) {
  return (
    <section className="discover-panel search-quest-panel" aria-labelledby="search-quest-title">
      <div className="discover-panel__heading">
        <p className="section-kicker">Quest Finder</p>
        <h2 id="search-quest-title">找一个想打的英文副本</h2>
      </div>

      <form action="/discover" className="discover-search-form">
        <label className="discover-search-form__query">
          <Search aria-hidden="true" size={18} />
          <input defaultValue={filters.q} name="q" placeholder="AI 新闻、电影幕后、旅行尴尬经历" />
        </label>

        <select defaultValue={filters.category} name="category">
          {discoveryCategories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>

        <select defaultValue={filters.length} name="length">
          {lengthFilters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>

        <select defaultValue={filters.difficulty} name="difficulty">
          {difficultyFilters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>

        <select defaultValue={filters.mode} name="mode">
          {modeFilters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>

        <button type="submit">搜索</button>
      </form>

      <p className={`provider-mode provider-mode--${providerMode}`}>{message}</p>
    </section>
  );
}
