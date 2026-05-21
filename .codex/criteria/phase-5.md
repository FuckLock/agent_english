---
phase_id: Phase 5
status: locked
spec_refs:
  - "Product-Spec.md#功能需求"
  - "Product-Spec.md#UI 布局"
  - "Product-Spec.md#技术说明"
  - "Product-Spec.md#补充说明"
  - "Product-Spec.md#非目标"
plan_refs:
  - "DEV-PLAN.md#架构约束摘要"
  - "DEV-PLAN.md#Phase 4: 通用网页翻译 + 显示模式管线"
  - "DEV-PLAN.md#Phase 5: 点词点句解释 + 收藏沉淀"
  - "DEV-PLAN.md#开发规则"
round: post-planner-fix
---

[功能验证 criteria]
1. 交付项：`packages/contracts` 作为 Phase 5 payload 事实源，定义并导出 `SelectionContext`、`SavedItem` 与 selection 相关 payload 字段
   验证手段：文件存在 + Grep 模式
   验证条件：
    - 文件存在：`packages/contracts/src/selection.ts`、`packages/contracts/src/saved-item.ts`、`packages/contracts/src/index.ts`
    - Grep 模式：`packages/contracts/src/selection.ts` 同时命中 `SelectionContext`、`pageId`、`selectionId`、`selectedText`、`contextBefore`、`contextAfter`、`sourceUrl`、`sourceTitle`、`containerPath`
    - Grep 模式：`packages/contracts/src/saved-item.ts` 同时命中 `SavedItem`、`sourceUrl`、`sourceTitle`、`selectedText`、`contextBefore`、`contextAfter`、`translation`、`explanation`、`kind`、`createdAt`
    - 命令输出：`rg -n 'pageTitle|originalText' packages/contracts/src/saved-item.ts` 输出为空
    - Grep 模式：`packages/contracts/src/index.ts` 同时命中 `selection` 与 `saved-item`

2. 交付项：`BridgeEvent` 白名单扩展到 selection 相关事件，TS contract 测试对同一 fixture 或同一内联 payload 断言 selection 字段、`schemaVersion` 与失败分支，而不是只验证 envelope 外壳或事件名字符串
   验证手段：文件存在 + 命令输出 + 命令退出码
   验证条件：
    - 文件存在：`packages/contracts/src/bridge-events.ts`
    - 命令输出：`rg -n 'schemaVersion|eventType|requestId|pageId|selectionId|failureReason' packages/contracts/src/bridge-events.ts` 输出非空
    - 命令输出：`rg -n '(fixture|payload).*selection|selection.*(fixture|payload)' packages/contracts/tests` 输出非空
    - 命令输出：`rg -n '(toEqual|deepStrictEqual|assert\\.(equal|deepEqual|deepStrictEqual)).*(selectionId|pageId|sourceUrl|sourceTitle|contextBefore|contextAfter|schemaVersion|failureReason)' packages/contracts/tests` 输出非空
    - 命令退出码：`pnpm --filter @agent-english/contracts test` 返回 0

3. 交付项：`browser-agent` 能从 DOM selection/range 提取选区上下文，并由 runtime/entrypoint 最终发出带页面与来源字段的 selection payload；具体 helper 文件名不限
   验证手段：文件存在 + Grep 模式 + 命令输出
   验证条件：
    - 文件存在：`packages/browser-agent/src/dom/selection-context.ts`、`packages/browser-agent/src/bridge/selection-events.ts`、`packages/browser-agent/src/index.ts`
    - Grep 模式：`packages/browser-agent/src/dom/selection-context.ts` 同时命中 `Selection|Range`、`selectedText`、`contextBefore`、`contextAfter`、`containerPath`
    - 命令输出：`rg -n 'selectionId|selectedText|contextBefore|contextAfter|sourceUrl|sourceTitle|containerPath|pageId' packages/browser-agent/src` 输出非空
    - 命令输出：`rg -n '(selectionId|selectedText|contextBefore|contextAfter|sourceUrl|sourceTitle|containerPath|pageId)' packages/browser-agent/tests` 输出非空

4. 交付项：DOM selection 只在 `packages/browser-agent`，`WebBrowserView.swift` 与 `apps/ios/AgentEnglish/Web/` 不写 DOM 解析或临时业务 JS；业务通信仍只通过结构化 `BridgeEvent`
   验证手段：命令输出
   验证条件：
    - 命令输出：`rg -n 'getSelection|Range|TreeWalker|NodeFilter|querySelector|document\\.|window\\.' packages/browser-agent/src/dom/selection-context.ts packages/browser-agent/src/bridge/selection-events.ts` 输出非空
    - 命令输出：`rg -n 'getSelection|Range|TreeWalker|NodeFilter|querySelector|document\\.|window\\.' apps/ios/AgentEnglish/Screens/WebBrowserView.swift apps/ios/AgentEnglish/Web` 输出为空
    - 命令输出：`rg -n 'evaluateJavaScript\\(.*(selection|explanation|favorite|SavedItem|SelectionContext)' apps/ios/AgentEnglish/Screens/WebBrowserView.swift apps/ios/AgentEnglish/Web` 输出为空
    - 命令输出：`rg -n 'BridgeEvent|schemaVersion|messageHandler|postMessage|WebBridgeController' apps/ios/AgentEnglish/Screens/WebBrowserView.swift apps/ios/AgentEnglish/Web packages/browser-agent/src/bridge` 输出非空

