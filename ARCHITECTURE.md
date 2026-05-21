# Architecture - iPhone 英语学习浏览器

## Purpose

本文档确定新产品的开发前架构边界：首版做 iPhone 原生 App，用 SwiftUI + WKWebView 承载真实网页浏览和学习工具，用 SwiftData 保存非敏感学习数据，用 Keychain 保存 Provider 凭证；未来 Android、macOS、Windows 通过新的平台壳接入同一套网页注入协议、学习数据模型和 Provider 适配边界。架构目标不是提前做全平台，而是让第一版 iOS 可交付，同时避免把翻译、收藏、复习、网页注入逻辑写死在单个界面里。

## Input Sources And Assumptions

| Type | Source | How It Was Used |
|---|---|---|
| Requirements | `Product-Spec.md` v2.0 | 作为产品范围、MVP 功能、非目标、技术方向和隐私边界的事实源。 |
| Design | `Design-Brief.md`、`design_export/clean_pencil/` | 作为 iPhone 首页、网页浏览页、翻译层、点词抽屉、收藏、复习、设置的信息架构和视觉约束；本地已发现 14 张 clean Pencil PNG，其中多张为 390x844 iPhone 画布。 |
| Existing code | 当前仓库根目录、`package.json`、已删除的旧 `src/` 游戏代码状态 | 判断当前处于重大重定义后新项目状态；旧 Next 游戏实现不再作为产品入口。 |
| Constraints | 用户明确说明：首版苹果手机端，后续 Android、macOS、Windows；2026-05-20 复核的 Apple App Review Guidelines、Apple SwiftData / WebKit 文档、YouTube API Services Developer Policies | 用于确定平台矩阵、审核风险、持久化边界、WebView 注入边界和 YouTube 保守支持边界。 |

## Architecture Assumptions

- 首版以 iOS 原生 App 为唯一运行交付，不同时开发 Android、macOS、Windows。
- 首版最低系统版本按 iOS 17+ 处理，以便使用 SwiftData；如后续必须支持更低 iOS 版本，需要新增 ADR 评估 Core Data 或 SQLite/GRDB 替换方案。
- 首版以 TestFlight 为验证目标，稳定后再进入 App Store 审核收口。
- 首版不建立账号系统、云同步或自有后端；收藏、历史、复习、Provider 配置默认本地保存。
- 收藏、历史、复习、翻译缓存等非敏感数据使用 SwiftData；Provider 凭证只存本机 Keychain；第三方网页 cookie、localStorage、sessionStorage 归 WKWebView 的 website data store 管理。
- 如果用户使用自己的 AI 或翻译 Provider，页面文本只在用户触发翻译或解释时发送给所选 Provider。
- 网页文本识别、DOM 节点标记、翻译层插入和站点适配通过可打包的 TypeScript `browser-agent` 注入脚本承载，iOS App 通过 WKWebView 加载该脚本。
- 未来 Android WebView、macOS WKWebView、Windows WebView2 优先复用 `browser-agent` 和 `contracts`，各平台 UI 壳、系统权限、本地存储可以重写。
- 当前仓库保留的 Next、React、Drizzle、better-sqlite3 依赖属于旧方向遗留；新产品入口不继续使用 `src/app` 或 Next 页面作为主实现。

## Product And Scope

| Scope | Decision |
|---|---|
| Current scope | iPhone 原生英语学习浏览器：首页快捷入口、WKWebView 浏览、网页双语翻译、显示模式切换、点词点句解释、收藏、复习、学习历史、Provider 设置、隐私清理。 |
| Future scope | Android App、macOS App、Windows App、可选轻量后端代理、可选账号同步、可选深色模式、更多站点适配。 |
| Current delivery target | iOS App，通过 TestFlight 自用验证，随后按 App Store 审核要求整理。 |
| Explicit non-goals | 不做旧版 English Monster Quest；不做 RPG、装备、地图、Boss；不做课程 App、考试训练、背单词表；不做 YouTube 替代客户端；不做视频下载、去广告、后台播放、音视频分离；不做无字幕视频实时转写；不做首版云同步；不做浏览器插件。 |

## Platform And Runtime Matrix

