import { RUNTIME_BOOTSTRAP_SOURCE } from "./runtime-source/bootstrap";
import { RUNTIME_SCANNER_SOURCE } from "./runtime-source/scanner";
import { RUNTIME_UI_BRIDGE_SOURCE } from "./runtime-source/ui-bridge";
import { RUNTIME_YOUTUBE_INJECTION_SOURCE } from "./runtime-source/youtube-injection";
import { RUNTIME_YOUTUBE_OVERLAY_SOURCE } from "./runtime-source/youtube-overlay";

// 拼接顺序（同一 IIFE 内共享词法作用域）：
// bootstrap（共享常量 / 状态）→ scanner（通用文本网页全量扫描 + 选词）→
// youtube-overlay（YouTube 页面识别 + 字幕 overlay 渲染）→ youtube-injection（YouTube
// 整站轻注入 + SPA 路由监听 + 字幕状态构建）→ ui-bridge（桥接命令 + 通用翻译入口 + 引导
// 事件）。Phase 8.7 从 ui-bridge 拆出 YouTube 逻辑以满足单文件 ≤300 行。
export const BROWSER_AGENT_RUNTIME_SOURCE = [
  RUNTIME_BOOTSTRAP_SOURCE,
  RUNTIME_SCANNER_SOURCE,
  RUNTIME_YOUTUBE_OVERLAY_SOURCE,
  RUNTIME_YOUTUBE_INJECTION_SOURCE,
  RUNTIME_UI_BRIDGE_SOURCE,
].join("\n");
