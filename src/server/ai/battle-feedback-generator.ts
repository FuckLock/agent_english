export type ReviewTriggerCandidate = {
  triggerType: "rescue_used" | "zh_only" | "weak_answer";
  skillKey: string;
  suggestedAction: string;
};

export type HitType = "miss" | "graze" | "hit" | "critical" | "stagger";
export type MonsterState = "normal" | "angry" | "near_death" | "dead";

export type BattleFeedback = {
  passed: boolean;
  communicationResult: string;
  rewrite: string;
  explanationZh: string;
  suggestedExpression: string;
  meaningZh: string;
  stuckPoint: string | null;
  reviewTriggerCandidate: ReviewTriggerCandidate | null;
  damage: number;
  hitType: HitType;
  hpDelta: number;
  comboNext: number;
  monsterStateBefore: MonsterState;
  monsterStateAfter: MonsterState;
};

export type BattleRescue = {
  hintZh: string;
  starterEnglish: string;
  expression: string;
};

type FeedbackInput = {
  answer: string;
  objectiveText: string;
  rescueCount: number;
  targetExpression: string;
  turnOrder: number;
  hpBefore: number;
  comboBefore: number;
  rescueUsedThisRound: boolean;
};

type RescueInput = {
  objectiveText: string;
  targetExpression: string;
};

