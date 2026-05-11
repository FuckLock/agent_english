import { getDb } from "./client";
import {
  contentExcerpts,
  contentProcessingJobs,
  contentSources,
  dungeons,
  providerTemplates,
  storyLessons
} from "./schema";
import { demoJson, lessonSeeds, providerTemplateSeeds } from "./seed-data";
import { getTemplateDefinition, serializeTemplateSchema } from "../providers/provider-templates";

export function applyProviderTemplates(timestamp: string) {
  const db = getDb();

  for (const [id, providerKey, name, capability, defaultBaseUrl, defaultModel] of providerTemplateSeeds) {
    const templateDefinition = getTemplateDefinition(id);

    db.insert(providerTemplates)
      .values({
        id,
        providerKey,
        name,
        capability,
        defaultBaseUrl,
        defaultModel,
        configSchemaJson: templateDefinition
          ? serializeTemplateSchema(templateDefinition)
          : demoJson.providerSchema,
        isBuiltin: true,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoUpdate({
        target: providerTemplates.id,
        set: { name, capability, defaultBaseUrl, defaultModel, updatedAt: timestamp }
      })
      .run();
  }
}

export function applyLessons(timestamp: string) {
  const db = getDb();

  for (const seed of lessonSeeds) {
    db.insert(contentSources)
      .values({
        id: seed.sourceId,
        sourceType: seed.sourceType,
        title: seed.title,
        url: null,
        originName: "Seed Demo",
        language: "en",
        status: "ready",
        difficultyLevel: seed.difficultyLevel,
        copyrightRisk: "low",
        longTermStorageRisk: "low",
        metadataJson: demoJson.empty,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoUpdate({
        target: contentSources.id,
        set: { title: seed.title, status: "ready", updatedAt: timestamp }
      })
      .run();

    db.insert(contentExcerpts)
      .values({
        id: seed.excerptId,
        contentSourceId: seed.sourceId,
        excerptText: seed.excerpt,
        summary: seed.summary,
        wordCount: seed.excerpt.split(" ").length,
        difficultyLevel: seed.difficultyLevel,
        fullTextCacheStatus: "short_excerpt_only",
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoUpdate({
        target: contentExcerpts.id,
        set: { excerptText: seed.excerpt, summary: seed.summary, updatedAt: timestamp }
      })
      .run();

    db.insert(contentProcessingJobs)
      .values({
        id: seed.jobId,
        contentSourceId: seed.sourceId,
        jobType: "seed_prepare",
        status: "succeeded",
        errorSummary: null,
        resultJson: demoJson.empty,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoUpdate({
        target: contentProcessingJobs.id,
        set: { status: "succeeded", updatedAt: timestamp }
      })
      .run();

    db.insert(storyLessons)
      .values({
        id: seed.lessonId,
        contentSourceId: seed.sourceId,
        title: seed.title,
        level: seed.level,
        coverStatus: "skipped",
        shortSummary: seed.summary,
        fullTextFolded: true,
        lessonJson: demoJson.lesson,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoUpdate({
        target: storyLessons.id,
        set: { title: seed.title, level: seed.level, updatedAt: timestamp }
      })
      .run();

    db.insert(dungeons)
      .values({
        id: seed.dungeonId,
        storyLessonId: seed.lessonId,
        slug: seed.slug,
        title: seed.title,
        level: seed.level,
        tag: seed.tag,
        xpReward: seed.xpReward,
        progressPercent: seed.progressPercent,
        tone: seed.tone,
        mapTop: seed.mapTop,
        mapLeft: seed.mapLeft,
        region: seed.region,
        status: "available",
        objectiveText: seed.objectiveText,
        monsterName: seed.monsterName,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoUpdate({
        target: dungeons.id,
        set: { progressPercent: seed.progressPercent, status: "available", updatedAt: timestamp }
      })
      .run();
  }
}
