---
phase_id: Phase 6.7
status: locked
spec_refs:
  - "Product-Spec.md#3.1 核心功能"
  - "Product-Spec.md#5.2.A 路径 2A：刷 YouTube 视频"
  - "Product-Spec.md#6 AI 能力需求"
  - "Product-Spec.md#8.2 YouTube 边界"
  - "Product-Spec.md#8.4 账号、会话与权益"
  - "Product-Spec.md#8.5 AI 服务与模型等级"
  - "Product-Spec.md#8.6 隐私与数据"
  - "Product-Spec.md#9.1 MVP 范围"
  - "Product-Spec.md#9.3 视频沉浸翻译模式"
  - "Product-Spec.md#10 非目标"
  - "Product-Spec.md#11 验收指标"
design_refs:
  - "Design-Brief.md#YouTube 视频沉浸翻译模式"
  - "design_export/iajll.png"
  - "design_export/f154K.png"
  - "design_export/NtBkp.png"
  - "design_export/3YlLm.png"
  - "design_export/iI4Cp.png"
plan_refs:
  - "DEV-PLAN.md#Phase 6.7: YouTube 听音翻译 Beta + 音频分钟额度"
  - "ARCHITECTURE.md#Layer Boundaries"
  - "ARCHITECTURE.md#Shared Contracts"
  - "PROJECT-STRUCTURE.md#Directory Responsibilities"
  - "docs/adr/ADR-0004-youtube-video-immersive-translation.md"
round: 3
---

[功能验证 criteria]
- 交付项：共享 contract、fixture 和 bridge event 必须把 YouTube 听音翻译的短句、状态、额度和错误码收口为跨端同构 payload，TS fixture 与 Swift decoder 必须字段等价。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`packages/contracts/src/video-audio-translation.ts`、`packages/contracts/src/bridge-events.ts`、`packages/contracts/tests/video-audio.test.mjs`、`packages/contracts/tests/fixtures/video-audio-youtube-watch.json`、`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Bridge/VideoAudioTranslationContracts.swift`、`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Bridge/BridgeEvent.swift`、`apps/ios/AgentEnglishTests/VideoAudioTranslationContractTests.swift`、`apps/ios/AgentEnglishTests/WebBridgeControllerTests.swift`
    - Grep 模式：`packages/contracts/src/video-audio-translation.ts` 同时命中 `VideoAudioSegment`、`VideoAudioTranslationState`、`AudioTranslationQuota`、`failureReason`
    - Grep 模式：`packages/contracts/tests/video-audio.test.mjs` 同时命中 `eventType`、`audioSegmentId`、`remainingMinutes`、`resetAt`
    - Grep 模式：`apps/ios/AgentEnglishTests/VideoAudioTranslationContractTests.swift` 同时命中 `audioSegmentId`、`remainingMinutes`、`resetAt`
    - Grep 模式：`apps/ios/AgentEnglishTests/WebBridgeControllerTests.swift` 同时命中 `testDecodesVideoAudioStateEventEnvelope`、`testDecodesVideoAudioQuotaEventEnvelope`
    - 命令退出码：`pnpm --filter @agent-english/contracts test` 返回 0
    - 命令退出码：`swift test --package-path apps/ios --filter VideoAudioTranslationContractTests` 返回 0
    - 命令退出码：`swift test --package-path apps/ios --filter WebBridgeControllerTests` 返回 0

- 交付项：`browser-agent` 必须以“字幕优先”为默认决策；只有字幕不可用、字幕质量低或用户手动选择时才切到听音 Beta；视频安全区不足时必须降级为下方字幕条。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`packages/browser-agent/src/site-adapters/youtube.ts`、`packages/browser-agent/src/overlay/video-caption-overlay.ts`、`packages/browser-agent/tests/youtube-adapter.test.mjs`、`packages/browser-agent/tests/video-caption-overlay.test.mjs`
    - Grep 模式：`packages/browser-agent/tests/youtube-adapter.test.mjs` 同时命中 `captions stay primary when caption text exists`、`audio beta becomes available when captions are unavailable`、`audio beta becomes available when caption quality is low`、`manual audio selection overrides caption priority`
    - Grep 模式：`packages/browser-agent/tests/video-caption-overlay.test.mjs` 同时命中 `unsafe audio overlay falls back to fallback bar`、`audio state renders recognizing quota exhausted and failed copy`
    - Grep 模式：`packages/browser-agent/src/site-adapters/youtube.ts` 同时命中 `caption` 与 `audio`
    - Grep 模式：`rg -n 'fetch\\(|XMLHttpRequest|MediaRecorder|getUserMedia|AudioContext|ffmpeg|yt-dlp|youtube-dl' packages/browser-agent/src/site-adapters/youtube.ts packages/browser-agent/src/overlay/video-caption-overlay.ts` 输出为空
    - 命令退出码：`pnpm --filter @agent-english/browser-agent test` 返回 0