const englishWordPattern = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
const chinesePattern = /[\u3400-\u9fff]/;
const politePattern = /\b(could|can|may|please|would|i'd|i would|let me|i need)\b/i;

export function generateBattleFeedback(input: FeedbackInput): BattleFeedback {
  const answer = input.answer.trim();
  const englishWords = answer.match(englishWordPattern) ?? [];
  const hasChinese = chinesePattern.test(answer);
  const enoughEnglish = englishWords.length >= 4;
  const soundsNatural = politePattern.test(answer) || input.turnOrder > 1;
  const passed = !hasChinese && enoughEnglish && soundsNatural;
  const stuckPoint = getStuckPoint({ hasChinese, enoughEnglish, soundsNatural });
  const suggestedExpression = pickSuggestedExpression(input.targetExpression);
  const hitType = computeHitType({
    passed,
    comboBefore: input.comboBefore,
    rescueUsedThisRound: input.rescueUsedThisRound
  });
  const damage = computeDamage(hitType);
  const hpDelta = -damage;
  const hpAfter = Math.max(0, input.hpBefore + hpDelta);
  const comboNext = computeComboNext({
    passed,
    comboBefore: input.comboBefore,
    rescueUsedThisRound: input.rescueUsedThisRound
  });
  const monsterStateBefore = computeMonsterState(input.hpBefore);
  const monsterStateAfter = computeMonsterState(hpAfter);

  return {
    passed,
    communicationResult: passed
      ? "能沟通成功。怪兽听懂了你的英文回应。"
      : "还不能通关。先把中文依赖降下来，再补一句完整英文。",
    rewrite: passed ? naturalizeAnswer(answer, suggestedExpression) : suggestedExpression,
    explanationZh: passed
      ? "这句已经能完成任务。改写版更像真实对话，会更礼貌、更顺。"
      : "战斗判定看的是能不能用英文把意图说清楚，不要求完美语法，但必须是完整英文表达。",
    suggestedExpression,
    meaningZh: "用更自然的英文完成当前任务。",
    stuckPoint,
    reviewTriggerCandidate: getReviewTrigger({
      hasChinese,
      passed,
      rescueCount: input.rescueCount,
      suggestedExpression
    }),
    damage,
    hitType,
    hpDelta,
    comboNext,
    monsterStateBefore,
    monsterStateAfter
  };
}

function computeHitType(input: {
  passed: boolean;
  comboBefore: number;
  rescueUsedThisRound: boolean;
}): HitType {
  if (!input.passed) return "miss";
  if (input.rescueUsedThisRound) return "graze";
  if (input.comboBefore >= 3) return "stagger";
  if (input.comboBefore >= 1) return "critical";
  return "hit";
}

function computeDamage(hitType: HitType): number {
  switch (hitType) {
    case "miss":
      return 0;
    case "graze":
      return 14;
    case "hit":
      return 28;
    case "critical":
      return 42;
    case "stagger":
      return 60;
  }
}

function computeComboNext(input: {
  passed: boolean;
  comboBefore: number;
  rescueUsedThisRound: boolean;
}): number {
  if (!input.passed) return 0;
  if (input.rescueUsedThisRound) return 0;
  return input.comboBefore + 1;
}

export function computeMonsterState(hp: number): MonsterState {
  if (hp <= 0) return "dead";
  if (hp <= 30) return "near_death";
  if (hp <= 60) return "angry";
  return "normal";
}

export function generateBattleRescue(input: RescueInput): BattleRescue {
  const expression = pickSuggestedExpression(input.targetExpression);

  return {
    hintZh: `先想清楚任务：${input.objectiveText}。你可以表达“我想礼貌地说明需求，并补一个理由”。`,
    starterEnglish: expression,
    expression
  };
}

export function parseBattleFeedback(value: string): BattleFeedback {
  try {
    const parsed = JSON.parse(value) as Partial<BattleFeedback>;
    return {
      passed: Boolean(parsed.passed),
      communicationResult: getString(parsed.communicationResult) || "反馈已生成。",
      rewrite: getString(parsed.rewrite) || "Could I say it another way, please?",
      explanationZh: getString(parsed.explanationZh) || "这轮会记录为一次可复习表达。",
      suggestedExpression: getString(parsed.suggestedExpression) || "Could I say it another way, please?",
      meaningZh: getString(parsed.meaningZh) || "更自然地表达当前意图。",
      stuckPoint: typeof parsed.stuckPoint === "string" ? parsed.stuckPoint : null,
      reviewTriggerCandidate: parseReviewTrigger(parsed.reviewTriggerCandidate),
      damage: getNumber(parsed.damage),
      hitType: parseHitType(parsed.hitType),
      hpDelta: getNumber(parsed.hpDelta),
      comboNext: getNumber(parsed.comboNext),
      monsterStateBefore: parseMonsterState(parsed.monsterStateBefore),
      monsterStateAfter: parseMonsterState(parsed.monsterStateAfter)
    };
  } catch {
    return {
      passed: false,
      communicationResult: "反馈读取失败，保留本轮回答。",
      rewrite: "Could I try again, please?",
      explanationZh: "这轮反馈数据不可读，可以重新打一轮。",
      suggestedExpression: "Could I try again, please?",
      meaningZh: "我可以再试一次吗？",
      stuckPoint: "feedback_parse_failed",
      reviewTriggerCandidate: null,
      damage: 0,
      hitType: "miss",
      hpDelta: 0,
      comboNext: 0,
      monsterStateBefore: "normal",
      monsterStateAfter: "normal"
    };
  }
}

function parseHitType(value: unknown): HitType {
  const allowed: HitType[] = ["miss", "graze", "hit", "critical", "stagger"];
  return allowed.includes(value as HitType) ? (value as HitType) : "miss";
}

function parseMonsterState(value: unknown): MonsterState {
  const allowed: MonsterState[] = ["normal", "angry", "near_death", "dead"];
  return allowed.includes(value as MonsterState) ? (value as MonsterState) : "normal";
}

function getNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getStuckPoint(input: {
  hasChinese: boolean;
  enoughEnglish: boolean;
  soundsNatural: boolean;
}) {
  if (input.hasChinese) return "zh_only";
  if (!input.enoughEnglish) return "too_short";
  if (!input.soundsNatural) return "needs_polite_frame";
  return null;
}

function getReviewTrigger(input: {
  hasChinese: boolean;
  passed: boolean;
  rescueCount: number;
  suggestedExpression: string;
}): ReviewTriggerCandidate | null {
  if (input.rescueCount > 0) {
    return {
      triggerType: "rescue_used",
      skillKey: skillKeyFromExpression(input.suggestedExpression),
      suggestedAction: `明天不用中文救援，再用 ${input.suggestedExpression} 打一轮。`
    };
  }

  if (input.hasChinese) {
    return {
      triggerType: "zh_only",
      skillKey: "english_output_first",
      suggestedAction: "先用中文想意思，再输出一句完整英文。"
    };
  }

  if (!input.passed) {
    return {
      triggerType: "weak_answer",
      skillKey: skillKeyFromExpression(input.suggestedExpression),
      suggestedAction: `补练 ${input.suggestedExpression}，让回答更像真实对话。`
    };
  }

  return null;
}

function naturalizeAnswer(answer: string, fallback: string) {
  const trimmed = answer.replace(/\s+/g, " ").replace(/[.!?]+$/g, "");
  if (!trimmed) return fallback;
  if (/\bplease\b/i.test(trimmed)) return `${trimmed}.`;
  return `${trimmed}, please.`;
}

function pickSuggestedExpression(expression: string) {
  const trimmed = expression.trim();
  return trimmed || "Could I get a little help with this, please?";
}

function parseReviewTrigger(value: unknown): ReviewTriggerCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<ReviewTriggerCandidate>;
  const triggerType = record.triggerType;
  if (triggerType !== "rescue_used" && triggerType !== "zh_only" && triggerType !== "weak_answer") {
    return null;
  }

  return {
    triggerType,
    skillKey: getString(record.skillKey) || "battle_expression",
    suggestedAction: getString(record.suggestedAction) || "把这句放进复习队列。"
  };
}

function skillKeyFromExpression(expression: string) {
  return expression.toLowerCase().includes("could") ? "polite_request" : "battle_expression";
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}
