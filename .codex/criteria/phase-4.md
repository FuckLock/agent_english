---
phase_id: Phase 4
status: locked
spec_refs:
  - "Product-Spec.md#功能需求"
  - "Product-Spec.md#UI 布局"
  - "Product-Spec.md#技术方向"
  - "Product-Spec.md#技术说明"
  - "Product-Spec.md#补充说明"
  - "Product-Spec.md#非目标"
  - "Product-Spec.md#验收指标"
plan_refs:
  - "DEV-PLAN.md#架构约束摘要"
  - "DEV-PLAN.md#Phase 4: 通用网页翻译 + 显示模式管线"
  - "DEV-PLAN.md#数据库表（如有）"
round: 3
---

[功能验证 criteria]
- 交付项：`packages/contracts` 作为翻译 payload 事实源，统一导出 `PageContext`、`PageTextSegment`、`TranslationRequest`、`TranslationResult`，并覆盖页面能力字段
  验证手段：文件存在 + Grep 模式
  验证条件：
    - 文件存在：`packages/contracts/src/translation.ts`、`packages/contracts/src/index.ts`
    - Grep 模式：`packages/contracts/src/translation.ts` 同时命中 `PageContext`、`PageTextSegment`、`TranslationRequest`、`TranslationResult`
    - Grep 模式：`packages/contracts/src/translation.ts` 同时命中 `pageId`、`segmentId`、`sourceLanguage`、`targetLanguage`、`displayMode`、`failureReason`
    - Grep 模式：`packages/contracts/src/translation.ts` 同时命中 `url`、`title`、`capabilities` 与 `SiteCapability|siteType|siteKind`
    - Grep 模式：`packages/contracts/src/translation.ts` 至少命中一类结果映射标记 `segmentResults|translationsBySegmentId|resultsBySegmentId`
    - Grep 模式：`packages/contracts/src/index.ts` 命中 `translation`

- 交付项：Phase 4 的跨端 translation payload 有 TS fixture/contract 测试与 Swift DTO/decoder 测试共同验证字段等价，而不是只验证事件名或 envelope 外壳
  验证手段：命令输出 + 命令退出码
  验证条件：
    - 命令输出：`rg -n 'PageContext|PageTextSegment|TranslationRequest|TranslationResult' packages/contracts/tests` 输出非空
    - 命令输出：`rg -n 'pageId|segmentId|sourceLanguage|targetLanguage|displayMode|failureReason|capabilities' packages/contracts/tests` 输出非空
    - 命令输出：`rg -n 'fixture|roundTrip|equivalent|fields?' packages/contracts/tests` 输出非空
    - 命令输出：`rg -n 'schemaVersion|translation\\.failed|failureReason' packages/contracts/tests` 输出非空
    - 命令输出：`rg -n 'PageContext|PageTextSegment|TranslationRequest|TranslationResult' apps/ios/AgentEnglishTests apps/ios/AgentEnglishCore/Sources/AgentEnglishCore` 输出非空
    - 命令输出：`rg -n 'pageId|segmentId|sourceLanguage|targetLanguage|displayMode|failureReason|capabilities' apps/ios/AgentEnglishTests` 输出非空
    - 命令输出：`rg -n 'decode|decoder|roundTrip|equivalent|equatable|fields?' apps/ios/AgentEnglishTests` 输出非空
    - 命令输出：`rg -n 'schemaVersion|unsupportedSchemaVersion|malformedPayload|translation\\.failed|failureReason' apps/ios/AgentEnglishTests` 输出非空
    - 命令退出码：`pnpm --filter @agent-english/contracts test` 返回 0
    - 命令退出码：`swift test --package-path apps/ios` 返回 0