5. 交付项：Swift DTO/decoder 与 contracts 对同一 fixture 或同一内联 payload 做字段等价断言，至少覆盖 `selectionId`、页面/来源字段、上下文字段、`schemaVersion` 和失败分支；`WebBridgeController` 收到 selection 后由 native Provider adapter 发起解释请求，失败不伪装成功
   验证手段：文件存在 + 命令输出 + 命令退出码
   验证条件：
    - 文件存在：`apps/ios/AgentEnglish/Web/WebBridgeController.swift`、`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ExplanationProviderClient.swift`
    - 命令输出：`rg -n 'SelectionContext|selectionId|pageId|sourceUrl|sourceTitle|contextBefore|contextAfter|schemaVersion|failureReason' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Bridge apps/ios/AgentEnglish/Web/WebBridgeController.swift` 输出非空
    - 命令输出：`rg -n '(fixture|payload).*selection|selection.*(fixture|payload)' apps/ios/AgentEnglishTests` 输出非空
    - 命令输出：`rg -n '(XCTAssertEqual|#expect\\().*(selectionId|pageId|sourceUrl|sourceTitle|contextBefore|contextAfter|schemaVersion|failureReason)' apps/ios/AgentEnglishTests` 输出非空
    - 命令输出：`rg -n 'selection|explanation|error|failure|credentialReference|keychainReference|Keychain' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ExplanationProviderClient.swift apps/ios/AgentEnglish/Web/WebBridgeController.swift` 输出非空
    - 命令退出码：`swift test --package-path apps/ios --filter WebBridgeControllerTests` 返回 0

6. 交付项：`SavedItemRepository` 与学习数据模型支持保存、搜索、按 `kind`/来源筛选、删除，并保存 Phase 5 要求的来源、原文、上下文、翻译、解释与时间字段
   验证手段：文件存在 + Grep 模式 + 命令输出
   验证条件：
    - 文件存在：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/SavedItemRepository.swift`、`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/LearningRecords.swift`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/LearningRecords.swift` 同时命中 `sourceUrl`、`sourceTitle`、`selectedText`、`contextBefore`、`contextAfter`、`translation`、`explanation`、`kind`、`createdAt`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/SavedItemRepository.swift` 同时命中 `save|insert`、`search`、`filter`、`delete`、`kind`、`source`
    - 命令输出：`rg -n 'SavedItemRepository|save|search|filter|delete|kind|source|createdAt' apps/ios/AgentEnglishTests` 输出非空

7. 交付项：Provider 凭证继续走 Keychain reference / settings；`AgentEnglishCore/Persistence/` 与 provider/profile/settings 持久化范围只保存非敏感学习数据，不保存明文凭证
   验证手段：命令输出
   验证条件：
    - 命令输出：`rg -n 'credentialReference|keychainReference|Keychain' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/KeychainCredentialStore.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/TranslationProviderSettingsStore.swift apps/ios/AgentEnglish/Web/WebBridgeController.swift` 输出非空
    - 命令输出：`rg -n 'apiKey|secretKey|accessToken|refreshToken|password|bearer ' packages/browser-agent/src/dom/selection-context.ts packages/browser-agent/src/bridge/selection-events.ts packages/browser-agent/src/index.ts` 输出为空
    - 命令输出：`rg -n 'apiKey|secretKey|accessToken|refreshToken|password|bearer ' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/LearningRecords.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/SavedItemRepository.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/TranslationProviderSettingsStore.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/AppModelContainer.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/SampleLearningData.swift` 输出为空

8. 交付项：`FavoritesView` 支持搜索、筛选、删除、空状态，并让用户看见来源 URL、页面标题或上下文且能回看来源
   验证手段：文件存在 + Grep 模式 + 命令输出
   验证条件：
    - 文件存在：`apps/ios/AgentEnglish/Screens/FavoritesView.swift`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/FavoritesView.swift` 同时命中 `searchable|TextField`、`Picker|Menu|\\.segmented`、`onDelete|swipeActions`、`ContentUnavailableView|empty`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/FavoritesView.swift` 同时命中 `sourceUrl|sourceTitle|contextBefore|contextAfter` 与 `openURL|Link|NavigationLink|reopen|openSource`
    - 命令输出：`rg -n 'sourceUrl|sourceTitle|contextBefore|contextAfter|openURL|Link|NavigationLink|reopen|openSource' apps/ios/AgentEnglishTests` 输出非空
    - 命令输出：`rg -n 'querySelector|TreeWalker|NodeFilter|SelectionContext|document\\.|window\\.' apps/ios/AgentEnglish/Screens/FavoritesView.swift` 输出为空

[UI 一致性 criteria]
9. 交付项：解释结果通过原生底部抽屉展示，不放进 `browser-agent` overlay；抽屉内容块完整，至少包含释义/解释结果、例句、加载态、错误态和收藏动作
   验证手段：文件存在 + Grep 模式 + 命令输出
   验证条件：
    - 文件存在：`apps/ios/AgentEnglish/Screens/ExplanationSheetView.swift`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/ExplanationSheetView.swift` 同时命中 `translation|definition|meaning`、`explanation|context`、`example`、`loading|ProgressView`、`error`、`favorite|save`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 同时命中 `ExplanationSheetView` 与 `selection|explanation|sheet`
    - 命令输出：`rg -n 'ExplanationSheetView|favorite|savedItem|selection explanation|bottom sheet' packages/browser-agent/src/overlay packages/browser-agent/src/bridge` 输出为空

