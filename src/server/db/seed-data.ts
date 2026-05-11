import { asJson } from "./utils";

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
    difficultyLevel: "A2"
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
    difficultyLevel: "B1"
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
    difficultyLevel: "A1"
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
    difficultyLevel: "A2"
  }
] as const;

export const providerTemplateSeeds = [
  ["openai-official", "openai", "OpenAI 官方", "text", "https://api.openai.com/v1"],
  ["google-official", "google", "Google 官方", "text", "https://generativelanguage.googleapis.com"],
  ["grsai-compatible", "grsai", "grsai 可配置", "text", null],
  ["openai-compatible", "openai-compatible", "OpenAI-compatible", "text", null],
  ["custom-http", "custom-http", "自定义 HTTP", "text", null],
  ["bing-search", "bing", "Bing Search", "search", "https://api.bing.microsoft.com"],
  ["google-cse", "google-cse", "Google CSE", "search", "https://www.googleapis.com"],
  ["tavily-search", "tavily", "Tavily", "search", "https://api.tavily.com"],
  ["serpapi-search", "serpapi", "SerpAPI", "search", "https://serpapi.com"]
] as const;

export const comicPanelSeeds = [
  ["panel-cafe-1", 1, "Could I get an iced latte, please?", "我想礼貌地点一杯冰拿铁。"],
  ["panel-cafe-2", 2, "Would you like anything else?", "店员询问是否还需要别的东西。"],
  ["panel-cafe-3", 3, "A small cake sounds perfect.", "我再加一个小蛋糕。"]
] as const;

export const demoJson = {
  empty: asJson({}),
  appSettings: asJson({ theme: "quest-light", dailyGoal: 3 }),
  providerSchema: asJson({ fields: ["apiKey", "baseUrl", "model"], advancedMapping: true }),
  lesson: asJson({ mode: "comic", panelCount: 3, fallback: "text-card" }),
  battleFeedback: asJson({
    passed: true,
    rewrite: "Could I get an iced latte, please?",
    explanationZh: "Could I get... 是礼貌点单句型。"
  }),
  skillProgress: asJson({ speaking: 42, listening: 35, reading: 58 }),
  learningRecord: asJson({ source: "seed", duplicateRewardBlocked: true })
};
