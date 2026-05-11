import { asc, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  comicPanels,
  contentExcerpts,
  contentProcessingJobs,
  contentSources,
  generationJobs,
  storyLessons
} from "@/server/db/schema";

export function listContentSources() {
  return getDb()
    .select()
    .from(contentSources)
    .orderBy(asc(contentSources.createdAt))
    .all();
}

export function getContentSourceDetail(contentSourceId: string) {
  const db = getDb();
  const source = db
    .select()
    .from(contentSources)
    .where(eq(contentSources.id, contentSourceId))
    .get();

  if (!source) {
    return null;
  }

  return {
    source,
    excerpts: db
      .select()
      .from(contentExcerpts)
      .where(eq(contentExcerpts.contentSourceId, contentSourceId))
      .all(),
    jobs: db
      .select()
      .from(contentProcessingJobs)
      .where(eq(contentProcessingJobs.contentSourceId, contentSourceId))
      .all()
  };
}

export function listStoryLessons() {
  return getDb().select().from(storyLessons).orderBy(asc(storyLessons.createdAt)).all();
}

export function getStoryLessonWithPanels(storyLessonId: string) {
  const db = getDb();
  const lesson = db
    .select()
    .from(storyLessons)
    .where(eq(storyLessons.id, storyLessonId))
    .get();

  if (!lesson) {
    return null;
  }

  return {
    lesson,
    panels: db
      .select()
      .from(comicPanels)
      .where(eq(comicPanels.storyLessonId, storyLessonId))
      .orderBy(asc(comicPanels.panelOrder))
      .all(),
    generationJobs: db
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.storyLessonId, storyLessonId))
      .all()
  };
}
