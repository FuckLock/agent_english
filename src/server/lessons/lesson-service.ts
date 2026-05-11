import { asc, eq } from "drizzle-orm";

import {
  createExtensionPanelDraft,
  createStoryLessonDraft,
  type StoryLessonDraft
} from "@/server/ai/story-lesson-generator";
import { getDb } from "@/server/db/client";
import {
  comicPanels,
  contentExcerpts,
  contentSources,
  dungeons,
  generationJobs,
  savedExpressions,
  storyLessons
} from "@/server/db/schema";
import { asJson, nowIso } from "@/server/db/utils";
import {
  ensureLessonGenerationJobs,
  ensurePanelImageJob,
  getTodayGenerationStats,
  queueLessonTts,
  retryLessonImages,
  type GenerationQuality
} from "@/server/generation/generation-job-runner";
import { normalizeCategory, normalizeDifficulty } from "@/server/content/content-analysis";
import { parseRecord, readLessonDraft, slugifyId } from "@/server/lessons/lesson-draft";
import { ensureMinimumPanels, getPanelId, insertPanel, updateLessonDraft } from "@/server/lessons/lesson-panels";
import { getProviderSetupStatus, getReadyProviderConfigId } from "@/server/repositories/provider-repository";

export type LessonPanelView = {
  id: string;
  order: number;
  englishText: string;
  chineseHint: string;
  explanationZh: string;
  imagePrompt: string;
  imageStatus: string;
  imageUrl: string | null;
  expression: string;
  meaningZh: string;
  jobStatus: string | null;
  jobError: string | null;
};

export type LessonPageModel = {
  id: string;
  title: string;
  level: string;
  summaryZh: string;
  objectiveText: string;
  fullText: string;
  fullTextFolded: boolean;
  coverPrompt: string;
  coverJobStatus: string | null;
  coverJobError: string | null;
  panels: LessonPanelView[];
  expressions: StoryLessonDraft["expressions"];
  ttsDisclosure: string;
  ttsStatus: string | null;
  ttsError: string | null;
  canUseTts: boolean;
  canGenerateImages: boolean;
  generationStats: ReturnType<typeof getTodayGenerationStats>;
  dungeonId: string | null;
};

export function getOrCreateStoryLessonFromSource(contentSourceId: string) {
  const existing = getDb()
    .select()
    .from(storyLessons)
    .where(eq(storyLessons.contentSourceId, contentSourceId))
    .get();

  if (existing) {
    ensureLessonGenerationJobs(existing.id);
    return existing;
  }

  const sourceBundle = getSourceBundle(contentSourceId);
  if (!sourceBundle) return null;

  const metadata = parseRecord(sourceBundle.source.metadataJson);
  const category = normalizeCategory(metadata.category);
  const level = normalizeDifficulty(sourceBundle.source.difficultyLevel).toUpperCase();
  const draft = createStoryLessonDraft({
    title: sourceBundle.source.title,
    level,
    category,
    summary: sourceBundle.excerpt?.summary ?? sourceBundle.source.title,
    excerpt: sourceBundle.excerpt?.excerptText ?? sourceBundle.source.title,
    originName: sourceBundle.source.originName ?? "Manual Source"
  });
  const timestamp = nowIso();
  const lessonId = `lesson-${slugifyId(contentSourceId.replace(/^source-/, ""))}`;

  getDb()
    .insert(storyLessons)
    .values({
      id: lessonId,
      contentSourceId,
      title: draft.title,
      level: draft.level,
      coverStatus: "skipped",
      shortSummary: draft.summaryZh,
      fullTextFolded: true,
      lessonJson: asJson(draft as unknown as Record<string, unknown>),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();

  for (const panel of draft.panels) {
    insertPanel(lessonId, panel, "skipped", timestamp);
  }

  ensureLessonGenerationJobs(lessonId);

  return getDb().select().from(storyLessons).where(eq(storyLessons.id, lessonId)).get() ?? null;
}

export function getLessonPageModel(lessonId: string): LessonPageModel | null {
  const db = getDb();
  const lesson = db.select().from(storyLessons).where(eq(storyLessons.id, lessonId)).get();
  if (!lesson) return null;

  ensureMinimumPanels(lesson.id);
  ensureLessonGenerationJobs(lesson.id);

  const source = db
    .select()
    .from(contentSources)
    .where(eq(contentSources.id, lesson.contentSourceId))
    .get();
  const excerpt = db
    .select()
    .from(contentExcerpts)
    .where(eq(contentExcerpts.contentSourceId, lesson.contentSourceId))
    .get();
  const panels = db
    .select()
    .from(comicPanels)
    .where(eq(comicPanels.storyLessonId, lesson.id))
    .orderBy(asc(comicPanels.panelOrder))
    .all();
  const jobs = db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.storyLessonId, lesson.id))
    .all();
  const draft = readLessonDraft(lesson.lessonJson, lesson, panels);
  const coverJob = jobs.find((job) => job.jobType === "cover_image") ?? null;
  const ttsJob = jobs.find((job) => job.jobType === "tts") ?? null;
  const providerStatus = getProviderSetupStatus();
  const dungeon = db
    .select()
    .from(dungeons)
    .where(eq(dungeons.storyLessonId, lesson.id))
    .get();

  const panelViews = panels.map((panel) => {
    const panelDraft = draft.panels.find(
      (item) => item.order === panel.panelOrder && item.englishText === panel.englishText
    );
    const panelJob = jobs.find((job) => job.comicPanelId === panel.id && job.jobType === "panel_image");

    return {
      id: panel.id,
      order: panel.panelOrder,
      englishText: panel.englishText,
      chineseHint: panel.chineseHint,
      explanationZh: panelDraft?.explanationZh ?? "这句可以直接放进真实对话里复用。",
      imagePrompt: panel.imagePrompt,
      imageStatus: panel.imageStatus,
      imageUrl: panel.imageUrl,
      expression: panelDraft?.expression ?? panel.englishText.replace(/[.!?]+$/g, ""),
      meaningZh: panelDraft?.meaningZh ?? "可复用表达。",
      jobStatus: panelJob?.status ?? null,
      jobError: panelJob?.errorSummary ?? null
    };
  });

  return {
    id: lesson.id,
    title: lesson.title,
    level: lesson.level,
    summaryZh: draft.summaryZh,
    objectiveText: draft.objectiveText,
    fullText: excerpt?.excerptText || draft.fullText || draft.sourceExcerpt,
    fullTextFolded: lesson.fullTextFolded,
    coverPrompt: draft.coverPrompt,
    coverJobStatus: coverJob?.status ?? null,
    coverJobError: coverJob?.errorSummary ?? null,
    panels: panelViews,
    expressions: panelViews.map((panel) => ({
      expression: panel.expression,
      meaningZh: panel.meaningZh,
      sourceText: panel.englishText
    })),
    ttsDisclosure: draft.ttsDisclosure,
    ttsStatus: ttsJob?.status ?? null,
    ttsError: ttsJob?.errorSummary ?? null,
    canUseTts: providerStatus.hasTtsProvider,
    canGenerateImages: providerStatus.hasImageProvider,
    generationStats: getTodayGenerationStats(),
    dungeonId: dungeon?.id ?? null
  };
}

