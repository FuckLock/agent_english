import { desc, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  appSettings,
  battleSessions,
  battleTurns,
  contentSources,
  dungeons,
  expressionEquipment,
  savedExpressions
} from "@/server/db/schema";
import { asJson, nowIso } from "@/server/db/utils";
import {
  ensureLessonGenerationJobs,
  type GenerationQuality
} from "@/server/generation/generation-job-runner";
import { ensureMinimumPanels } from "@/server/lessons/lesson-panels";

export const PROLOGUE_DUNGEON_ID = "dungeon-prologue";
export const PROLOGUE_LESSON_ID = "lesson-prologue";
export const PROLOGUE_HELLO_EQUIPMENT_ID = "equipment-hello-sword";
export const PROLOGUE_HELLO_EXPRESSION_ID = "expression-prologue-hello";
export const PROLOGUE_STATE_SETTING_KEY = "prologue_state";

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

export function isPrologueComplete(): boolean {
  const setting = getDb()
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, PROLOGUE_STATE_SETTING_KEY))
    .get();
  if (!setting) return false;
  try {
    const parsed = JSON.parse(setting.valueJson) as { completed?: boolean };
    return Boolean(parsed.completed);
  } catch {
    return false;
  }
}

export function applyPrologueClearance(battleId: string): { unlocked: boolean } {
  const db = getDb();
  const battle = db
    .select()
    .from(battleSessions)
    .where(eq(battleSessions.id, battleId))
    .get();
  if (!battle) return { unlocked: false };

  const dungeon = db
    .select()
    .from(dungeons)
    .where(eq(dungeons.id, battle.dungeonId))
    .get();
  if (!dungeon?.isPrologue) return { unlocked: false };
  if (battle.status !== "completed") return { unlocked: false };

  const timestamp = nowIso();
  const lastTurn = db
    .select()
    .from(battleTurns)
    .where(eq(battleTurns.battleSessionId, battleId))
    .orderBy(desc(battleTurns.turnOrder))
    .get();

  if (lastTurn) {
    db.update(savedExpressions)
      .set({
        battleTurnId: lastTurn.id,
        status: "equipped",
        usedCount: 1,
        updatedAt: timestamp
      })
      .where(eq(savedExpressions.id, PROLOGUE_HELLO_EXPRESSION_ID))
      .run();
  }

  db.update(expressionEquipment)
    .set({ equipped: true, useCount: 1, updatedAt: timestamp })
    .where(eq(expressionEquipment.id, PROLOGUE_HELLO_EQUIPMENT_ID))
    .run();

  db.insert(appSettings)
    .values({
      id: "settings-prologue-state",
      key: PROLOGUE_STATE_SETTING_KEY,
      valueJson: asJson({ completed: true, completedAt: timestamp }),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        valueJson: asJson({ completed: true, completedAt: timestamp }),
        updatedAt: timestamp
      }
    })
    .run();

  return { unlocked: true };
}