- 交付项：翻译请求、完成、失败事件在 TS 与 Swift 两侧都扩展到 `BridgeEvent` 白名单，并始终携带结构化 envelope 字段
  验证手段：文件存在 + Grep 模式 + 命令输出 + 命令退出码
  验证条件：
    - 文件存在：`packages/browser-agent/src/bridge/translation-events.ts`、`packages/contracts/src/bridge-events.ts`、`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Bridge/BridgeEvent.swift`
    - Grep 模式：`packages/contracts/src/bridge-events.ts` 同时命中 `schemaVersion`、`eventType`、`requestId`、`pageId`
    - Grep 模式：`packages/contracts/src/bridge-events.ts` 同时命中 `translation.request(ed)?|translation.completed|translation.failed`、`BridgeEventEnvelope`、`createBridgeEvent`
    - Grep 模式：`packages/browser-agent/src/bridge/translation-events.ts` 同时命中 `createBridgeEvent`、`requestId`、`pageId`、`segmentId`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Bridge/BridgeEvent.swift` 同时命中 `bridgeSchemaVersion` 与 `translationRequest|translationCompleted|translationFailed|translation.request(ed)?|translation.completed|translation.failed`
    - 命令输出：`rg -n 'schemaVersion|requestId|pageId|segmentId|translation\\.(request|requested|completed|failed)' packages/contracts/tests packages/browser-agent/tests apps/ios/AgentEnglishTests` 输出非空
    - 命令退出码：`swift test --package-path apps/ios --filter WebBridgeControllerTests` 返回 0

- 交付项：`browser-agent` 能对通用网页执行文本节点扫描、可见性过滤、段落合并，并在重扫时保持稳定 `segmentId`；页面上下文会带出 URL、标题和能力信息
  验证手段：文件存在 + Grep 模式 + 命令输出
  验证条件：
    - 文件存在：`packages/browser-agent/src/dom/segment-scanner.ts`
    - Grep 模式：`packages/browser-agent/src/dom/segment-scanner.ts` 同时命中 `PageTextSegment`、`segmentId` 与 `TreeWalker|NodeFilter|Text`
    - Grep 模式：`packages/browser-agent/src/dom/segment-scanner.ts` 同时命中 `visibility|display|getComputedStyle|getBoundingClientRect|offsetParent`
    - Grep 模式：`packages/browser-agent/src/dom/segment-scanner.ts` 同时命中 `merge|paragraph|block`
    - 命令输出：`rg -n 'pageContext|capabilities|SiteCapability|detectCapabilities|title|url' packages/browser-agent/src/dom packages/browser-agent/src/bridge` 输出非空
    - 命令输出：`rg -n 'segmentId|stable|rescan|repeat|second scan' packages/browser-agent/tests` 输出非空
    - 命令输出：`rg -ni 'youtube|reddit|ao3|wikipedia|twitter|x\\.com|subtitle|caption' packages/browser-agent/src/dom/segment-scanner.ts` 输出为空

- 交付项：`browser-agent` 能把译文以内联形式插入原文附近，并通过 `original` / `bilingual` / `learning` 三种模式控制显示；学习模式默认隐藏中文但可展开
  验证手段：文件存在 + Grep 模式 + 命令输出
  验证条件：
    - 文件存在：`packages/browser-agent/src/overlay/translation-overlay.ts`、`packages/browser-agent/src/modes/display-mode-controller.ts`、`packages/browser-agent/src/index.ts`
    - Grep 模式：`packages/browser-agent/src/overlay/translation-overlay.ts` 同时命中 `segmentId` 与 `loading|failed|error`
    - Grep 模式：`packages/browser-agent/src/overlay/translation-overlay.ts` 至少命中一个就地插入标记 `after|insertAdjacentElement|appendChild|insertBefore`
    - Grep 模式：`packages/browser-agent/src/modes/display-mode-controller.ts` 同时命中 `original`、`bilingual`、`learning`
    - Grep 模式：`packages/browser-agent/src/modes/display-mode-controller.ts` 同时命中 `hidden|collapsed` 与 `expand|toggle|reveal`
    - Grep 模式：`packages/browser-agent/src/index.ts` 同时命中 `translation-events`、`segment-scanner`、`translation-overlay`、`display-mode-controller`
    - 命令输出：`rg -n 'original|bilingual|learning|segmentId|expand|toggle|reveal' packages/browser-agent/tests` 输出非空

- 交付项：native Provider adapter 负责文本分块、重试和错误归一；翻译缓存只写入 `Persistence` / SwiftData，不允许由 Provider adapter 自己持久化
  验证手段：文件存在 + Grep 模式 + 命令输出
  验证条件：
    - 文件存在：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift` 同时命中 `chunk|batch|segment` 与 `retry|attempt`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift` 同时命中 `TranslationResult|segmentId` 与 `failure|error`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift` 命中 `credentialReference|keychainReference|Keychain`
    - 命令输出：`rg -n 'TranslationCacheRecord|translationCache|textHash|pageHash|@Model' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence` 输出非空
    - 命令输出：`rg -n 'import SwiftData|@Model|ModelContext|insert\\(|save\\(' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift` 输出为空

- 交付项：浏览页用原生交互触发翻译与显示模式切换，由 `WebBridgeController` 管理翻译请求生命周期，并分别覆盖 Provider 未配置、页面结构不可识别、翻译失败三类降级结果
  验证手段：Grep 模式 + 命令输出
  验证条件：
    - Grep 模式：`apps/ios/AgentEnglish/Web/WebBridgeController.swift` 同时命中 `translation`、`requestId`、`pageId` 与 `BridgeEventDecoder|schemaVersion|bridgeSchemaVersion`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 同时命中 `browserToolbar|toolbar` 与 `character.bubble|translate|translation`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 同时命中 `accessibilityLabel` 与 `翻译|translate|translation`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 同时命中 `DisplayMode|displayMode|translationState|translationStatus` 与 `Picker|SegmentedControl`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 命中 `pickerStyle\\s*\\(\\s*\\.segmented\\s*\\)|SegmentedPickerStyle|\\.segmented`
    - 命令输出：`rg -n 'provider(NotConfigured|Unavailable)|page(Unrecognized|Unsupported|NotReadable|Structure)|translation(Failed|Error)|selection(Fallback|Translation)|copy(Text)?Fallback' apps/ios/AgentEnglishTests packages/browser-agent/tests apps/ios/AgentEnglish/Web apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 输出非空
    - 命令输出：`rg -n 'TranslationProviderClient|credentialReference|apiKey|Keychain|OpenAI|Anthropic|Gemini|Claude' apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 输出为空

