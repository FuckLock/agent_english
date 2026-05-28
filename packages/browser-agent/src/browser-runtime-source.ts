import { RUNTIME_BOOTSTRAP_SOURCE } from "./runtime-source/bootstrap";
import { RUNTIME_SCANNER_SOURCE } from "./runtime-source/scanner";
import { RUNTIME_UI_BRIDGE_SOURCE } from "./runtime-source/ui-bridge";
import { RUNTIME_YOUTUBE_CAPTION_TRACK_SOURCE } from "./runtime-source/youtube-caption-track-source";
import { RUNTIME_YOUTUBE_INJECTION_SOURCE } from "./runtime-source/youtube-injection";
import { RUNTIME_YOUTUBE_OVERLAY_SOURCE } from "./runtime-source/youtube-overlay";

// 拼接顺序（同一 IIFE 内共享词法作用域；箭头函数 const 互相引用在运行时求值，故顺序只需
// 保证「执行前」全部声明完）：
// bootstrap（共享常量 / 状态，含 Phase 8.9 字幕轨状态变量）→ scanner（通用文本网页全量
// 扫描 + 选词）→ youtube-overlay（YouTube 页面识别 detectYouTubePage + 字幕 overlay 渲染）→
// youtube-caption-track（Phase 8.9：读 player response captionTracks + 同源 fetch timedtext
// json3 解析 + 按 currentTime 时间同步）→ youtube-injection（YouTube 整站轻注入 + SPA 路由
// 监听 + 字幕状态构建）→ ui-bridge（桥接命令 + 通用翻译入口 + 引导事件 + 启动字幕同步）。
// Phase 8.7 从 ui-bridge 拆出 YouTube 逻辑、Phase 8.9 再拆出字幕轨子模块以满足单文件 ≤300 行。
export const BROWSER_AGENT_RUNTIME_SOURCE = [
  RUNTIME_BOOTSTRAP_SOURCE,
  RUNTIME_SCANNER_SOURCE,
  RUNTIME_YOUTUBE_OVERLAY_SOURCE,
  RUNTIME_YOUTUBE_CAPTION_TRACK_SOURCE,
  RUNTIME_YOUTUBE_INJECTION_SOURCE,
  RUNTIME_UI_BRIDGE_SOURCE,
].join("\n");
