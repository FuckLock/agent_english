import {
  difficultyFilters,
  lengthFilters,
  type DifficultyFilterId,
  type DiscoveryCategoryId,
  type DiscoveryModeId,
  type LengthFilterId
} from "@/lib/discovery-options";
import {
  analyzeManualContent,
  getCategoryLabel,
  getDifficultyLabel,
  getLengthLabel,
  normalizeCategory,
  normalizeDifficulty,
  normalizeLength,
  normalizeMode,
  type ManualContentInput
} from "@/server/content/content-analysis";
import { getDb } from "@/server/db/client";
import { contentExcerpts, contentProcessingJobs, contentSources } from "@/server/db/schema";
import { asJson, nowIso } from "@/server/db/utils";
import { getProviderSetupStatus } from "@/server/repositories/provider-repository";

export type DiscoveryFilters = {
  q?: string;
  category?: DiscoveryCategoryId;
  length?: LengthFilterId;
  difficulty?: DifficultyFilterId;
  mode?: DiscoveryModeId;
};

export type DiscoveryCandidate = {
  sourceId: string;
  title: string;
  originName: string;
  url: string | null;
  summary: string;
  excerpt: string;
  sourceType: string;
  category: DiscoveryCategoryId;
  categoryLabel: string;
  length: Exclude<LengthFilterId, "any">;
  lengthLabel: string;
  difficulty: Exclude<DifficultyFilterId, "any">;
  difficultyLabel: string;
  mode: DiscoveryModeId;
  wordCount: number;
  copyrightRisk: string;
  longTermStorageRisk: string;
  suitableForDungeon: boolean;
  reasons: string[];
};

export function searchDiscoveryCandidates(filters: DiscoveryFilters) {
  const normalized = normalizeFilters(filters);
  const candidates = listStoredCandidates().filter((candidate) => matchesFilters(candidate, normalized));
  const hasSearchProvider = getProviderSetupStatus().hasSearchProvider;

  return {
    providerMode: hasSearchProvider ? "provider-ready" : "manual-fallback",
    message: hasSearchProvider
      ? "搜索 Provider 已就绪，当前先返回本地标准化候选。"
      : "搜索 Provider 未配置，先显示本地演示内容，可直接粘贴 URL 或英文文本。",
    filters: normalized,
    candidates,
    fallbackActions: ["换关键词", "切换分类", "粘贴 URL / 英文文本"]
  };
}

export function createManualContent(input: ManualContentInput) {
  const analysis = analyzeManualContent(input);
  const timestamp = nowIso();
  const sourceId = `source-manual-${crypto.randomUUID()}`;
  const excerptId = `excerpt-${sourceId}`;
  const jobId = `job-${sourceId}`;
  const db = getDb();

  db.insert(contentSources)
    .values({
      id: sourceId,
      sourceType: input.sourceType,
      title: analysis.title,
      url: input.url ?? null,
      originName: analysis.originName,
      language: "en",
      status: analysis.suitableForDungeon ? "ready" : "summary_only",
      difficultyLevel: analysis.difficultyLabel,
      copyrightRisk: analysis.copyrightRisk,
      longTermStorageRisk: analysis.longTermStorageRisk,
      metadataJson: asJson(analysis.metadata),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();

  db.insert(contentExcerpts)
    .values({
      id: excerptId,
      contentSourceId: sourceId,
      excerptText: analysis.excerpt,
      summary: analysis.summary,
      wordCount: analysis.wordCount,
      difficultyLevel: analysis.difficultyLabel,
      fullTextCacheStatus: analysis.fullTextCacheStatus,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();

  db.insert(contentProcessingJobs)
    .values({
      id: jobId,
      contentSourceId: sourceId,
      jobType: "manual_intake",
      status: analysis.suitableForDungeon ? "succeeded" : "needs_review",
      errorSummary: analysis.suitableForDungeon ? null : analysis.reasons.join("；"),
      resultJson: asJson(analysis.metadata),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();

  return getCandidateBySourceId(sourceId);
}

function listStoredCandidates() {
  const db = getDb();
  const excerpts = db.select().from(contentExcerpts).all();

  return db
    .select()
    .from(contentSources)
    .all()
    .map((source) => {
      const excerpt = excerpts.find((item) => item.contentSourceId === source.id);
      const metadata = parseMetadata(source.metadataJson);
      const wordCount = excerpt?.wordCount ?? 0;
      const length = normalizeLength(metadata.length, wordCount);
      const difficulty = normalizeDifficulty(source.difficultyLevel);
      const category = normalizeCategory(metadata.category);

      return {
        sourceId: source.id,
        title: source.title,
        originName: source.originName ?? "Unknown",
        url: source.url,
        summary: excerpt?.summary ?? source.title,
        excerpt: excerpt?.excerptText ?? "",
        sourceType: source.sourceType,
        category,
        categoryLabel: getCategoryLabel(category),
        length,
        lengthLabel: getLengthLabel(length),
        difficulty,
        difficultyLabel: getDifficultyLabel(difficulty),
        mode: normalizeMode(metadata.mode),
        wordCount,
        copyrightRisk: source.copyrightRisk,
        longTermStorageRisk: source.longTermStorageRisk,
        suitableForDungeon: metadata.suitableForDungeon !== false && source.status === "ready",
        reasons: Array.isArray(metadata.reasons) ? metadata.reasons.map(String) : []
      } satisfies DiscoveryCandidate;
    });
}

function getCandidateBySourceId(sourceId: string) {
  return listStoredCandidates().find((candidate) => candidate.sourceId === sourceId) ?? null;
}

function matchesFilters(candidate: DiscoveryCandidate, filters: Required<DiscoveryFilters>) {
  const q = filters.q.trim().toLowerCase();
  const haystack = `${candidate.title} ${candidate.summary} ${candidate.excerpt}`.toLowerCase();

  return (
    (!q || haystack.includes(q)) &&
    (filters.category === "today" || candidate.category === filters.category) &&
    (filters.length === "any" || candidate.length === filters.length) &&
    (filters.difficulty === "any" || candidate.difficulty === filters.difficulty) &&
    candidate.mode === filters.mode
  );
}

function normalizeFilters(filters: DiscoveryFilters): Required<DiscoveryFilters> {
  return {
    q: filters.q ?? "",
    category: normalizeCategory(filters.category),
    length: isOption(filters.length, lengthFilters) ? filters.length : "any",
    difficulty: isOption(filters.difficulty, difficultyFilters) ? filters.difficulty : "any",
    mode: normalizeMode(filters.mode)
  };
}

function parseMetadata(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isOption<T extends readonly { id: string }[]>(value: unknown, options: T): value is T[number]["id"] {
  return typeof value === "string" && options.some((option) => option.id === value);
}
