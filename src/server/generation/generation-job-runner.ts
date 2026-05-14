import { and, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { comicPanels, generationJobs } from "@/server/db/schema";
import { asJson, nowIso } from "@/server/db/utils";
import {
  getProviderSetupStatus,
  getReadyProviderConfigId
} from "@/server/repositories/provider-repository";

export const generationJobStatuses = [
  "pending",
  "submitted",
  "polling",
  "succeeded",
  "failed",
  "cancelled",
  "skipped"
] as const;

export type GenerationQuality = "draft" | "standard" | "high";
export type GenerationJobStatus = (typeof generationJobStatuses)[number];
export type GenerationJobType =
  | "cover_image"
  | "panel_image"
  | "monster_card"
  | "clearance_card"
  | "equipment_card"
  | "tts";

type PanelForJob = {
  id: string;
  storyLessonId: string;
  panelOrder: number;
  imagePrompt: string;
};

type JobInput = {
  id: string;
  storyLessonId: string;
  comicPanelId?: string | null;
  providerConfigId?: string | null;
  jobType: GenerationJobType;
  status: GenerationJobStatus;
  quality: GenerationQuality;
  dedupeKey: string;
  request: Record<string, unknown>;
  result?: Record<string, unknown>;
  errorSummary?: string | null;
};

export function ensureLessonGenerationJobs(lessonId: string, quality: GenerationQuality = "draft") {
  const db = getDb();
  const panels = db.select().from(comicPanels).where(eq(comicPanels.storyLessonId, lessonId)).all();
  const providerStatus = getProviderSetupStatus();
  const imageProviderId = getReadyProviderConfigId("image");
  const ttsProviderId = getReadyProviderConfigId("tts");

  upsertJob({
    id: `job-${lessonId}-cover-${quality}`,
    storyLessonId: lessonId,
    jobType: "cover_image",
    providerConfigId: imageProviderId,
    status: providerStatus.hasImageProvider ? "pending" : "skipped",
    quality,
    dedupeKey: `lesson:${lessonId}:cover:${quality}`,
    request: { target: "cover", quality },
    errorSummary: providerStatus.hasImageProvider ? null : "图片 Provider 未配置，封面降级为文本卡。"
  });

  ensureLessonVisualJob({
    lessonId,
    jobType: "monster_card",
    target: "monster_card",
    quality,
    hasImageProvider: providerStatus.hasImageProvider,
    providerConfigId: imageProviderId,
    missingProviderMessage: "图片 Provider 未配置，怪兽卡降级为可读任务卡。"
  });

  ensureLessonVisualJob({
    lessonId,
    jobType: "clearance_card",
    target: "clearance_card",
    quality,
    hasImageProvider: providerStatus.hasImageProvider,
    providerConfigId: imageProviderId,
    missingProviderMessage: "图片 Provider 未配置，通关卡降级为文字奖励卡。"
  });

  for (const panel of panels) {
    ensurePanelImageJob(toPanelForJob(panel), quality, providerStatus.hasImageProvider, imageProviderId);
  }

  upsertJob({
    id: `job-${lessonId}-tts-standard`,
    storyLessonId: lessonId,
    jobType: "tts",
    providerConfigId: ttsProviderId,
    status: providerStatus.hasTtsProvider ? "pending" : "skipped",
    quality: "standard",
    dedupeKey: `lesson:${lessonId}:tts:standard`,
    request: { target: "lesson_audio" },
    errorSummary: providerStatus.hasTtsProvider ? null : "TTS Provider 未配置，先隐藏播放能力。"
  });
}

export function ensurePanelImageJob(
  panel: PanelForJob,
  quality: GenerationQuality,
  hasImageProvider: boolean,
  providerConfigId: string | null
) {
  upsertJob({
    id: `job-${panel.id}-${quality}`,
    storyLessonId: panel.storyLessonId,
    comicPanelId: panel.id,
    jobType: "panel_image",
    providerConfigId,
    status: hasImageProvider ? "pending" : "skipped",
    quality,
    dedupeKey: `lesson:${panel.storyLessonId}:panel:${panel.id}:${quality}`,
    request: {
      target: "comic_panel",
      panelOrder: panel.panelOrder,
      prompt: panel.imagePrompt,
      quality
    },
    errorSummary: hasImageProvider ? null : "图片 Provider 未配置，本格显示无图降级卡。"
  });

  getDb()
    .update(comicPanels)
    .set({ imageStatus: hasImageProvider ? "pending" : "skipped", updatedAt: nowIso() })
    .where(eq(comicPanels.id, panel.id))
    .run();
}

export function retryLessonImages(lessonId: string, quality: GenerationQuality = "draft") {
  ensureLessonGenerationJobs(lessonId, quality);
  const providerStatus = getProviderSetupStatus();
  const panels = getDb()
    .select()
    .from(comicPanels)
    .where(eq(comicPanels.storyLessonId, lessonId))
    .all();

  return {
    queued: panels.length + 3,
    imageMode: providerStatus.imageMode
  };
}

export function ensureEquipmentCardJob(input: {
  lessonId: string;
  equipmentId: string;
  expression: string;
  quality?: GenerationQuality;
}) {
  const providerStatus = getProviderSetupStatus();
  const providerConfigId = getReadyProviderConfigId("image");
  const quality = input.quality ?? "draft";

  upsertJob({
    id: `job-${input.equipmentId}-${quality}`,
    storyLessonId: input.lessonId,
    jobType: "equipment_card",
    providerConfigId,
    status: providerStatus.hasImageProvider ? "pending" : "skipped",
    quality,
    dedupeKey: `lesson:${input.lessonId}:equipment:${input.equipmentId}:${quality}`,
    request: {
      target: "equipment_card",
      expression: input.expression,
      quality
    },
    errorSummary: providerStatus.hasImageProvider ? null : "图片 Provider 未配置，装备卡降级为文字卡。"
  });
}

export function queueLessonTts(lessonId: string) {
  const providerStatus = getProviderSetupStatus();
  const providerConfigId = getReadyProviderConfigId("tts");

  upsertJob({
    id: `job-${lessonId}-tts-standard`,
    storyLessonId: lessonId,
    jobType: "tts",
    providerConfigId,
    status: providerStatus.hasTtsProvider ? "pending" : "skipped",
    quality: "standard",
    dedupeKey: `lesson:${lessonId}:tts:standard`,
    request: { target: "lesson_audio" },
    errorSummary: providerStatus.hasTtsProvider ? null : "TTS Provider 未配置，先隐藏播放能力。"
  });

  return {
    audioMode: providerStatus.hasTtsProvider ? "tts" : "manual-read"
  };
}

export function getTodayGenerationStats() {
  const todayPrefix = nowIso().slice(0, 10);
  const jobs = getDb().select().from(generationJobs).all();
  const todayJobs = jobs.filter((job) => job.createdAt.startsWith(todayPrefix));

  return {
    total: todayJobs.length,
    failed: todayJobs.filter((job) => job.status === "failed").length,
    skipped: todayJobs.filter((job) => job.status === "skipped").length
  };
}

function upsertJob(input: JobInput) {
  const db = getDb();
  const existing = db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.dedupeKey, input.dedupeKey))
    .get();
  const timestamp = nowIso();

  if (existing) {
    const shouldKeepTerminal =
      existing.status === "succeeded" || existing.status === "submitted" || existing.status === "polling";

    db.update(generationJobs)
      .set({
        status: shouldKeepTerminal ? existing.status : input.status,
        providerConfigId: input.providerConfigId ?? existing.providerConfigId,
        requestJson: asJson(input.request),
        resultJson: asJson(input.result ?? {}),
        errorSummary: shouldKeepTerminal ? existing.errorSummary : input.errorSummary ?? null,
        updatedAt: timestamp
      })
      .where(eq(generationJobs.id, existing.id))
      .run();
    return;
  }

  db.insert(generationJobs)
    .values({
      id: input.id,
      storyLessonId: input.storyLessonId,
      comicPanelId: input.comicPanelId ?? null,
      providerConfigId: input.providerConfigId ?? null,
      jobType: input.jobType,
      status: input.status,
      quality: input.quality,
      dedupeKey: input.dedupeKey,
      requestJson: asJson(input.request),
      resultJson: asJson(input.result ?? {}),
      errorSummary: input.errorSummary ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();
}

function ensureLessonVisualJob(input: {
  lessonId: string;
  jobType: Extract<GenerationJobType, "monster_card" | "clearance_card">;
  target: string;
  quality: GenerationQuality;
  hasImageProvider: boolean;
  providerConfigId: string | null;
  missingProviderMessage: string;
}) {
  upsertJob({
    id: `job-${input.lessonId}-${input.jobType}-${input.quality}`,
    storyLessonId: input.lessonId,
    jobType: input.jobType,
    providerConfigId: input.providerConfigId,
    status: input.hasImageProvider ? "pending" : "skipped",
    quality: input.quality,
    dedupeKey: `lesson:${input.lessonId}:${input.jobType}:${input.quality}`,
    request: { target: input.target, quality: input.quality },
    errorSummary: input.hasImageProvider ? null : input.missingProviderMessage
  });
}

function toPanelForJob(panel: typeof comicPanels.$inferSelect): PanelForJob {
  return {
    id: panel.id,
    storyLessonId: panel.storyLessonId,
    panelOrder: panel.panelOrder,
    imagePrompt: panel.imagePrompt
  };
}

export function getPanelJob(panelId: string) {
  return getDb()
    .select()
    .from(generationJobs)
    .where(and(eq(generationJobs.comicPanelId, panelId), eq(generationJobs.jobType, "panel_image")))
    .get();
}
