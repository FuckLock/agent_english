import { desc, eq } from "drizzle-orm";

import { getDatabasePath, getDb } from "@/server/db/client";
import {
  appSettings,
  battleSessions,
  bossTrainingItems,
  expressionEquipment,
  learningRecords,
  providerUsageLogs,
  reviewTriggers,
  savedExpressions,
  storyLessons,
  userProgress
} from "@/server/db/schema";
import { listProviderConfigsSafe } from "@/server/repositories/provider-repository";

export function exportLearningData() {
  const db = getDb();
  const recentFailures = db
    .select()
    .from(providerUsageLogs)
    .where(eq(providerUsageLogs.status, "failed"))
    .orderBy(desc(providerUsageLogs.createdAt))
    .limit(12)
    .all()
    .map((item) => ({
      eventType: item.eventType,
      status: item.status,
      errorSummary: truncate(item.errorSummary ?? ""),
      createdAt: item.createdAt
    }));

  return {
    exportedAt: new Date().toISOString(),
    databasePath: getDatabasePath(),
    learningData: {
      storyLessons: db.select().from(storyLessons).all(),
      savedExpressions: db.select().from(savedExpressions).all(),
      equipment: db.select().from(expressionEquipment).all(),
      reviewTriggers: db.select().from(reviewTriggers).all(),
      bossTrainingItems: db.select().from(bossTrainingItems).all(),
      learningRecords: db.select().from(learningRecords).all(),
      battleSessions: db.select().from(battleSessions).all(),
      userProgress: db.select().from(userProgress).all()
    },
    safeConfigSummary: {
      providerConfigs: listProviderConfigsSafe(),
      appSettings: db.select().from(appSettings).all()
    },
    recentFailures,
    sensitiveConfigExcluded: true
  };
}

export function getDataManagementSummary() {
  const db = getDb();
  const failures = db
    .select()
    .from(providerUsageLogs)
    .where(eq(providerUsageLogs.status, "failed"))
    .orderBy(desc(providerUsageLogs.createdAt))
    .limit(5)
    .all()
    .map((item) => ({
      id: item.id,
      eventType: item.eventType,
      errorSummary: truncate(item.errorSummary ?? ""),
      createdAt: item.createdAt
    }));

  return {
    databasePath: getDatabasePath(),
    storyLessons: db
      .select()
      .from(storyLessons)
      .orderBy(desc(storyLessons.createdAt))
      .all()
      .map((lesson) => ({ id: lesson.id, title: lesson.title, level: lesson.level })),
    counts: {
      learningRecords: db.select().from(learningRecords).all().length,
      savedExpressions: db.select().from(savedExpressions).all().length,
      equipment: db.select().from(expressionEquipment).all().length,
      reviewTriggers: db.select().from(reviewTriggers).all().length,
      bossItems: db.select().from(bossTrainingItems).all().length
    },
    recentFailures: failures
  };
}

function truncate(value: string) {
  return value.length > 180 ? `${value.slice(0, 180)}...` : value;
}
