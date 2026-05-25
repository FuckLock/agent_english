# Architecture - iPhone 英语学习浏览器

## Purpose

本文档确定新产品的开发前架构边界：首版做 iPhone 原生 App + 轻量模型服务后端，用 SwiftUI + WKWebView 承载真实网页浏览和学习工具，用 SwiftData 保存非敏感学习数据，由后端统一创建游客会话、校验登录身份、管理 Free / Pro / Max entitlement、保存 Provider 密钥、维护模型目录并路由模型服务；未来 Android、macOS、Windows 通过新的平台壳接入同一套网页注入协议、学习数据模型和模型服务 API。架构目标不是提前做全平台，而是让第一版 iOS 可交付，同时避免把翻译、收藏、复习、网页注入逻辑、账号权益或模型厂商配置写死在单个界面里。

## Input Sources And Assumptions

| Type | Source | How It Was Used |
|---|---|---|
| Requirements | `Product-Spec.md` v2.2 | 作为产品范围、MVP 功能、非目标、技术方向和隐私边界的事实源；v2.2 明确取消用户自定义 Provider / BYOK，改为后台模型目录、游客 Free 会话、可选登录、dev/staging Pro / Max 测试账号和后端权益判定。 |
| Design | `Design-Brief.md`、`design_export/clean_pencil/`、`design_export/5mGHS.png` / `bCKWH.png` / `uTNzx.png` 等 v2.2 状态稿 | 作为 iPhone 首页、网页浏览页、翻译层、点词抽屉、收藏、复习、设置的信息架构和视觉约束；v2.2 补充账号状态、登录入口、测试账号和模型服务错误态。 |
| Existing code | 当前仓库根目录、`package.json`、已删除的旧 `src/` 游戏代码状态 | 判断当前处于重大重定义后新项目状态；旧 Next 游戏实现不再作为产品入口。 |
| Constraints | 用户明确说明：首版苹果手机端，后续 Android、macOS、Windows；2026-05-20 复核的 Apple App Review Guidelines、Apple SwiftData / WebKit 文档、YouTube API Services Developer Policies；2026-05-22 补充 Apple 登录服务规则与 Google Sign-In 后端校验约束 | 用于确定平台矩阵、审核风险、持久化边界、WebView 注入边界、账号登录边界和 YouTube 保守支持边界。 |

## Architecture Assumptions

- 首版以 iOS 原生 App 为唯一运行交付，不同时开发 Android、macOS、Windows。
- 首版最低系统版本按 iOS 17+ 处理，以便使用 SwiftData；如后续必须支持更低 iOS 版本，需要新增 ADR 评估 Core Data 或 SQLite/GRDB 替换方案。
- 首版以 TestFlight 为验证目标，稳定后再进入 App Store 审核收口。
- 首版建立轻量模型服务后端；后端同时负责游客会话、可选登录会话、Free / Pro / Max entitlement、额度、模型目录和 Provider 路由；不建立学习数据云同步，具体支付系统不进入当前架构决策。
- 首次启动创建或恢复匿名游客会话，游客默认 Free；公开登录为可选能力，iOS 公开版本如果提供 Google 登录，必须并列提供 Sign in with Apple 或等价隐私登录选项。
- dev/staging 可通过 `ENABLE_DEV_AUTH=true` 启用 Pro / Max 测试账号；生产环境不得显示测试登录入口，也不得接受测试账号登录接口。
- 收藏、历史、复习、翻译缓存等非敏感学习数据使用 SwiftData；App 不保存第三方 Provider 凭证或固定生产等级 token；Keychain 只允许保存后端签发的 App session token、匿名设备令牌或服务访问令牌；第三方网页 cookie、localStorage、sessionStorage 归 WKWebView 的 website data store 管理。
- 页面文本只在用户触发翻译或解释时发送到自有模型服务后端；后端按 session entitlement、模型目录和 fallback 策略转发给对应第三方 Provider，不能信任客户端请求体中的服务等级。
- 网页文本识别、DOM 节点标记、翻译层插入和站点适配通过可打包的 TypeScript `browser-agent` 注入脚本承载，iOS App 通过 WKWebView 加载该脚本。
- 未来 Android WebView、macOS WKWebView、Windows WebView2 优先复用 `browser-agent` 和 `contracts`，各平台 UI 壳、系统权限、本地存储可以重写。
- 当前仓库保留的 Next、React、Drizzle、better-sqlite3 依赖属于旧方向遗留；新产品入口不继续使用 `src/app` 或 Next 页面作为主实现。模型服务后端应作为新的服务目录创建，不能复活旧游戏 API 作为 Provider 路由层。