- 交付项：听音分钟额度必须由共享 catalog 和后端 quota 收口，Free 固定为每天 10 分钟，Pro / Max 明确高于 Free，并带重置时间和滥用保护。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`packages/contracts/src/model-catalog.ts`、`services/model-gateway/src/quota/audio-minute-quota.ts`、`services/model-gateway/tests/video-audio-translate.test.mjs`
    - Grep 模式：`packages/contracts/src/model-catalog.ts` 同时命中 `audio`、`asr`、`free`、`pro`、`max`
    - Grep 模式：`services/model-gateway/src/quota/audio-minute-quota.ts` 同时命中 `10`、`resetAt`
    - Grep 模式：`services/model-gateway/tests/video-audio-translate.test.mjs` 同时命中 `free audio quota is ten minutes`、`pro and max audio quotas exceed free`、`audio quota reset and abuse protection are enforced`
    - 命令退出码：`pnpm --filter @agent-english/model-gateway test` 返回 0

- 交付项：听音翻译 API 必须在进入 ASR / 翻译前先校验 session entitlement 和音频分钟额度；客户端篡改 `serviceTier` 不能越权获得 Pro / Max 听音额度；失败响应不能泄露 Provider 名、Key 或 fallback 链。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`services/model-gateway/src/routes/video-audio-translate.ts`、`services/model-gateway/src/providers/asr-provider.ts`、`services/model-gateway/tests/video-audio-translate.test.mjs`
    - Grep 模式：`services/model-gateway/src/routes/video-audio-translate.ts` 同时命中 `entitlement`、`quota`
    - Grep 模式：`services/model-gateway/src/providers/asr-provider.ts` 同时命中 `fallback` 与 `map` 或 `normalize`
    - Grep 模式：`services/model-gateway/tests/video-audio-translate.test.mjs` 同时命中 `rejects missing session token before audio translation`、`returns 429 when free audio quota is exhausted`、`ignores request serviceTier when entitlement is lower`、`returns provider-safe audio fallback error`
    - Grep 模式：`services/model-gateway/tests/video-audio-translate.test.mjs` 不命中 `deepseek-secret`、`openai-secret`、`Provider route failed`
    - 命令退出码：`pnpm --filter @agent-english/model-gateway test` 返回 0

- 交付项：iOS `ModelServiceClient` 必须新增听音翻译请求入口，并把额度不足、服务不可用和隐私提示前置状态映射为可展示结果，而不是吞错或伪装成字幕翻译成功。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ModelServiceClient.swift`、`apps/ios/AgentEnglishTests/ModelServiceClientTests.swift`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ModelServiceClient.swift` 同时命中 `video`、`audio`、`translate`
    - Grep 模式：`apps/ios/AgentEnglishTests/ModelServiceClientTests.swift` 同时命中 `testVideoAudioTranslateMapsQuotaExceededAndServiceUnavailable`、`testVideoAudioRequestRequiresPrivacyDisclosureState`、`testVideoAudioCatalogDecodesAudioQuotaFields`
    - 命令退出码：`swift test --package-path apps/ios --filter ModelServiceClientTests` 返回 0

