import { getDatabasePath } from "./client";
import { runMigrations } from "./migrate";
import { seedDatabase } from "./seed";
import { isDirectRun } from "./utils";
import { getHomeOverview, listExpressionEquipment, listReviewQueue } from "../repositories/game-repository";
import {
  getStoryLessonWithPanels,
  listContentSources,
  listStoryLessons
} from "../repositories/lesson-repository";
import {
  listProviderConfigsSafe,
  listProviderTemplates
} from "../repositories/provider-repository";

export function runDatabaseSelfTest() {
  runMigrations();
  const seedResult = seedDatabase();
  const home = getHomeOverview();
  const sources = listContentSources();
  const lessons = listStoryLessons();
  const cafeLesson = getStoryLessonWithPanels("lesson-cafe-mystery");
  const templates = listProviderTemplates();
  const configs = listProviderConfigsSafe();
  const equipment = listExpressionEquipment();
  const reviewQueue = listReviewQueue();

  if (home.dungeons.length < 3) {
    throw new Error("Expected at least 3 seeded dungeons.");
  }

  if (home.progress.xpLabel === "0 XP") {
    throw new Error("Expected seeded user XP.");
  }

  if (!cafeLesson || cafeLesson.panels.length < 3) {
    throw new Error("Expected Cafe Mystery lesson with 3 comic panels.");
  }

  return {
    ok: true,
    databasePath: getDatabasePath(),
    seedResult,
    counts: {
      dungeons: home.dungeons.length,
      providerTemplates: templates.length,
      providerConfigsSafe: configs.length,
      contentSources: sources.length,
      storyLessons: lessons.length,
      equipment: equipment.length,
      reviewTriggers: reviewQueue.triggers.length,
      bossItems: reviewQueue.bossItems.length
    },
    home: {
      progress: home.progress,
      firstDungeon: home.dungeons[0]?.title ?? null
    }
  };
}

if (isDirectRun(import.meta.url)) {
  process.stdout.write(JSON.stringify(runDatabaseSelfTest(), null, 2) + "\n");
}
