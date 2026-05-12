import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { learningRecords, userProgress } from "@/server/db/schema";
import { asJson, nowIso } from "@/server/db/utils";

export type XpAwardResult = {
  awarded: boolean;
  duplicateBlocked: boolean;
  xpDelta: number;
};

export type ProgressSnapshot = {
  level: number;
  xp: number;
  xpToNextLevel: number;
  skillProgress: Record<string, number>;
};

type XpAwardInput = {
  battleSessionId: string | null;
  metadata: Record<string, unknown>;
  recordType: string;
  rewardKey: string;
  storyLessonId: string | null;
  xpDelta: number;
};

const USER_ID = "local-user";
const XP_PER_LEVEL = 350;

export function ensureXpAward(input: XpAwardInput): XpAwardResult {
  const db = getDb();
  const existing = db
    .select()
    .from(learningRecords)
    .where(eq(learningRecords.rewardKey, input.rewardKey))
    .get();

  if (existing) {
    return {
      awarded: false,
      duplicateBlocked: existing.battleSessionId !== input.battleSessionId,
      xpDelta: existing.battleSessionId === input.battleSessionId ? existing.xpDelta : 0
    };
  }

  const timestamp = nowIso();
  db.insert(learningRecords)
    .values({
      id: `record-${input.rewardKey.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      storyLessonId: input.storyLessonId,
      battleSessionId: input.battleSessionId,
      recordType: input.recordType,
      rewardKey: input.rewardKey,
      xpDelta: input.xpDelta,
      metadataJson: asJson(input.metadata),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();

  addUserXp(input.xpDelta, timestamp);

  return { awarded: true, duplicateBlocked: false, xpDelta: input.xpDelta };
}

export function getExistingXpAward(rewardKey: string, battleSessionId: string): XpAwardResult | null {
  const existing = getDb()
    .select()
    .from(learningRecords)
    .where(eq(learningRecords.rewardKey, rewardKey))
    .get();
  if (!existing) return null;

  return {
    awarded: false,
    duplicateBlocked: existing.battleSessionId !== battleSessionId,
    xpDelta: existing.battleSessionId === battleSessionId ? existing.xpDelta : 0
  };
}

export function updateSkillProgress(input: { readingDelta: number; speakingDelta: number }) {
  const timestamp = nowIso();
  const current = getOrCreateUserProgress(timestamp);
  const skillProgress = readSkillProgress(current.skillProgressJson);
  const nextSkillProgress = {
    ...skillProgress,
    reading: clampProgress((skillProgress.reading ?? 0) + input.readingDelta),
    speaking: clampProgress((skillProgress.speaking ?? 0) + input.speakingDelta)
  };

  getDb()
    .update(userProgress)
    .set({
      skillProgressJson: asJson(nextSkillProgress),
      updatedAt: timestamp
    })
    .where(eq(userProgress.userId, USER_ID))
    .run();

  return getProgressSnapshot();
}

export function getProgressSnapshot(): ProgressSnapshot {
  const timestamp = nowIso();
  const current = getOrCreateUserProgress(timestamp);
  const nextThreshold = current.level * XP_PER_LEVEL;

  return {
    level: current.level,
    xp: current.xp,
    xpToNextLevel: Math.max(0, nextThreshold - current.xp),
    skillProgress: readSkillProgress(current.skillProgressJson)
  };
}

function addUserXp(xpDelta: number, timestamp: string) {
  const current = getOrCreateUserProgress(timestamp);
  const nextXp = current.xp + xpDelta;
  const nextLevel = nextXp >= current.level * XP_PER_LEVEL ? current.level + 1 : current.level;

  getDb()
    .update(userProgress)
    .set({
      xp: nextXp,
      level: nextLevel,
      updatedAt: timestamp
    })
    .where(eq(userProgress.userId, USER_ID))
    .run();
}

function getOrCreateUserProgress(timestamp: string) {
  const existing = getDb()
    .select()
    .from(userProgress)
    .where(eq(userProgress.userId, USER_ID))
    .get();
  if (existing) return existing;

  getDb()
    .insert(userProgress)
    .values({
      id: "progress-local-user",
      userId: USER_ID,
      level: 1,
      xp: 0,
      streakDays: 0,
      skillProgressJson: asJson({ reading: 0, speaking: 0, listening: 0 }),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();

  return getDb().select().from(userProgress).where(eq(userProgress.userId, USER_ID)).get()!;
}

function readSkillProgress(value: string): Record<string, number> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, number] => typeof entry[1] === "number")
        .map(([key, item]) => [key, clampProgress(item)])
    );
  } catch {
    return {};
  }
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
