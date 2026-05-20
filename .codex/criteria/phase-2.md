---
phase_id: Phase 2
status: locked
spec_refs:
  - "Product-Spec.md:34 ### 核心功能"
  - "Product-Spec.md:56 ### 整体布局"
  - "Product-Spec.md:67 ### 主要页面"
  - "Product-Spec.md:88 ### 路径 1：首次使用"
  - "Product-Spec.md:108 ### 路径 3：第二天复习"
  - "Product-Spec.md:126 ## 技术方向"
  - "Product-Spec.md:153 ### App Store 边界"
  - "Product-Spec.md:157 ### 隐私与数据"
  - "Product-Spec.md:166 ### MVP 范围"
  - "Product-Spec.md:197 ## 非目标"
plan_refs:
  - "DEV-PLAN.md:15 ## 架构约束摘要"
  - "DEV-PLAN.md:86 ## Phase 2: 原生 Tab 壳 + SwiftData / Keychain 本地学习底座"
  - "DEV-PLAN.md:339 ## 技术栈表"
  - "DEV-PLAN.md:353 ## 数据模型 / 持久化表"
round: 2
---

[架构拆分说明]
本 criteria 只验证 `apps/ios` 原生 Tab 壳、SwiftData / Keychain 本地学习底座和样例学习闭环。
`WKWebView` 进入页面、`BridgeEvent` native decode、website data 提示仍属于 `DEV-PLAN.md` 的 Phase 3，本轮不得提前实现。
根 `pnpm` workspace 只做 Phase 1 回归验证，不要求恢复旧 `src/`，也不要求扩展 `packages/contracts` 或 `packages/browser-agent`。

[功能验证 criteria]
- 交付项：iPhone 原生 App 入口存在，启动结构先进入 `BrowserHomeView`，四个 Tab 都是原生 SwiftUI 页面
  验证手段：文件存在 + Grep 模式 + 命令输出
  验证条件：
    - 文件存在：`apps/ios/AgentEnglish/App/AgentEnglishApp.swift`、`apps/ios/AgentEnglish/App/RootTabView.swift`、`apps/ios/AgentEnglish/Screens/BrowserHomeView.swift`、`apps/ios/AgentEnglish/Screens/FavoritesView.swift`、`apps/ios/AgentEnglish/Screens/ReviewView.swift`、`apps/ios/AgentEnglish/Screens/SettingsView.swift`
    - Grep 模式：`apps/ios/AgentEnglish/App/AgentEnglishApp.swift` 同时命中 `@main`、`WindowGroup`、`RootTabView`
    - Grep 模式：`apps/ios/AgentEnglish/App/RootTabView.swift` 同时命中 `TabView`、`BrowserHomeView`、`FavoritesView`、`ReviewView`、`SettingsView`
    - Grep 模式：`apps/ios/AgentEnglish/App/RootTabView.swift` 同时命中 `浏览`、`收藏`、`复习`、`设置`
    - 命令输出：`rg -n 'WKWebView|WebBrowserView|UIViewRepresentable' apps/ios/AgentEnglish/App apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` 输出为空

- 交付项：浏览首页是原生搜索 / 地址输入页，带 App 标识和常用站点入口占位，而不是课程流或旧网页壳
  验证手段：Grep 模式 + 命令输出
  验证条件：
    - Grep 模式：`apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` 同时命中 `Agent English`、`TextField`、`YouTube`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` 同时命中 `Reddit`、`Wikipedia`、`AO3`、`X`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` 至少命中一个原生站点入口网格容器 `LazyVGrid|Grid`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` 至少命中一个设置入口标记 `toolbar|navigationBarTrailing|gearshape|gear`
    - 命令输出：`rg -n 'course|lesson|boss|quest|inventory|monster|map' apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` 输出为空
    - 命令输出：`rg -n 'WKWebView|SFSafariViewController|WebBrowserView' apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` 输出为空

- 交付项：核心层提供 SwiftData model container，并真实定义、注册收藏、复习、设置和 Provider profile 的首批持久化模型
  验证手段：文件存在 + Grep 模式 + 命令输出
  验证条件：
    - 文件存在：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/AppModelContainer.swift`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence` 同时命中 `@Model`、`final class SavedItemRecord`、`final class ReviewCardRecord`、`final class AppSettingsRecord`、`final class ProviderProfileRecord`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/AppModelContainer.swift` 同时命中 `ModelContainer`、`Schema`、`SavedItemRecord.self`、`ReviewCardRecord.self`、`AppSettingsRecord.self`、`ProviderProfileRecord.self`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence` 同时命中 `savedItemId` 或 `savedItem`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence` 同时命中 `credentialReference` 或 `keychainReference` 或 `credentialRef`
    - 命令输出：`rg -n '//.*(@Model|final class SavedItemRecord|final class ReviewCardRecord|final class AppSettingsRecord|final class ProviderProfileRecord|SavedItemRecord\\.self|ReviewCardRecord\\.self|AppSettingsRecord\\.self|ProviderProfileRecord\\.self)' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence` 输出为空

