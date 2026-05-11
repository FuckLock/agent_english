import type { DiscoveryCategoryId } from "@/lib/discovery-options";

export type StoryPanelDraft = {
  order: number;
  englishText: string;
  chineseHint: string;
  explanationZh: string;
  imagePrompt: string;
  expression: string;
  meaningZh: string;
};

export type StoryLessonDraft = {
  mode: "comic";
  title: string;
  level: string;
  category: DiscoveryCategoryId;
  summaryZh: string;
  objectiveText: string;
  sourceExcerpt: string;
  fullText: string;
  coverPrompt: string;
  panels: StoryPanelDraft[];
  expressions: Array<{
    expression: string;
    meaningZh: string;
    sourceText: string;
  }>;
  ttsDisclosure: string;
};

type StoryLessonInput = {
  title: string;
  level: string;
  category: DiscoveryCategoryId;
  summary: string;
  excerpt: string;
  originName: string;
};

const extensionPanels = [
  {
    englishText: "I can explain the problem clearly.",
    chineseHint: "我可以把问题说清楚。",
    explanationZh: "explain the problem clearly 适合描述状况，不只是说 I don't know。"
  },
  {
    englishText: "Could you help me check it?",
    chineseHint: "你能帮我检查一下吗？",
    explanationZh: "Could you help me...? 是礼貌求助句，比命令式更自然。"
  },
  {
    englishText: "Now I know what to say next time.",
    chineseHint: "现在我知道下次该怎么说了。",
    explanationZh: "what to say next time 可以表达下次遇到类似场景的应对。"
  }
] as const;

export function createStoryLessonDraft(input: StoryLessonInput): StoryLessonDraft {
  const sentences = normalizeSentences(input.excerpt);
  const baseSentences = ensurePanelSentences(sentences, input.title);
  const panels = baseSentences.slice(0, 3).map((sentence, index) =>
    createPanelDraft(index + 1, sentence, input.title, input.category)
  );

  return {
    mode: "comic",
    title: input.title,
    level: input.level,
    category: input.category,
    summaryZh: input.summary,
    objectiveText: createObjectiveText(input.category),
    sourceExcerpt: input.excerpt,
    fullText: input.excerpt,
    coverPrompt: createImagePrompt("cover", input.title, input.category, input.originName),
    panels,
    expressions: panels.map((panel) => ({
      expression: panel.expression,
      meaningZh: panel.meaningZh,
      sourceText: panel.englishText
    })),
    ttsDisclosure: "AI 英文朗读用于辅助输入，不代表真人录音。"
  };
}

export function createExtensionPanelDraft(order: number, title: string, category: DiscoveryCategoryId) {
  const template = extensionPanels[(order - 4) % extensionPanels.length];

  return createPanelDraft(order, template.englishText, title, category, {
    chineseHint: template.chineseHint,
    explanationZh: template.explanationZh
  });
}

function ensurePanelSentences(sentences: string[], title: string) {
  const fallback = [
    `I noticed something interesting in ${title}.`,
    "The situation became clearer after one small detail.",
    "I can use a short English sentence to explain it."
  ];

  return [...sentences, ...fallback].slice(0, 3);
}

function normalizeSentences(text: string) {
  const matches = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  if (matches.length > 0) {
    return matches;
  }

  return text ? [text] : [];
}

function createPanelDraft(
  order: number,
  englishText: string,
  title: string,
  category: DiscoveryCategoryId,
  override?: { chineseHint: string; explanationZh: string }
): StoryPanelDraft {
  const expression = extractExpression(englishText);

  return {
    order,
    englishText,
    chineseHint: override?.chineseHint ?? createChineseHint(englishText, order),
    explanationZh: override?.explanationZh ?? createExplanation(englishText, expression),
    imagePrompt: createImagePrompt(`panel ${order}`, title, category, englishText),
    expression,
    meaningZh: createExpressionMeaning(expression)
  };
}

function extractExpression(sentence: string) {
  const clean = sentence.replace(/[.!?]+$/g, "");
  const words = clean.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];

  if (/could i|get|would you|could you/i.test(clean)) {
    return clean;
  }

  return words.slice(0, Math.min(words.length, 6)).join(" ") || "I can explain it";
}

function createChineseHint(sentence: string, order: number) {
  if (/could i get/i.test(sentence)) return "我想礼貌地提出请求。";
  if (/would you like/i.test(sentence)) return "对方在询问是否还需要别的东西。";
  if (/help me/i.test(sentence)) return "我在礼貌地请求帮助。";

  return `第 ${order} 格：先抓住这句英文的场景和动作。`;
}

function createExplanation(sentence: string, expression: string) {
  if (/could/i.test(sentence)) return "Could... 比 can 更礼貌，适合向店员、同事或陌生人请求。";
  if (/noticed/i.test(sentence)) return "noticed 表示“注意到”，适合说发现了问题。";

  return `${expression} 是这格最值得拿来复用的表达。`;
}

function createExpressionMeaning(expression: string) {
  if (/could/i.test(expression)) return "礼貌请求或求助。";
  if (/noticed/i.test(expression)) return "说明自己注意到了某个情况。";
  if (/explain/i.test(expression)) return "把问题说清楚。";

  return "可复用的场景表达。";
}

function createObjectiveText(category: DiscoveryCategoryId) {
  const objectives: Record<DiscoveryCategoryId, string> = {
    today: "读完 3 格漫画后，用一句英文说清楚故事重点。",
    weird: "把奇怪事件讲给别人听，说明你发现了什么。",
    movie: "用英文描述一个幕后细节或人物动机。",
    tech: "用简单英文解释一个科技变化或小问题。",
    culture: "用礼貌英文解释一个生活场景。",
    people: "用英文讲清楚一个人的选择或行动。",
    travel: "用英文处理旅行中的一个小状况。"
  };

  return objectives[category];
}

function createImagePrompt(kind: string, title: string, category: string, detail: string) {
  return [
    "bright RPG comic card style",
    kind,
    title,
    category,
    detail,
    "clear facial expressions, readable scene, warm adventure colors"
  ].join(", ");
}
