---
phase_id: Phase 6.6
status: locked
spec_refs:
  - "Product-Spec.md#YouTube 视频沉浸翻译模式"
design_refs:
  - "Design-Brief.md#YouTube 视频沉浸翻译模式"
  - "design_export/IeNMB.png"
  - "design_export/8QbXx.png"
  - "design_export/UFozf.png"
  - "design_export/o2OII.png"
  - "design_export/CUfX0.png"
plan_refs:
  - "DEV-PLAN.md#Phase 6.6: 浏览器沉浸体验修正 + YouTube 视频模式基线"
  - "ARCHITECTURE.md#Layer Boundaries"
  - "PROJECT-STRUCTURE.md"
  - "docs/adr/ADR-0004-youtube-video-immersive-translation.md"
round: 1
---

[功能验证 criteria]
1. YouTube watch / Shorts 页面必须进入视频沉浸模式，不再显示文本型网页的“原文 / 双语 / 学习”分段控件。
   验证条件：
   - `packages/browser-agent/src/site-adapters/youtube.ts` 能识别 `youtube.com/watch`、`m.youtube.com/shorts`、`youtu.be`。
   - `packages/browser-agent/src/modes/display-mode-controller.ts` 对 YouTube 视频页拒绝切换到 `bilingual` / `learning` 阅读模式。
   - `apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 在 `isVideoImmersiveMode` 时隐藏阅读模式 Picker。

2. 视频字幕状态必须走共享 contract 和 bridge，不把 YouTube DOM 规则写进 SwiftUI。
   验证条件：
   - `packages/contracts/src/video-caption.ts` 定义 `VideoCaptionSegment`、`VideoCaptionOverlayState`、页面类型、可用性、overlay 状态和错误码。
   - `packages/contracts/src/bridge-events.ts` 导出 `video.caption.state.changed` 事件。
   - Swift `BridgeEventDecoder` 能解码同一 fixture。

3. browser-agent 必须只做 DOM / overlay / bridge，不直接调用模型服务或 Provider。
   验证条件：
   - `packages/browser-agent/src/site-adapters/youtube.ts` 只包含 URL / DOM 状态识别和状态构造。
   - `packages/browser-agent/src/overlay/video-caption-overlay.ts` 只渲染 overlay / fallback bar。
   - `packages/browser-agent/src` 不出现 `Authorization`、`Bearer`、`apiKey`、`baseURL`。

4. iOS 必须接收视频字幕状态，并把当前字幕句复用既有模型服务翻译路径，而不是在 JS 里直连模型。
   验证条件：
   - `WebBridgeController` 暴露 `videoCaptionState`、`isVideoImmersiveMode`。
   - `WebBridgeController` 收到带 `activeSegment.sourceText` 的视频状态后，通过 `TranslationProviderClient` 翻译单句，并回填 `applyVideoCaptionOverlayState`。
   - 翻译失败、字幕不可用、overlay 不安全时只显示轻量状态，不中断原站播放。

5. 回归验证必须覆盖 contracts、browser-agent 和 Swift tests。
   验证条件：
   - `pnpm --filter @agent-english/contracts test` 返回 0。
   - `pnpm --filter @agent-english/browser-agent test` 返回 0。
   - `swift test --package-path apps/ios` 返回 0。
