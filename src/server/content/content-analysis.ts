import {
  difficultyFilters,
  discoveryCategories,
  lengthFilters,
  modeFilters,
  type DifficultyFilterId,
  type DiscoveryCategoryId,
  type DiscoveryModeId,
  type LengthFilterId
} from "@/lib/discovery-options";

export type ManualContentInput = {
  sourceType: "url" | "text";
  title?: string;
  url?: string;
  text?: string;
  category?: DiscoveryCategoryId;
  mode?: DiscoveryModeId;
};

const riskWords = ["adult", "violent", "hate", "extremist", "graphic"];
const navigationWords = ["cookie", "privacy policy", "subscribe", "advertisement", "menu"];
const copyrightWords = ["all rights reserved", "copyright", "paywall", "subscription required"];

export function analyzeManualContent(input: ManualContentInput) {
  const text = input.text?.trim() ?? "";
  const wordCount = countWords(text);
  const length = detectLength(wordCount);
  const difficulty = detectDifficulty(text, wordCount);
  const copyrightRisk = detectCopyrightRisk(text, wordCount, input.sourceType);
  const longTermStorageRisk = detectLongTermStorageRisk(wordCount, input.sourceType, copyrightRisk);
  const reasons = detectSuitabilityIssues(text, wordCount, input.sourceType, copyrightRisk);
  const category = input.category ?? "today";
  const categoryLabel = getCategoryLabel(category);
  const title = input.title?.trim() || inferTitle(text, input.url);

  return {
    title,
    originName: input.sourceType === "url" ? getUrlHost(input.url) : "Manual Text",
    summary: summarizeText(text, title),
    excerpt: makeExcerpt(text),
    wordCount,
    length,
    lengthLabel: getLengthLabel(length),
    difficulty,
    difficultyLabel: getDifficultyLabel(difficulty),
    copyrightRisk,
    longTermStorageRisk,
    fullTextCacheStatus: "short_excerpt_only",
    suitableForDungeon: reasons.length === 0,
    reasons,
    metadata: {
      category,
      categoryLabel,
      length,
      mode: input.mode ?? "quest",
      suitableForDungeon: reasons.length === 0,
      reasons
    }
  };
}

export function countWords(text: string) {
  return text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)?.length ?? 0;
}

export function normalizeLength(value: unknown, wordCount: number) {
  return value === "short" || value === "medium" || value === "long" ? value : detectLength(wordCount);
}

export function normalizeDifficulty(value: string): Exclude<DifficultyFilterId, "any"> {
  if (value === "入门" || value === "A1") return "beginner";
  if (value === "简单" || value === "A2") return "easy";
  return "medium";
}

export function normalizeCategory(value: unknown): DiscoveryCategoryId {
  return isOption(value, discoveryCategories) ? value : "today";
}

export function normalizeMode(value: unknown): DiscoveryModeId {
  return isOption(value, modeFilters) ? value : "quest";
}

export function getCategoryLabel(category: DiscoveryCategoryId) {
  return discoveryCategories.find((item) => item.id === category)?.label ?? "今日推荐";
}

export function getLengthLabel(length: Exclude<LengthFilterId, "any">) {
  return lengthFilters.find((item) => item.id === length)?.label ?? "短文";
}

export function getDifficultyLabel(difficulty: Exclude<DifficultyFilterId, "any">) {
  return difficultyFilters.find((item) => item.id === difficulty)?.label ?? "简单";
}

function detectSuitabilityIssues(
  text: string,
  wordCount: number,
  sourceType: string,
  copyrightRisk: string
) {
  const lowered = text.toLowerCase();
  const reasons: string[] = [];
  if (wordCount < 20) reasons.push("内容过短，缺少可打副本的情节或观点");
  if (wordCount > 900) reasons.push("内容过长，第一版先提炼为摘要卡");
  if (navigationWords.some((word) => lowered.includes(word))) reasons.push("疑似广告或导航页");
  if (riskWords.some((word) => lowered.includes(word))) reasons.push("题材不适合轻松学习副本");
  if (copyrightRisk === "high") reasons.push("版权风险高，只能保留短摘录或手动改写");
  if (sourceType === "url" && !text) reasons.push("URL 正文未抓取，需要手动粘贴正文");
  return reasons;
}

function detectCopyrightRisk(text: string, wordCount: number, sourceType: string) {
  const lowered = text.toLowerCase();
  if (copyrightWords.some((word) => lowered.includes(word))) return "high";
  if (sourceType === "url" || wordCount > 900) return "medium";
  return "low";
}

function detectLongTermStorageRisk(wordCount: number, sourceType: string, copyrightRisk: string) {
  if (copyrightRisk === "high" || wordCount > 900) return "high";
  if (sourceType === "url") return "medium";
  return "low";
}

function detectLength(wordCount: number): Exclude<LengthFilterId, "any"> {
  if (wordCount <= 80) return "short";
  if (wordCount <= 220) return "medium";
  return "long";
}

function detectDifficulty(text: string, wordCount: number): Exclude<DifficultyFilterId, "any"> {
  const words = text.match(/[A-Za-z]+/g) ?? [];
  const avgLength = words.reduce((sum, word) => sum + word.length, 0) / Math.max(words.length, 1);
  if (wordCount < 70 && avgLength < 5.2) return "beginner";
  if (avgLength < 6.2) return "easy";
  return "medium";
}

function isOption<T extends readonly { id: string }[]>(value: unknown, options: T): value is T[number]["id"] {
  return typeof value === "string" && options.some((option) => option.id === value);
}

function summarizeText(text: string, title: string) {
  const sentence = text.split(/[.!?。！？]/).find((part) => countWords(part) > 5)?.trim();
  return sentence ? `${sentence}.` : `${title} 的短摘录学习卡。`;
}

function makeExcerpt(text: string) {
  const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?|[.,!?;:]/g) ?? [];
  return words.slice(0, 90).join(" ") || "Paste English text to create a learning card.";
}

function inferTitle(text: string, url?: string) {
  const firstWords = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)?.slice(0, 7).join(" ");
  return firstWords || getUrlHost(url) || "Manual English Quest";
}

function getUrlHost(url?: string) {
  if (!url) return "Manual Source";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Manual Source";
  }
}
