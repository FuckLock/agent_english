import { asJson } from "./utils";
import { builtinProviderTemplates } from "../providers/provider-templates";

export const lessonSeeds = [
  {
    sourceId: "source-cafe-mystery",
    excerptId: "excerpt-cafe-mystery",
    jobId: "job-cafe-mystery-ready",
    lessonId: "lesson-cafe-mystery",
    dungeonId: "dungeon-cafe-mystery",
    slug: "cafe-mystery",
    title: "Cafe Mystery",
    level: "A2",
    tag: "点餐听力",
    xpReward: 240,
    progressPercent: 72,
    tone: "#FF7A59",
    mapTop: "21%",
    mapLeft: "17%",
    region: "Talk Harbor",
    objectiveText: "Use polite cafe English to order a drink.",
    monsterName: "Latte Phantom",
    excerpt: "Could I get an iced latte, please? I would also like a small cake.",
    summary: "在咖啡店用礼貌英语点单。",
    sourceType: "demo",
    difficultyLevel: "A2",
    category: "culture"
  },
  {
    sourceId: "source-moon-station",
    excerptId: "excerpt-moon-station",
    jobId: "job-moon-station-ready",
    lessonId: "lesson-moon-station",
    dungeonId: "dungeon-moon-station",
    slug: "moon-station",
    title: "Moon Station",
    level: "B1",
    tag: "科幻阅读",
    xpReward: 320,
    progressPercent: 38,
    tone: "#4F7CFF",
    mapTop: "34%",
    mapLeft: "64%",
    region: "Comic Town",
    objectiveText: "Explain a small station emergency in clear English.",
    monsterName: "Signal Wisp",
    excerpt: "The moon station was quiet until the warning light began to blink.",
    summary: "在月球站处理一个轻量科幻事件。",
    sourceType: "demo",
    difficultyLevel: "B1",
    category: "tech"
  },
  {
    sourceId: "source-bakery-chase",
    excerptId: "excerpt-bakery-chase",
    jobId: "job-bakery-chase-ready",
    lessonId: "lesson-bakery-chase",
    dungeonId: "dungeon-bakery-chase",
    slug: "bakery-chase",
    title: "Bakery Chase",
    level: "A1",
    tag: "漫画跟读",
    xpReward: 180,
    progressPercent: 54,
    tone: "#19A974",
    mapTop: "58%",
    mapLeft: "35%",
    region: "Comic Town",
    objectiveText: "Follow a funny bakery scene with short sentences.",
    monsterName: "Bread Runner",
    excerpt: "The baker runs after the warm bread and laughs with the children.",
    summary: "用短句跟读轻松漫画场景。",
    sourceType: "demo",
    difficultyLevel: "A1",
    category: "weird"
  },
  {
    sourceId: "source-word-forge",
    excerptId: "excerpt-word-forge",
    jobId: "job-word-forge-ready",
    lessonId: "lesson-word-forge",
    dungeonId: "dungeon-word-forge",
    slug: "word-forge",
    title: "Word Forge",
    level: "A2",
    tag: "单词铸造",
    xpReward: 210,
    progressPercent: 21,
    tone: "#F4B740",
    mapTop: "70%",
    mapLeft: "72%",
    region: "Word Forge",
    objectiveText: "Turn useful words into short usable sentences.",
    monsterName: "Vocabulary Smith",
    excerpt: "A useful word becomes stronger when you use it in a real sentence.",
    summary: "把单词变成能开口使用的句子。",
    sourceType: "demo",
    difficultyLevel: "A2",
    category: "people"
  }
] as const;

export const providerTemplateSeeds = builtinProviderTemplates.map((templateItem) => [
  templateItem.id,
  templateItem.providerKey,
  templateItem.name,
  templateItem.capability,
  templateItem.defaultBaseUrl,
  templateItem.defaultModel
] as const);

export const comicPanelSeeds = [
  ["panel-cafe-1", 1, "Could I get an iced latte, please?", "我想礼貌地点一杯冰拿铁。"],
  ["panel-cafe-2", 2, "Would you like anything else?", "店员询问是否还需要别的东西。"],
  ["panel-cafe-3", 3, "A small cake sounds perfect.", "我再加一个小蛋糕。"],
  ["panel-cafe-4", 4, "The menu suddenly looks like a dungeon map.", "菜单突然像一张副本地图。"],
  ["panel-cafe-5", 5, "I can ask politely and keep the conversation going.", "我可以礼貌提问，让对话继续。"],
  ["panel-cafe-6", 6, "The useful sentence becomes a new expression gear.", "有用句子变成新的表达装备。"]
] as const;

export const demoJson = {
  empty: asJson({}),
  appSettings: asJson({ theme: "quest-light", dailyGoal: 3 }),
  providerSchema: asJson({ fields: ["apiKey", "baseUrl", "model"], advancedMapping: true }),
  lesson: asJson({ mode: "comic", panelCount: 6, fallback: "text-card" }),
  battleFeedback: asJson({
    passed: true,
    rewrite: "Could I get an iced latte, please?",
    explanationZh: "Could I get... 是礼貌点单句型。"
  }),
  skillProgress: asJson({ speaking: 42, listening: 35, reading: 58 }),
  learningRecord: asJson({ source: "seed", duplicateRewardBlocked: true })
};