10. 交付项：解释抽屉高度可控且不遮掉整页浏览主体；浏览主体仍是 `WKWebView` / `WebViewContainer`
    验证手段：Grep 模式 + 命令输出
    验证条件：
    - Grep 模式：`apps/ios/AgentEnglish/Screens/WebBrowserView.swift` 命中 `WebViewContainer|WKWebView`
    - 命令输出：`rg -n 'height|detent|sheetHeight|selectedDetent|presentation' apps/ios/AgentEnglish/Screens/WebBrowserView.swift apps/ios/AgentEnglish/Screens/ExplanationSheetView.swift` 输出非空
    - 命令输出：`rg -n 'fullScreenCover\\(' apps/ios/AgentEnglish/Screens/WebBrowserView.swift apps/ios/AgentEnglish/Screens/ExplanationSheetView.swift` 输出为空

[非功能 criteria]
11. 交付项：repository 与 FavoritesView 测试是显式行为断言，而不是关键字存在性；至少覆盖 `save`、`search`、`filter`、`delete`、空状态、来源信息可见和来源可回看
    验证手段：命令输出 + 命令退出码
    验证条件：
    - 命令输出：`rg -n '(XCTAssertEqual|XCTAssertTrue|XCTAssertFalse|#expect\\().*(save|search|filter|delete|empty|sourceUrl|sourceTitle|contextBefore|contextAfter|openURL|reopen|openSource)' apps/ios/AgentEnglishTests` 输出非空
    - 命令输出：`rg -n 'SavedItemRepository|FavoritesView' apps/ios/AgentEnglishTests` 输出非空
    - 命令退出码：`swift test --package-path apps/ios` 返回 0

12. 交付项：Phase 5 构建 / 测试通过，Node workspace critical audit 通过，且 Phase 5 实际改动不新增复习、历史、站点适配、导出、同步或跨平台的 future-scope 路径 / diff 符号
    验证手段：编译输出 + 命令输出 + 命令退出码
    验证条件：
    - 命令退出码：`pnpm check` 返回 0
    - 命令退出码：`pnpm build` 返回 0
    - 命令退出码：`pnpm test` 返回 0
    - 命令退出码：`swift build --package-path apps/ios` 返回 0
    - 命令退出码：`swift test --package-path apps/ios` 返回 0
    - 命令退出码：`pnpm audit --audit-level critical --registry=https://registry.npmjs.org/` 返回 0；该项是 Node workspace critical audit，若默认镜像失败，必须记录并使用该 HTTPS registry 重跑
    - 命令输出：`git diff --name-only HEAD -- packages/contracts packages/browser-agent apps/ios | rg '(^packages/browser-agent/src/site-adapters/|^packages/contracts/src/(review-card|history|export|sync)\\.|^apps/ios/AgentEnglish/Screens/HistoryView\\.swift$|^apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/(Review|History|Export|Sync)/|^apps/(android|macos|windows)/)'` 输出为空
    - 命令输出：`git diff --unified=0 HEAD -- packages/contracts packages/browser-agent apps/ios | rg 'ReviewScheduler|HistoryView|ExportService|CloudKit|Firebase|Supabase'` 输出为空

13. 交付项：Phase 4 的整页翻译、显示模式和失败降级回归仍通过，不能被 Phase 5 selection / 收藏改动破坏
    验证手段：命令输出 + 命令退出码
    验证条件：
    - 命令输出：`rg -n 'translation-overlay|display-mode-controller|original|bilingual|learning|provider-not-configured|page-unrecognized|translation\\.failed|selection fallback|copy fallback' packages/browser-agent/tests apps/ios/AgentEnglishTests` 输出非空
    - 命令退出码：`pnpm --filter @agent-english/browser-agent test` 返回 0
    - 命令退出码：`swift test --package-path apps/ios --filter WebBridgeControllerTests` 返回 0
