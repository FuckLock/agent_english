export const appCopy = {
  productName: "English Monster Quest",
  tagline: "越学越开心的英语副本"
} as const;

export const navItems = [
  { id: "map", label: "地图", href: "#map" },
  { id: "discover", label: "发现", href: "/discover" },
  { id: "vault", label: "收藏", href: "#vault" },
  { id: "settings", label: "设置", href: "/settings" }
] as const;

export const xpSummary = {
  level: "Lv. 12",
  xp: "3,840 XP",
  streak: "7 天连胜"
} as const;

export const dungeons = [
  {
    title: "Cafe Mystery",
    level: "A2",
    tag: "点餐听力",
    xp: 240,
    progress: 72,
    tone: "#FF7A59"
  },
  {
    title: "Moon Station",
    level: "B1",
    tag: "科幻阅读",
    xp: 320,
    progress: 38,
    tone: "#4F7CFF"
  },
  {
    title: "Bakery Chase",
    level: "A1",
    tag: "漫画跟读",
    xp: 180,
    progress: 54,
    tone: "#19A974"
  }
] as const;