## Product And Scope

| Scope | Decision |
|---|---|
| Current scope | iPhone 原生英语学习浏览器 + 轻量模型服务后端：首页快捷入口、WKWebView 浏览、网页双语翻译、显示模式切换、点词点句解释、收藏、复习、学习历史、账号状态、游客 Free 会话、dev/staging Pro / Max 测试账号、服务等级 / 模型档位展示、隐私清理、后台模型目录、Provider 密钥托管、额度与 fallback。 |
| Future scope | Android App、macOS App、Windows App、正式账号恢复、订阅支付、云同步学习数据、深色模式、更多站点适配、更完整的模型运营后台。 |
| Current delivery target | iOS App，通过 TestFlight 自用验证，随后按 App Store 审核要求整理。 |
| Explicit non-goals | 不做旧版 English Monster Quest；不做 RPG、装备、地图、Boss；不做课程 App、考试训练、背单词表；不做 YouTube 替代客户端；不做视频下载、去广告、后台播放、音视频分离；不做无字幕视频实时转写；不做首版学习数据云同步；不做生产环境测试账号；不做 Google-only iOS 公开登录；不做浏览器插件；不做用户自定义 Provider、API Key、Base URL、模型名或 BYOK。 |

## Platform And Runtime Matrix

| Target | Status | Runtime / Shell | Reuse Strategy |
|---|---|---|---|
| iPhone | current | SwiftUI App + WKWebView + SwiftData + Keychain + Swift Package 模块 | 当前唯一客户端交付平台；复用 `browser-agent` JS bundle、`contracts` 协议、学习数据模型命名和模型服务 API。 |
| Backend service | current | 轻量模型服务 API | 托管游客 / 登录 session、entitlement、Provider 密钥、模型目录、Free / Pro / Max 等级、额度、用量、fallback 和第三方 Provider 调用；App 不直连模型厂商，也不自己判定用户等级。 |
| Android | future | Kotlin / Jetpack Compose + Android WebView | 重写平台壳、本地存储和系统权限；复用 `browser-agent`、协议 schema、模型服务 API 和学习数据命名。 |
| macOS | future | SwiftUI App + WKWebView | 优先复用 iOS 的 Swift 无 UI 模块和 `browser-agent`；重写窗口、菜单、快捷键和桌面导航。 |
| Windows | future | WinUI / WebView2 或等价原生壳 | 重写平台壳和本地存储；复用 `browser-agent`、协议 schema、模型服务 API。 |
| Web extension | non-goal | Browser extension runtime | 当前产品定位是移动端 App，不做全平台浏览器插件。 |
| Next.js web app | non-goal | Next.js runtime | 旧游戏实现遗留，不作为新产品入口；根部 Node 工具链只服务共享脚本构建和文档工具。 |

## Ecosystem Convention

| Concern | Decision |
|---|---|
| Language / framework convention | iOS 使用 Swift、SwiftUI、WebKit、SwiftData、Keychain；网页注入脚本使用 TypeScript；模型服务后端使用 TypeScript / Node.js；共享协议以 JSON schema / TypeScript 类型为事实源，Swift 侧实现等价 DTO。 |
| Package / module convention | 根目录使用 pnpm workspace 管理 `packages/browser-agent`、`packages/contracts` 和 `services/model-gateway`；iOS 工程放在 `apps/ios`，Swift 无 UI 模块放入 iOS 工程内的 Swift Package。 |
| Build / run convention | iOS 通过 Xcode 构建；`browser-agent` 通过 pnpm 构建成无运行时依赖的可注入 JS bundle；模型服务通过独立 Node service 运行；首版不通过 Next dev server 运行产品。 |
| Documentation convention | 产品、设计、架构和项目结构文档放根目录；架构决策记录放 `docs/adr/`；外部政策和平台限制记录在架构文档或 ADR。 |