| Target | Status | Runtime / Shell | Reuse Strategy |
|---|---|---|---|
| iPhone | current | SwiftUI App + WKWebView + SwiftData + Keychain + Swift Package 模块 | 当前唯一交付平台；复用 `browser-agent` JS bundle、`contracts` 协议、学习数据模型命名。 |
| Android | future | Kotlin / Jetpack Compose + Android WebView | 重写平台壳、本地存储和系统权限；复用 `browser-agent`、协议 schema、Provider 行为约束。 |
| macOS | future | SwiftUI App + WKWebView | 优先复用 iOS 的 Swift 无 UI 模块和 `browser-agent`；重写窗口、菜单、快捷键和桌面导航。 |
| Windows | future | WinUI / WebView2 或等价原生壳 | 重写平台壳和本地存储；复用 `browser-agent`、协议 schema、Provider 行为约束。 |
| Backend service | future optional | 轻量 API 服务 | 仅在需要额度控制、统一 Provider 代理、账号同步或跨设备复习时引入。 |
| Web extension | non-goal | Browser extension runtime | 当前产品定位是移动端 App，不做全平台浏览器插件。 |
| Next.js web app | non-goal | Next.js runtime | 旧游戏实现遗留，不作为新产品入口；根部 Node 工具链只服务共享脚本构建和文档工具。 |

## Ecosystem Convention

| Concern | Decision |
|---|---|
| Language / framework convention | iOS 使用 Swift、SwiftUI、WebKit、SwiftData、Keychain；网页注入脚本使用 TypeScript；共享协议以 JSON schema / TypeScript 类型为事实源，Swift 侧实现等价 DTO。 |
| Package / module convention | 根目录使用 pnpm workspace 管理 `packages/browser-agent` 和 `packages/contracts`；iOS 工程放在 `apps/ios`，Swift 无 UI 模块放入 iOS 工程内的 Swift Package。 |
| Build / run convention | iOS 通过 Xcode 构建；`browser-agent` 通过 pnpm 构建成无运行时依赖的可注入 JS bundle；首版不通过 Next dev server 运行产品。 |
| Documentation convention | 产品、设计、架构和项目结构文档放根目录；架构决策记录放 `docs/adr/`；外部政策和平台限制记录在架构文档或 ADR。 |

## Architecture Principle

平台壳只负责用户体验、系统能力和 WebView 容器，网页注入脚本只负责 DOM 识别与翻译层渲染，学习业务规则和数据协议不能散落在页面脚本或单个 SwiftUI View 中。

## Layer Boundaries

| Layer | Owns | Does Not Own |
|---|---|---|
| Entry layer / runtime container | `apps/ios` 的 App 生命周期、SwiftUI 导航、Tab、网页浏览页、工具条、底部抽屉、设置页、WKWebView 配置、系统权限。 | 不拥有翻译 Provider 具体协议、不直接写 DOM 解析规则、不把复习调度规则写进 View。 |
| Native core modules | 收藏、历史、复习队列、复习反馈、显示模式状态、Provider 选择、错误状态、隐私清理策略、SwiftData repository 接口。 | 不拥有网页 DOM 节点查找、不保存 Provider 密钥明文、不包含 YouTube 播放器修改逻辑。 |
| Shared contracts | Native 与 JS bridge 事件、页面文本段、翻译请求、翻译结果、选区上下文、收藏项、复习卡、错误码、站点能力声明。 | 不拥有 UI 组件、不直接调用 Provider、不直接写本地数据库。 |
| Browser agent | DOM 文本识别、稳定节点 id、翻译层插入、学习模式折叠、选词选句事件、站点适配、页面变更监听。 | 不持久化学习数据、不存储 API Key、不绕过站点权限、不修改播放器核心能力、不下载媒体。 |
| Local data layer | SwiftData model、migration、repository implementation、收藏、历史、复习状态、翻译缓存、Provider 配置元数据、数据清理操作；敏感凭证进入 Keychain。 | 不决定 UI 导航、不直接读取 DOM、不把完整浏览历史上传到远端、不管理第三方网页内部 cookie。 |
| External service adapters | 翻译 Provider、AI Provider、网络请求、重试、速率限制、错误映射、文本分块。 | 不拥有页面渲染、不决定收藏结构、不隐藏第三方发送提示。 |

## Runtime And Integration Boundary

