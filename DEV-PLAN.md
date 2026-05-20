# Development Plan — iPhone 英语学习浏览器

> 本文件记录项目的开发阶段划分、当前进度和剩余工作。
> 新 session 启动时应首先阅读此文件，了解项目状态后再继续开发。

**基于信息**：
- 源 Spec：Product-Spec.md v2.0
- 源架构：ARCHITECTURE.md / PROJECT-STRUCTURE.md / docs/adr/ADR-0001-architecture-strategy.md
- 源设计：Design-Brief.md + design_export/clean_pencil/（设计 MCP 不可用，本次以 Brief 和已导出稿为准）
- 生成日期：2026-05-19
- 覆盖 Spec 功能：14 个 / 总 14 个

**当前进度（2026-05-20）**：
- Phase 1 已完成：workspace、contracts 和 browser-agent 最小包可构建 / 测试。
- Phase 2 已完成：iOS 原生 Tab 壳、SwiftData / Keychain 本地学习底座和样例学习闭环可构建 / 测试。
- Phase 3 已完成：Xcode 工程、WebView 可进入页面、boot / ping / page-ready bridge 解码、Provider disclosure 和 website data 分离提示可构建 / 测试。
- 下一步进入 Phase 4：通用网页文本扫描、翻译 Provider adapter、翻译缓存和原文 / 双语 / 学习模式。

---

## 架构约束摘要

**当前范围**：
- 首版只交付 iPhone 原生 App，入口固定为 `apps/ios`，运行时组合固定为 SwiftUI + WKWebView + SwiftData + Keychain。
- `packages/contracts` 是 native 与 injected script 的协议事实源；`packages/browser-agent` 只承载 DOM 识别、翻译层、学习模式和站点适配。
- 首版必须交付原生学习闭环：收藏、复习、历史、Provider 设置、隐私清理和基础统计，避免退化成纯 WebView 壳。

**后续范围 / Non-goals**：
- Android、macOS、Windows 仅保留未来接入边界，本计划不创建完整平台工程。
- 不恢复旧 `src/` Next 入口，不复用旧 Drizzle / SQLite 游戏数据，不引入 RPG、课程化、云同步、浏览器插件、YouTube 替代客户端。
- 不实现视频下载、去广告、后台播放、无字幕视频实时转写、Netflix / Disney+ / TED / Coursera 支持。

**层次边界**：
- 入口层：`apps/ios` 负责 App 生命周期、SwiftUI 导航、Tab、WKWebView 容器、工具条、底部抽屉、设置页和系统权限；禁止写 DOM 规则、Provider 协议细节或复习调度规则。
- 核心层：`apps/ios/AgentEnglishCore` 负责收藏、历史、复习、Provider profile、错误映射、隐私策略和 SwiftData repository；禁止直接读写网页 DOM、保存凭证明文或修改播放器。
- 共享协议：`packages/contracts` 负责 `BridgeEvent`、DTO、错误码、数据模型命名和 schema；禁止放 UI、存储实现或 Provider SDK。
- 适配层：`packages/browser-agent` 负责 DOM 扫描、overlay、selection、site adapter；native Provider adapter 负责外部请求、重试和错误归一；禁止 JS 直接持久化、持有 API Key 或直接调用第三方 AI。

**目录职责**：
| 路径 | 当前状态 | 职责 | 禁止 |
|------|----------|------|------|
| `apps/ios/` | placeholder | 首版 iOS App 工程、SwiftUI 页面、WKWebView 容器、原生导航和系统能力接入 | 作为跨平台抽象层；直接承载 DOM 选择器、站点规则或旧 Next 页面 |
| `apps/ios/AgentEnglishCore/` | placeholder | 收藏、历史、复习、Provider、Bridge DTO、SwiftData、隐私清理等无 UI 核心模块 | 放 SwiftUI View、网页 DOM 逻辑、JS 注入源码 |
| `packages/contracts/` | placeholder | bridge event、共享 DTO、错误码、数据模型命名、schema version | 放 UI 组件、平台存储实现、Provider SDK |
| `packages/browser-agent/` | placeholder | 文本识别、overlay、学习模式、selection、站点适配、页面变更监听 | 保存凭证、调用 Provider、写本地数据库、修改 YouTube 播放器 |
| `apps/android/` / `apps/macos/` / `apps/windows/` | future | 未来平台壳位置，仅文档占位 | 首版创建完整工程或复制 iOS 实现 |
| `src/` | legacy cleanup target | 旧 Next 游戏入口，后续只作为清理对象处理 | 恢复为新产品入口、创建新业务代码 |
| `data/` | legacy cleanup target | 旧本地 SQLite 残留目录 | 作为新产品 SwiftData 或学习数据来源 |