## Architecture Principle

平台壳只负责用户体验、系统能力和 WebView 容器，网页注入脚本只负责 DOM 识别与翻译层渲染，模型服务后端只负责 session、entitlement、模型目录、密钥托管、额度和 Provider 路由；学习业务规则、数据协议和服务等级策略不能散落在页面脚本或单个 SwiftUI View 中。

## Layer Boundaries

| Layer | Owns | Does Not Own |
|---|---|---|
| Entry layer / runtime container | `apps/ios` 的 App 生命周期、SwiftUI 导航、Tab、网页浏览页、工具条、底部抽屉、设置页、登录 sheet、账号状态展示、WKWebView 配置、系统权限。 | 不拥有翻译 Provider 具体协议、不直接写 DOM 解析规则、不把复习调度规则写进 View、不展示 API Key 输入、不让用户手动指定真实服务等级。 |
| Native core modules | 收藏、历史、复习队列、复习反馈、显示模式状态、账号 / session 状态、服务等级快照、模型偏好、错误状态、隐私清理策略、SwiftData repository 接口、Keychain session token 存取、模型服务客户端。 | 不拥有网页 DOM 节点查找、不保存 Provider 密钥明文、不包含 YouTube 播放器修改逻辑、不直接调用模型厂商 API、不把客户端等级当作授权依据。 |
| Shared contracts | Native 与 JS bridge 事件、页面文本段、翻译请求、翻译结果、选区上下文、收藏项、复习卡、错误码、站点能力声明、AuthSession、AccountStatus、EntitlementSnapshot、模型目录、服务等级、额度状态。 | 不拥有 UI 组件、不直接调用 Provider、不直接写本地数据库或后端密钥。 |
| Browser agent | DOM 文本识别、稳定节点 id、翻译层插入、学习模式折叠、选词选句事件、站点适配、页面变更监听。 | 不持久化学习数据、不存储 API Key、不绕过站点权限、不修改播放器核心能力、不下载媒体。 |
| Local data layer | SwiftData model、migration、repository implementation、收藏、历史、复习状态、翻译缓存、服务等级快照、模型偏好、数据清理操作；App session token 只进入 Keychain。 | 不决定 UI 导航、不直接读取 DOM、不把完整浏览历史上传到远端、不管理第三方网页内部 cookie、不保存 Provider 密钥或固定生产等级 token。 |
| Model gateway service | 游客会话、登录会话、dev/staging 测试账号、Free / Pro / Max entitlement、模型目录、Provider 密钥、额度、用量、fallback、第三方 Provider 请求、错误映射、文本分块和成本控制。 | 不拥有 WebView 页面渲染、不保存完整浏览历史、不替 App 持久化收藏 / 复习学习数据、不暴露 Provider 密钥给客户端、不接受客户端自报服务等级作为授权。 |
| External provider adapters | 后端内部的翻译 API / LLM Provider adapter、网络请求、重试、速率限制、错误归一。 | 不拥有页面渲染、不决定收藏结构、不直接被 iOS App 调用。 |

## Runtime And Integration Boundary

| Concern | Boundary |
|---|---|
| Runtime container | iOS 首版使用 WKWebView；通过 `WKUserScript` 注入已打包的 `browser-agent`；通过 `WKScriptMessageHandler` 接收页面文本、选区和状态事件；第三方网站会话数据由 WebKit website data store 承载。 |
| Session bootstrap | App 启动后由 native core 创建或恢复后端 session；无登录时使用游客 Free session；登录成功或退出登录后刷新 Keychain session token、entitlement snapshot 和模型目录。 |
| Input boundary | 用户输入 URL 或搜索词；WebView 页面脚本提取可见文本段；用户点词、选句、收藏和切换显示模式产生交互事件。 |
| Output boundary | 翻译结果由 native 层调用模型服务后返回给 `browser-agent`，脚本把中文插入原文附近；点词解释用原生底部抽屉展示。 |
| Interaction / integration bridge | Bridge 只传结构化 JSON 消息，必须带 `eventType`、`schemaVersion`、`requestId`、`pageId`、`segmentId` 或 `selectionId`；native 侧按白名单和 schema 版本处理事件。 |
| Error fallback | 页面结构不可识别时允许选区翻译；模型服务不可用、额度不足或当前等级不可用时给出明确提示；YouTube 字幕不可访问时只提示字幕失败，不影响页面文字翻译。 |

