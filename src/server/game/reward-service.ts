import { asc, eq } from "drizzle-orm";

import type { BattlePageModel } from "@/server/battles/battle-model";
import { getBattlePageModel } from "@/server/battles/battle-model";
import { getDb } from "@/server/db/client";
import {
  battleSessions,
  bossTrainingItems,
  expressionEquipment,
  reviewTriggers,
  savedExpressions
} from "@/server/db/schema";
import { nowIso } from "@/server/db/utils";
import { ensureEquipmentCardJob } from "@/server/generation/generation-job-runner";
import {
  ensureXpAward,
  getExistingXpAward,
  getProgressSnapshot,
  updateSkillProgress,
  type ProgressSnapshot,
  type XpAwardResult
} from "@/server/game/progress-service";
import { slugifyId } from "@/server/lessons/lesson-draft";
import { applyPrologueClearance } from "@/server/lessons/prologue-service";

export type SettlementRewardModel = {
  battle: BattlePageModel;
  xp: {
    battle: XpAwardResult;
    expression: XpAwardResult;
    noRescueBonus: XpAwardResult;
    read: XpAwardResult;
    earnedXp: number;
    newlyAwardedXp: number;
  };
  progress: ProgressSnapshot;
  equipmentDrop: {
    equipmentName: string;
    expression: string;
    meaningZh: string;
    newlyCreated: boolean;
    rarity: string;
  } | null;
  reviewItems: Array<{
    id: string;
    skillKey: string;
    stuckCount: number;
    suggestedAction: string;
    triggerType: string;
  }>;
  bossItems: Array<{
    id: string;
    prompt: string;
    title: string;
  }>;
  nextActions: string[];
};

const EMPTY_XP: XpAwardResult = { awarded: false, duplicateBlocked: false, xpDelta: 0 };

export function getSettlementRewardModel(battleId: string): SettlementRewardModel | null {
  const battle = getBattlePageModel(battleId);
  if (!battle || battle.status !== "completed") return null;

  const session = getDb().select().from(battleSessions).where(eq(battleSessions.id, battleId)).get();
  if (!session) return null;

  const read = ensureXpAward({
    battleSessionId: battle.id,
    metadata: { source: "settlement", duplicateRule: "read_once_per_lesson" },
    recordType: "read_completed",
    rewardKey: `read:${battle.lessonId}`,
    storyLessonId: battle.lessonId,
    xpDelta: 10
  });
  const battleXp = ensureXpAward({
    battleSessionId: battle.id,
    metadata: { source: "settlement", rescueCount: battle.rescueCount },
    recordType: "battle_completed",
    rewardKey: `battle:${battle.id}`,
    storyLessonId: battle.lessonId,
    xpDelta: 20
  });
  const noRescueBonus =
    battle.rescueCount === 0
      ? ensureXpAward({
          battleSessionId: battle.id,
          metadata: { source: "settlement", condition: "no_rescue" },
          recordType: "battle_bonus",
          rewardKey: `battle:${battle.id}:no-rescue`,
          storyLessonId: battle.lessonId,
          xpDelta: 5
        })
      : EMPTY_XP;
  const equipmentDrop = ensureEquipmentDrop(battle);
  const expressionRewardKey = equipmentDrop
    ? `equipment:${battle.id}:${slugifyId(equipmentDrop.expression)}`
    : "";
  const expression =
    equipmentDrop?.newlyCreated && expressionRewardKey
      ? ensureXpAward({
          battleSessionId: battle.id,
          metadata: { source: "settlement", expression: equipmentDrop.expression },
          recordType: "expression_equipped",
          rewardKey: expressionRewardKey,
          storyLessonId: battle.lessonId,
          xpDelta: 2
        })
      : getExistingXpAward(expressionRewardKey, battle.id) ?? EMPTY_XP;
  const newlyAwardedXp = [read, battleXp, noRescueBonus, expression]
    .filter((item) => item.awarded)
    .reduce((sum, item) => sum + item.xpDelta, 0);
  const progress =
    newlyAwardedXp > 0
      ? updateSkillProgress({
          readingDelta: read.awarded ? 3 : 0,
          speakingDelta: battleXp.awarded ? (battle.rescueCount > 0 ? 4 : 8) : 0
        })
      : getProgressSnapshot();
  const reviewItems = listBattleReviewItems(battle);
  const bossItems = ensureBossTrainingItems(reviewItems);
  applyPrologueClearance(battle.id);

  return {
    battle,
    xp: {
      battle: battleXp,
      expression,
      noRescueBonus,
      read,
      earnedXp: read.xpDelta + battleXp.xpDelta + noRescueBonus.xpDelta + expression.xpDelta,
      newlyAwardedXp
    },
    progress,
    equipmentDrop,
    reviewItems,
    bossItems,
    nextActions: getNextActions(battle.rescueCount, bossItems.length)
  };
}

