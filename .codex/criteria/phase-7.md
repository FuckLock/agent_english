---
phase_id: Phase 7
status: locked
spec_refs:
  - "Product-Spec.md#3.1 核心功能"
  - "Product-Spec.md#5.3 路径 3：收藏后复习"
  - "Product-Spec.md#8.6 隐私与数据"
  - "Product-Spec.md#9.1 MVP 范围"
plan_refs:
  - "DEV-PLAN.md#Phase 7: 复习、历史、设置与隐私管理"
  - "ARCHITECTURE.md#Layer Boundaries"
  - "PROJECT-STRUCTURE.md#Directory Responsibilities"
  - "docs/adr/ADR-0001-architecture-strategy.md"
round: local-reconciliation-after-phase-6.7
---

[功能验证 criteria]
- 交付项：收藏必须能生成 `ReviewCard` 队列，并支持“记住 / 模糊 / 不会”三种反馈写回下次复习时间。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`packages/contracts/src/review-card.ts`、`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Review/ReviewScheduler.swift`、`apps/ios/AgentEnglish/Screens/ReviewView.swift`、`apps/ios/AgentEnglishTests/ReviewSchedulerTests.swift`
    - Grep 模式：`packages/contracts/src/review-card.ts` 同时命中 `remembered`、`fuzzy`、`forgotten`、`nextDueAt`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Review/ReviewScheduler.swift` 同时命中 `generateMissingCards`、`dueCards`、`recordFeedback`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/ReviewView.swift` 同时命中 `查看答案`、`记住`、`模糊`、`不会`
    - 命令退出码：`pnpm --filter @agent-english/contracts test` 返回 0
    - 命令退出码：`swift test --package-path apps/ios --filter ReviewSchedulerTests` 返回 0

- 交付项：浏览历史必须由 page-ready bridge 写入 SwiftData，首页能显示继续学习入口，历史页能打开、按站点清理和全量清理。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/HistoryRepository.swift`、`apps/ios/AgentEnglish/Screens/HistoryView.swift`、`apps/ios/AgentEnglish/Screens/BrowserHomeView.swift`、`apps/ios/AgentEnglish/Web/WebBridgeController+Recording.swift`、`apps/ios/AgentEnglishTests/HistoryRepositoryTests.swift`
    - Grep 模式：`apps/ios/AgentEnglish/Web/WebBridgeController+Recording.swift` 命中 `recordPageReady`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/HistoryRepository.swift` 同时命中 `recordVisit`、`fetchRecent`、`clearSite`、`deleteAll`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` 同时命中 `继续学习`、`HistoryView`
    - 命令退出码：`swift test --package-path apps/ios --filter HistoryRepositoryTests` 返回 0

- 交付项：本地统计必须覆盖今日翻译页数、收藏数、复习完成数和连续使用天数，并被设置页展示。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/StatisticsRepository.swift`、`apps/ios/AgentEnglish/Screens/SettingsView.swift`、`apps/ios/AgentEnglishTests/StatisticsRepositoryTests.swift`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/StatisticsRepository.swift` 同时命中 `recordTranslatedPage`、`recordSavedItem`、`recordReviewCompleted`、`currentStreakDays`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/SettingsView.swift` 同时命中 `今日学习`、`翻译页数`、`收藏数`、`复习完成`、`连续使用`
    - 命令退出码：`swift test --package-path apps/ios --filter StatisticsRepositoryTests` 返回 0

- 交付项：设置页必须支持目标语言保存、翻译缓存清理、学习数据清理和网站数据清理，且学习数据与 website data 不能混成一个删除动作。
  验证手段：文件存在 + Grep 模式 + 命令退出码
  验证条件：
    - 文件存在：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Privacy/PrivacyDataManager.swift`、`apps/ios/AgentEnglish/Screens/SettingsClearAction.swift`、`apps/ios/AgentEnglish/Screens/SettingsView.swift`、`apps/ios/AgentEnglishTests/PrivacyDataManagerTests.swift`、`apps/ios/AgentEnglishTests/TranslationProviderSettingsStoreTests.swift`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Privacy/PrivacyDataManager.swift` 同时命中 `clearLearningData`、`clearTranslationCache`、`clearWebsiteData`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/SettingsView.swift` 同时命中 `目标语言`、`清空翻译缓存`、`清理网站数据`、`清空学习数据`
    - Grep 模式：`apps/ios/AgentEnglish/Screens/SettingsClearAction.swift` 同时命中 `learningData`、`translationCache`、`websiteData`
    - 命令退出码：`swift test --package-path apps/ios --filter PrivacyDataManagerTests` 返回 0
    - 命令退出码：`swift test --package-path apps/ios --filter TranslationProviderSettingsStoreTests` 返回 0

[非功能 criteria]
- 交付项：Phase 7 必须遵守架构边界，复习、历史、统计和隐私管理都在 native core / SwiftUI；不得把网站 cookie 清理与学习数据清理合并；不得新增 JS Provider 密钥或 DOM 规则。
  验证手段：Grep 模式 + 命令退出码
  验证条件：
    - Grep 模式：`rg -n 'querySelector|MutationObserver|\\.ytp-' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Review apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Privacy apps/ios/AgentEnglish/Screens/ReviewView.swift apps/ios/AgentEnglish/Screens/HistoryView.swift apps/ios/AgentEnglish/Screens/SettingsView.swift` 输出为空
    - Grep 模式：`rg -n 'apiKey|baseURL|openai|deepseek|anthropic' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Review apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Privacy apps/ios/AgentEnglish/Screens/ReviewView.swift apps/ios/AgentEnglish/Screens/HistoryView.swift apps/ios/AgentEnglish/Screens/SettingsView.swift` 输出为空
    - 命令退出码：`swift test --package-path apps/ios` 返回 0
    - 命令退出码：`xcodebuild -project apps/ios/AgentEnglish.xcodeproj -scheme AgentEnglish -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build` 返回 0
