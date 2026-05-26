---
phase_id: Phase 8
status: locked
spec_refs:
  - "Product-Spec.md#3.1 核心功能"
  - "Product-Spec.md#5.2.A 路径 2A：刷 YouTube 视频"
  - "Product-Spec.md#8.2 YouTube 边界"
  - "Product-Spec.md#9.3 视频沉浸翻译模式"
  - "Product-Spec.md#10 非目标"
plan_refs:
  - "DEV-PLAN.md#Phase 8: 站点适配 + YouTube 视频沉浸翻译完善 + 快捷入口管理"
  - "ARCHITECTURE.md#Layer Boundaries"
  - "PROJECT-STRUCTURE.md#Directory Responsibilities"
  - "docs/adr/ADR-0004-youtube-video-immersive-translation.md"
round: revised-after-phase-6.7-and-phase-7
---

[功能验证 criteria]
- 交付项：`packages/contracts` 必须把核心站点和能力枚举作为事实源，覆盖 YouTube、Reddit、Wikipedia、AO3、X、字幕、听音、评论、搜索结果、长文和动态内容。
  验证手段：Grep 模式 + 命令退出码
  验证条件：
    - Grep 模式：`packages/contracts/src/site-capability.ts` 同时命中 `youtube`、`reddit`、`wikipedia`、`ao3`、`x`
    - Grep 模式：`packages/contracts/src/site-capability.ts` 同时命中 `captions-available`、`captions-unavailable`、`video-audio-translation`、`comments`、`search-results`、`longform-reading`、`dynamic-content`
    - 命令退出码：`pnpm --filter @agent-english/contracts test` 返回 0

- 交付项：`browser-agent` 必须为 YouTube、Reddit、Wikipedia、AO3、X 建立独立 site adapter，并保留 generic fallback；scanner 必须按 URL 设置 `PageContext.siteKind` 和 segment capabilities。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`packages/browser-agent/src/site-adapters/youtube.ts`、`packages/browser-agent/src/site-adapters/reddit.ts`、`packages/browser-agent/src/site-adapters/wikipedia.ts`、`packages/browser-agent/src/site-adapters/ao3.ts`、`packages/browser-agent/src/site-adapters/x.ts`、`packages/browser-agent/src/site-adapters/generic.ts`、`packages/browser-agent/src/site-adapters/index.ts`
    - Grep 模式：`packages/browser-agent/tests/site-adapters.test.mjs` 同时命中 `detects YouTube watch and Shorts`、`detects Reddit Wikipedia AO3 and X`、`falls back to generic capabilities`
    - Grep 模式：`packages/browser-agent/tests/segment-scanner.test.mjs` 同时命中 `reddit`、`wikipedia`、`ao3`、`x`
    - 命令退出码：`pnpm --filter @agent-english/browser-agent test` 返回 0

- 交付项：YouTube watch / Shorts 必须继续禁止文本阅读模式控件，字幕可用时走字幕叠层，字幕不可用或质量低时提供听音翻译 Beta 状态，不能影响页面文字翻译。
  验证手段：Grep 模式 + 命令退出码
  验证条件：
    - Grep 模式：`packages/browser-agent/tests/youtube-adapter.test.mjs` 同时命中 `detects watch shorts and non-video YouTube pages`、`captions stay primary when caption text exists`、`audio beta becomes available when captions are unavailable`、`audio beta becomes available when caption quality is low`
    - Grep 模式：`packages/browser-agent/tests/display-mode-controller.test.mjs` 命中 `youtube`
    - 命令退出码：`pnpm --filter @agent-english/browser-agent test` 返回 0

- 交付项：首页快捷入口必须支持默认核心站点、添加、删除和排序；该能力已在 Phase 7 之前落地，Phase 8 必须保留回归。
  验证手段：Grep 模式 + 命令退出码
  验证条件：
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/SiteShortcutRepository.swift` 同时命中 `YouTube`、`Reddit`、`Wikipedia`、`AO3`、`X`、`seedDefaultsIfNeeded`、`addOrUpdate`、`move`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/SiteShortcutEditorView.swift` 同时命中 `添加或更新`、`onDelete`、`onMove`
    - 命令退出码：`swift test --package-path apps/ios --filter SiteShortcutRepositoryTests` 返回 0

[非功能 criteria]
- 交付项：Phase 8 不得违反 ADR-0004：不下载媒体或完整字幕，不分离音视频，不后台听音，不在 JS 里直连模型 / ASR，不在 iOS 写站点 DOM selector。
  验证手段：Grep 模式 + 命令退出码
  验证条件：
    - Grep 模式：`rg -n 'yt-dlp|youtube-dl|ffmpeg|demux|mux|extractAudio|downloadAudio|downloadVideo|downloadSubtitle' packages/browser-agent/src apps/ios/AgentEnglish apps/ios/AgentEnglishCore` 输出为空
    - Grep 模式：`rg -n 'fetch\\(|XMLHttpRequest|openai|deepseek|anthropic|apiKey|baseURL' packages/browser-agent/src` 输出为空
    - Grep 模式：`rg -n '\\.ytp-|querySelector|MutationObserver' apps/ios/AgentEnglish/Web apps/ios/AgentEnglish/Screens apps/ios/AgentEnglishCore` 输出为空
    - 命令退出码：`pnpm --filter @agent-english/browser-agent check` 返回 0
    - 命令退出码：`swift test --package-path apps/ios` 返回 0
    - 命令退出码：`xcodebuild -project apps/ios/AgentEnglish.xcodeproj -scheme AgentEnglish -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build` 返回 0