- 交付项：收藏页、复习页和设置页消费本地学习底座或样例数据源，而不是纯占位文本
  验证手段：Grep 模式 + 命令输出
  验证条件：
    - Grep 模式：`apps/ios/AgentEnglish/Screens/FavoritesView.swift` 同时命中 `SavedItemRecord` 与至少一个数据消费标记 `@Query|savedItems|sampleSavedItems|SampleLearningData`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/ReviewView.swift` 同时命中 `ReviewCardRecord` 与至少一个数据消费标记 `@Query|reviewCards|sampleReviewCards|SampleLearningData`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/SettingsView.swift` 同时命中 `AppSettingsRecord|ProviderProfileRecord` 与 `Provider|隐私`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence` 同时命中至少一个样例数据入口 `SampleLearningData|seedSampleData|PreviewData|makeSample`
    - 命令输出：`rg -n 'placeholder only|TODO|TBD' apps/ios/AgentEnglish/Screens/FavoritesView.swift apps/ios/AgentEnglish/Screens/ReviewView.swift apps/ios/AgentEnglish/Screens/SettingsView.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence` 输出为空
    - 命令输出：`rg -n '"(收藏|复习|设置)"\\s*\\)' apps/ios/AgentEnglish/Screens/FavoritesView.swift apps/ios/AgentEnglish/Screens/ReviewView.swift apps/ios/AgentEnglish/Screens/SettingsView.swift` 输出为空

- 交付项：样例“收藏 -> 复习卡 -> 容器重载后仍可见且关联仍有效”的本地学习闭环有自动化验证
  验证手段：文件存在 + Grep 模式 + Swift 测试
  验证条件：
    - 文件存在：`apps/ios/AgentEnglishTests/LocalLearningLoopTests.swift`
    - Grep 模式：`apps/ios/AgentEnglishTests/LocalLearningLoopTests.swift` 同时命中 `SavedItemRecord`、`ReviewCardRecord`、`ModelContainer`
    - Grep 模式：`apps/ios/AgentEnglishTests/LocalLearningLoopTests.swift` 同时命中至少一个创建语义标记 `insert|save|seed` 与至少一个重载语义标记 `reload|reopen|recreate|secondContainer|reloaded`
    - Grep 模式：`apps/ios/AgentEnglishTests/LocalLearningLoopTests.swift` 同时命中 `savedItemId` 或 `savedItem`
    - 命令退出码：若产物是 Swift Package，则 `swift test --package-path apps/ios --filter LocalLearningLoopTests` 返回 0
    - 命令退出码：若产物是 Xcode 工程，则 `xcodebuild -project apps/ios/AgentEnglish.xcodeproj -scheme AgentEnglish -destination 'platform=iOS Simulator,name=iPhone 16' test -only-testing:AgentEnglishTests/LocalLearningLoopTests` 返回 0

[UI 一致性 criteria]
注：`design_files` 仅以 `design_export/clean_pencil/*.png` 路径提供且当前轮次不使用 MCP 读像素，本轮只锁定能由 `Design-Brief.md` 和导出稿稳定抽取的结构约束，不写不可机器验证的颜色或像素要求。

- 交付项：底部导航与首页结构符合 Design Brief 的 iPhone 原生浏览首页约束
  验证手段：Grep 模式 + 命令输出
  验证条件：
    - Grep 模式：`apps/ios/AgentEnglish/App/RootTabView.swift` 同时命中 `Label(`、`浏览`、`收藏`、`复习`、`设置`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` 同时命中 `Agent English`、`TextField`、`LazyVGrid|Grid`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` 同时命中 `YouTube`、`Reddit`、`Wikipedia`、`AO3`、`X`
    - 命令输出：`rg -n 'WebView|WKWebView|fullScreenCover|NavigationSplitView' apps/ios/AgentEnglish/App apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` 输出为空

- 交付项：收藏 / 复习 / 设置三页保持原生列表或卡片容器，不引入自定义字体、网页容器或游戏化视觉
  验证手段：Grep 模式 + 命令输出
  验证条件：
    - Grep 模式：`apps/ios/AgentEnglish/Screens/FavoritesView.swift` 至少命中一个原生数据容器 `List|ForEach`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/ReviewView.swift` 至少命中一个原生内容容器 `ScrollView|List|VStack|GroupBox`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/SettingsView.swift` 至少命中一个原生分组容器 `List|Form`，且命中 `Section`
    - 命令输出：`rg -n 'Font\\.custom|UIFont\\(|NSFont|WKWebView|UIViewRepresentable|XP|装备|地图|怪兽|Boss|闯关' apps/ios/AgentEnglish` 输出为空

[架构边界 criteria]
- 交付项：入口层与核心层没有提前跨到 Phase 3 的 WebView / bridge / DOM / Provider 网络职责
  验证手段：命令输出
  验证条件：
    - 命令输出：`rg -n 'import WebKit|WKWebView|WKUserScript|WKScriptMessage|BridgeEvent|UserContentController|evaluateJavaScript|WebBridgeController|WebsiteDataPrompt' apps/ios/AgentEnglish apps/ios/AgentEnglishCore` 输出为空
    - 命令输出：`rg -n 'querySelector|MutationObserver|document\\.|window\\.' apps/ios/AgentEnglish apps/ios/AgentEnglishCore` 输出为空
    - 命令输出：`rg -n 'URLSession|Alamofire|OpenAI|Anthropic|Gemini|Claude' apps/ios/AgentEnglish apps/ios/AgentEnglishCore` 输出为空
    - 命令输出：`rg -n '@Model|final class (SavedItemRecord|ReviewCardRecord|AppSettingsRecord|ProviderProfileRecord)' apps/ios/AgentEnglish` 输出为空

- 交付项：本 Phase 的实现落在允许目录职责内，并通过 `AgentEnglishCore` 暴露持久化能力
  验证手段：文件存在 + Grep 模式 + 命令输出
  验证条件：
    - 文件存在：`apps/ios/AgentEnglish/`、`apps/ios/AgentEnglishCore/`、`apps/ios/AgentEnglishTests/`
    - Grep 模式：`apps/ios/AgentEnglish/App/AgentEnglishApp.swift` 或 `apps/ios/AgentEnglish/Screens/` 至少一处命中 `import AgentEnglishCore`
    - 命令输出：`find apps -maxdepth 1 -mindepth 1 -type d | sort` 输出只包含 `apps/ios`
    - 命令输出：`rg -n 'packages/browser-agent|packages/contracts' apps/ios/AgentEnglish apps/ios/AgentEnglishCore apps/ios/AgentEnglishTests` 输出为空

- 交付项：本 Phase 不提前扩展 browser-agent / contracts 的 Phase 3+ 能力，也不恢复旧 `src` 产品入口
  验证手段：命令输出 + Grep 模式
  验证条件：
    - 命令输出：`git diff --name-only -- packages/browser-agent/src/dom packages/browser-agent/src/overlay packages/browser-agent/src/site-adapters packages/browser-agent/src/bridge/bootstrap.ts packages/contracts/src/bridge-events.ts` 输出为空
    - 命令输出：`git ls-files --others --exclude-standard -- packages/browser-agent/src/dom packages/browser-agent/src/overlay packages/browser-agent/src/site-adapters` 输出为空
    - 命令输出：`test ! -d src || git diff --name-only -- src` 输出为空
    - 命令输出：`git ls-files --others --exclude-standard -- src` 输出为空
    - Grep 模式：`package.json` 的脚本值不命中 `next dev`、`next build`、`next start`、`src/server/db/migrate.ts`、`src/server/db/seed.ts`、`src/server/db/self-test.ts`
    - Grep 模式：`pnpm-workspace.yaml` 同时命中 `packages/contracts` 与 `packages/browser-agent`，且不命中 `apps/ios`、`src`、`packages/*`、`packages/**`

[隐私 / 安全 criteria]
- 交付项：Provider 凭证只以 Keychain 引用键或测试 double 表达，不把明文秘密写入 SwiftData 模型、核心层或设置页
  验证手段：Grep 模式 + 命令输出
  验证条件：
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence` 同时命中 `ProviderProfileRecord` 与至少一个引用键标记 `credentialReference|keychainReference|credentialRef`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence` 至少命中一个 Keychain 边界标记 `Keychain|keychain|credentialReference|keychainReference`
    - 命令输出：`rg -n 'apiKey\\s*:\\s*String|secret\\s*:\\s*String|token\\s*:\\s*String|password\\s*:\\s*String' apps/ios/AgentEnglish apps/ios/AgentEnglishCore` 输出为空
    - 命令输出：`rg -n 'SecureField|TextField\\([^\\n]*(api|API|token|Token|secret|Secret|password|Password)' apps/ios/AgentEnglish/Screens/SettingsView.swift` 输出为空
    - 命令输出：`rg -n 'sk-ant-|sk-proj-|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|AIza' apps/ios packages` 输出为空

- 交付项：本地学习数据与 website data / cookie 管理保持分离，Phase 2 不引入站点数据清理逻辑
  验证手段：命令输出
  验证条件：
    - 命令输出：`rg -n 'HTTPCookie|WKWebsiteDataStore|websiteData|cookie' apps/ios/AgentEnglish apps/ios/AgentEnglishCore` 输出为空
    - 命令输出：`rg -n 'clearHistory|clearCookies|removeData' apps/ios/AgentEnglish apps/ios/AgentEnglishCore` 输出为空

[非功能 / 回归 criteria]
- 交付项：iOS skeleton 至少提供一种可编译形态，并给出与产物匹配的构建命令
  验证手段：文件存在 + 编译输出 + 命令退出码
  验证条件：
    - 文件存在：`apps/ios/Package.swift` 或 `apps/ios/AgentEnglish.xcodeproj/project.pbxproj`
    - 命令退出码：若存在 `apps/ios/Package.swift`，`swift build --package-path apps/ios` 返回 0
    - 命令退出码：若存在 `apps/ios/Package.swift`，`swift test --package-path apps/ios --filter LocalLearningLoopTests` 返回 0
    - 命令退出码：若存在 `apps/ios/AgentEnglish.xcodeproj/project.pbxproj`，`xcodebuild -project apps/ios/AgentEnglish.xcodeproj -scheme AgentEnglish -destination 'generic/platform=iOS Simulator' build` 返回 0
    - 命令退出码：若存在 `apps/ios/AgentEnglish.xcodeproj/project.pbxproj`，`xcodebuild -project apps/ios/AgentEnglish.xcodeproj -scheme AgentEnglish -destination 'platform=iOS Simulator,name=iPhone 16' test -only-testing:AgentEnglishTests/LocalLearningLoopTests` 返回 0

- 交付项：根 workspace 的 Node / TypeScript 资产在新增 iOS 目录后继续通过 Phase 1 回归
  验证手段：命令退出码 + Grep 模式
  验证条件：
    - 命令退出码：`pnpm test` 返回 0
    - 命令退出码：`pnpm check` 返回 0
    - 命令退出码：`pnpm build` 返回 0
    - 命令退出码：`pnpm audit --audit-level critical --registry=https://registry.npmjs.org/` 返回 0
    - Grep 模式：`pnpm-workspace.yaml` 同时命中 `packages/contracts` 与 `packages/browser-agent`
    - Grep 模式：`package.json` 的脚本值不命中 `next dev`、`next build`、`next start`
