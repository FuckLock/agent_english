import { asc, eq } from "drizzle-orm";

import { DEFAULT_COMIC_PANEL_COUNT, type StoryPanelDraft } from "@/server/ai/story-lesson-generator";
import { getDb } from "@/server/db/client";
import { comicPanels, storyLessons } from "@/server/db/schema";
import { asJson, nowIso } from "@/server/db/utils";
import { readLessonDraft } from "@/server/lessons/lesson-draft";

export function insertPanel(
  lessonId: string,
  panel: StoryPanelDraft,
  imageStatus: string,
  timestamp: string
) {
  getDb()
    .insert(comicPanels)
    .values({
      id: getPanelId(lessonId, panel.order),
      storyLessonId: lessonId,
      panelOrder: panel.order,
      englishText: panel.englishText,
      chineseHint: panel.chineseHint,
      imagePrompt: panel.imagePrompt,
      imageStatus,
      imageUrl: null,
      rhythmType: panel.rhythmType,
      visualGrammarJson: asJson(panel.visualGrammar),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: comicPanels.id,
      set: {
        englishText: panel.englishText,
        chineseHint: panel.chineseHint,
        imagePrompt: panel.imagePrompt,
        imageStatus,
        rhythmType: panel.rhythmType,
        visualGrammarJson: asJson(panel.visualGrammar),
        updatedAt: timestamp
      }
    })
    .run();
}

export function ensureMinimumPanels(lessonId: string) {
  const db = getDb();
  const panels = db
    .select()
    .from(comicPanels)
    .where(eq(comicPanels.storyLessonId, lessonId))
    .orderBy(asc(comicPanels.panelOrder))
    .all();

  if (panels.length >= DEFAULT_COMIC_PANEL_COUNT) return;

  const lesson = db.select().from(storyLessons).where(eq(storyLessons.id, lessonId)).get();
  if (!lesson) return;

  const draft = readLessonDraft(lesson.lessonJson, lesson, panels);
  const timestamp = nowIso();

  const existingOrders = new Set(panels.map((panel) => panel.panelOrder));
  for (const panel of draft.panels.slice(0, DEFAULT_COMIC_PANEL_COUNT)) {
    if (existingOrders.has(panel.order)) continue;
    insertPanel(lessonId, panel, "skipped", timestamp);
  }
}

export function updateLessonDraft(lessonId: string, panel: StoryPanelDraft) {
  const db = getDb();
  const lesson = db.select().from(storyLessons).where(eq(storyLessons.id, lessonId)).get();
  if (!lesson) return;

  const currentPanels = db
    .select()
    .from(comicPanels)
    .where(eq(comicPanels.storyLessonId, lessonId))
    .orderBy(asc(comicPanels.panelOrder))
    .all();
  const draft = readLessonDraft(lesson.lessonJson, lesson, currentPanels);
  const panels = [...currentPanels.map((item) => toPanelDraft(item, draft.panels)), panel].sort(
    (first, second) => first.order - second.order
  );
  const expressions = panels.map((item) => ({
    expression: item.expression,
    meaningZh: item.meaningZh,
    sourceText: item.englishText
  }));

  getDb()
    .update(storyLessons)
    .set({
      lessonJson: asJson({ ...draft, panelCount: panels.length, panels, expressions }),
      updatedAt: nowIso()
    })
    .where(eq(storyLessons.id, lessonId))
    .run();
}

export function getPanelId(lessonId: string, order: number) {
  return `panel-${lessonId}-${order}`;
}

function toPanelDraft(
  panel: typeof comicPanels.$inferSelect,
  draftPanels: StoryPanelDraft[]
): StoryPanelDraft {
  const existing = draftPanels.find(
    (item) => item.order === panel.panelOrder && item.englishText === panel.englishText
  );
  if (existing) return existing;

  return {
    order: panel.panelOrder,
    englishText: panel.englishText,
    chineseHint: panel.chineseHint,
    explanationZh: "这句可以直接拿去复用。",
    imagePrompt: panel.imagePrompt,
    expression: panel.englishText.replace(/[.!?]+$/g, ""),
    meaningZh: "可复用表达。",
    rhythmType: readRhythmType(panel.rhythmType),
    visualGrammar: readVisualGrammar(panel.visualGrammarJson)
  };
}

function readRhythmType(value: string): StoryPanelDraft["rhythmType"] {
  const allowed: StoryPanelDraft["rhythmType"][] = [
    "setup",
    "turn",
    "reaction",
    "challenge",
    "expression",
    "reward",
    "extension"
  ];

  return allowed.includes(value as StoryPanelDraft["rhythmType"])
    ? (value as StoryPanelDraft["rhythmType"])
    : "extension";
}

function readVisualGrammar(value: string): StoryPanelDraft["visualGrammar"] {
  try {
    const parsed = JSON.parse(value) as Partial<StoryPanelDraft["visualGrammar"]>;
    return {
      shot: typeof parsed.shot === "string" ? parsed.shot : "comic beat",
      focus: typeof parsed.focus === "string" ? parsed.focus : "story comprehension",
      mood: typeof parsed.mood === "string" ? parsed.mood : "warm adventure"
    };
  } catch {
    return { shot: "comic beat", focus: "story comprehension", mood: "warm adventure" };
  }
}