[UI 一致性 criteria]
- 交付项：网页浏览页仍以 `WKWebView` 内容为主体，译文以内联形式贴近原文，不允许把浏览页替换成独立翻译页或全屏遮罩
  验证手段：Grep 模式 + 命令输出
  验证条件：
    - Grep 模式：`apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 命中 `WebViewContainer`
    - Grep 模式：`packages/browser-agent/src/overlay/translation-overlay.ts` 同时命中 `segmentId` 与 `after|insertAdjacentElement|appendChild|insertBefore`
    - 命令输出：`rg -n 'segmentId|insertAdjacentElement|appendChild|insertBefore|after' packages/browser-agent/tests` 输出非空
    - 命令输出：`rg -n 'fullScreenCover\\(' apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 输出为空
    - 命令输出：`rg -n 'position\\s*:\\s*fixed|inset\\s*:\\s*0|100vh|100vw|document\\.body\\.innerHTML|replaceChildren\\(' packages/browser-agent/src/overlay/translation-overlay.ts` 输出为空

- 交付项：学习模式和失败态都落在段落级译文层或底部轻提示结果，不替代网页主体，也不提前借用 Phase 5 的解释抽屉
  验证手段：Grep 模式 + 命令输出
  验证条件：
    - Grep 模式：`packages/browser-agent/src/modes/display-mode-controller.ts` 同时命中 `learning` 与 `hidden|collapsed` 以及 `expand|toggle|reveal`
    - Grep 模式：`packages/browser-agent/src/overlay/translation-overlay.ts` 同时命中 `segmentId` 与 `loading|failed|error`
    - 命令输出：`rg -n 'page(Unrecognized|Unsupported|NotReadable|Structure)|provider(NotConfigured|Unavailable)|translation(Failed|Error)|selection(Fallback|Translation)|copy(Text)?Fallback' packages/browser-agent/tests apps/ios/AgentEnglishTests` 输出非空
    - 命令输出：`rg -n 'ExplanationSheetView|SelectionContext|selectionId' packages/browser-agent/src/overlay/translation-overlay.ts packages/browser-agent/src/modes/display-mode-controller.ts apps/ios/AgentEnglish/Screens/WebBrowserView.swift apps/ios/AgentEnglish/Web/WebBridgeController.swift` 输出为空

[非功能 criteria]
- 交付项：Phase 4 的 Node 与 Swift 构建、类型检查、测试命令全部通过
  验证手段：编译输出 + 命令退出码
  验证条件：
    - 命令退出码：`pnpm check` 返回 0
    - 命令退出码：`pnpm build` 返回 0
    - 命令退出码：`pnpm test` 返回 0
    - 命令退出码：`swift test --package-path apps/ios` 返回 0

- 交付项：自动化测试显式覆盖页面能力、跨端 payload 等价、BridgeEvent schema、稳定 `segmentId`、显示模式、缓存 / 重试，以及三类失败降级
  验证手段：命令输出 + 命令退出码
  验证条件：
    - 命令输出：`rg -n 'pageContext|capabilities|PageContext|PageTextSegment|TranslationRequest|TranslationResult|schemaVersion|requestId|pageId|segmentId|sourceLanguage|targetLanguage|displayMode|failureReason|original|bilingual|learning|cache|retry|provider(NotConfigured|Unavailable)|page(Unrecognized|Unsupported|NotReadable|Structure)|translation(Failed|Error)|selection(Fallback|Translation)' packages/contracts/tests packages/browser-agent/tests apps/ios/AgentEnglishTests` 输出非空
    - 命令退出码：`pnpm --filter @agent-english/contracts test` 返回 0
    - 命令退出码：`pnpm --filter @agent-english/browser-agent test` 返回 0
    - 命令退出码：`swift test --package-path apps/ios` 返回 0

