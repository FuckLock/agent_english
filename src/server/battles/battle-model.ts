import { asc, eq } from "drizzle-orm";

import {
  generateBattleRescue,
  parseBattleFeedback,
  type BattleFeedback,
  type BattleRescue,
  type HitType,
  type MonsterState
} from "@/server/ai/battle-feedback-generator";
import { getDb } from "@/server/db/client";
import {
  battleSessions,
  battleTurns,
  comicPanels,
  dungeons,
  expressionEquipment,
  savedExpressions,
  storyLessons
} from "@/server/db/schema";
import { readLessonDraft, slugifyId } from "@/server/lessons/lesson-draft";
import { PROLOGUE_ASSETS } from "@/server/lessons/prologue-service";

export type BattleEquipmentView = {
  id: string;
  expression: string;
  meaningZh: string;
  equipmentName: string;
  rarity: string;
  equipped: boolean;
};

export type BattleTurnView = {
  id: string;
  turnOrder: number;
  userAnswer: string;
  hpDelta: number;
  passed: boolean;
  feedback: BattleFeedback;
  damage: number;
  hitType: HitType;
  comboAfter: number;
  monsterStateAfter: MonsterState;
  rescueUsedThisRound: boolean;
};

export type BattlePageModel = {
  id: string;
  status: string;
  title: string;
  level: string;
  objectiveText: string;
  monsterName: string;
  lessonId: string;
  rescueCount: number;
  currentRound: number;
  totalRounds: number;
  hpRemaining: number;
  comboCount: number;
  monsterState: MonsterState;
  rescuePending: boolean;
  lastHitType: HitType | null;
  lastDamage: number;
  turns: BattleTurnView[];
  equipment: BattleEquipmentView[];
  rescue: BattleRescue;
  isPrologue: boolean;
  monsterImageUrl: string | null;
};

export function getBattlePageModel(battleId: string): BattlePageModel | null {
  const db = getDb();
  const session = db.select().from(battleSessions).where(eq(battleSessions.id, battleId)).get();
  if (!session) return null;

  const dungeon = db.select().from(dungeons).where(eq(dungeons.id, session.dungeonId)).get();
  if (!dungeon) return null;

  const lesson = db.select().from(storyLessons).where(eq(storyLessons.id, dungeon.storyLessonId)).get();
  if (!lesson) return null;

  const panels = db
    .select()
    .from(comicPanels)
    .where(eq(comicPanels.storyLessonId, lesson.id))
    .orderBy(asc(comicPanels.panelOrder))
    .all();
  const draft = readLessonDraft(lesson.lessonJson, lesson, panels);
  const turns = db
    .select()
    .from(battleTurns)
    .where(eq(battleTurns.battleSessionId, battleId))
    .orderBy(asc(battleTurns.turnOrder))
    .all();

  const turnViews: BattleTurnView[] = turns.map((turn) => ({
    id: turn.id,
    turnOrder: turn.turnOrder,
    userAnswer: turn.userAnswer,
    hpDelta: turn.hpDelta,
    passed: turn.passed,
    feedback: parseBattleFeedback(turn.aiFeedbackJson),
    damage: turn.damage,
    hitType: normalizeHitType(turn.hitType),
    comboAfter: turn.comboAfter,
    monsterStateAfter: normalizeMonsterState(turn.monsterStateAfter),
    rescueUsedThisRound: turn.rescueUsedThisRound
  }));
  const lastTurn = turnViews.at(-1);

  return {
    id: session.id,
    status: session.status,
    title: dungeon.title,
    level: dungeon.level,
    objectiveText: dungeon.objectiveText,
    monsterName: dungeon.monsterName,
    lessonId: lesson.id,
    rescueCount: session.rescueCount,
    currentRound: session.currentRound,
    totalRounds: session.totalRounds,
    hpRemaining: session.hpRemaining,
    comboCount: session.comboCount,
    monsterState: normalizeMonsterState(session.monsterState),
    rescuePending: session.rescuePending,
    lastHitType: lastTurn?.hitType ?? null,
    lastDamage: lastTurn?.damage ?? 0,
    turns: turnViews,
    equipment: getBattleEquipment(lesson.id, draft.expressions),
    rescue: generateBattleRescue({
      objectiveText: dungeon.objectiveText,
      targetExpression: draft.expressions[0]?.expression ?? ""
    }),
    isPrologue: Boolean(dungeon.isPrologue),
    monsterImageUrl: dungeon.isPrologue ? PROLOGUE_ASSETS.monsterImageUrl : null
  };
}

function normalizeHitType(value: string): HitType {
  const allowed: HitType[] = ["miss", "graze", "hit", "critical", "stagger"];
  return allowed.includes(value as HitType) ? (value as HitType) : "miss";
}

function normalizeMonsterState(value: string): MonsterState {
  const allowed: MonsterState[] = ["normal", "angry", "near_death", "dead"];
  return allowed.includes(value as MonsterState) ? (value as MonsterState) : "normal";
}

function getBattleEquipment(
  lessonId: string,
  draftExpressions: Array<{ expression: string; meaningZh: string; sourceText: string }>
) {
  const db = getDb();
  const saved = db
    .select()
    .from(savedExpressions)
    .where(eq(savedExpressions.storyLessonId, lessonId))
    .orderBy(asc(savedExpressions.createdAt))
    .all();
  const equipmentRows = db.select().from(expressionEquipment).orderBy(asc(expressionEquipment.createdAt)).all();
  const equipmentByExpressionId = new Map(equipmentRows.map((item) => [item.savedExpressionId, item]));
  const savedViews = saved.map((item) => {
    const equipment = equipmentByExpressionId.get(item.id);

    return {
      id: item.id,
      expression: item.expression,
      meaningZh: item.meaningZh,
      equipmentName: equipment?.equipmentName ?? "Story Charm",
      rarity: equipment?.rarity ?? item.status,
      equipped: equipment?.equipped ?? item.status === "equipped"
    };
  });
  const draftViews = draftExpressions.slice(0, 3).map((item) => ({
    id: `draft-${slugifyId(item.expression)}`,
    expression: item.expression,
    meaningZh: item.meaningZh,
    equipmentName: "Draft Skill",
    rarity: "story",
    equipped: false
  }));

  return dedupeEquipment([...savedViews, ...draftViews]).slice(0, 5);
}

function dedupeEquipment(items: BattleEquipmentView[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.expression.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
