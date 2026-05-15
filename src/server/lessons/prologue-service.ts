import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { contentSources, dungeons } from "@/server/db/schema";
import {
  ensureLessonGenerationJobs,
  type GenerationQuality
} from "@/server/generation/generation-job-runner";
import { ensureMinimumPanels } from "@/server/lessons/lesson-panels";

export const PROLOGUE_DUNGEON_ID = "dungeon-prologue";
export const PROLOGUE_LESSON_ID = "lesson-prologue";

export function isPrologueLesson(lessonId: string): boolean {
  const dungeon = getDb()
    .select({ isPrologue: dungeons.isPrologue })
    .from(dungeons)
    .where(eq(dungeons.storyLessonId, lessonId))
    .get();
  return Boolean(dungeon?.isPrologue);
}

export function isPrologueContentSource(contentSourceId: string): boolean {
  const source = getDb()
    .select({ sourceType: contentSources.sourceType })
    .from(contentSources)
    .where(eq(contentSources.id, contentSourceId))
    .get();
  return source?.sourceType === "prologue";
}

export function maybeEnsureLessonGenerationJobs(
  lessonId: string,
  quality: GenerationQuality = "draft"
) {
  if (isPrologueLesson(lessonId)) return;
  ensureLessonGenerationJobs(lessonId, quality);
}

export function maybeEnsureMinimumPanels(lessonId: string) {
  if (isPrologueLesson(lessonId)) return;
  ensureMinimumPanels(lessonId);
}
