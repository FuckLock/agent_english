import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  battleSessions,
  battleTurns,
  bossTrainingItems,
  dungeons,
  expressionEquipment,
  generationJobs,
  learningRecords,
  reviewTriggers,
  savedExpressions,
  storyLessons,
  userProgress
} from "@/server/db/schema";
import { asJson, nowIso } from "@/server/db/utils";
import { getDataManagementSummary } from "@/server/data/export-service";

export function clearLearningRecords() {
  const db = getDb();
  db.delete(bossTrainingItems).run();
  db.delete(reviewTriggers).run();
  db.delete(expressionEquipment).run();
  db.delete(savedExpressions).run();
  db.delete(learningRecords).run();
  db.delete(battleTurns).run();
  db.delete(battleSessions).run();
  resetUserProgress();

  return getDataManagementSummary();
}

export function deleteStoryLessonCascade(lessonId: string) {
  const db = getDb();
  const lesson = db.select().from(storyLessons).where(eq(storyLessons.id, lessonId)).get();
  if (!lesson) return null;

  const dungeonRows = db.select().from(dungeons).where(eq(dungeons.storyLessonId, lessonId)).all();
  for (const dungeon of dungeonRows) {
    const sessions = db
      .select()
      .from(battleSessions)
      .where(eq(battleSessions.dungeonId, dungeon.id))
      .all();
    for (const session of sessions) {
      const turns = db
        .select()
        .from(battleTurns)
        .where(eq(battleTurns.battleSessionId, session.id))
        .all();
      for (const turn of turns) {
        const triggers = db
          .select()
          .from(reviewTriggers)
          .where(eq(reviewTriggers.battleTurnId, turn.id))
          .all();
        for (const trigger of triggers) {
          db.delete(bossTrainingItems).where(eq(bossTrainingItems.reviewTriggerId, trigger.id)).run();
          db.delete(reviewTriggers).where(eq(reviewTriggers.id, trigger.id)).run();
        }
      }
      db.delete(battleTurns).where(eq(battleTurns.battleSessionId, session.id)).run();
    }
    db.delete(battleSessions).where(eq(battleSessions.dungeonId, dungeon.id)).run();
  }

  const expressions = db.select().from(savedExpressions).where(eq(savedExpressions.storyLessonId, lessonId)).all();
  for (const expression of expressions) {
    db.delete(expressionEquipment).where(eq(expressionEquipment.savedExpressionId, expression.id)).run();
    const triggers = db
      .select()
      .from(reviewTriggers)
      .where(eq(reviewTriggers.savedExpressionId, expression.id))
      .all();
    for (const trigger of triggers) {
      db.delete(bossTrainingItems).where(eq(bossTrainingItems.reviewTriggerId, trigger.id)).run();
      db.delete(reviewTriggers).where(eq(reviewTriggers.id, trigger.id)).run();
    }
  }

  db.delete(learningRecords).where(eq(learningRecords.storyLessonId, lessonId)).run();
  db.delete(generationJobs).where(eq(generationJobs.storyLessonId, lessonId)).run();
  db.delete(savedExpressions).where(eq(savedExpressions.storyLessonId, lessonId)).run();
  db.delete(dungeons).where(eq(dungeons.storyLessonId, lessonId)).run();
  db.delete(storyLessons).where(eq(storyLessons.id, lessonId)).run();

  return getDataManagementSummary();
}

function resetUserProgress() {
  const timestamp = nowIso();
  const existing = getDb()
    .select()
    .from(userProgress)
    .where(eq(userProgress.userId, "local-user"))
    .get();

  if (!existing) {
    getDb()
      .insert(userProgress)
      .values({
        id: "progress-local-user",
        userId: "local-user",
        level: 1,
        xp: 0,
        streakDays: 0,
        skillProgressJson: asJson({ reading: 0, speaking: 0, listening: 0 }),
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .run();
    return;
  }

  getDb()
    .update(userProgress)
    .set({
      level: 1,
      xp: 0,
      streakDays: 0,
      skillProgressJson: asJson({ reading: 0, speaking: 0, listening: 0 }),
      updatedAt: timestamp
    })
    .where(eq(userProgress.userId, "local-user"))
    .run();
}