- 交付项：Phase 1-3 的 contracts / 本地学习闭环 / WebView bridge 与隐私提示回归仍保持通过
  验证手段：文件存在 + 命令输出 + 命令退出码
  验证条件：
    - 文件存在：`apps/ios/AgentEnglishTests/LocalLearningLoopTests.swift`、`apps/ios/AgentEnglishTests/WebBridgeControllerTests.swift`、`apps/ios/AgentEnglish/Settings/PrivacyDisclosureView.swift`、`apps/ios/AgentEnglish/Settings/WebsiteDataPromptView.swift`
    - 命令输出：`rg -n 'RootTabView|BrowserHomeView' apps/ios/AgentEnglish/App/RootTabView.swift apps/ios/AgentEnglish/App/AgentEnglishApp.swift` 输出非空
    - 命令输出：`rg -n 'WebBrowserView|NavigationLink|openURL|launch\\.url|initialURL' apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` 输出非空
    - 命令输出：`rg -n 'WebViewContainer|WKWebView' apps/ios/AgentEnglish/Screens/WebBrowserView.swift apps/ios/AgentEnglish/Web/WebViewContainer.swift` 输出非空
    - 命令输出：`rg -n 'PrivacyDisclosureView|WebsiteDataPromptView' apps/ios/AgentEnglish/Screens/SettingsView.swift apps/ios/AgentEnglish/Settings` 输出非空
    - 命令退出码：`swift test --package-path apps/ios --filter LocalLearningLoopTests` 返回 0
    - 命令退出码：`swift test --package-path apps/ios --filter WebBridgeControllerTests` 返回 0

- 交付项：Phase 4 新增 TS 翻译层文件的用户可见文案不能散落硬编码，必须集中在消息常量或映射机制中
  验证手段：命令输出
  验证条件：
    - 命令输出：`rg -n 'message(s|Map)?|label(s)?|status(Label|Message)s?|failureMessage(s)?|errorMessage(s)?' packages/browser-agent/src/overlay/translation-overlay.ts packages/browser-agent/src/modes/display-mode-controller.ts` 输出非空
    - 命令输出：`rg -n '[一-龥]' packages/browser-agent/src/overlay/translation-overlay.ts packages/browser-agent/src/modes/display-mode-controller.ts` 输出为空
    - 命令输出：`rg -n 'message(s|Map)?|label(s)?|status(Label|Message)s?|failureMessage(s)?|errorMessage(s)?|[一-龥]' packages/browser-agent/src/bridge/translation-events.ts` 输出为空

- 交付项：Phase 4 新增模块保持既定架构与后续范围边界，不提前进入 Phase 5 / 6 / 7、账号 / 云同步 / 后端，也不把职责放错层
  验证手段：命令输出
  验证条件：
    - 命令输出：`rg -n 'fetch\\(|XMLHttpRequest|localStorage|indexedDB|credentialReference|keychain|Keychain|apiKey|OPENAI_API_KEY|ANTHROPIC_API_KEY' packages/browser-agent/src` 输出为空
    - 命令输出：`rg -n 'browser-agent|SwiftUI|WebKit|URLSession|Keychain' packages/contracts/src/translation.ts packages/contracts/src/bridge-events.ts` 输出为空
    - 命令输出：`rg -n 'querySelector|TreeWalker|NodeFilter|document\\.|window\\.' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift apps/ios/AgentEnglish/Web/WebBridgeController.swift apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 输出为空
    - 命令输出：`rg -n 'SelectionContext|selectionId|selection\\.changed|selection-events|ExplanationProviderClient|SavedItem|ReviewCard|favorite\\.|saved-item|review-card|ReviewScheduler' packages/contracts/src/translation.ts packages/browser-agent/src/bridge/translation-events.ts packages/browser-agent/src/dom/segment-scanner.ts packages/browser-agent/src/overlay/translation-overlay.ts packages/browser-agent/src/modes/display-mode-controller.ts apps/ios/AgentEnglish/Web/WebBridgeController.swift apps/ios/AgentEnglish/Screens/WebBrowserView.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift` 输出为空
    - 命令输出：`rg -n 'site-adapters|youtube|reddit|wikipedia|ao3|x\\.com|subtitle|caption' packages/browser-agent/src/bridge/translation-events.ts packages/browser-agent/src/dom/segment-scanner.ts packages/browser-agent/src/overlay/translation-overlay.ts packages/browser-agent/src/modes/display-mode-controller.ts apps/ios/AgentEnglish/Web/WebBridgeController.swift apps/ios/AgentEnglish/Screens/WebBrowserView.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift` 输出为空
    - 命令输出：`rg -n '\\b(account|sync|cloud|backend|server|graphql)\\b|CloudKit|Firebase|Supabase' packages/contracts/src/translation.ts packages/browser-agent/src/bridge/translation-events.ts packages/browser-agent/src/dom/segment-scanner.ts packages/browser-agent/src/overlay/translation-overlay.ts packages/browser-agent/src/modes/display-mode-controller.ts apps/ios/AgentEnglish/Web/WebBridgeController.swift apps/ios/AgentEnglish/Screens/WebBrowserView.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift` 输出为空