function ensureEquipmentDrop(battle: BattlePageModel) {
  const lastTurn = battle.turns.at(-1);
  if (!lastTurn) return null;

  const db = getDb();
  const saved = db
    .select()
    .from(savedExpressions)
    .where(eq(savedExpressions.battleTurnId, lastTurn.id))
    .orderBy(asc(savedExpressions.createdAt))
    .get();
  if (!saved) return null;

  const equipmentId = `equipment-${saved.id}`;
  const existing = db
    .select()
    .from(expressionEquipment)
    .where(eq(expressionEquipment.id, equipmentId))
    .get();
  if (existing) {
    return {
      equipmentName: existing.equipmentName,
      expression: saved.expression,
      meaningZh: saved.meaningZh,
      newlyCreated: false,
      rarity: existing.rarity
    };
  }

  const timestamp = nowIso();
  const rarity = battle.rescueCount === 0 ? "rare" : "common";
  const equipmentName = getEquipmentName(saved.expression, rarity);

  db.insert(expressionEquipment)
    .values({
      id: equipmentId,
      savedExpressionId: saved.id,
      equipmentName,
      rarity,
      useCount: 1,
      equipped: true,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();
  ensureEquipmentCardJob({ equipmentId, expression: saved.expression, lessonId: battle.lessonId });

  return {
    equipmentName,
    expression: saved.expression,
    meaningZh: saved.meaningZh,
    newlyCreated: true,
    rarity
  };
}

function listBattleReviewItems(battle: BattlePageModel) {
  const turnIds = new Set(battle.turns.map((turn) => turn.id));
  if (turnIds.size === 0) return [];

  return getDb()
    .select()
    .from(reviewTriggers)
    .where(eq(reviewTriggers.status, "open"))
    .all()
    .filter((item) => item.battleTurnId && turnIds.has(item.battleTurnId))
    .map((item) => ({
      id: item.id,
      skillKey: item.skillKey,
      stuckCount: item.stuckCount,
      suggestedAction: item.suggestedAction,
      triggerType: item.triggerType
    }));
}

function ensureBossTrainingItems(reviewItems: SettlementRewardModel["reviewItems"]) {
  const db = getDb();
  const createdOrExisting = [];

  for (const item of reviewItems) {
    const sameSkillCount = db
      .select()
      .from(reviewTriggers)
      .where(eq(reviewTriggers.skillKey, item.skillKey))
      .all()
      .filter((trigger) => trigger.status === "open").length;
    if (item.stuckCount < 3 && sameSkillCount < 3) continue;

    const existing = db
      .select()
      .from(bossTrainingItems)
      .where(eq(bossTrainingItems.reviewTriggerId, item.id))
      .get();
    if (existing) {
      createdOrExisting.push({ id: existing.id, title: existing.title, prompt: existing.prompt });
      continue;
    }

    const timestamp = nowIso();
    const bossItem = {
      id: `boss-${item.id}`,
      reviewTriggerId: item.id,
      title: `${formatSkillName(item.skillKey)} Boss`,
      prompt: item.suggestedAction,
      status: "queued",
      dueAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.insert(bossTrainingItems).values(bossItem).run();
    createdOrExisting.push({ id: bossItem.id, title: bossItem.title, prompt: bossItem.prompt });
  }

  return createdOrExisting;
}

function getEquipmentName(expression: string, rarity: string) {
  if (expression.toLowerCase().includes("could")) return "Polite Request Charm";
  if (rarity === "rare") return "Clear Voice Badge";
  return "Story Spark Card";
}

function getNextActions(rescueCount: number, bossCount: number) {
  if (bossCount > 0) return ["明天打一轮 Boss 训练", "不用中文救援复打一遍"];
  if (rescueCount > 0) return ["用同一句表达复打一轮", "试着不点中文救援"];
  return ["去找下一个副本", "把掉落装备带进下一场"];
}

function formatSkillName(skillKey: string) {
  return skillKey
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((item) => item[0]?.toUpperCase() + item.slice(1))
    .join(" ");
}