export function extendLessonPanels(lessonId: string, quality: GenerationQuality = "draft") {
  const model = getLessonPageModel(lessonId);
  if (!model || model.panels.length >= 6) return model;

  const timestamp = nowIso();
  const providerStatus = getProviderSetupStatus();
  const providerConfigId = getReadyProviderConfigId("image");
  const lesson = getDb().select().from(storyLessons).where(eq(storyLessons.id, lessonId)).get();
  if (!lesson) return model;

  const draft = readLessonDraft(lesson.lessonJson, lesson, []);
  const nextOrder = model.panels.length + 1;
  const panelDraft = createExtensionPanelDraft(nextOrder, model.title, draft.category);
  const panelId = getPanelId(lessonId, nextOrder);

  insertPanel(lessonId, panelDraft, providerStatus.hasImageProvider ? "pending" : "skipped", timestamp);
  ensurePanelImageJob(
    {
      id: panelId,
      storyLessonId: lessonId,
      panelOrder: nextOrder,
      imagePrompt: panelDraft.imagePrompt
    },
    quality,
    providerStatus.hasImageProvider,
    providerConfigId
  );
  updateLessonDraft(lessonId, panelDraft);

  return getLessonPageModel(lessonId);
}

export function retryLessonImageJobs(lessonId: string, quality: GenerationQuality = "draft") {
  retryLessonImages(lessonId, quality);
  return getLessonPageModel(lessonId);
}

export function queueLessonAudioJob(lessonId: string) {
  queueLessonTts(lessonId);
  return getLessonPageModel(lessonId);
}

export function saveLessonExpression(input: {
  lessonId: string;
  expression: string;
  meaningZh: string;
  sourceText: string;
}) {
  const timestamp = nowIso();
  const id = `saved-${input.lessonId}-${slugifyId(input.expression)}`;

  getDb()
    .insert(savedExpressions)
    .values({
      id,
      storyLessonId: input.lessonId,
      battleTurnId: null,
      expression: input.expression,
      meaningZh: input.meaningZh,
      sourceText: input.sourceText,
      status: "saved",
      usedCount: 0,
      nextReviewAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: savedExpressions.id,
      set: { status: "saved", updatedAt: timestamp }
    })
    .run();

  return { ok: true, id };
}

function getSourceBundle(contentSourceId: string) {
  const db = getDb();
  const source = db.select().from(contentSources).where(eq(contentSources.id, contentSourceId)).get();
  if (!source) return null;

  return {
    source,
    excerpt: db
      .select()
      .from(contentExcerpts)
      .where(eq(contentExcerpts.contentSourceId, contentSourceId))
      .get()
  };
}