**ADR 决策摘要**：
- ADR-0001 固定首版路线为“iOS 原生壳 + `browser-agent` + `contracts`”，因此最早的实现 tranche 仍必须先建立 `apps/ios`、`packages/contracts`、`packages/browser-agent`。
- ADR-0001 要求所有 WebView 与 JS 通信都通过结构化 `BridgeEvent`，Provider 凭证只能进 Keychain，收藏 / 历史 / 复习 / 翻译缓存进入 SwiftData，网站 cookie 与 learning data 分离管理。
- 由于原单体 Phase 1 在 criteria-alignment 第 3 轮被判定 `unverifiable`，本次修订将其拆为新的 Phase 1-3：Phase 1 先验证 workspace + contracts + browser-agent 最小包，Phase 2 验证原生 Tab 壳 + SwiftData / Keychain 本地学习底座，Phase 3 验证 `WKWebView` 可进入页面 + `BridgeEvent` 通信入口 + website data 提示；在 Phase 4 前不得跳过这三个基础 Phase。

---

## Phase 1: Workspace 骨架 + Contracts / Browser-Agent 最小包

**交付内容**：
- 重整根目录脚本与 workspace，只把 `packages/contracts` 和 `packages/browser-agent` 纳入首批 Node 工具链，旧 Next / Drizzle 入口降为清理对象而非产品入口。
- 落 `BridgeEvent` envelope、schema version、boot 级事件名和导出入口，让 `packages/contracts` 成为 native / JS 共享事实源。
- 产出可构建的 `browser-agent` 最小 bundle，仅包含 bootstrap 与 contracts 引用，为后续 `WKUserScript` 注入保留稳定入口。

**关键文件**：
- `[修改] package.json` — 切换根脚本到 pnpm workspace 构建与验证入口，移除旧 Next 产品入口语义
- `[修改] pnpm-workspace.yaml` — 纳入 `packages/contracts` 与 `packages/browser-agent`
- `[新增] packages/contracts/package.json` — contracts 包构建与导出配置
- `[新增] packages/contracts/src/bridge-events.ts` — `BridgeEvent`、schema version、boot 事件名与 envelope
- `[新增] packages/contracts/src/index.ts` — contracts 对外统一导出
- `[新增] packages/browser-agent/package.json` — browser-agent 包构建配置
- `[新增] packages/browser-agent/src/bridge/bootstrap.ts` — boot / ping 初始化消息与最小桥接入口
- `[新增] packages/browser-agent/src/index.ts` — 注入脚本主入口与 bundle 出口

**依赖前置 Phase**：
- 无（独立 Phase）

**架构约束映射**：
- 层次边界：只建立共享协议与适配层最小骨架，不在 JS 中写持久化，不在根脚本中恢复旧 Web 产品运行时。
- 目录职责：允许创建 `packages/contracts`、`packages/browser-agent` 和根 workspace 配置；禁止恢复 `src/` 作为入口，禁止创建 Android / macOS / Windows 完整工程。
- ADR 约束：本 Phase 只兑现原始首个 implementation tranche 的 contracts / browser-agent 子集；SwiftData、Keychain、原生学习闭环和 website data 提示在紧随其后的 Phase 2-3 收口。
- 后续范围：不提前实现原生 UI、站点适配、真实翻译 Provider 或导出功能。

**已知风险**：
- pnpm workspace 与 browser-agent bundle 出口如果在本 Phase 未跑通，后续 `WKUserScript` 注入链会被整体阻塞。

**验收标准**：
- 最低：pnpm workspace 能安装并运行 `packages/contracts`、`packages/browser-agent` 的 TypeScript 校验与构建；contracts 对外暴露结构化 `BridgeEvent`；`browser-agent` 能生成可供后续 `WKUserScript` 注入的 bundle 文件。
- 回归：根脚本不再把 Next 页面或 Drizzle 迁移作为新产品默认入口。

---

