import { getDb } from "./client";
import {
  comicPanels,
  contentExcerpts,
  contentProcessingJobs,
  contentSources,
  dungeons,
  expressionEquipment,
  generationJobs,
  savedExpressions,
  storyLessons
} from "./schema";
import { prologueLessonJson, prologueSeed } from "./seed-data";
import { asJson } from "./utils";

export function applyPrologueSeed(timestamp: string) {
  const db = getDb();
  const seed = prologueSeed;

  db.insert(contentSources)
    .values({
      id: seed.sourceId,
      sourceType: seed.sourceType,
      title: seed.title,
      url: null,
      originName: "Built-in Prologue",
      language: "en",
      status: "ready",
      difficultyLevel: seed.difficultyLevel,
      copyrightRisk: "low",
      longTermStorageRisk: "low",
      metadataJson: asJson({
        category: seed.category,
        length: "short",
        mode: "prologue",
        suitableForDungeon: true,
        isPrologue: true,
        reasons: []
      }),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: contentSources.id,
      set: {
        title: seed.title,
        status: "ready",
        difficultyLevel: seed.difficultyLevel,
        metadataJson: asJson({
          category: seed.category,
          length: "short",
          mode: "prologue",
          suitableForDungeon: true,
          isPrologue: true,
          reasons: []
        }),
        updatedAt: timestamp
      }
    })
    .run();

  db.insert(contentExcerpts)
    .values({
      id: seed.excerptId,
      contentSourceId: seed.sourceId,
      excerptText: seed.excerpt,
      summary: seed.summary,
      wordCount: seed.excerpt.split(/\s+/).length,
      difficultyLevel: seed.difficultyLevel,
      fullTextCacheStatus: "built_in_full_text",
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: contentExcerpts.id,
      set: {
        excerptText: seed.excerpt,
        summary: seed.summary,
        wordCount: seed.excerpt.split(/\s+/).length,
        updatedAt: timestamp
      }
    })
    .run();

  db.insert(contentProcessingJobs)
    .values({
      id: seed.jobId,
      contentSourceId: seed.sourceId,
      jobType: "prologue_ready",
      status: "succeeded",
      errorSummary: null,
      resultJson: asJson({ builtIn: true }),
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
      coverStatus: "ready",
      shortSummary: seed.summary,
      fullTextFolded: false,
      lessonJson: prologueLessonJson,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: storyLessons.id,
      set: {
        title: seed.title,
        coverStatus: "ready",
        shortSummary: seed.summary,
        fullTextFolded: false,
        lessonJson: prologueLessonJson,
        updatedAt: timestamp
      }
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
      isPrologue: true,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: dungeons.id,
      set: {
        status: "available",
        isPrologue: true,
        progressPercent: seed.progressPercent,
        updatedAt: timestamp
      }
    })
    .run();

  for (const panel of seed.panels) {
    db.insert(comicPanels)
      .values({
        id: panel.id,
        storyLessonId: seed.lessonId,
        panelOrder: panel.order,
        englishText: panel.englishText,
        chineseHint: panel.chineseHint,
        imagePrompt: `prologue panel ${panel.order} built-in`,
        imageStatus: "ready",
        imageUrl: panel.imageUrl,
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
          imageStatus: "ready",
          imageUrl: panel.imageUrl,
          rhythmType: panel.rhythmType,
          visualGrammarJson: asJson(panel.visualGrammar),
          updatedAt: timestamp
        }
      })
      .run();
  }

  db.insert(generationJobs)
    .values({
      id: "generation-prologue-cover",
      storyLessonId: seed.lessonId,
      comicPanelId: null,
      providerConfigId: null,
      jobType: "cover_image",
      status: "succeeded",
      quality: "standard",
      dedupeKey: "prologue:cover",
      requestJson: asJson({ builtIn: true }),
      resultJson: asJson({ imageUrl: seed.coverImageUrl, builtIn: true }),
      errorSummary: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: generationJobs.id,
      set: {
        status: "succeeded",
        resultJson: asJson({ imageUrl: seed.coverImageUrl, builtIn: true }),
        updatedAt: timestamp
      }
    })
    .run();

  db.insert(savedExpressions)
    .values({
      id: seed.helloSword.expressionId,
      storyLessonId: seed.lessonId,
      battleTurnId: null,
      expression: seed.helloSword.expression,
      meaningZh: seed.helloSword.meaningZh,
      sourceText: seed.helloSword.sourceText,
      status: "locked",
      usedCount: 0,
      nextReviewAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: savedExpressions.id,
      set: { status: "locked", updatedAt: timestamp }
    })
    .run();

  db.insert(expressionEquipment)
    .values({
      id: seed.helloSword.equipmentId,
      savedExpressionId: seed.helloSword.expressionId,
      equipmentName: seed.helloSword.equipmentName,
      rarity: seed.helloSword.rarity,
      useCount: 0,
      equipped: false,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: expressionEquipment.id,
      set: { equipped: false, updatedAt: timestamp }
    })
    .run();
}