- 交付项：启用听音前必须先出现隐私提示；听音中必须可停止和可关闭；关闭后要回到视频页轻入口，且不能恢复文本网页的阅读模式分段控件。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`apps/ios/AgentEnglishTests/VideoAudioTranslationInteractionTests.swift`、`apps/ios/AgentEnglish/Screens/WebBrowserView.swift`
    - Grep 模式：`apps/ios/AgentEnglishTests/VideoAudioTranslationInteractionTests.swift` 同时命中 `testAudioTranslationRequiresPrivacyAcknowledgementBeforeDispatch`、`testStopAudioTranslationRestoresLightEntryState`、`testCloseAudioTranslationRestoresLightEntryState`、`testCloseAudioTranslationKeepsVideoImmersiveMode`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 同时命中 `video-audio-entry`、`video-audio-stop`、`video-audio-close`、`video-audio-privacy`
    - Grep 模式：`apps/ios/AgentEnglishTests/WebBrowserViewTests.swift` 同时命中 `video-audio-entry` 与 `video-audio-close`
    - 命令输出：`sed -n '/private var browserToolbar:/,/private var videoCaptionToolbar:/p' apps/ios/AgentEnglish/Screens/WebBrowserView.swift | rg 'Picker\\('` 输出非空
    - 命令输出：`sed -n '/private var videoCaptionToolbar:/,/private var bridgeStatusBar:/p' apps/ios/AgentEnglish/Screens/WebBrowserView.swift | rg 'Picker\\('` 输出为空
    - 命令退出码：`swift test --package-path apps/ios --filter VideoAudioTranslationInteractionTests` 返回 0

- 交付项：Phase 6.7 不能破坏普通网页翻译、点词解释、收藏、设置页服务等级快照和 Phase 6.6 的字幕 overlay / bridge 行为。
  验证手段：Grep 模式 + 命令退出码
  验证条件：
    - Grep 模式：`apps/ios/AgentEnglishTests/TranslationProviderClientTests.swift` 命中 `testTranslatesSegmentsThroughModelServiceClient`
    - Grep 模式：`apps/ios/AgentEnglishTests/ExplanationProviderClientTests.swift` 命中 `testReturnsSuccessfulExplanationFromModelService`
    - Grep 模式：`apps/ios/AgentEnglishTests/SavedItemRepositoryTests.swift` 命中 `testSaveSearchFilterAndDeleteSavedItems`
    - Grep 模式：`apps/ios/AgentEnglishTests/TranslationProviderSettingsStoreTests.swift` 命中 `testRefreshCatalogUsesRemoteSnapshotWhenServiceIsReachable`
    - Grep 模式：`services/model-gateway/tests/model-gateway.test.mjs` 同时命中 `translate route maps segmentId results and quota state`、`explain route returns context aware explanation payload`
    - Grep 模式：`packages/browser-agent/tests/video-caption-overlay.test.mjs` 命中 `fallback bar remains available for unsafe caption overlay`
    - 命令退出码：`swift test --package-path apps/ios --filter TranslationProviderClientTests` 返回 0
    - 命令退出码：`swift test --package-path apps/ios --filter ExplanationProviderClientTests` 返回 0
    - 命令退出码：`swift test --package-path apps/ios --filter SavedItemRepositoryTests` 返回 0
    - 命令退出码：`swift test --package-path apps/ios --filter ModelServiceSettingsStoreTests` 返回 0
    - 命令退出码：`swift test --package-path apps/ios --filter VideoCaptionContractTests` 返回 0
    - 命令退出码：`pnpm --filter @agent-english/browser-agent test` 返回 0
    - 命令退出码：`pnpm --filter @agent-english/model-gateway test` 返回 0

[UI 一致性 criteria]
- 交付项：YouTube 视频页的来源 badge、状态文案和开始 / 停止轻入口必须通过 XCTest 锁定，不允许依赖人工目测。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`apps/ios/AgentEnglish/Screens/WebBrowserView.swift`、`apps/ios/AgentEnglishTests/WebBrowserViewTests.swift`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 同时命中 `accessibilityIdentifier("video-audio-source")`、`accessibilityIdentifier("video-audio-status")`、`accessibilityIdentifier("video-audio-entry")`、`accessibilityIdentifier("video-audio-stop")`、`accessibilityIdentifier("video-audio-close")`
    - Grep 模式：`apps/ios/AgentEnglishTests/WebBrowserViewTests.swift` 同时命中 `testVideoAudioSourceBadgeAndStatusCopyForCaptionAndAudioStates`、`testVideoAudioEntryStopAndCloseControlsExposeStableAccessibilityIdentifiers`
    - 命令退出码：`swift test --package-path apps/ios --filter WebBrowserViewTests` 返回 0

