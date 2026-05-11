export const discoveryCategories = [
  { id: "today", label: "今日推荐", query: "fun English story" },
  { id: "weird", label: "奇闻趣事", query: "strange but true story" },
  { id: "movie", label: "电影娱乐", query: "movie behind the scenes" },
  { id: "tech", label: "科技新鲜事", query: "AI technology news" },
  { id: "culture", label: "生活文化", query: "daily life culture" },
  { id: "people", label: "人物故事", query: "interesting person story" },
  { id: "travel", label: "旅行冒险", query: "travel adventure story" }
] as const;

export const lengthFilters = [
  { id: "any", label: "不限长度" },
  { id: "short", label: "短文" },
  { id: "medium", label: "中篇" },
  { id: "long", label: "长文" }
] as const;

export const difficultyFilters = [
  { id: "any", label: "不限难度" },
  { id: "beginner", label: "入门" },
  { id: "easy", label: "简单" },
  { id: "medium", label: "中等" }
] as const;

export const modeFilters = [
  { id: "quest", label: "进入副本" },
  { id: "read", label: "只读故事" }
] as const;

export type DiscoveryCategoryId = (typeof discoveryCategories)[number]["id"];
export type LengthFilterId = (typeof lengthFilters)[number]["id"];
export type DifficultyFilterId = (typeof difficultyFilters)[number]["id"];
export type DiscoveryModeId = (typeof modeFilters)[number]["id"];
