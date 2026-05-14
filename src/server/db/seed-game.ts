import { getDb } from "./client";
import {
  appSettings,
  battleSessions,
  battleTurns,
  bossTrainingItems,
  comicPanels,
  expressionEquipment,
  generationJobs,
  learningRecords,
  reviewTriggers,
  savedExpressions,
  userProgress
} from "./schema";
import { comicPanelSeeds, demoJson } from "./seed-data";
import { asJson } from "./utils";

export function applyDemoBattle(timestamp: string) {
  const db = getDb();
  const lessonId = "lesson-cafe-mystery";

  for (const [id, panelOrder, englishText, chineseHint] of comicPanelSeeds) {
    db.insert(comicPanels)
      .values({
        id,
        storyLessonId: lessonId,
        panelOrder,
        englishText,
        chineseHint,
        imagePrompt: `webtoon panel for ${englishText}`,
        imageStatus: "skipped",
        imageUrl: null,
        rhythmType: getSeedPanelRhythm(panelOrder),
        visualGrammarJson: asJson(getSeedPanelVisualGrammar(panelOrder)),
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoUpdate({
        target: comicPanels.id,
        set: {
          englishText,
          chineseHint,
          rhythmType: getSeedPanelRhythm(panelOrder),
          visualGrammarJson: asJson(getSeedPanelVisualGrammar(panelOrder)),
          updatedAt: timestamp
        }
      })
      .run();
  }

  db.insert(generationJobs)
    .values({
      id: "generation-cafe-cover",
      storyLessonId: lessonId,
      comicPanelId: null,
      providerConfigId: null,
      jobType: "cover_image",
      status: "skipped",
      quality: "draft",
      dedupeKey: "seed:cafe-cover",
      requestJson: demoJson.empty,
      resultJson: demoJson.empty,
      errorSummary: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: generationJobs.id,
      set: { jobType: "cover_image", status: "skipped", updatedAt: timestamp }
    })
    .run();

  db.insert(battleSessions)
    .values({
      id: "battle-cafe-demo",
      dungeonId: "dungeon-cafe-mystery",
      status: "in_progress",
      rescueCount: 1,
      currentRound: 1,
      totalRounds: 3,
      hpRemaining: 42,
      startedAt: timestamp,
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: battleSessions.id,
      set: { status: "in_progress", hpRemaining: 42, updatedAt: timestamp }
    })
    .run();

  db.insert(battleTurns)
    .values({
      id: "turn-cafe-demo-1",
      battleSessionId: "battle-cafe-demo",
      turnOrder: 1,
      userAnswer: "Could I get an iced latte, please?",
      aiFeedbackJson: demoJson.battleFeedback,
      hpDelta: -18,
      passed: true,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: battleTurns.id,
      set: { aiFeedbackJson: demoJson.battleFeedback, updatedAt: timestamp }
    })
    .run();
}

function getSeedPanelRhythm(order: number) {
  const rhythm = ["setup", "turn", "reaction", "challenge", "expression", "reward"];

  return rhythm[order - 1] ?? "extension";
}

function getSeedPanelVisualGrammar(order: number) {
  return {
    shot: order <= 3 ? "story setup" : "expression reward",
    focus: order <= 4 ? "story comprehension" : "usable expression",
    mood: "warm cafe adventure"
  };
}

export function applyProgress(timestamp: string) {
  const db = getDb();

  db.insert(savedExpressions)
    .values({
      id: "expression-could-i-get",
      storyLessonId: "lesson-cafe-mystery",
      battleTurnId: "turn-cafe-demo-1",
      expression: "Could I get ...?",
      meaningZh: "我可以要……吗？",
      sourceText: "Could I get an iced latte, please?",
      status: "equipped",
      usedCount: 4,
      nextReviewAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: savedExpressions.id,
      set: { usedCount: 4, status: "equipped", updatedAt: timestamp }
    })
    .run();

  db.insert(expressionEquipment)
    .values({
      id: "equipment-politeness-ring",
      savedExpressionId: "expression-could-i-get",
      equipmentName: "Politeness Ring",
      rarity: "rare",
      useCount: 4,
      equipped: true,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: expressionEquipment.id,
      set: { useCount: 4, equipped: true, updatedAt: timestamp }
    })
    .run();

  db.insert(reviewTriggers)
    .values({
      id: "review-cafe-polite-order",
      savedExpressionId: "expression-could-i-get",
      battleTurnId: "turn-cafe-demo-1",
      triggerType: "rescue_used",
      skillKey: "polite_ordering",
      stuckCount: 1,
      suggestedAction: "明天用 Could I get ...? 再打一轮点餐副本。",
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: reviewTriggers.id,
      set: { stuckCount: 1, status: "open", updatedAt: timestamp }
    })
    .run();

  db.insert(bossTrainingItems)
    .values({
      id: "boss-training-polite-order",
      reviewTriggerId: "review-cafe-polite-order",
      title: "Polite Ordering Boss",
      prompt: "Order two things politely without using Chinese rescue.",
      status: "queued",
      dueAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: bossTrainingItems.id,
      set: { status: "queued", updatedAt: timestamp }
    })
    .run();

  db.insert(learningRecords)
    .values({
      id: "record-cafe-read",
      storyLessonId: "lesson-cafe-mystery",
      battleSessionId: "battle-cafe-demo",
      recordType: "battle_started",
      rewardKey: "battle_started:cafe-mystery",
      xpDelta: 120,
      metadataJson: demoJson.learningRecord,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: learningRecords.id,
      set: { xpDelta: 120, updatedAt: timestamp }
    })
    .run();

  db.insert(userProgress)
    .values({
      id: "progress-local-user",
      userId: "local-user",
      level: 12,
      xp: 3840,
      streakDays: 7,
      skillProgressJson: demoJson.skillProgress,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: userProgress.userId,
      set: { level: 12, xp: 3840, streakDays: 7, updatedAt: timestamp }
    })
    .run();

  db.insert(appSettings)
    .values({
      id: "settings-local-user",
      key: "local_user_preferences",
      valueJson: demoJson.appSettings,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { valueJson: demoJson.appSettings, updatedAt: timestamp }
    })
    .run();
}