- 交付项：设置页服务等级块的听音额度文案必须通过 XCTest 锁定，Free 明示“今日 10 分钟”，并展示剩余分钟；Pro / Max 数字必须高于 Free。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`apps/ios/AgentEnglish/Screens/SettingsView.swift`、`apps/ios/AgentEnglishTests/SettingsViewTests.swift`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/SettingsView.swift` 命中 `accessibilityIdentifier("audio-quota-summary")`
    - Grep 模式：`apps/ios/AgentEnglishTests/SettingsViewTests.swift` 同时命中 `testAudioQuotaSummaryShowsFreeTenMinuteCopy`、`testAudioQuotaSummaryShowsRemainingMinutesForHigherTiers`
    - 命令退出码：`swift test --package-path apps/ios --filter SettingsViewTests` 返回 0

[非功能 criteria]
- 交付项：Phase 6.7 的 TS / Swift 校验链必须可执行，且 `browser-agent` 生成到 iOS 的 runtime 同步不能失配。
  验证手段：命令退出码
  验证条件：
    - 命令退出码：`pnpm --filter @agent-english/contracts check` 返回 0
    - 命令退出码：`pnpm --filter @agent-english/browser-agent check` 返回 0
    - 命令退出码：`pnpm --filter @agent-english/model-gateway check` 返回 0
    - 命令退出码：`pnpm --filter @agent-english/browser-agent test` 返回 0
    - 命令退出码：`swift test --package-path apps/ios` 返回 0

- 交付项：实现必须遵守层次边界，ASR / Provider 密钥、音频分钟额度和 fallback 只留在 `services/model-gateway`；iOS 不写 YouTube DOM 规则，`browser-agent` 不直连模型或 ASR。
  验证手段：命令输出 + Grep 模式
  验证条件：
    - 命令输出：`git diff --name-only -- . ':(exclude).codex/criteria' | rg -v '^(packages/contracts/|packages/browser-agent/|services/model-gateway/|apps/ios/)'` 输出为空
    - Grep 模式：`rg -n '\\.ytp-|querySelector|MutationObserver' apps/ios/AgentEnglish/Web/WebBridgeController.swift apps/ios/AgentEnglish/Screens/WebBrowserView.swift apps/ios/AgentEnglish/Screens/SettingsView.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Bridge/VideoAudioTranslationContracts.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ModelServiceClient.swift` 输出为空
    - Grep 模式：`rg -n 'fetch\\(|XMLHttpRequest|openai|deepseek|anthropic|apiKey|baseURL' packages/browser-agent/src` 输出为空
    - Grep 模式：`rg -n 'openai|deepseek|anthropic|apiKey|baseURL|ASR key|Provider key' apps/ios/AgentEnglish/Web/WebBridgeController.swift apps/ios/AgentEnglish/Screens/WebBrowserView.swift apps/ios/AgentEnglish/Screens/SettingsView.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Bridge/VideoAudioTranslationContracts.swift` 输出为空

- 交付项：实现必须符合隐私与合规边界，不下载 / 分离 YouTube 音视频，不保存完整音频，不做后台静默听音。
  验证手段：Grep 模式
  验证条件：
    - Grep 模式：`rg -n 'yt-dlp|youtube-dl|ffmpeg|demux|mux|extractAudio|downloadAudio|downloadVideo' packages/browser-agent/src services/model-gateway/src apps/ios/AgentEnglish apps/ios/AgentEnglishCore` 输出为空
    - Grep 模式：`rg -n 'AVAudioFile|createWriteStream|writeFileSync|writeFile\\(|Caches/.*audio|Documents/.*audio' services/model-gateway/src apps/ios/AgentEnglish apps/ios/AgentEnglishCore` 输出为空
    - Grep 模式：`rg -n 'BGTask|background audio|后台听音|静默听音' apps/ios/AgentEnglish apps/ios/AgentEnglishCore services/model-gateway/src` 输出为空