## Shared Contracts

`packages/contracts` 是 bridge payload 与学习数据命名的事实源。Swift 侧 DTO / decoder 必须与 TypeScript contract 字段等价；每个新增或扩展的 cross-boundary payload 都要有可执行的 contract fixture 或 decoder 测试，至少覆盖字段存在性、字段命名、schema version 和失败分支。Phase 4 引入的 `PageContext`、`PageTextSegment`、`TranslationRequest`、`TranslationResult` 必须在 TypeScript tests 与 Swift `AgentEnglishTests` 中同时验证 `pageId`、`segmentId`、`sourceLanguage`、`targetLanguage`、`displayMode`、`failureReason`、`capabilities` 等跨端字段，不能只验证事件名或 envelope 外壳。

| Contract | Purpose |
|---|---|
| `PageContext` | 表示当前页面 URL、标题、站点类型、语言推断和可用能力。 |
| `PageTextSegment` | 表示 DOM 中可翻译的文本段，包含稳定 id、原文、上下文路径、可见性和站点来源。 |
| `AuthSession` | 表示后端签发的 session、过期时间、账号类型和可刷新状态；生产 token 只保存在 Keychain，不进入 SwiftData 或 JS。 |
| `AccountStatus` | 表示游客、正式登录、dev/staging Pro 测试账号、dev/staging Max 测试账号等用户可见账号状态。 |
| `EntitlementSnapshot` | 表示当前后端判定的 Free / Pro / Max 等级、额度、可用模型档位和刷新时间；客户端只能展示和缓存，不作为授权事实源。 |
| `TranslationRequest` | 表示发送给模型服务的分块请求，包含源语言、目标语言、模式、文本段数组、模型偏好和隐私提示状态；服务等级由后端 session entitlement 判定，不能由客户端请求体决定。 |
| `TranslationResult` | 表示模型服务返回的翻译结果，必须能映射回 `segmentId`，并携带失败原因、模型等级和可展示的模型名称。 |
| `SelectionContext` | 表示用户点词、短语或选句时的原文、前后文、页面来源和 DOM 位置。 |
| `SavedItem` | 表示收藏的词、短语或句子，包含来源 URL、页面标题、上下文、翻译、解释和创建时间。 |
| `ReviewCard` | 表示主动回忆卡片，包含问题面、答案面、来源、复习状态和反馈。 |
| `ModelCatalog` | 表示后台下发的 Free / Pro / Max 等级、可用模型显示名、能力、状态、额度和 fallback 信息；不包含 Provider 密钥、Base URL 或内部路由细节。 |
| `BridgeEvent` | 表示 native 与 injected script 之间的消息 envelope，用于统一错误处理和版本兼容。 |
| `SiteCapability` | 表示站点适配能力，例如普通文本、评论区、搜索结果、可访问字幕、动态内容刷新。 |
| `PrivacyDisclosure` | 表示向用户展示的模型服务数据发送范围、后端转发说明、缓存策略、清理入口和 website data 清理提示。 |

## Data And Privacy