## Phase 2: 原生 Tab 壳 + SwiftData / Keychain 本地学习底座

**交付内容**：
- 创建 `apps/ios` App target 与浏览 / 收藏 / 复习 / 设置四个原生 Tab 基础页，首页保留搜索框和站点入口占位，明确“首屏是原生浏览首页而不是全屏 WebView”。
- 建立 SwiftData model container、`SavedItem` / `ReviewCard` / 设置与 Provider profile 的首批持久化模型，并用 Keychain 引用键承载敏感凭证入口。
- 用样例数据和测试打通“样例收藏 -> 样例复习卡 -> 重载后仍可见”的最小本地学习闭环，作为 App Store 原生价值底座。

**关键文件**：
- `[新增] apps/ios/AgentEnglish/App/AgentEnglishApp.swift` — iOS App 入口与生命周期
- `[新增] apps/ios/AgentEnglish/App/RootTabView.swift` — 浏览、收藏、复习、设置的原生导航骨架
- `[新增] apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` — 原生首页、地址输入框和站点入口占位
- `[新增] apps/ios/AgentEnglish/Screens/FavoritesView.swift` — 收藏页基础列表壳
- `[新增] apps/ios/AgentEnglish/Screens/ReviewView.swift` — 复习页基础卡片壳
- `[新增] apps/ios/AgentEnglish/Screens/SettingsView.swift` — 设置页基础分组壳
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/AppModelContainer.swift` — SwiftData model container、样例模型注册和本地存储入口
- `[新增] apps/ios/AgentEnglishTests/LocalLearningLoopTests.swift` — 样例收藏、复习卡和容器重载的本地学习闭环测试

**依赖前置 Phase**：
- 依赖 Phase 1（需要 workspace、contracts 与 browser-agent 最小构建基础）

**架构约束映射**：
- 层次边界：入口层只创建原生导航和基础页；核心层只创建 SwiftData / Keychain 本地学习底座；禁止在 SwiftUI View 内写 DOM 规则。
- 目录职责：允许创建 `apps/ios/AgentEnglish/`、`apps/ios/AgentEnglishCore/` 和 `apps/ios/AgentEnglishTests/` 的原生壳与 persistence 基础；禁止创建 `WKWebView` 业务桥接、DOM 扫描或 Provider 网络调用。
- ADR 约束：本 Phase 完成原始首个 implementation tranche 中“原生学习闭环 + SwiftData / Keychain 边界”子集，但桥接解码和 website data 提示仍留给 Phase 3。
- 后续范围：不提前实现网页浏览、翻译、站点适配或完整 Provider 配置流程。

**已知风险**：
- 如果样例学习闭环只在测试中成立、却无法在原生页面中可见，后续仍会被 App Store 原生价值边界卡住。

**验收标准**：
- 最低：iOS 工程能编译并启动到原生 Tab 壳；首屏显示 `BrowserHomeView` 而不是 `WKWebView`；样例 `SavedItem` 和 `ReviewCard` 在收藏 / 复习页可见且容器重载后仍可读回；Provider 凭证只以 Keychain 引用或测试 double 存取，不进入 SwiftData 明文。
- 回归：Phase 1 的 workspace 构建与 contracts / browser-agent 校验仍正常。

---

## Phase 3: `WKWebView` 可进入页面 + `BridgeEvent` 入口 + 隐私提示

**交付内容**：
- 补齐 Xcode iOS App wrapper 与共享 scheme，让当前原生 Tab 壳可在 Xcode 中选择 iPhone Simulator / 真机调试；该 wrapper 只承载现有 SwiftUI 壳和本地学习底座，不提前实现 WebView 业务。
- 让用户从原生首页进入 `WebBrowserView`，显示可导航的 `WKWebView` 页面与基础前进 / 返回工具条。
- 把 `browser-agent` bootstrap 注入 `WKWebView`，通过 `WebBridgeController` 接收并解码首批 `BridgeEvent` boot / ping / page-ready 消息，建立唯一 bridge 入口。
- 在设置页补齐 Provider 数据发送说明和 website data 清理提示，明确学习数据与网站数据分离。

**关键文件**：
- `[新增] apps/ios/AgentEnglish.xcodeproj/project.pbxproj` — Xcode iOS App wrapper，用于模拟器 / 真机调试
- `[新增] apps/ios/AgentEnglish.xcodeproj/xcshareddata/xcschemes/AgentEnglish.xcscheme` — 共享 Xcode scheme
- `[新增] apps/ios/README-Xcode.md` — Xcode 模拟器 / 真机调试说明
- `[新增] apps/ios/AgentEnglish/Screens/WebBrowserView.swift` — 浏览页、工具条和页面进入 / 返回流转
- `[新增] apps/ios/AgentEnglish/Web/WebViewContainer.swift` — `WKWebView` 容器、`WKUserScript` 注入与 message handler 挂载
- `[新增] apps/ios/AgentEnglish/Web/WebBridgeController.swift` — `WKScriptMessageHandler` 到 contracts 解码的唯一桥接入口
- `[新增] apps/ios/AgentEnglish/Web/BrowserAgentBootstrapScript.swift` — iOS `WKUserScript` boot / ping / page-ready bootstrap
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Bridge/BridgeEvent.swift` — Swift 侧 bridge event 白名单与解码器
- `[新增] apps/ios/AgentEnglish/Settings/PrivacyDisclosureView.swift` — Provider 文本发送说明与 disclosure 展示
- `[新增] apps/ios/AgentEnglish/Settings/WebsiteDataPromptView.swift` — website data 独立提示与后果说明
- `[新增] apps/ios/AgentEnglishTests/WebBridgeControllerTests.swift` — bootstrap 事件解码与 bridge 白名单测试
- `[修改] packages/browser-agent/src/bridge/bootstrap.ts` — 启动事件、page-ready 消息和最小握手流程
- `[修改] packages/contracts/src/bridge-events.ts` — bootstrap / page-ready 事件类型和解码约束