| Concern | Boundary |
|---|---|
| Runtime container | iOS 首版使用 WKWebView；通过 `WKUserScript` 注入已打包的 `browser-agent`；通过 `WKScriptMessageHandler` 接收页面文本、选区和状态事件；第三方网站会话数据由 WebKit website data store 承载。 |
| Input boundary | 用户输入 URL 或搜索词；WebView 页面脚本提取可见文本段；用户点词、选句、收藏和切换显示模式产生交互事件。 |
| Output boundary | 翻译结果由 native 层调用 Provider 后返回给 `browser-agent`，脚本把中文插入原文附近；点词解释用原生底部抽屉展示。 |
| Interaction / integration bridge | Bridge 只传结构化 JSON 消息，必须带 `eventType`、`schemaVersion`、`requestId`、`pageId`、`segmentId` 或 `selectionId`；native 侧按白名单和 schema 版本处理事件。 |
| Error fallback | 页面结构不可识别时允许选区翻译；Provider 未配置时引导设置；YouTube 字幕不可访问时只提示字幕失败，不影响页面文字翻译。 |

## Shared Contracts

`packages/contracts` 是 bridge payload 与学习数据命名的事实源。Swift 侧 DTO / decoder 必须与 TypeScript contract 字段等价；每个新增或扩展的 cross-boundary payload 都要有可执行的 contract fixture 或 decoder 测试，至少覆盖字段存在性、字段命名、schema version 和失败分支。Phase 4 引入的 `PageContext`、`PageTextSegment`、`TranslationRequest`、`TranslationResult` 必须在 TypeScript tests 与 Swift `AgentEnglishTests` 中同时验证 `pageId`、`segmentId`、`sourceLanguage`、`targetLanguage`、`displayMode`、`failureReason`、`capabilities` 等跨端字段，不能只验证事件名或 envelope 外壳。

| Contract | Purpose |
|---|---|
| `PageContext` | 表示当前页面 URL、标题、站点类型、语言推断和可用能力。 |
| `PageTextSegment` | 表示 DOM 中可翻译的文本段，包含稳定 id、原文、上下文路径、可见性和站点来源。 |
| `TranslationRequest` | 表示发送给 Provider 的分块请求，包含源语言、目标语言、模式、文本段数组和隐私提示状态。 |
| `TranslationResult` | 表示 Provider 返回的翻译结果，必须能映射回 `segmentId`，并携带失败原因。 |
| `SelectionContext` | 表示用户点词、短语或选句时的原文、前后文、页面来源和 DOM 位置。 |
| `SavedItem` | 表示收藏的词、短语或句子，包含来源 URL、页面标题、上下文、翻译、解释和创建时间。 |
| `ReviewCard` | 表示主动回忆卡片，包含问题面、答案面、来源、复习状态和反馈。 |
| `ProviderProfile` | 表示 Provider 类型、能力、模型显示名、是否需要用户 API Key、是否支持流式返回和速率限制。 |
| `BridgeEvent` | 表示 native 与 injected script 之间的消息 envelope，用于统一错误处理和版本兼容。 |
| `SiteCapability` | 表示站点适配能力，例如普通文本、评论区、搜索结果、可访问字幕、动态内容刷新。 |
| `PrivacyDisclosure` | 表示向用户展示的 Provider 数据发送范围、缓存策略、清理入口和 website data 清理提示。 |

## Data And Privacy

| Data | Storage | Privacy Rule |
|---|---|---|
| Provider credentials | iOS Keychain | 不写入 SwiftData、日志、导出文件或 JS 注入脚本。 |
| Favorites and review state | SwiftData，首版随 App 本机保存 | 默认不上传；用户可删除单条、按站点删除或全部清空。 |
| Browsing history | SwiftData，可按站点清理 | 不默认上传完整历史；只用于继续学习和历史页。 |
| Translation cache | SwiftData 或本地文件缓存，按页面和文本 hash 关联 | 仅用于减少重复请求；用户可清除；不作为永久学习资产。 |
| Website cookies / localStorage | WKWebView website data store | 与学习数据清理分开提示；清理网站数据可能导致站点登出。 |
| Page text sent to Provider | 外部 Provider 请求体 | 只有用户触发翻译或解释时发送；设置页必须说明当前 Provider 会收到页面文本。 |
| Analytics / usage metrics | 首版本地统计 | 只记录翻译页数、收藏数、复习数、连续使用天数；不采集第三方网页内容。 |

## External Policy Constraints

