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

export const prologueSeed = {
  sourceId: "source-prologue",
  excerptId: "excerpt-prologue",
  jobId: "job-prologue-ready",
  lessonId: "lesson-prologue",
  dungeonId: "dungeon-prologue",
  slug: "prologue",
  title: "First Meeting",
  level: "A1",
  tag: "新手教学",
  xpReward: 100,
  progressPercent: 0,
  tone: "#FFA45C",
  mapTop: "85%",
  mapLeft: "10%",
  region: "Prologue Vale",
  objectiveText: "Say hello to the friendly monster you meet.",
  monsterName: "Village Sprite",
  sourceType: "prologue",
  difficultyLevel: "A1",
  category: "weird",
  excerpt:
    "A wanderer arrives at a quiet village gate at dusk. The wanderer waves and says hello. The monster smiles and gives a glowing sword.",
  summary: "在一段轻冒险序章里学会用 Hello 打招呼。",
  coverImageUrl: "/assets/prologue/cover.webp",
  monsterImageUrl: "/assets/prologue/monster.webp",
  victoryImageUrl: "/assets/prologue/victory.webp",
  equipmentImageUrl: "/assets/prologue/hello-sword.webp",
  panels: [
    {
      id: "panel-prologue-1",
      order: 1,
      englishText: "A wanderer arrives at a quiet village gate at dusk.",
      chineseHint: "一位旅人在黄昏时分来到一座安静的村门。",
      imageUrl: "/assets/prologue/panel-1.webp",
      rhythmType: "setup",
      visualGrammar: { shot: "wide", focus: "arrival", mood: "quiet dusk village" }
    },
    {
      id: "panel-prologue-2",
      order: 2,
      englishText: "The wanderer waves and says hello.",
      chineseHint: "旅人挥手，对路上小怪兽说 Hello。",
      imageUrl: "/assets/prologue/panel-2.webp",
      rhythmType: "turn",
      visualGrammar: { shot: "medium", focus: "greeting", mood: "friendly first contact" }
    },
    {
      id: "panel-prologue-3",
      order: 3,
      englishText: "The monster smiles and gives a glowing sword.",
      chineseHint: "怪兽微笑着，递出一把发光的剑。",
      imageUrl: "/assets/prologue/panel-3.webp",
      rhythmType: "reward",
      visualGrammar: { shot: "close-up", focus: "gift reveal", mood: "warm reward" }
    }
  ],
  helloSword: {
    expressionId: "expression-prologue-hello",
    equipmentId: "equipment-hello-sword",
    expression: "Hello!",
    meaningZh: "你好！",
    sourceText: "The wanderer waves and says hello.",
    equipmentName: "Hello Sword",
    rarity: "common"
  }
} as const;

export const prologueLessonJson = asJson({
  mode: "prologue_comic",
  panelCount: 3,
  fallback: "built-in-assets",
  isPrologue: true
});
