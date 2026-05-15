# Prologue Built-in Image Pack

> 7 张内置占位 webp，本目录路径由 `src/server/db/seed-prologue.ts` 直接引用。
> 当前文件为 1x1 lossy WebP **占位**，仅满足"路径可加载"，**视觉上无意义**。
> 真图由 design / 图片生成阶段后续替换；替换时保持文件名和相对路径不变。

## 文件清单（与 `seed-data.ts` `prologueSeed.coverImageUrl` / `panels[*].imageUrl` / `monsterImageUrl` / `equipmentImageUrl` / `victoryImageUrl` 一一对应）

| 文件 | 用途 | 引用字段 |
|---|---|---|
| `cover.webp` | 序章副本封面 | `prologueSeed.coverImageUrl` |
| `panel-1.webp` | 第 1 格分镜（setup：旅人抵达村门） | `prologueSeed.panels[0].imageUrl` |
| `panel-2.webp` | 第 2 格分镜（turn：旅人挥手 hello） | `prologueSeed.panels[1].imageUrl` |
| `panel-3.webp` | 第 3 格分镜（reward：怪兽递出剑） | `prologueSeed.panels[2].imageUrl` |
| `monster.webp` | Village Sprite 怪兽卡 | `prologueSeed.monsterImageUrl` |
| `hello-sword.webp` | Hello Sword 装备卡 | `prologueSeed.equipmentImageUrl` |
| `victory.webp` | 序章通关卡 | `prologueSeed.victoryImageUrl` |

## 视觉规范（Design-Brief.md `序章副本` 章节）

- 像真正的第一关，不像产品说明页
- 7 张图统一成一段轻冒险教学剧情
- 风格统一漫画卡牌，避免每格像不同作品
- 详见 `Design-Brief.md` → 视觉规范 / 序章图片包

## 替换流程

1. 设计 / 生成新图（design-maker 或图片 Provider）
2. 直接覆盖本目录的 7 个 .webp 文件
3. 不需要改 seed-data.ts 路径
4. 不需要 db migration（imageUrl 字段已固定）
