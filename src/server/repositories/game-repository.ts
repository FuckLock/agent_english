import { asc, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  battleSessions,
  bossTrainingItems,
  dungeons,
  expressionEquipment,
  learningRecords,
  reviewTriggers,
  savedExpressions,
  userProgress
} from "@/server/db/schema";

export type HomeDungeon = {
  id: string;
  title: string;
  level: string;
  tag: string;
  xp: number;
  progress: number;
  tone: string;
  mapTop: string;
  mapLeft: string;
  region: string;
};

export type UserProgressSummary = {
  levelLabel: string;
  xpLabel: string;
  streakLabel: string;
};

const fallbackProgress: UserProgressSummary = {
  levelLabel: "Lv. 1",
  xpLabel: "0 XP",
  streakLabel: "0 天连胜"
};

function formatProgress(row: typeof userProgress.$inferSelect): UserProgressSummary {
  return {
    levelLabel: `Lv. ${row.level}`,
    xpLabel: `${new Intl.NumberFormat("en-US").format(row.xp)} XP`,
    streakLabel: `${row.streakDays} 天连胜`
  };
}

function toHomeDungeon(row: typeof dungeons.$inferSelect): HomeDungeon {
  return {
    id: row.id,
    title: row.title,
    level: row.level,
    tag: row.tag,
    xp: row.xpReward,
    progress: row.progressPercent,
    tone: row.tone,
    mapTop: row.mapTop,
    mapLeft: row.mapLeft,
    region: row.region
  };
}

export function getUserProgressSummary() {
  try {
    const row = getDb()
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, "local-user"))
      .get();

    return row ? formatProgress(row) : fallbackProgress;
  } catch {
    return fallbackProgress;
  }
}

export function listHomeDungeons() {
  try {
    return getDb()
      .select()
      .from(dungeons)
      .where(eq(dungeons.status, "available"))
      .orderBy(asc(dungeons.createdAt))
      .all()
      .map(toHomeDungeon);
  } catch {
    return [];
  }
}

export function getHomeOverview() {
  return {
    progress: getUserProgressSummary(),
    dungeons: listHomeDungeons()
  };
}

export function getDungeonDetail(dungeonId: string) {
  return getDb().select().from(dungeons).where(eq(dungeons.id, dungeonId)).get();
}

export function listActiveBattles() {
  try {
    return getDb()
      .select()
      .from(battleSessions)
      .where(eq(battleSessions.status, "in_progress"))
      .orderBy(asc(battleSessions.createdAt))
      .all();
  } catch {
    return [];
  }
}

export function listExpressionEquipment() {
  return getDb()
    .select()
    .from(expressionEquipment)
    .orderBy(asc(expressionEquipment.createdAt))
    .all();
}

export function listSavedExpressions() {
  return getDb()
    .select()
    .from(savedExpressions)
    .orderBy(asc(savedExpressions.createdAt))
    .all();
}

export function listReviewQueue() {
  const db = getDb();

  return {
    triggers: db
      .select()
      .from(reviewTriggers)
      .where(eq(reviewTriggers.status, "open"))
      .all(),
    bossItems: db
      .select()
      .from(bossTrainingItems)
      .where(eq(bossTrainingItems.status, "queued"))
      .all()
  };
}

export function listLearningRecords() {
  return getDb()
    .select()
    .from(learningRecords)
    .orderBy(asc(learningRecords.createdAt))
    .all();
}
