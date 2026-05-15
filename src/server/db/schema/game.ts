import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { timestamps } from "./common";
import { storyLessons } from "./content";

export const dungeons = sqliteTable(
  "dungeons",
  {
    id: text("id").primaryKey(),
    storyLessonId: text("story_lesson_id")
      .notNull()
      .references(() => storyLessons.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    level: text("level").notNull(),
    tag: text("tag").notNull(),
    xpReward: integer("xp_reward").notNull(),
    progressPercent: integer("progress_percent").notNull(),
    tone: text("tone").notNull(),
    mapTop: text("map_top").notNull(),
    mapLeft: text("map_left").notNull(),
    region: text("region").notNull(),
    status: text("status").notNull(),
    objectiveText: text("objective_text").notNull(),
    monsterName: text("monster_name").notNull(),
    isPrologue: integer("is_prologue", { mode: "boolean" }).notNull().default(false),
    ...timestamps
  },
  (table) => [
    uniqueIndex("dungeons_slug_unique").on(table.slug),
    index("dungeons_status_idx").on(table.status),
    index("dungeons_is_prologue_idx").on(table.isPrologue)
  ]
);

export const battleSessions = sqliteTable(
  "battle_sessions",
  {
    id: text("id").primaryKey(),
    dungeonId: text("dungeon_id")
      .notNull()
      .references(() => dungeons.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    rescueCount: integer("rescue_count").notNull(),
    currentRound: integer("current_round").notNull(),
    totalRounds: integer("total_rounds").notNull(),
    hpRemaining: integer("hp_remaining").notNull(),
    comboCount: integer("combo_count").notNull().default(0),
    monsterState: text("monster_state").notNull().default("normal"),
    rescuePending: integer("rescue_pending", { mode: "boolean" }).notNull().default(false),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    ...timestamps
  },
  (table) => [index("battle_sessions_dungeon_idx").on(table.dungeonId)]
);

export const battleTurns = sqliteTable(
  "battle_turns",
  {
    id: text("id").primaryKey(),
    battleSessionId: text("battle_session_id")
      .notNull()
      .references(() => battleSessions.id, { onDelete: "cascade" }),
    turnOrder: integer("turn_order").notNull(),
    userAnswer: text("user_answer").notNull(),
    aiFeedbackJson: text("ai_feedback_json").notNull(),
    hpDelta: integer("hp_delta").notNull(),
    passed: integer("passed", { mode: "boolean" }).notNull(),
    damage: integer("damage").notNull().default(0),
    hitType: text("hit_type").notNull().default("miss"),
    comboAfter: integer("combo_after").notNull().default(0),
    monsterStateAfter: text("monster_state_after").notNull().default("normal"),
    rescueUsedThisRound: integer("rescue_used_this_round", { mode: "boolean" }).notNull().default(false),
    ...timestamps
  },
  (table) => [
    uniqueIndex("battle_turns_session_order_unique").on(table.battleSessionId, table.turnOrder)
  ]
);

export const savedExpressions = sqliteTable(
  "saved_expressions",
  {
    id: text("id").primaryKey(),
    storyLessonId: text("story_lesson_id").references(() => storyLessons.id, {
      onDelete: "set null"
    }),
    battleTurnId: text("battle_turn_id").references(() => battleTurns.id, {
      onDelete: "set null"
    }),
    expression: text("expression").notNull(),
    meaningZh: text("meaning_zh").notNull(),
    sourceText: text("source_text").notNull(),
    status: text("status").notNull(),
    usedCount: integer("used_count").notNull(),
    nextReviewAt: text("next_review_at"),
    ...timestamps
  },
  (table) => [index("saved_expressions_status_idx").on(table.status)]
);

export const expressionEquipment = sqliteTable("expression_equipment", {
  id: text("id").primaryKey(),
  savedExpressionId: text("saved_expression_id")
    .notNull()
    .references(() => savedExpressions.id, { onDelete: "cascade" }),
  equipmentName: text("equipment_name").notNull(),
  rarity: text("rarity").notNull(),
  useCount: integer("use_count").notNull(),
  equipped: integer("equipped", { mode: "boolean" }).notNull(),
  ...timestamps
});

export const reviewTriggers = sqliteTable(
  "review_triggers",
  {
    id: text("id").primaryKey(),
    savedExpressionId: text("saved_expression_id").references(() => savedExpressions.id, {
      onDelete: "set null"
    }),
    battleTurnId: text("battle_turn_id").references(() => battleTurns.id, {
      onDelete: "set null"
    }),
    triggerType: text("trigger_type").notNull(),
    skillKey: text("skill_key").notNull(),
    stuckCount: integer("stuck_count").notNull(),
    suggestedAction: text("suggested_action").notNull(),
    status: text("status").notNull(),
    ...timestamps
  },
  (table) => [index("review_triggers_status_idx").on(table.status)]
);

export const bossTrainingItems = sqliteTable("boss_training_items", {
  id: text("id").primaryKey(),
  reviewTriggerId: text("review_trigger_id")
    .notNull()
    .references(() => reviewTriggers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status").notNull(),
  dueAt: text("due_at").notNull(),
  ...timestamps
});

export const learningRecords = sqliteTable(
  "learning_records",
  {
    id: text("id").primaryKey(),
    storyLessonId: text("story_lesson_id").references(() => storyLessons.id, {
      onDelete: "set null"
    }),
    battleSessionId: text("battle_session_id").references(() => battleSessions.id, {
      onDelete: "set null"
    }),
    recordType: text("record_type").notNull(),
    rewardKey: text("reward_key").notNull(),
    xpDelta: integer("xp_delta").notNull(),
    metadataJson: text("metadata_json").notNull(),
    ...timestamps
  },
  (table) => [uniqueIndex("learning_records_reward_key_unique").on(table.rewardKey)]
);

export const userProgress = sqliteTable("user_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  level: integer("level").notNull(),
  xp: integer("xp").notNull(),
  streakDays: integer("streak_days").notNull(),
  skillProgressJson: text("skill_progress_json").notNull(),
  ...timestamps
});