| Data | Storage | Privacy Rule |
|---|---|---|
| App session token / anonymous device token | iOS Keychain | 只用于访问自有模型服务；不写入 SwiftData、日志、导出文件或 JS 注入脚本。 |
| Account identity | 后端数据库；iOS 只缓存展示所需状态 | 正式登录身份必须由后端验证 Apple / Google identity token 后创建；iOS 不把普通 user id 当作可信身份。 |
| Dev / staging test account seeds | 后端 dev/staging 环境变量或本地 seed | `ENABLE_DEV_AUTH=true` 时才启用；生产环境不得保存、展示或接受测试账号。 |
| Provider credentials | 后端密钥管理环境 | 不进入 App bundle、SwiftData、Keychain、日志、导出文件或 JS 注入脚本。 |
| Favorites and review state | SwiftData，首版随 App 本机保存 | 默认不上传；用户可删除单条、按站点删除或全部清空。 |
| Browsing history | SwiftData，可按站点清理 | 不默认上传完整历史；只用于继续学习和历史页。 |
| Translation cache | SwiftData 或本地文件缓存，按页面和文本 hash 关联 | 仅用于减少重复请求；用户可清除；不作为永久学习资产。 |
| Website cookies / localStorage | WKWebView website data store | 与学习数据清理分开提示；清理网站数据可能导致站点登出。 |
| Page text sent to model gateway | 自有后端请求体 | 只有用户触发翻译或解释时发送；设置页必须说明文本会发送到自有后端并可能由后端转发给当前等级对应的第三方模型或翻译服务。 |
| Model catalog / entitlement snapshot | 后端下发 + SwiftData 可缓存 | 只保存展示所需的账号状态、等级、模型显示名、可用状态和额度状态；不保存 Provider 内部密钥、Base URL、成本信息或授权 token。 |
| Analytics / usage metrics | 首版本地统计 | 只记录翻译页数、收藏数、复习数、连续使用天数；不采集第三方网页内容。 |

## External Policy Constraints

| Source | Architecture Constraint |
|---|---|
| Apple App Review Guidelines | App 不能只是网页链接集合或 WebView 套壳；首版必须把原生收藏、复习、隐私设置、历史、统计和学习解释作为核心能力。公开版本如提供第三方 / 社交登录，需提供等价隐私登录选项；账号创建后也要预留 App 内删除账号路径。 |
| Apple SwiftData documentation | SwiftData 可作为 SwiftUI 原生持久化层；本项目把它限定为 iOS 17+ 的非敏感学习数据存储。 |
| Apple WebKit `WKUserScript` documentation | 页面脚本注入必须通过 WebKit 机制管理，脚本生命周期和消息桥接要由 native 容器控制。 |
| Google Sign-In for iOS backend auth | Google 登录只能把 ID token 交给后端验证；后端不能信任客户端传来的普通 user id 或未验证 profile。 |
| YouTube API Services Developer Policies | 不修改、屏蔽或替代 YouTube 播放器能力；不下载、分离或绕过音视频内容；首版只做页面文字和可访问字幕的保守学习增强。 |

## Risk Register

| Risk | Impact | Constraint |
|---|---|---|
| Runtime compatibility | iOS WKWebView、Android WebView、Windows WebView2 的注入时机和 DOM 行为不同 | `browser-agent` 必须有 bridge 版本号、站点能力声明和 fixture 测试；平台壳不能假设注入一定早于页面脚本。 |
| SwiftData minimum OS | SwiftData 把首版默认最低系统版本推到 iOS 17+ | 如果产品要求覆盖 iOS 16 或更早版本，必须新增 ADR 改为 Core Data 或 SQLite 方案。 |
| Third-party site changes | YouTube、Reddit、X 等页面结构频繁变化，可能导致文本识别失效 | 站点适配必须隔离在 `packages/browser-agent/src/site-adapters`，失败时回退到通用文本识别或选区翻译。 |
| Publish / review constraints | App Store 可能拒绝纯 WebView、链接集合或无足够原生功能的应用 | 首个实现 tranche 必须在 DEV-PLAN Phase 1-3 内完成 contracts / browser-agent、原生 Tab 壳、SwiftData / Keychain、本地学习闭环、WKWebView 进入流、BridgeEvent native decode 和 website data 提示；不能只做站点入口和网页翻译按钮。 |
| YouTube policy risk | 过度控制播放器、字幕下载、后台播放或去广告会带来合规风险 | 当前不做播放器替代、不下载字幕文件、不修改广告或播放行为。 |
| Backend cost and abuse risk | Free / Pro / Max 模型调用会产生直接成本，公开服务可能被滥用 | 模型服务必须有额度、速率限制、缓存、错误归一和服务等级检查；Free 层不能无限调用高成本模型。 |
| Provider secret leakage risk | 如果第三方 Provider 密钥进入 App，密钥会被提取并滥用 | Provider 密钥只能存在后端密钥管理环境；iOS App 不允许出现 API Key、Base URL 或 BYOK 输入。 |
| Fixed token abuse risk | 如果把固定 Free / Pro / Max token 写入 App 包，token 会被提取并绕过套餐 | 生产 App 只能保存后端签发的可撤销 session token；后端以 session entitlement 为授权事实源。 |
| Dev auth leakage risk | Pro / Max 测试账号若进入生产，会直接绕过真实权益系统 | 测试账号和密码登录接口必须由 `ENABLE_DEV_AUTH` 和部署环境双重限制；生产构建隐藏 UI 并拒绝接口。 |
| Login compliance risk | iOS 公开版本若只提供 Google 登录，可能触发审核和隐私预期风险 | 登录设计优先 Sign in with Apple；Google 只能并列提供；账号删除入口随正式账号创建一并实现。 |
| Model service privacy risk | 页面文本可能包含用户敏感内容，发送到自有后端并转发给第三方 Provider 有隐私压力 | 发送前必须有设置页说明；用户可关闭缓存和清理数据；后端不能保存完整浏览历史。 |
| Future environment differences | 多平台 UI、存储和权限差异会增加维护成本 | 未来平台只承诺复用 contracts 和 browser-agent；平台壳与本地存储按平台重写。 |

