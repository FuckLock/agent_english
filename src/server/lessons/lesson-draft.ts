import {
  DEFAULT_COMIC_PANEL_COUNT,
  createStoryLessonDraft,
  type StoryLessonDraft,
  type StoryPanelDraft
} from "@/server/ai/story-lesson-generator";
import { comicPanels, storyLessons } from "@/server/db/schema";
import { normalizeCategory } from "@/server/content/content-analysis";

export function readLessonDraft(
  value: string,
  lesson: typeof storyLessons.$inferSelect,
  panels: Array<typeof comicPanels.$inferSelect>
): StoryLessonDraft {
  const parsed = parseRecord(value);
  const sourceExcerpt =
    getString(parsed.sourceExcerpt) ||
    panels.map((panel) => panel.englishText).join(" ") ||
    lesson.shortSummary;
  const category = normalizeCategory(parsed.category);
  const fallback = createStoryLessonDraft({
    title: lesson.title,
    level: lesson.level,
    category,
    summary: lesson.shortSummary,
    excerpt: sourceExcerpt,
    originName: "Seed Demo"
  });

  return {
    ...fallback,
    title: getString(parsed.title) || fallback.title,
    level: getString(parsed.level) || fallback.level,
    summaryZh: getString(parsed.summaryZh) || lesson.shortSummary,
    objectiveText: getString(parsed.objectiveText) || fallback.objectiveText,
    sourceExcerpt,
    fullText: getString(parsed.fullText) || sourceExcerpt,
    coverPrompt: getString(parsed.coverPrompt) || fallback.coverPrompt,
    panels: readPanelDrafts(parsed.panels, fallback.panels),
    expressions: readExpressions(parsed.expressions, fallback.expressions),
    ttsDisclosure: getString(parsed.ttsDisclosure) || fallback.ttsDisclosure
  };
}

export function parseRecord(value: string | unknown) {
  if (typeof value !== "string") return parseUnknownRecord(value);

  try {
    return parseUnknownRecord(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
}

export function slugifyId(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || crypto.randomUUID()
  );
}

function readPanelDrafts(value: unknown, fallback: StoryPanelDraft[]) {
  if (!Array.isArray(value)) return fallback;

  const panels = value
    .map((item) => {
      const record = parseUnknownRecord(item);
      const order = getNumber(record.order);
      const englishText = getString(record.englishText);
      if (!order || !englishText) return null;

      return {
        order,
        englishText,
        chineseHint: getString(record.chineseHint) || `第 ${order} 格中文提示。`,
        explanationZh: getString(record.explanationZh) || "这句可以直接拿去复用。",
        imagePrompt: getString(record.imagePrompt) || `comic panel ${order}`,
        expression: getString(record.expression) || englishText,
        meaningZh: getString(record.meaningZh) || "可复用表达。",
        rhythmType: readRhythmType(record.rhythmType, fallback[order - 1]?.rhythmType),
        visualGrammar: readVisualGrammar(record.visualGrammar, fallback[order - 1]?.visualGrammar)
      } satisfies StoryPanelDraft;
    })
    .filter((item): item is StoryPanelDraft => Boolean(item));

  if (panels.length === 0) return fallback;

  const panelByOrder = new Map(panels.map((panel) => [panel.order, panel]));
  for (const fallbackPanel of fallback.slice(0, DEFAULT_COMIC_PANEL_COUNT)) {
    if (!panelByOrder.has(fallbackPanel.order)) {
      panelByOrder.set(fallbackPanel.order, fallbackPanel);
    }
  }

  return [...panelByOrder.values()].sort((first, second) => first.order - second.order);
}

function readExpressions(value: unknown, fallback: StoryLessonDraft["expressions"]) {
  if (!Array.isArray(value)) return fallback;

  const expressions = value
    .map((item) => {
      const record = parseUnknownRecord(item);
      const expression = getString(record.expression);
      if (!expression) return null;

      return {
        expression,
        meaningZh: getString(record.meaningZh) || "可复用表达。",
        sourceText: getString(record.sourceText) || expression
      };
    })
    .filter((item): item is StoryLessonDraft["expressions"][number] => Boolean(item));

  return expressions.length > 0 ? expressions : fallback;
}

function parseUnknownRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readRhythmType(value: unknown, fallback: StoryPanelDraft["rhythmType"] = "extension") {
  const allowed: StoryPanelDraft["rhythmType"][] = [
    "setup",
    "turn",
    "reaction",
    "challenge",
    "expression",
    "reward",
    "extension"
  ];

  return typeof value === "string" && allowed.includes(value as StoryPanelDraft["rhythmType"])
    ? (value as StoryPanelDraft["rhythmType"])
    : fallback;
}

function readVisualGrammar(
  value: unknown,
  fallback: StoryPanelDraft["visualGrammar"] = {
    shot: "comic beat",
    focus: "story comprehension",
    mood: "warm adventure"
  }
) {
  const record = parseUnknownRecord(value);

  return {
    shot: getString(record.shot) || fallback.shot,
    focus: getString(record.focus) || fallback.focus,
    mood: getString(record.mood) || fallback.mood
  };
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