**依赖前置 Phase**：
- 依赖 Phase 1（需要 contracts 与 browser-agent bundle）
- 依赖 Phase 2（需要原生首页、设置页与本地学习底座）

**架构约束映射**：
- 层次边界：入口层只负责 `WKWebView` 容器与导航；共享协议只扩展 boot 级 `BridgeEvent`；适配层只做最小 bridge bootstrap，不实现 DOM 扫描或翻译业务。
- 目录职责：允许修改 `apps/ios/AgentEnglish/Web/`、`apps/ios/AgentEnglish/Settings/`、`packages/contracts` 与 `packages/browser-agent/src/bridge/`；禁止在本 Phase 创建真实 Provider adapter、翻译 overlay 或站点规则。
- ADR 约束：本 Phase 完成原始首个 implementation tranche 中“`BridgeEvent` 解码 + website data 提示 + 可见 WebView 入口”子集；Phase 4 前不得绕过该唯一 bridge 入口。
- 后续范围：不提前实现整页翻译、选区解释、历史、复习调度或导出。

**已知风险**：
- 如果 `WKUserScript` 注入时机或 bridge 白名单设计不稳，后续翻译和选区事件会产生重复消息或初始化竞态。

**验收标准**：
- 最低：Xcode 能打开 `apps/ios/AgentEnglish.xcodeproj` 并构建 `AgentEnglish` scheme；用户能从首页进入并看见 `WKWebView` 页面，再返回原生首页；`WKScriptMessage` 只通过 `WebBridgeController` 进入 native 层，至少一种 bootstrap 事件可经 tests 或调试入口按 `BridgeEvent` 解码；设置页能看到 Provider disclosure 和独立 website data 清理提示。
- 回归：Phase 2 的原生 Tab 壳、样例收藏 / 复习数据和 Keychain 引用约束仍正常。

---

## Phase 4: 通用网页翻译 + 显示模式管线

**交付内容**：
- 完成 `browser-agent` 通用文本扫描、稳定 `segmentId`、页面能力上报和 native / JS 翻译请求映射。
- 完成 native Provider adapter、文本分块、翻译缓存，以及原文 / 双语 / 学习模式切换。
- 为页面识别失败、Provider 未配置和翻译失败提供明确降级提示，并保留选区翻译入口。