| Source | Architecture Constraint |
|---|---|
| Apple App Review Guidelines | App 不能只是网页链接集合或 WebView 套壳；首版必须把原生收藏、复习、隐私设置、历史、统计和学习解释作为核心能力。 |
| Apple SwiftData documentation | SwiftData 可作为 SwiftUI 原生持久化层；本项目把它限定为 iOS 17+ 的非敏感学习数据存储。 |
| Apple WebKit `WKUserScript` documentation | 页面脚本注入必须通过 WebKit 机制管理，脚本生命周期和消息桥接要由 native 容器控制。 |
| YouTube API Services Developer Policies | 不修改、屏蔽或替代 YouTube 播放器能力；不下载、分离或绕过音视频内容；首版只做页面文字和可访问字幕的保守学习增强。 |

## Risk Register

| Risk | Impact | Constraint |
|---|---|---|
| Runtime compatibility | iOS WKWebView、Android WebView、Windows WebView2 的注入时机和 DOM 行为不同 | `browser-agent` 必须有 bridge 版本号、站点能力声明和 fixture 测试；平台壳不能假设注入一定早于页面脚本。 |
| SwiftData minimum OS | SwiftData 把首版默认最低系统版本推到 iOS 17+ | 如果产品要求覆盖 iOS 16 或更早版本，必须新增 ADR 改为 Core Data 或 SQLite 方案。 |
| Third-party site changes | YouTube、Reddit、X 等页面结构频繁变化，可能导致文本识别失效 | 站点适配必须隔离在 `packages/browser-agent/src/site-adapters`，失败时回退到通用文本识别或选区翻译。 |
| Publish / review constraints | App Store 可能拒绝纯 WebView、链接集合或无足够原生功能的应用 | 首个实现 tranche 必须在 DEV-PLAN Phase 1-3 内完成 contracts / browser-agent、原生 Tab 壳、SwiftData / Keychain、本地学习闭环、WKWebView 进入流、BridgeEvent native decode 和 website data 提示；不能只做站点入口和网页翻译按钮。 |
| YouTube policy risk | 过度控制播放器、字幕下载、后台播放或去广告会带来合规风险 | 当前不做播放器替代、不下载字幕文件、不修改广告或播放行为。 |
| Provider privacy risk | 页面文本可能包含用户敏感内容，发送给第三方 Provider 有隐私压力 | Provider 发送前必须有设置页说明；用户可关闭缓存和清理数据；凭证只进 Keychain。 |
| Future environment differences | 多平台 UI、存储和权限差异会增加维护成本 | 未来平台只承诺复用 contracts 和 browser-agent；平台壳与本地存储按平台重写。 |

## Development Planning Input

- `DEV-PLAN.md` 必须以 `apps/ios` 作为首版产品入口，不再规划旧 `src/app` Next 页面。
- DEV-PLAN Phase 1-3 共同构成首个实现 tranche：Phase 1 建立 workspace、`packages/contracts`、`packages/browser-agent` 最小包；Phase 2 建立 iOS 原生 Tab 壳、SwiftData / Keychain 本地学习底座；Phase 3 建立 WKWebView 进入流、BridgeEvent native decode 和 website data 提示。三者完成前不能进入站点功能堆叠。
- 所有 WebView 与 JS 通讯都必须经过 `BridgeEvent` envelope，禁止 SwiftUI View 直接拼接临时 JavaScript 字符串处理业务。
- 翻译 Provider 和 AI Provider 通过 native adapter 调用；`browser-agent` 不能持有 API Key 或直接请求第三方 AI。
- 收藏、复习、历史、隐私清理是 App Store 最低原生价值边界；开发计划不能把它们推迟到不可验证的后续阶段。
- Android、macOS、Windows 目录不在首版实现中创建完整工程；只在文档和 contracts 中保留接入边界。
- 旧游戏资源、旧 `src/` API、旧数据库迁移、旧 Next 页面属于清理对象；不得作为新产品功能复用。

## References

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple SwiftData: https://developer.apple.com/documentation/SwiftData
- Apple WebKit `WKUserScript`: https://developer.apple.com/documentation/webkit/wkuserscript
- Apple WebKit `WKUserContentController.addUserScript`: https://developer.apple.com/documentation/webkit/wkusercontentcontroller/adduserscript%28_%3A%29
- YouTube API Services Developer Policies: https://developers.google.com/youtube/terms/developer-policies