## Development Planning Input

- `DEV-PLAN.md` 必须以 `apps/ios` 作为首版客户端入口，以 `services/model-gateway` 作为模型服务入口，不再规划旧 `src/app` Next 页面。
- DEV-PLAN Phase 1-3 共同构成首个实现 tranche：Phase 1 建立 workspace、`packages/contracts`、`packages/browser-agent` 最小包；Phase 2 建立 iOS 原生 Tab 壳、SwiftData / Keychain 本地学习底座；Phase 3 建立 WKWebView 进入流、BridgeEvent native decode 和 website data 提示。三者完成前不能进入站点功能堆叠。
- DEV-PLAN 必须在 Phase 6 后、Phase 7 前插入账号会话与权益 Phase，先完成游客 Free session、后端 entitlement、dev/staging Pro / Max 测试账号和设置页账号状态，再继续历史 / 复习 / 隐私扩展。
- 所有 WebView 与 JS 通讯都必须经过 `BridgeEvent` envelope，禁止 SwiftUI View 直接拼接临时 JavaScript 字符串处理业务。
- 翻译和解释请求通过 native 模型服务客户端调用自有后端；`browser-agent` 和 iOS App 都不能持有 API Key 或直接请求第三方 AI。
- 模型目录、翻译和解释接口必须使用后端 session entitlement 授权；客户端传入的 `serviceTier` 只能用于展示偏好或兼容旧数据，不能作为后端授权输入。
- 收藏、复习、历史、隐私清理是 App Store 最低原生价值边界；开发计划不能把它们推迟到不可验证的后续阶段。
- Android、macOS、Windows 目录不在首版实现中创建完整工程；只在文档和 contracts 中保留接入边界。
- 旧游戏资源、旧 `src/` API、旧数据库迁移、旧 Next 页面属于清理对象；不得作为新产品功能复用。

## References

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple SwiftData: https://developer.apple.com/documentation/SwiftData
- Apple WebKit `WKUserScript`: https://developer.apple.com/documentation/webkit/wkuserscript
- Apple WebKit `WKUserContentController.addUserScript`: https://developer.apple.com/documentation/webkit/wkusercontentcontroller/adduserscript%28_%3A%29
- Google Sign-In for iOS backend auth: https://developers.google.com/identity/sign-in/ios/backend-auth
- YouTube API Services Developer Policies: https://developers.google.com/youtube/terms/developer-policies
- ADR-0002 Backend-Managed Model Service: docs/adr/ADR-0002-backend-managed-model-service.md
- ADR-0003 Auth Session And Entitlement Foundation: docs/adr/ADR-0003-auth-session-entitlement.md
