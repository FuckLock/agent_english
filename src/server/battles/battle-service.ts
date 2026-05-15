import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import { generateBattleFeedback, type BattleFeedback } from "@/server/ai/battle-feedback-generator";
import { getBattlePageModel, type BattlePageModel } from "@/server/battles/battle-model";
import { getDb } from "@/server/db/client";
import {
  battleSessions,
  battleTurns,
  comicPanels,
  dungeons,
  reviewTriggers,
  savedExpressions,
  storyLessons
} from "@/server/db/schema";
import { asJson, nowIso } from "@/server/db/utils";
import { readLessonDraft, slugifyId } from "@/server/lessons/lesson-draft";

export function createBattleFromLesson(input: { dungeonId?: string; lessonId?: string }) {
  const dungeon = input.dungeonId ? getDungeon(input.dungeonId) : ensureDungeonForLesson(input.lessonId);
  if (!dungeon) return null;

  const timestamp = nowIso();
  const battleId = `battle-${dungeon.slug}-${randomUUID().slice(0, 8)}`;

  getDb()
    .insert(battleSessions)
    .values({
      id: battleId,
      dungeonId: dungeon.id,
      status: "in_progress",
      rescueCount: 0,
      currentRound: 1,
      totalRounds: 3,
      hpRemaining: 100,
      comboCount: 0,
      monsterState: "normal",
      rescuePending: false,
      startedAt: timestamp,
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();

  return getBattlePageModel(battleId);
}

export function requestBattleRescue(battleId: string) {
  const session = getDb().select().from(battleSessions).where(eq(battleSessions.id, battleId)).get();
  if (!session || session.status === "completed") return null;

  const timestamp = nowIso();
  getDb()
    .update(battleSessions)
    .set({
      rescueCount: session.rescueCount + 1,
      comboCount: 0,
      rescuePending: true,
      updatedAt: timestamp
    })
    .where(eq(battleSessions.id, battleId))
    .run();

  return getBattlePageModel(battleId);
}

export function submitBattleTurn(input: { battleId: string; userAnswer: string }) {
  const session = getDb()
    .select()
    .from(battleSessions)
    .where(eq(battleSessions.id, input.battleId))
    .get();
  if (!session || session.status === "completed") return null;

  const model = getBattlePageModel(input.battleId);
  if (!model) return null;

  const timestamp = nowIso();
  const nextTurnOrder = model.turns.length + 1;
  const targetExpression = model.equipment[0]?.expression ?? model.rescue.expression;
  const rescueUsedThisRound = Boolean(session.rescuePending);
  const feedback = generateBattleFeedback({
    answer: input.userAnswer,
    objectiveText: model.objectiveText,
    rescueCount: model.rescueCount,
    targetExpression,
    turnOrder: nextTurnOrder,
    hpBefore: session.hpRemaining,
    comboBefore: session.comboCount,
    rescueUsedThisRound
  });
  const nextHp = Math.max(0, session.hpRemaining + feedback.hpDelta);
  const turnId = `turn-${input.battleId}-${nextTurnOrder}`;

  getDb()
    .insert(battleTurns)
    .values({
      id: turnId,
      battleSessionId: input.battleId,
      turnOrder: nextTurnOrder,
      userAnswer: input.userAnswer.trim(),
      aiFeedbackJson: asJson(feedback as unknown as Record<string, unknown>),
      hpDelta: feedback.hpDelta,
      passed: feedback.passed,
      damage: feedback.damage,
      hitType: feedback.hitType,
      comboAfter: feedback.comboNext,
      monsterStateAfter: feedback.monsterStateAfter,
      rescueUsedThisRound,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();

  persistFeedback(model.lessonId, turnId, input.userAnswer, feedback, model.rescueCount);
  updateBattleSessionAfterTurn(input.battleId, model, feedback, nextHp, timestamp);

  return getBattlePageModel(input.battleId);
}

function ensureDungeonForLesson(lessonId: string | undefined) {
  if (!lessonId) return null;

  const db = getDb();
  const existing = db.select().from(dungeons).where(eq(dungeons.storyLessonId, lessonId)).get();
  if (existing) return existing;

  const lesson = db.select().from(storyLessons).where(eq(storyLessons.id, lessonId)).get();
  if (!lesson) return null;

  const panels = db
    .select()
    .from(comicPanels)
    .where(eq(comicPanels.storyLessonId, lesson.id))
    .orderBy(asc(comicPanels.panelOrder))
    .all();
  const draft = readLessonDraft(lesson.lessonJson, lesson, panels);
  const slug = slugifyId(lesson.id.replace(/^lesson-/, ""));
  const timestamp = nowIso();

  db.insert(dungeons)
    .values({
      id: `dungeon-${slug}`,
      storyLessonId: lesson.id,
      slug,
      title: `${lesson.title} Challenge`,
      level: lesson.level,
      tag: "表达挑战",
      xpReward: 180,
      progressPercent: 0,
      tone: "#4f7cff",
      mapTop: "54%",
      mapLeft: "52%",
      region: "Story Gate",
      status: "available",
      objectiveText: draft.objectiveText,
      monsterName: getMonsterName(draft.category),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();

  return db.select().from(dungeons).where(eq(dungeons.id, `dungeon-${slug}`)).get() ?? null;
}

function getDungeon(dungeonId: string) {
  return getDb().select().from(dungeons).where(eq(dungeons.id, dungeonId)).get() ?? null;
}

function persistFeedback(
  lessonId: string,
  turnId: string,
  userAnswer: string,
  feedback: BattleFeedback,
  rescueCount: number
) {
  const candidateId = `saved-${lessonId}-${slugifyId(feedback.suggestedExpression)}`;
  const timestamp = nowIso();

  getDb()
    .insert(savedExpressions)
    .values({
      id: candidateId,
      storyLessonId: lessonId,
      battleTurnId: turnId,
      expression: feedback.suggestedExpression,
      meaningZh: feedback.meaningZh,
      sourceText: userAnswer.trim(),
      status: feedback.passed ? "saved" : "candidate",
      usedCount: 1,
      nextReviewAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: savedExpressions.id,
      set: { battleTurnId: turnId, sourceText: userAnswer.trim(), updatedAt: timestamp }
    })
    .run();

  if (!feedback.reviewTriggerCandidate) return;

  getDb()
    .insert(reviewTriggers)
    .values({
      id: `review-${turnId}`,
      savedExpressionId: candidateId,
      battleTurnId: turnId,
      triggerType: feedback.reviewTriggerCandidate.triggerType,
      skillKey: feedback.reviewTriggerCandidate.skillKey,
      stuckCount: Math.max(1, rescueCount),
      suggestedAction: feedback.reviewTriggerCandidate.suggestedAction,
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();
}

function updateBattleSessionAfterTurn(
  battleId: string,
  model: BattlePageModel,
  feedback: BattleFeedback,
  hpRemaining: number,
  timestamp: string
) {
  const completed = feedback.passed || hpRemaining <= 0;
  getDb()
    .update(battleSessions)
    .set({
      status: completed ? "completed" : "in_progress",
      currentRound: completed ? model.currentRound : Math.min(model.currentRound + 1, model.totalRounds),
      hpRemaining,
      comboCount: feedback.comboNext,
      monsterState: feedback.monsterStateAfter,
      rescuePending: false,
      completedAt: completed ? timestamp : null,
      updatedAt: timestamp
    })
    .where(eq(battleSessions.id, battleId))
    .run();
}

function getMonsterName(category: string) {
  if (category === "tech") return "Bug Imp";
  if (category === "travel") return "Lost Passport Mimic";
  if (category === "people") return "Small Talk Phantom";
  return "Meaning Muncher";
}