**关键文件**：
- `[新增] packages/contracts/src/translation.ts` — `PageContext`、`PageTextSegment`、`TranslationRequest`、`TranslationResult`
- `[新增] packages/browser-agent/src/bridge/translation-events.ts` — 翻译请求、完成、失败事件映射
- `[新增] packages/browser-agent/src/dom/segment-scanner.ts` — 通用文本节点扫描和稳定段落 id
- `[新增] packages/browser-agent/src/overlay/translation-overlay.ts` — 双语插入层与失败提示渲染
- `[新增] packages/browser-agent/src/modes/display-mode-controller.ts` — 原文 / 双语 / 学习模式切换
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift` — native 翻译 Provider 调用、重试与错误归一
- `[修改] apps/ios/AgentEnglish/Web/WebBridgeController.swift` — 翻译请求路由、结果回传和 bridge 生命周期管理
- `[修改] apps/ios/AgentEnglish/Screens/WebBrowserView.swift` — 浏览页工具条、翻译按钮、模式切换与降级提示承载

**依赖前置 Phase**：
- 依赖 Phase 1（需要共享 contracts 与 browser-agent 构建基础）
- 依赖 Phase 2（需要 SwiftData / Provider profile 底座）
- 依赖 Phase 3（需要可进入的 `WKWebView` 与唯一 bridge 入口）

**架构约束映射**：
- 层次边界：DOM 扫描和 overlay 只在 `packages/browser-agent`；Provider 调用只在 native adapter；View 只负责交互触发和状态展示。
- 目录职责：允许修改 `packages/contracts`、`packages/browser-agent`、`apps/ios/AgentEnglish/Web/` 和 native Provider 模块；禁止在 JS 中保存 API Key 或写入 SwiftData。
- ADR 约束：所有通信必须走 `BridgeEvent`；缓存写入 SwiftData；失败时可降级到选区翻译，但不能伪装成功。
- 后续范围：不在本 Phase 内实现站点专属规则、收藏解释或复习调度。

**已知风险**：
- 第三方 Provider 的速率限制和文本分块策略会直接影响长文翻译稳定性，需要在本 Phase 先验证缓存与重试行为。

**验收标准**：
- 最低：用户在通用英文网页上点击翻译后能看到双语插入；三种显示模式可切换；翻译失败能明确提示并保留选区翻译入口。
- 回归：Phase 1-3 的原生 Tab 壳、样例本地学习闭环、`WKWebView` 进入流程和隐私提示仍正常。

---

## Phase 5: 点词点句解释 + 收藏沉淀

**交付内容**：
- 用户点词、点短语或选中句子时，native 底部抽屉展示中文释义、语境解释、例句和收藏按钮。
- 保存 `SavedItem` 的来源 URL、页面标题、原文上下文、翻译和解释，并让收藏页支持搜索、筛选、删除。
- 让 WebView 选择事件、原生解释请求和收藏持久化通过同一 contract / bridge 流程完成。

**关键文件**：
- `[新增] packages/contracts/src/selection.ts` — `SelectionContext`、selection 事件和错误状态
- `[新增] packages/contracts/src/saved-item.ts` — `SavedItem` 共享命名和导出字段
- `[新增] packages/browser-agent/src/dom/selection-context.ts` — 选区上下文提取和 range 标准化
- `[新增] packages/browser-agent/src/bridge/selection-events.ts` — 点词 / 选句事件发射与回填
- `[新增] apps/ios/AgentEnglish/Screens/ExplanationSheetView.swift` — 原生底部抽屉解释视图
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/SavedItemRepository.swift` — 收藏读写、搜索和删除
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ExplanationProviderClient.swift` — 解释请求、例句生成和错误归一
- `[修改] apps/ios/AgentEnglish/Screens/FavoritesView.swift` — 收藏列表、筛选、搜索和删除入口

**依赖前置 Phase**：
- 依赖 Phase 2（需要 native 壳和本地存储基础）
- 依赖 Phase 4（需要通用页面识别、翻译结果和 bridge 管线）

**架构约束映射**：
- 层次边界：selection 和 DOM range 处理只在 `browser-agent`；解释请求和收藏持久化只在 native core；收藏页不直接读取网页 DOM。
- 目录职责：允许扩展 `packages/contracts`、`packages/browser-agent`、`apps/ios/AgentEnglish/Screens/` 和 `AgentEnglishCore/Persistence` / `Providers`；禁止把解释提示塞回网页 overlay 代替原生底部抽屉。
- ADR 约束：解释请求仍由 native 发起，凭证仍只在 Keychain；收藏模型命名必须与 contracts 保持等价。
- 后续范围：不在本 Phase 内实现复习队列、历史继续学习或站点专属规则。

**已知风险**：
- 不同站点的选区 API 与动态 DOM 结构差异较大，需要优先验证 selection range 映射是否会破坏原网页交互。

**验收标准**：
- 最低：用户在通用网页中点词或选句后能看到解释抽屉；可一键收藏并在收藏页检索、筛选、删除；来源 URL 和上下文可回看。
- 回归：Phase 4 的整页翻译、显示模式和失败降级仍正常。

---

## Phase 6: 复习、历史、设置与隐私管理

**交付内容**：
- 基于收藏生成 `ReviewCard` 队列，支持记住 / 模糊 / 不会反馈并调整近期复习优先级。
- 提供历史页、继续学习入口和本地统计，覆盖翻译页数、收藏数、复习完成数、连续使用天数。
- 在 Phase 3 的隐私提示基础上，补全设置页中的 Provider 配置、目标语言、数据保留策略、缓存清理、网站数据清理提示和全量清空能力。

**关键文件**：
- `[新增] packages/contracts/src/review-card.ts` — `ReviewCard`、反馈状态和调度字段命名
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Review/ReviewScheduler.swift` — 复习优先级与反馈调度
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/HistoryRepository.swift` — 浏览历史、继续学习定位和站点清理
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/StatisticsRepository.swift` — 本地统计聚合与连续使用天数
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Privacy/PrivacyDataManager.swift` — 学习数据清理、website data 提示和隐私开关
- `[修改] apps/ios/AgentEnglish/Screens/ReviewView.swift` — 主动回忆卡片、答案展开和反馈按钮
- `[新增] apps/ios/AgentEnglish/Screens/HistoryView.swift` — 最近翻译网页与继续学习入口
- `[修改] apps/ios/AgentEnglish/Screens/SettingsView.swift` — Provider、语言、缓存、网站数据和清理策略设置

**依赖前置 Phase**：
- 依赖 Phase 2（需要 SwiftData / Keychain / 基础页面）
- 依赖 Phase 4（统计、历史和缓存要消费翻译行为）
- 依赖 Phase 5（复习卡基于收藏沉淀）

**架构约束映射**：
- 层次边界：复习调度、历史和统计都在 native core；设置页只做配置与展示，不直接操作网页 DOM 或 Provider SDK。
- 目录职责：允许新增 `Review/`、`Privacy/`、`Persistence/` 细分模块和对应 SwiftUI 页面；禁止把网站 cookie 清理和学习数据清理混为同一删除动作。
- ADR 约束：原生收藏、复习、历史和隐私清理是 App Store 价值边界，本 Phase 必须完整成形；Provider 配置元数据写 SwiftData，敏感凭证留 Keychain。
- 后续范围：不在本 Phase 内做云同步、账号系统或跨设备统计。

**已知风险**：
- 复习优先级算法首版只需“可解释、可验证”，避免提前引入复杂 SRS 公式导致调试成本过高。

**验收标准**：
- 最低：用户能从收藏生成复习卡并提交三种反馈；历史页能回到原网页；设置页能配置 Provider、切换目标语言并分别清理学习数据与 website data。
- 回归：Phase 5 的解释抽屉、收藏沉淀与搜索筛选，以及 Phase 3 的隐私提示仍正常。

---

## Phase 7: 站点适配 + YouTube 保守支持 + 快捷入口管理

**交付内容**：
- 为 YouTube、Reddit、Wikipedia、AO3、X 建立独立 site adapter，并保留 generic fallback。
- 支持 YouTube 标题、简介、评论、搜索结果翻译；有可访问字幕时尝试双语字幕，无字幕或字幕不可访问时明确提示但不影响页面文字翻译。
- 支持首页常用站点快捷入口的添加、删除和排序，让浏览首页可按个人习惯定制。

**关键文件**：
- `[新增] packages/contracts/src/site-capability.ts` — 站点能力声明与 adapter 能力枚举
- `[新增] packages/browser-agent/src/site-adapters/youtube.ts` — YouTube 页面文字和可访问字幕适配
- `[新增] packages/browser-agent/src/site-adapters/reddit.ts` — Reddit 帖子与评论适配
- `[新增] packages/browser-agent/src/site-adapters/wikipedia.ts` — Wikipedia 长文段落适配
- `[新增] packages/browser-agent/src/site-adapters/ao3.ts` — AO3 阅读页适配
- `[新增] packages/browser-agent/src/site-adapters/x.ts` — X 时间线与详情页适配
- `[修改] apps/ios/AgentEnglish/Screens/BrowserHomeView.swift` — 常用站点网格和入口状态展示
- `[新增] apps/ios/AgentEnglish/Screens/SiteShortcutEditorView.swift` — 快捷入口编辑、排序和删除界面

**依赖前置 Phase**：
- 依赖 Phase 3（需要首页、`WKWebView` 页面进入流和 bridge 入口）
- 依赖 Phase 4（需要通用翻译与桥接管线）
- 依赖 Phase 5（需要 selection / 收藏在特定站点仍可工作）

**架构约束映射**：
- 层次边界：站点规则只进 `packages/browser-agent/src/site-adapters`；YouTube 能力只做保守学习增强，native 层只负责提示与状态展示。
- 目录职责：允许新增 site adapter 和首页快捷入口管理页面；禁止在 `apps/ios` 中硬编码 DOM selector 或在 JS 中改动播放器行为。
- ADR 约束：YouTube 不能做替代客户端、不能下载媒体、不能去广告；站点失败必须回退到通用文本识别或选区翻译。
- 后续范围：不提前支持 Netflix / Disney+ / Coursera，也不创建桌面端或 Android 站点壳。

**已知风险**：
- 第三方站点 DOM 经常变化，site adapter 需要与通用扫描共存，不能让单站点失败拖垮整页翻译。

**验收标准**：
- 最低：五个核心站点都能在各自主页面结构上获得更稳定的翻译结果；YouTube 字幕失败不会影响页面文字翻译；用户可自定义首页快捷入口顺序。
- 回归：Phase 4 的 generic 翻译、Phase 5 的点词收藏、Phase 6 的历史与设置仍正常。

---

## Phase 8: 导出、回归加固与交付收口

**交付内容**：
- 导出收藏为 CSV / Markdown，包含来源 URL、标题、原文上下文、翻译和解释，便于迁移到 Anki 或笔记工具。
- 完成错误 / 空状态、翻译失败 / 字幕失败文案，以及学习数据与 website data 分离清理的最后收口。
- 补齐 browser-agent fixture、bridge contract、SwiftData repository 和 review scheduler 回归检查，并清理旧 Next / Drizzle 入口脚本对新产品构建路径的干扰。

**关键文件**：
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/ExportService.swift` — CSV / Markdown 导出与字段映射
- `[新增] apps/ios/AgentEnglish/Screens/ExportSheetView.swift` — 导出入口、格式选择与分享面板
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Privacy/WebsiteDataCleanupService.swift` — website data 清理执行与确认流程
- `[新增] apps/ios/AgentEnglishTests/BridgeContractTests.swift` — native / contracts 一致性与 bridge 解码回归
- `[新增] apps/ios/AgentEnglishTests/ReviewSchedulerTests.swift` — 复习反馈和调度规则回归
- `[新增] apps/ios/AgentEnglishTests/SwiftDataRepositoryTests.swift` — 收藏、历史、缓存与导出数据回归
- `[新增] packages/browser-agent/fixtures/wikipedia-article.html` — 长文 fixture 与 overlay 回归输入
- `[修改] package.json` — 最终 workspace 校验脚本、browser-agent / contracts 构建脚本和旧入口剥离

**依赖前置 Phase**：
- 依赖 Phase 1 到 Phase 7（需要完整功能面、回归样本和导出源数据）

**架构约束映射**：
- 层次边界：导出与测试都消费既有 contracts / core / browser-agent，不新增越层捷径；website data 清理仍走 native 隐私模块。
- 目录职责：允许补齐 `AgentEnglishTests/`、`packages/browser-agent/fixtures/`、`Persistence/` 和 root validation scripts；禁止为了测试方便把业务逻辑挪回 `src/` 或旧 Next 路径。
- ADR 约束：导出不能泄露 Keychain 凭证；隐私清理必须继续区分学习数据和网站数据；回归检查要覆盖 bridge、SwiftData 和站点 fixture。
- 后续范围：不在本 Phase 内引入发布后端、账号同步或跨平台共享数据库。

**已知风险**：
- 导出编码与 fixture 维护成本会随站点数量上升，因此本 Phase 需要先把核心五站点和关键数据字段稳定下来。

**验收标准**：
- 最低：用户能导出 CSV / Markdown；错误和空状态完整；关键 repository、bridge 和 fixture 回归通过；新构建路径不再依赖旧 Next / Drizzle 产品入口。
- 回归：Phase 1 到 Phase 7 的全部核心流程仍可编译、启动并使用。

---

## 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 运行时 | iOS | 17+ | ADR 固定首版最低系统版本，供 SwiftData 与原生 WebView 方案使用 |
| 原生语言 | Swift | 6.x | iOS 原生壳与无 UI 核心模块主语言 |
| 原生 UI | SwiftUI | iOS 17 SDK | 首页、浏览页、收藏、复习、设置和底部抽屉 |
| Web 容器 | WebKit `WKWebView` | iOS 17 SDK | 承载真实网页浏览、`WKUserScript` 注入和 bridge 消息 |
| 本地持久化 | SwiftData | iOS 17+ | 收藏、历史、复习、统计、翻译缓存等非敏感数据 |
| 凭证存储 | Keychain Services | iOS 17+ | Provider 凭证和敏感引用信息 |
| 共享脚本语言 | TypeScript | 5.9.3 | `packages/contracts` 与 `packages/browser-agent` 开发语言 |
| JS 运行时 | Node.js | >=22.13.0 | workspace 构建和脚本运行环境 |
| 包管理 / Workspace | pnpm | 10.33.4 | 管理 `packages/contracts`、`packages/browser-agent` 和根脚本 |

## 数据库表（如有）

| 表名 | 创建 Phase | 修改记录 | 用途（含外键关系）|
|------|-----------|---------|------|
| `app_settings_records` | Phase 2 | Phase 3 增加隐私提示状态；Phase 6 增加目标语言、显示模式默认值、数据保留策略 | 保存本机设置项；与 `provider_profile_records` 关联当前选中的 Provider 配置 |
| `provider_profile_records` | Phase 2 | Phase 6 增加 disclosure、缓存开关和模型显示名 | 保存 Provider 类型、能力、Keychain 引用键、是否启用；不保存明文凭证 |
| `saved_item_records` | Phase 2 | Phase 5 增加解释、来源上下文、搜索字段 | 收藏词 / 短语 / 句子；可生成 `review_card_records` |
| `review_card_records` | Phase 2 | Phase 6 增加 `lastReviewedAt`、`nextDueAt`、`feedbackState` | 主动回忆卡片；通过 `savedItemId` 关联 `saved_item_records` |
| `history_entry_records` | Phase 6 | — | 记录最近翻译网页与继续学习入口；可按站点清理 |
| `translation_cache_records` | Phase 4 | Phase 6 增加 `historyEntryId` 弱关联 | 以页面 / 文本 hash 关联翻译结果，减少重复请求 |
| `daily_stat_records` | Phase 6 | — | 保存每日翻译页数、收藏数、复习完成数和连续使用天数聚合结果 |
| `site_shortcut_records` | Phase 7 | — | 保存首页常用站点入口、图标、排序和启用状态 |

## 开发规则

**项目特定规则**（dev-builder 通用规则之外的项目约定）：
- 包管理器：`pnpm`
- 首版产品入口只能是 `apps/ios`；旧 `src/`、`.next/`、Drizzle 配置和 `data/agent-english.sqlite*` 都视为历史残留，不得复活为新入口或新数据源。
- `packages/contracts` 是 bridge event、DTO、错误码和数据模型命名的事实源；Swift DTO 必须与其保持等价。
- 所有 WebView 与 JS 通信都必须经过结构化 `BridgeEvent`，禁止 SwiftUI View 拼接临时业务 JavaScript 处理收藏、翻译或解释。
- `packages/browser-agent` 只负责 DOM、overlay、selection 和 site adapter；不得持有 API Key、直接调用 Provider、写本地数据库或修改 YouTube 播放器核心行为。
- SwiftData 只保存非敏感学习数据；Provider 凭证只进 Keychain；website data 与学习数据必须分开提示和清理。
- 若后续要支持 iOS 16 或更低版本、提前引入 Android / 后端代理 / 账号同步，必须先新增 ADR，再改计划。

**通用规则**（按 dev-builder [开发规则]）：
- 详细见 dev-builder SKILL.md，本文件不重复定义
