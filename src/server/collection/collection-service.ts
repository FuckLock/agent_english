import { asc, desc, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  battleSessions,
  bossTrainingItems,
  comicPanels,
  dungeons,
  expressionEquipment,
  learningRecords,
  reviewTriggers,
  savedExpressions,
  storyLessons,
  userProgress
} from "@/server/db/schema";

export type CollectionModel = ReturnType<typeof getCollectionModel>;

export function getCollectionModel() {
  const db = getDb();
  const progress = db.select().from(userProgress).where(eq(userProgress.userId, "local-user")).get();
  const expressions = db.select().from(savedExpressions).orderBy(desc(savedExpressions.createdAt)).all();
  const equipment = db.select().from(expressionEquipment).orderBy(desc(expressionEquipment.createdAt)).all();
  const triggers = db.select().from(reviewTriggers).orderBy(desc(reviewTriggers.createdAt)).all();
  const bossItems = db.select().from(bossTrainingItems).orderBy(desc(bossTrainingItems.createdAt)).all();
  const lessons = db.select().from(storyLessons).orderBy(desc(storyLessons.createdAt)).all();
  const panels = db.select().from(comicPanels).orderBy(asc(comicPanels.panelOrder)).all();
  const records = db.select().from(learningRecords).orderBy(desc(learningRecords.createdAt)).all();
  const battles = db.select().from(battleSessions).orderBy(desc(battleSessions.createdAt)).all();
  const dungeonRows = db.select().from(dungeons).all();
  const expressionById = new Map(expressions.map((item) => [item.id, item]));
  const dungeonById = new Map(dungeonRows.map((item) => [item.id, item]));

  return {
    progress: {
      level: progress?.level ?? 1,
      xp: progress?.xp ?? 0,
      streakDays: progress?.streakDays ?? 0,
      skills: readSkillProgress(progress?.skillProgressJson)
    },
    equipment: equipment.map((item) => {
      const expression = expressionById.get(item.savedExpressionId);
      return {
        id: item.id,
        equipmentName: item.equipmentName,
        rarity: item.rarity,
        useCount: item.useCount,
        equipped: item.equipped,
        expression: expression?.expression ?? "Unknown expression",
        meaningZh: expression?.meaningZh ?? "来源表达已删除。"
      };
    }),
    savedExpressions: expressions.map((item) => ({
      id: item.id,
      expression: item.expression,
      meaningZh: item.meaningZh,
      status: item.status,
      usedCount: item.usedCount,
      nextReviewAt: item.nextReviewAt,
      createdAt: item.createdAt
    })),
    monsterRecords: battles.map((battle) => {
      const dungeon = dungeonById.get(battle.dungeonId);
      return {
        id: battle.id,
        title: dungeon?.title ?? "Unknown Dungeon",
        monsterName: dungeon?.monsterName ?? "Unknown Monster",
        status: battle.status,
        rescueCount: battle.rescueCount,
        hpRemaining: battle.hpRemaining,
        completedAt: battle.completedAt,
        level: dungeon?.level ?? "N/A"
      };
    }),
    reviewItems: triggers.map((item) => ({
      id: item.id,
      triggerType: item.triggerType,
      skillKey: item.skillKey,
      stuckCount: item.stuckCount,
      suggestedAction: item.suggestedAction,
      status: item.status
    })),
    bossItems: bossItems.map((item) => ({
      id: item.id,
      title: item.title,
      prompt: item.prompt,
      status: item.status,
      dueAt: item.dueAt
    })),
    storyCards: lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      level: lesson.level,
      summary: lesson.shortSummary,
      panelCount: panels.filter((panel) => panel.storyLessonId === lesson.id).length,
      recordCount: records.filter((record) => record.storyLessonId === lesson.id).length
    })),
    learningRecords: records.map((item) => ({
      id: item.id,
      recordType: item.recordType,
      rewardKey: item.rewardKey,
      xpDelta: item.xpDelta,
      createdAt: item.createdAt
    }))
  };
}

export function updateReviewStatus(input: { id: string; status: string }) {
  if (!["open", "done", "snoozed"].includes(input.status)) return null;

  getDb()
    .update(reviewTriggers)
    .set({ status: input.status, updatedAt: new Date().toISOString() })
    .where(eq(reviewTriggers.id, input.id))
    .run();

  return getCollectionModel();
}

function readSkillProgress(value: string | undefined) {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === "number")
    );
  } catch {
    return {};
  }
}
