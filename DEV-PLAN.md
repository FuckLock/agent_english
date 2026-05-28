# Development Plan — iPhone 英语学习浏览器

> 本文件记录项目的开发阶段划分、当前进度和剩余工作。
> 新 session 启动时应首先阅读此文件，了解项目状态后再继续开发。

**基于信息**：
- 源 Spec：Product-Spec.md v2.8
- 源架构：ARCHITECTURE.md / PROJECT-STRUCTURE.md / docs/adr/ADR-0001-architecture-strategy.md / docs/adr/ADR-0002-backend-managed-model-service.md / docs/adr/ADR-0003-auth-session-entitlement.md / docs/adr/ADR-0004-youtube-video-immersive-translation.md（v2.5 修订：隐形态 / 召唤态；v2.6 修订：YouTube 整站重定位 + SPA 友好注入；v2.8 修订：视频字幕来源从渲染 DOM 改为视频自带字幕轨数据 / player response / timedtext，按播放进度同步）/ docs/adr/ADR-0005-tiered-translation-proxy.md（翻译分层 + Free 轻量翻译代理解耦；v2.7 修订：Free 翻译 provider 从第三方通用翻译改为产品方服务端配置的便宜大模型 / OpenAI 兼容 Chat Completions）
- 源设计：Design-Brief.md v2.5 + design_export/clean_pencil/ + v2.2 账号 / 登录 / 模型服务错误状态 PNG（`5mGHS.png`、`bCKWH.png`、`uTNzx.png` 等）；v2.3 YouTube 视频沉浸翻译设计稿已补；v2.4 听音翻译 Beta 状态稿已补（`iajll.png`、`f154K.png`、`NtBkp.png`、`3YlLm.png`、`iI4Cp.png`）；v2.5 YouTube 隐形态稿已出（`design_export/tTNH1.png`），召唤把手 / 胶囊菜单可视稿因 Pencil absolute 浮层渲染限制未出，规范以 Design-Brief v2.5「召唤入口」「状态变体」文字块为准；v2.6 YouTube 整站重定位为交互 / 注入修正，沿用 v2.5 视频页隐形态 / 召唤态视觉，未引入新视觉稿；v2.7 仅替换 translation-proxy 内部 provider 实现（服务端后端变更），用户无感、界面仍只显示 free translation，未引入新视觉稿
- 生成日期：2026-05-19（v2.5 修订：2026-05-25；v2.6 修订：2026-05-25；v2.7 修订：2026-05-26）
- 覆盖 Spec 功能：v2.8 核心范围已映射到 Phase 1-9；账号会话与权益由 Phase 6.5 覆盖；YouTube 视频沉浸翻译体验修正由 Phase 6.6 起步；字幕翻译 + 听音翻译 Beta 由 Phase 6.6 / 6.7 分别打底，Phase 8 完整站点适配收口；v2.5 翻译分层（Free 文本翻译解耦大模型后端）由 Phase 8.5 落地；v2.5 YouTube 隐形态 / 召唤态交互重构由 Phase 8.6 落地；v2.6 YouTube 整站重定位（整站原生体验 + App 整站隐形 + SPA 友好轻注入 + 仅视频页叠字幕 + 移除 YouTube 页面文字翻译）由 Phase 8.7 落地；v2.7 Free 文本 / 字幕翻译 provider 改用便宜大模型（OpenAI 兼容 Chat Completions，translation-proxy 内部 provider 实现替换，iOS Providers 与 model-gateway 不变）由新增 Phase 8.8 落地；v2.8 YouTube 视频字幕来源从渲染 DOM 改为视频自带字幕轨数据（player response / timedtext，按播放进度同步、覆盖 Shorts 与横屏、不依赖手动开 CC）由新增 Phase 8.9 落地（含第一步技术 spike 闸门）

**当前进度（2026-05-25，已迭代到 v2.6）**：
- Phase 1 已完成：workspace、contracts 和 browser-agent 最小包可构建 / 测试。
- Phase 2 已完成：iOS 原生 Tab 壳、SwiftData / Keychain 本地学习底座和样例学习闭环可构建 / 测试。
- Phase 3 已完成：Xcode 工程、WebView 可进入页面、boot / ping / page-ready bridge 解码、Provider disclosure 和 website data 分离提示可构建 / 测试。
- Phase 4 已完成：通用网页文本扫描、翻译请求 / 回填 bridge、翻译 Provider adapter、缓存和文本型网页原文 / 双语 / 学习阅读模式可构建 / 测试。
- Phase 5 已完成：点词点句解释、selection bridge、原生解释抽屉、SavedItem 收藏沉淀、收藏页搜索 / 筛选 / 删除和来源回看可构建 / 测试。
- Phase 6 已完成到后台模型服务网关、模型目录 contract、iOS 模型服务客户端和设置页服务等级改造；Phase 4-5 的直连 Provider 能力已转为模型服务路径。
- Phase 6.5 已完成：游客 Free session、后端 entitlement、dev/staging Pro / Max 测试账号、设置页账号状态、模型目录同步和 session token 请求路径已构建 / 测试 / review 通过。
- Phase 6.6 已完成基线：浏览器沉浸 chrome、YouTube watch / Shorts 视频模式、`VideoCaptionSegment` / `VideoCaptionOverlayState`、视频字幕叠层 / 降级状态和相关测试已收口。
- Phase 6.7 已完成：字幕优先 + 听音翻译 Beta 状态、音频分钟额度、后端 ASR route / quota、iOS 听音隐私提示 / 停止 / 关闭入口和相关测试已收口；Free 每天 10 分钟听音额度由后端授权与 catalog 下发。
- Phase 7 已完成：收藏生成复习卡、记住 / 模糊 / 不会反馈调度、浏览历史 / 继续学习、本地统计、目标语言保存、翻译缓存 / 学习数据 / website data 分离清理已构建 / 测试。
- Phase 8 已完成：YouTube、Reddit、Wikipedia、AO3、X 站点能力 adapter、scanner 站点能力下发、YouTube 字幕 / 听音双路径回归和首页快捷入口管理已构建 / 测试。
- 产品决策已调整到 v2.5（在 v2.4 基础上）：① Free 文本翻译从「统一走大模型 gateway」改为「走独立轻量翻译代理转发第三方通用翻译（Google / 微软）」，大模型后端未就绪时 Free 文本翻译仍开箱可用；② YouTube 视频页砍掉底部常驻工具条，改为 App UI 隐形态（YouTube 独占屏幕 + 双语字幕叠层 + 左侧半透明召唤把手）+ 召唤态（精简胶囊菜单：返回 / 翻译开关 / 字幕·听音切换 / 收藏当前句，用完即隐）；③「不做 BYOK」仅指禁止用户自配大模型，不限制产品集成的通用翻译服务；④ 本版集中把 YouTube 做透，Reddit / Wikipedia / AO3 / X 等其他平台定位不变但延后。听音 ASR 仍走 gateway、Free 每天 10 分钟；Free 文本翻译不限量。
- Phase 8.5 已完成：翻译分层重构落地——新建独立 `services/translation-proxy`、iOS `Providers` 按 session entitlement 路由（Free 文本翻译走翻译代理、Pro / Max 走大模型 gateway）、Free 文本翻译在 `MODEL_SERVICE_ROOT` 未配置时仍开箱可用、隐私提示拆成两条数据流并补测试已 commit；收敛了「现状全量直连 `/v1/translate` 导致 Free 翻不了」的技术债。
- Phase 8.6 已完成：YouTube 视频页 v2.5 隐形态 / 召唤态重构落地——移除底部常驻 `videoCaptionToolbar` + `videoCaptionStatusBar`（7 按钮工具条）、进入视频页即隐形态（YouTube 独占屏幕 + 双语字幕叠层 + 左侧半透明召唤把手）、召唤态精简胶囊菜单（返回 / 翻译开关 / 字幕 · 听音切换 / 收藏当前句）用完即隐已 commit；收敛了「视频页底部常驻控件违反 v2.5」的技术债。
- 产品决策已调整到 v2.6（在 v2.5 基础上，真机验证后修正）：v2.5 只把 YouTube **视频播放页**做了隐形（Phase 8.6），但 YouTube **首页 / 列表 / 搜索 / Shorts** 仍被当普通文本网页处理——套了「原文 / 双语 / 学习」阅读显示模式控件 + 常驻浏览工具条；且 `browser-agent` 注入（`.atDocumentEnd` 一次性注入 + 全量 DOM 扫描 + 全局 touch / mouse 事件监听 + fixed overlay + 不监听 SPA 路由）破坏了 YouTube 单页应用的原生滑动 / 点击 / 路由。v2.6 把 YouTube 从「普通可翻译网页 + 视频页特殊」重定位为「专门适配的视频站点」：YouTube **整站**（首页 / 列表 / 搜索 / Shorts / 视频页）保持原生操作体验、App 整站几乎隐形、整站不套阅读显示模式控件 / 浏览工具条；App 在 YouTube 的唯一增强是视频播放页的可开关双语字幕（沿用 v2.5 隐形态 / 召唤态）；本版不做 YouTube 页面文字翻译（标题 / 简介 / 评论 / 搜索结果），该能力从当前范围移除、留作后续；注入必须 SPA 友好、绝不破坏 YouTube 原生交互（属 review 阻断项）。
- 当前现状技术债（v2.6 待收敛）：① `WebBrowserView` 对 YouTube 仅在视频页做隐形，首页 / 列表 / 搜索仍走文本网页 chrome（阅读模式分段控件 + 浏览工具条）；② iOS 侧 `WebBridgeController+VideoCaption.swift` 的 `isVideoImmersiveMode` / `isYouTubeVideoURL` 仅按 `/watch`、`/shorts` 路径识别，未做「YouTube 域名整站识别」；③ `browser-agent` YouTube adapter（`site-adapters/youtube.ts`）与 runtime 注入（`runtime-source/scanner.ts` 全量扫描、`runtime-source/ui-bridge.ts`、`runtime-source/bootstrap.ts`）走通用文本网页注入路径，不监听 SPA 前端路由、做全量 DOM 扫描、注册干扰原生滚动 / 点击的全局事件、overlay 布局干扰 YouTube 虚拟滚动。三项均在新增 Phase 8.7 收敛。
- 产品决策已调整到 v2.7（在 v2.6 基础上，仅服务端后端实现变更）：Free 文本 / 字幕翻译的 provider 从「第三方通用翻译（Google / 微软）」改为「产品方在服务端配置的便宜大模型（OpenAI 兼容 Chat Completions，如 DeepSeek V3 / Kimi / GLM / Qwen）」。动机：Google Cloud / Azure 翻译账号申请麻烦、需信用卡；大模型 API（DeepSeek 等）注册充值简单、成本低、翻译质量优于通用机器翻译。本次只改 `services/translation-proxy` **内部 provider 实现**——iOS `AgentEnglishCore/Providers` 按 entitlement 路由（Free→translation-proxy，Pro / Max→model-gateway）与 `services/model-gateway` **都不动**；翻译分层 / 独立部署 / 故障隔离 / key 只在服务端 / 不做 BYOK / 跨端复用等 ADR-0005 核心决策全部保留（见 ADR-0005「v2.7 修订」段）；用户无感，界面仍只显示 free translation。
- Phase 8.7（YouTube 整站沉浸重构 + 修交互破坏）、Phase 8.8（translation-proxy Free 翻译 provider 改用便宜大模型）均已落地（见上方提交记录）。
- 产品决策已调整到 v2.8（在 v2.7 基础上，真机验证后修正字幕来源）：v2.4–v2.7 的 YouTube 视频字幕来源是「读播放器渲染的 DOM（`.ytp-caption-segment`）」，真机暴露只在「横屏 watch + 用户手动开 CC」时可读、翻不了 Shorts（用户核心场景，竞品能翻）。v2.8 把字幕来源改为「读取视频自带的字幕轨数据（player response / timedtext，含自动生成字幕）」，按播放进度（`video.currentTime`）时间同步显示当前句，不依赖手动开 CC、覆盖 Shorts 与横屏；无字幕轨视频走听音 Beta 或提示（不做 OCR）。合规边界调整为「实时读字幕轨用于翻译显示、只取当前播放所需、不保存为文件、不离线缓存整轨、不再分发」（已写入 Spec v2.8 / ADR-0004 v2.8 修订段 / ARCHITECTURE v2.8）。
- 下一步进入 Phase 8.9：YouTube 视频字幕轨读取 + 播放进度同步——**第一步技术 spike 验证 WKWebView 内能读到 `captionTracks` + timedtext fetch 成功**（依赖 YouTube 内部接口，移动版结构 / SPA 路由 / fetch 鉴权有失败风险，spike 通过再做时间同步 + 翻译 + overlay）；改动集中在 `packages/browser-agent`（`site-adapters/youtube.ts`、`runtime-source/youtube-injection.ts` 及必要的 overlay）+ 重新生成 `BrowserAgentRuntimeSource.generated.swift`，下游翻译（Free→translation-proxy）/ overlay 复用既有链路，不重做整站沉浸 / 隐形态 / 翻译分层。最后 Phase 9：导出、错误 / 空状态补齐、回归加固和旧入口收口。

---

## 架构约束摘要

**当前范围**：
- 首版交付 iPhone 原生 App + 轻量模型服务后端；客户端入口固定为 `apps/ios`，模型服务入口固定为 `services/model-gateway`，运行时组合为 SwiftUI + WKWebView + SwiftData + Keychain + Node.js backend。
- `packages/contracts` 是 native 与 injected script 的协议事实源；`packages/browser-agent` 只承载 DOM 识别、文本型网页翻译层、学习模式、YouTube 当前字幕句识别、视频字幕 / 听音翻译叠层、降级条和站点适配。
- 翻译能力分层（ADR-0005，v2.7 修订）：Free 文本翻译走独立 `services/translation-proxy`（内部调用产品方服务端配置的便宜大模型 / OpenAI 兼容 Chat Completions，按 session 限额），Pro / Max 文本翻译、点词解释、学习卡、YouTube 听音 ASR 走 `services/model-gateway`；两个服务独立部署、互不依赖，大模型 gateway 未配置 / 故障时 Free 文本翻译仍开箱可用。v2.7 只替换 translation-proxy 内部 provider 实现（第三方通用翻译 → 便宜大模型），分层 / 独立部署 / 故障隔离结构不变。
- 首版必须交付原生学习闭环：收藏、复习、历史、服务等级 / 模型档位设置、隐私清理和基础统计，避免退化成纯 WebView 壳。
- App 不提供用户自定义 Provider、API Key、Base URL、模型名或 BYOK；Provider 密钥、通用翻译 key、模型目录、会话、entitlement、额度和 fallback 只在后端，不进客户端 / `browser-agent` / App bundle。「不做 BYOK」仅指禁止用户自配大模型，不限制产品自身集成的通用翻译服务（Free 默认翻译）。
- App 首次启动必须创建或恢复游客 Free session；后端 session entitlement 是 Free / Pro / Max 授权事实源，客户端自报服务等级不能用于授权。
- dev/staging 可通过 `ENABLE_DEV_AUTH=true` 启用 Pro / Max 测试账号；生产环境必须隐藏 UI 并拒绝接口。

**后续范围 / Non-goals**：
- Android、macOS、Windows 仅保留未来接入边界，本计划不创建完整平台工程。
- 不恢复旧 `src/` Next 入口，不复用旧 Drizzle / SQLite 游戏数据，不引入 RPG、课程化、学习数据云同步、浏览器插件、YouTube 替代客户端。
- 不在生产环境启用测试账号；不做 Google-only iOS 公开登录；不把固定 Free / Pro / Max token 写进 App 包。
- 不实现视频下载、字幕下载、去广告、后台播放、无限制听音识别、后台听音识别、下载音视频后转写、Netflix / Disney+ / TED / Coursera 支持；不做用户自带模型配置；不在 YouTube 视频页展示阅读型“原文 / 双语 / 学习”底部分段控件。

**层次边界**：
- 入口层：`apps/ios` 负责 App 生命周期、SwiftUI 导航、Tab、WKWebView 容器、工具条、底部抽屉、设置页和系统权限；禁止写 DOM 规则、Provider 协议细节、后台路由策略或复习调度规则。
- 核心层：`apps/ios/AgentEnglishCore` 负责收藏、历史、复习、模型目录快照、服务等级、错误映射、隐私策略、视频翻译来源 / 听音额度状态、模型服务客户端和 SwiftData repository；禁止直接读写网页 DOM、保存 Provider / ASR 密钥或修改播放器。
- 共享协议：`packages/contracts` 负责 `BridgeEvent`、DTO、错误码、模型目录、服务等级、文本额度、音频分钟额度、视频字幕 / 听音翻译 payload、数据模型命名和 schema；禁止放 UI、存储实现或 Provider / ASR SDK。
- 适配层：`packages/browser-agent` 负责 DOM 扫描、overlay、selection、site adapter；`services/model-gateway` 负责 session / entitlement、Provider / ASR adapter、模型目录、文本额度、音频分钟额度、fallback 和错误归一；`services/translation-proxy` 负责 Free 文本翻译（v2.7：内部调用产品方服务端配置的便宜大模型 / OpenAI 兼容 Chat Completions，用翻译 prompt 生成中文译文）、按 session 限额、分块、缓存、provider fallback 和错误归一（不判定 entitlement 等级、不调用 model-gateway 的强模型 / ASR）；禁止 JS 或 iOS App 直接持有大模型 / 翻译 API Key、Base URL 或调用第三方 AI / ASR / 翻译服务。

**目录职责**：
| 路径 | 当前状态 | 职责 | 禁止 |
|------|----------|------|------|
| `apps/ios/` | placeholder | 首版 iOS App 工程、SwiftUI 页面、WKWebView 容器、原生导航和系统能力接入 | 作为跨平台抽象层；直接承载 DOM 选择器、站点规则或旧 Next 页面 |
| `apps/ios/AgentEnglishCore/` | placeholder | 收藏、历史、复习、模型服务客户端、Bridge DTO、SwiftData、隐私清理等无 UI 核心模块 | 放 SwiftUI View、网页 DOM 逻辑、JS 注入源码、Provider 密钥 |
| `packages/contracts/` | placeholder | bridge event、共享 DTO、错误码、模型目录、服务等级、文本额度、音频分钟额度、视频字幕 / 听音翻译 payload、数据模型命名、schema version | 放 UI 组件、平台存储实现、Provider / ASR SDK |
| `packages/browser-agent/` | placeholder | 文本识别、文本型网页 overlay、学习模式、selection、YouTube 当前字幕句识别、视频字幕 / 听音翻译叠层、降级条、站点适配、页面变更监听 | 保存凭证、调用 Provider / ASR / 模型服务、写本地数据库、修改 YouTube 播放器、下载完整字幕文件、下载或分离音视频、遮挡 YouTube 控件 |
| `services/model-gateway/` | active | 游客 / 登录 session、dev/staging 测试账号、entitlement、模型目录、Provider / ASR 密钥、Free / Pro / Max、文本额度、音频分钟额度、用量、fallback、Pro / Max 文本翻译 / 解释 / 听音翻译 API | App UI、DOM 规则、完整浏览历史、完整音频持久化、收藏 / 复习学习数据、客户端自报等级授权 |
| `services/translation-proxy/` | active（Phase 8.5 创建；Phase 8.8 换内部 provider） | 独立轻量翻译服务：Free 文本翻译，v2.7 内部调用产品方服务端配置的便宜大模型（OpenAI 兼容 Chat Completions）、按 session 限额、文本分块、缓存、错误归一、provider fallback；独立于 model-gateway 部署 | 调用 model-gateway 的强模型 / ASR、entitlement 等级判定、完整浏览历史、向客户端暴露大模型 / 翻译 key 或 Base URL、页面渲染或本地学习数据持久化 |
| `apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/` | active（Phase 8.5 重构为分层路由） | 翻译 / 解释客户端：按 entitlement 把 Free 文本翻译路由到 translation-proxy、Pro / Max 文本翻译 / 解释 / 听音路由到 model-gateway；service-tier / audio-quota 错误映射、重试、错误归一 | 页面 overlay 渲染、收藏列表 UI、JS 注入源码、第三方 Provider / ASR / 通用翻译密钥与 Base URL、把翻译 key 放进客户端 |
| `apps/android/` / `apps/macos/` / `apps/windows/` | future | 未来平台壳位置，仅文档占位 | 首版创建完整工程或复制 iOS 实现 |
| `src/` | legacy cleanup target | 旧 Next 游戏入口，后续只作为清理对象处理 | 恢复为新产品入口、创建新业务代码 |
| `data/` | legacy cleanup target | 旧本地 SQLite 残留目录 | 作为新产品 SwiftData 或学习数据来源 |

**ADR 决策摘要**：
- ADR-0001 固定首版路线为“iOS 原生壳 + `browser-agent` + `contracts`”，因此最早的实现 tranche 仍必须先建立 `apps/ios`、`packages/contracts`、`packages/browser-agent`。
- ADR-0001 要求所有 WebView 与 JS 通信都通过结构化 `BridgeEvent`，收藏 / 历史 / 复习 / 翻译缓存进入 SwiftData，网站 cookie 与 learning data 分离管理。
- ADR-0002 要求 App 不保存第三方 Provider 凭证、不展示 API Key 配置；所有翻译 / 解释请求必须通过 `services/model-gateway` 路由到后台模型目录。
- ADR-0003 要求 App 启动创建或恢复游客 Free session，iOS 只在 Keychain 保存后端 session token，后端以 session entitlement 判定 Free / Pro / Max；dev/staging 测试账号必须由 `ENABLE_DEV_AUTH` 限制，生产关闭。
- ADR-0004 要求 YouTube watch / Shorts 独立于阅读显示模式：不能展示底部“原文 / 双语 / 学习”控件，字幕翻译必须可关闭、可降级，并避开播放器控件、广告和品牌区域；v2.4 追加字幕优先 + 听音翻译 Beta，Free 每天 10 分钟，听音请求必须经后端 ASR 路由和音频分钟额度控制。
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
- 后续范围：不提前实现原生 UI、站点适配、真实模型服务调用或导出功能。

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

## Phase 4: 文本型网页翻译 + 阅读显示模式管线

**交付内容**：
- 完成 `browser-agent` 通用文本扫描、稳定 `segmentId`、页面能力上报和 native / JS 翻译请求映射。
- 完成 native Provider adapter、文本分块、翻译缓存，以及文本型网页的原文 / 双语 / 学习模式切换。
- 为页面识别失败、模型服务不可用、当前等级不可用和翻译失败提供明确降级提示，并保留选区翻译入口。

**关键文件**：
- `[新增] packages/contracts/src/translation.ts` — `PageContext`、`PageTextSegment`、`TranslationRequest`、`TranslationResult`
- `[新增] packages/browser-agent/src/bridge/translation-events.ts` — 翻译请求、完成、失败事件映射
- `[新增] packages/browser-agent/src/dom/segment-scanner.ts` — 通用文本节点扫描和稳定段落 id
- `[新增] packages/browser-agent/src/overlay/translation-overlay.ts` — 双语插入层与失败提示渲染
- `[新增] packages/browser-agent/src/modes/display-mode-controller.ts` — 文本型网页原文 / 双语 / 学习模式切换
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
- 后续范围：不在本 Phase 内实现站点专属规则、YouTube 视频沉浸翻译、收藏解释或复习调度。

**已知风险**：
- 第三方 Provider 的速率限制和文本分块策略会直接影响长文翻译稳定性，需要在本 Phase 先验证缓存与重试行为。

**验收标准**：
- 最低：用户在通用英文文本网页上点击翻译后能看到双语插入；三种阅读显示模式可切换；翻译失败能明确提示并保留选区翻译入口；YouTube 视频页不以本 Phase 的阅读显示模式作为完成标准。
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
- 回归：Phase 4 的整页翻译、阅读显示模式和失败降级仍正常。

---

## Phase 6: 后台模型服务网关 + 服务等级设置

**交付内容**：
- 新增 `services/model-gateway`，提供模型目录、Free / Pro / Max 等级、翻译 API、解释 API、额度 / 速率限制和 Provider fallback 骨架。
- 扩展 `packages/contracts`，让 iOS、后端和 browser-agent 共享模型目录、服务等级、额度状态和模型服务错误码。
- 将 iOS 端 Phase 4-5 的直连 Provider 调用重构为模型服务客户端；设置页移除 API Key、Base URL、模型名和自定义 Provider 配置，只展示当前等级、可用模型档位、用量状态、目标语言和隐私说明。

**关键文件**：
- `[新增] services/model-gateway/package.json` — 模型服务包配置、脚本和测试入口
- `[新增] services/model-gateway/src/index.ts` — 后端服务启动入口
- `[新增] services/model-gateway/src/catalog/model-catalog.ts` — Free / Pro / Max 模型目录、显示名、能力和 fallback 配置
- `[新增] services/model-gateway/src/routes/translate.ts` — 翻译 API，接收分块请求并返回可映射到 `segmentId` 的结果
- `[新增] services/model-gateway/src/routes/explain.ts` — 点词点句解释 API，返回释义、语境解释和例句
- `[新增] services/model-gateway/src/providers/provider-router.ts` — 后端内部 Provider 路由、fallback 和错误归一
- `[新增] services/model-gateway/src/quota/service-tier.ts` — Free / Pro / Max 额度、速率限制和用量状态
- `[新增] packages/contracts/src/model-service.ts` — `ModelCatalog`、`ServiceTier`、`ModelQuotaState`、模型服务错误码
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ModelServiceClient.swift` — iOS 模型服务客户端，替代直连 Provider 调用
- `[修改] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift` — 改为调用 `ModelServiceClient`
- `[修改] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ExplanationProviderClient.swift` — 改为调用 `ModelServiceClient`
- `[修改] apps/ios/AgentEnglish/Screens/SettingsView.swift` — 移除 Provider 配置表单，改为服务等级、模型档位、用量和隐私展示
- `[修改] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/TranslationProviderSettingsStore.swift` — 改为服务等级 / 模型偏好快照，不保存 Provider 参数

**依赖前置 Phase**：
- 依赖 Phase 4（需要翻译请求 / 回填管线）
- 依赖 Phase 5（需要解释请求和收藏沉淀）
- 依赖 ADR-0002（后台托管 Provider 密钥与模型目录）

**架构约束映射**：
- 层次边界：iOS App 只调用模型服务；Provider 密钥、Base URL、真实模型名、成本信息和 fallback 只在后端。
- 目录职责：允许新增 `services/model-gateway`、扩展 `packages/contracts` 和重构 `AgentEnglishCore/Providers`；禁止把 Provider API Key 放入 App、SwiftData、Keychain 或 browser-agent。
- ADR 约束：落实 ADR-0002；旧直连 Provider 能力必须降级为迁移前技术债，不能作为最终产品形态继续开发。
- 后续范围：不在本 Phase 做订阅支付、正式账号恢复或学习数据云同步；本 Phase 若仍存在开发固定等级模拟，只能作为迁移过渡，必须由 Phase 6.5 的 session entitlement 收口。

**已知风险**：
- 这会改动 Phase 4-5 的 Provider 调用路径，必须保留现有网页翻译、点词解释和收藏流程的回归测试。
- Free 层成本不可无限开放；即使首版用开发模拟额度，也必须在接口层保留 quota / rate-limit 结构。

**验收标准**：
- 最低：iOS App 不再要求用户填写 API Key、Base URL 或模型名；设置页只展示服务等级和模型档位；翻译和解释请求通过模型服务客户端完成；模型服务能返回 Free / Pro / Max 目录和可识别错误。
- 回归：Phase 4 的网页翻译与阅读显示模式、Phase 5 的点词解释和收藏仍可构建 / 测试。

---

## Phase 6.5: 账号会话 + 后端权益 + Dev 测试账号

**交付内容**：
- 完成游客 Free session：App 首次启动创建或恢复后端游客会话，Keychain 保存后端 session token，设置页显示游客模式 / Free，基础翻译不因未登录被阻断。
- 完成后端 entitlement 授权：模型目录、翻译和解释 API 以 session entitlement 判定 Free / Pro / Max，忽略客户端请求体自报的 `serviceTier`。
- 完成 dev/staging Pro / Max 测试账号：`ENABLE_DEV_AUTH=true` 时允许登录 `test-pro@agentenglish.local` / `test-max@agentenglish.local`，生产环境隐藏 UI 并拒绝接口。
- 补齐设置页账号区和登录状态：游客态、dev Pro、dev Max、退出登录、模型目录同步失败、额度不足和等级不可用状态可见。

**关键文件**：
- `[新增] packages/contracts/src/auth-session.ts` — `AuthSession`、`AccountStatus`、`EntitlementSnapshot`、dev login request / response、auth 错误码
- `[新增] services/model-gateway/src/sessions/session-store.ts` — 游客 session 创建 / 恢复、session token 校验、退出登录和过期策略
- `[新增] services/model-gateway/src/entitlements/entitlement-service.ts` — Free / Pro / Max 权益判定、测试账号等级映射、模型目录授权过滤
- `[新增] services/model-gateway/src/auth/dev-auth.ts` — dev/staging 测试账号登录、环境变量密码读取、`ENABLE_DEV_AUTH` 防护
- `[修改] services/model-gateway/src/routes/model-catalog.ts` — 基于 session entitlement 返回可用模型目录和额度状态
- `[修改] services/model-gateway/src/routes/translate.ts` — 校验 session entitlement，忽略客户端自报等级
- `[修改] services/model-gateway/src/routes/explain.ts` — 校验 session entitlement，返回等级不可用 / 额度不足等错误
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Account/AccountSessionClient.swift` — session bootstrap、dev login、logout、entitlement refresh
- `[修改] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/KeychainCredentialStore.swift` — 保存后端 session token，不保存固定生产等级 token
- `[修改] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ModelServiceClient.swift` — 所有模型服务请求附带 session token，并处理 auth / entitlement 错误
- `[修改] apps/ios/AgentEnglish/Screens/SettingsView.swift` — 新增账号状态区、登录入口、dev/staging 测试账号状态和退出登录入口
- `[新增] apps/ios/AgentEnglishTests/AccountSessionClientTests.swift` — 游客 session、dev login、logout 和 Keychain token 替换测试
- `[新增] services/model-gateway/tests/auth-session.test.mjs` — 后端游客 session、dev auth gate、entitlement 授权和生产拒绝测试

**依赖前置 Phase**：
- 依赖 Phase 6（需要模型服务网关、模型目录 contract 和 iOS 模型服务客户端）
- 依赖 ADR-0003（账号会话与权益基础）
- 依赖 Design-Brief v2.2 和已导出的 v2.2 账号 / 登录 / 模型服务错误状态 PNG

**架构约束映射**：
- 层次边界：iOS 只展示账号状态并保存后端 session token；Apple / Google identity token 验证、dev password login、entitlement 判定只在后端。
- 目录职责：允许新增 `AgentEnglishCore/Account/`、`services/model-gateway/src/auth/`、`sessions/`、`entitlements/` 和 contracts auth DTO；禁止把测试账号密码、Provider 密钥或固定生产等级 token 写入 App。
- ADR 约束：落实 ADR-0003；后端必须拒绝生产环境 dev auth，必须忽略客户端 `serviceTier`，必须把游客 Free 作为默认可用路径。
- 后续范围：不在本 Phase 做 StoreKit、充值页、订阅管理、正式账号恢复、学习数据云同步或生产 Google-only 登录。

**已知风险**：
- 如果没有真实后端环境变量和本地 seed，dev/staging Pro / Max 路径无法验证；本 Phase 必须提供可本地运行的 seed 或测试 double。
- 如果设置页先展示登录而非游客可用，会破坏首屏体验；登录入口必须是可选的，不强制用户进入账号流程。

**验收标准**：
- 最低：首次启动能获得游客 Free session，设置页显示游客模式 / Free，基础翻译 / 解释请求会带 session token；Pro / Max 测试账号只在 dev/staging 可登录，登录后模型目录和额度刷新；生产配置下测试账号 UI 不出现且接口返回拒绝。
- 授权：后端模型目录、翻译和解释 API 不信任客户端自报 `serviceTier`；改请求体不能越权获得 Pro / Max 能力。
- 回归：Phase 6 的模型目录、翻译、解释和设置页服务等级展示仍可构建 / 测试；Phase 4-5 的网页翻译、点词解释和收藏仍可用。

---

## Phase 6.6: 浏览器沉浸体验修正 + YouTube 视频模式基线

**交付内容**：
- 修正 WebBrowserView 的浏览状态：进入真实网页后 App 底部 Tab 和阅读模式面板不能长期挤占内容，文本型网页保留可收起工具条。
- 建立 YouTube watch / Shorts 页面识别和视频沉浸翻译状态机：视频页不展示“原文 / 双语 / 学习”分段控件，只显示极简翻译状态和必要错误提示。
- 新增 `VideoCaptionSegment` / `VideoCaptionOverlayState` contract 和双端 fixture，为后续完整字幕翻译打基础；本 Phase 只要求可识别视频页、可表达字幕可用 / 不可用 / 降级状态，不强行承诺所有 YouTube 视频翻译成功。
- 更新设计稿后实现最小 UI：默认播放、字幕翻译中、字幕不可用、降级字幕条和收藏当前句入口的基线状态。

**关键文件**：
- `[新增] packages/contracts/src/video-caption.ts` — `VideoCaptionSegment`、`VideoCaptionOverlayState`、字幕错误码和状态枚举
- `[新增] packages/contracts/tests/fixtures/video-caption-youtube-watch.json` — YouTube watch 字幕状态 fixture
- `[新增] packages/browser-agent/src/site-adapters/youtube.ts` — watch / Shorts 页面识别、页面类型能力上报和字幕状态探测基线
- `[新增] packages/browser-agent/src/overlay/video-caption-overlay.ts` — 视频安全区域字幕叠层和视频下方降级条渲染基线
- `[修改] packages/browser-agent/src/modes/display-mode-controller.ts` — 禁止 YouTube 视频页启用文本型阅读模式控件
- `[修改] apps/ios/AgentEnglish/Screens/WebBrowserView.swift` — 进入网页后的沉浸浏览 chrome、YouTube 视频模式状态展示和错误提示
- `[修改] apps/ios/AgentEnglish/Web/WebBridgeController.swift` — 接收 YouTube 页面类型、字幕状态和 overlay 状态事件
- `[新增] apps/ios/AgentEnglishTests/VideoCaptionContractTests.swift` — Swift DTO 与 TS fixture 字段等价测试

**依赖前置 Phase**：
- 依赖 Phase 3（需要 `WKWebView` 进入流和 bridge 入口）
- 依赖 Phase 4（需要翻译请求 / 回填管线和阅读显示模式基础）
- 依赖 Phase 6.5（需要模型服务 session token 和后端 entitlement，后续字幕翻译请求必须走同一授权路径）
- 依赖 v2.3 Design-Brief 和补充后的 YouTube 视频沉浸翻译设计稿

**架构约束映射**：
- 层次边界：YouTube DOM 和字幕状态识别只在 `packages/browser-agent/src/site-adapters/youtube.ts`；SwiftUI 只承载状态、工具条和错误提示；模型请求仍由 native `ModelServiceClient` 调后端。
- 目录职责：允许新增 video caption contracts、overlay 和 YouTube adapter；禁止在 SwiftUI 中硬编码 YouTube DOM selector，禁止 JS 直接调用模型服务。
- ADR / 政策约束：不替换播放器、不下载完整字幕文件、不遮挡 YouTube 控件 / 广告 / 品牌区域；无法安全叠加时必须降级。
- 后续范围：不在本 Phase 做 Reddit / Wikipedia / AO3 / X 完整站点适配；不在 Phase 6.6 内做听音翻译 Beta；不做 Netflix / Disney+。

**已知风险**：
- YouTube DOM、字幕节点和 Shorts 布局变化频繁；本 Phase 必须以站点能力声明和降级状态为主，不能把“所有视频都有字幕翻译”写成验收条件。
- 如果设计稿没有先补 YouTube 视频状态，开发容易继续沿用普通网页工具条，造成同类返工。

**验收标准**：
- 最低：打开 YouTube watch / Shorts 页面时不再出现“原文 / 双语 / 学习”分段控件；App chrome 不长期挤压视频主体；页面能上报 video mode、字幕可用 / 不可用或降级状态。
- Contract：`VideoCaptionSegment` / `VideoCaptionOverlayState` 有 TS fixture 与 Swift decoder 等价测试。
- UX：字幕不可用、额度不足或模型服务失败时只给轻量提示，不中断 YouTube 播放和原站交互。
- 回归：普通文本网页的 Phase 4 阅读显示模式仍可用；Phase 5 点词解释和 Phase 6.5 session token 请求路径不被破坏。

---

## Phase 6.7: YouTube 听音翻译 Beta + 音频分钟额度

**交付内容**：
- 在 Phase 6.6 的视频模式基线上增加“字幕优先 + 听音兜底”的来源策略：字幕可用时默认字幕翻译；字幕不可用、质量明显不足或用户手动选择时进入听音翻译 Beta。
- 扩展 contracts 和 Swift DTO：新增 `VideoAudioSegment`、`VideoAudioTranslationState`、`AudioTranslationQuota`，并让 overlay 能统一渲染字幕源和听音源的双语字幕。
- 后端模型服务新增听音翻译路由和 ASR adapter 抽象：后端保存 ASR / Provider 密钥、处理短音频片段、完成识别 + 翻译、错误归一和 fallback；iOS / JS 不保存密钥、不直连 ASR。
- 后端新增音频分钟额度：Free 每天 10 分钟；Pro / Max 由 model catalog / entitlement 下发更高额度；后端以 session entitlement 为授权事实源，忽略客户端自报等级。
- iOS 设置页和视频页展示听音额度、识别中、停止、额度用完、听音失败和隐私提示；听音翻译必须用户可见、可关闭、可停止。

**关键文件**：
- `[新增] packages/contracts/src/video-audio-translation.ts` — `VideoAudioSegment`、`VideoAudioTranslationState`、`AudioTranslationQuota`、听音错误码和状态枚举
- `[新增] packages/contracts/tests/fixtures/video-audio-youtube-watch.json` — YouTube watch 听音翻译状态 fixture
- `[修改] packages/contracts/src/model-catalog.ts` — 扩展 Free / Pro / Max 的音频分钟额度和 ASR 能力字段
- `[修改] packages/browser-agent/src/overlay/video-caption-overlay.ts` — 统一渲染字幕源 / 听音源、听音识别中、额度用完和失败状态
- `[修改] packages/browser-agent/src/site-adapters/youtube.ts` — 在字幕不可用 / 质量低时上报可切换听音状态，不下载或分离音视频
- `[新增] services/model-gateway/src/routes/video-audio-translate.ts` — 听音翻译 API，必须校验 session 和音频分钟额度
- `[新增] services/model-gateway/src/providers/asr-provider.ts` — ASR Provider adapter 抽象、错误映射和 fallback 边界
- `[新增] services/model-gateway/src/quota/audio-minute-quota.ts` — Free 每天 10 分钟、Pro / Max 更高额度、重置时间和滥用保护
- `[修改] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ModelServiceClient.swift` — 新增听音翻译请求、音频额度错误映射和隐私提示状态
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Bridge/VideoAudioTranslationContracts.swift` — Swift DTO 与 TS fixture 字段等价
- `[修改] apps/ios/AgentEnglish/Web/WebBridgeController.swift` — 接收听音翻译状态、音频额度状态和 overlay 状态事件
- `[修改] apps/ios/AgentEnglish/Screens/WebBrowserView.swift` — 视频页显示字幕 / 听音来源、听音识别中、停止、额度用完和失败轻提示
- `[修改] apps/ios/AgentEnglish/Screens/SettingsView.swift` — 服务等级区展示 Free 今日 10 分钟听音额度和剩余分钟
- `[新增] apps/ios/AgentEnglishTests/VideoAudioTranslationContractTests.swift` — Swift DTO 与 TS fixture 字段等价测试

**依赖前置 Phase**：
- 依赖 Phase 6.5（需要 session entitlement、model catalog 和 quota 基础）
- 依赖 Phase 6.6（需要 YouTube 视频模式、视频字幕 overlay 和浏览器沉浸 chrome）
- 依赖 Product-Spec v2.4 / ADR-0004 amended（明确 Free 也支持听音翻译，每天 10 分钟）
- 依赖 v2.4 Design-Brief 和已导出的 Pencil 听音状态稿（`iajll.png`、`f154K.png`、`NtBkp.png`、`3YlLm.png`、`iI4Cp.png`）

**架构约束映射**：
- 层次边界：听音翻译的 ASR、Provider 密钥、音频分钟额度和 fallback 只在 `services/model-gateway`；iOS 只做用户可见控制、隐私提示、短片段请求编排和状态展示；`browser-agent` 只渲染 overlay 与站点能力状态。
- 目录职责：允许扩展 contracts、browser-agent overlay、model-gateway routes / providers / quota、iOS bridge DTO 和 WebBrowserView；禁止在 JS 中调用 ASR，禁止在 SwiftUI 中硬编码 YouTube DOM selector，禁止保存完整音频。
- ADR / 政策约束：不替换播放器、不下载完整字幕文件、不下载或分离音视频、不后台听音、不遮挡 YouTube 控件 / 广告 / 品牌区域；无法安全叠加时必须降级。
- 后续范围：不在本 Phase 做 StoreKit、正式订阅支付、长视频完整转写、字幕文件下载、Netflix / Disney+ / Coursera 支持。

**已知风险**：
- iOS WKWebView 内的 YouTube 音频可用性、系统权限和平台政策存在不确定性；本 Phase 必须先用可验证的短片段机制打通，无法安全获取音频时要明确失败并回退字幕 / 页面文字翻译。
- 听音翻译成本和延迟高于字幕翻译；Free 必须严格限制每天 10 分钟，后端必须具备速率限制和用量统计。
- ASR 质量会受背景音乐、噪声、口音和视频混音影响；错误状态必须是正常产品状态，不能伪装成功。

**验收标准**：
- 最低：字幕不可用的 YouTube watch / Shorts 页面能出现“听音翻译 Beta”入口；Free 用户能看到今日 10 分钟额度、已用 / 剩余状态；启用后能进入识别中、成功、失败、停止和额度用完状态。
- Contract：`VideoAudioSegment` / `VideoAudioTranslationState` / `AudioTranslationQuota` 有 TS fixture 与 Swift decoder 等价测试。
- 后端：听音翻译 API 必须校验 session token 和音频分钟额度；修改请求体中的 `serviceTier` 不能越权获得 Pro / Max 听音额度。
- 隐私：用户启用听音前能看到音频片段会发送到自有后端并可能转发给 ASR / 模型服务的说明；默认不保存完整音频。
- 回归：Phase 6.6 的字幕翻译叠层 / 降级条仍可用；普通文本网页翻译、点词解释、收藏和设置页服务等级不被破坏。

---

## Phase 7: 复习、历史、设置与隐私管理

**交付内容**：
- 基于收藏生成 `ReviewCard` 队列，支持记住 / 模糊 / 不会反馈并调整近期复习优先级。
- 提供历史页、继续学习入口和本地统计，覆盖翻译页数、收藏数、复习完成数、连续使用天数。
- 在 Phase 3 与 Phase 6 的隐私提示基础上，补全目标语言、数据保留策略、缓存清理、网站数据清理提示和全量清空能力。

**关键文件**：
- `[新增] packages/contracts/src/review-card.ts` — `ReviewCard`、反馈状态和调度字段命名
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Review/ReviewScheduler.swift` — 复习优先级与反馈调度
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/HistoryRepository.swift` — 浏览历史、继续学习定位和站点清理
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/StatisticsRepository.swift` — 本地统计聚合与连续使用天数
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Privacy/PrivacyDataManager.swift` — 学习数据清理、website data 提示和隐私开关
- `[修改] apps/ios/AgentEnglish/Screens/ReviewView.swift` — 主动回忆卡片、答案展开和反馈按钮
- `[新增] apps/ios/AgentEnglish/Screens/HistoryView.swift` — 最近翻译网页与继续学习入口
- `[修改] apps/ios/AgentEnglish/Screens/SettingsView.swift` — 在 Phase 6.5 账号区基础上补语言、缓存、网站数据和清理策略设置

**依赖前置 Phase**：
- 依赖 Phase 2（需要 SwiftData / Keychain / 基础页面）
- 依赖 Phase 4（统计、历史和缓存要消费翻译行为）
- 依赖 Phase 5（复习卡基于收藏沉淀）
- 依赖 Phase 6（设置页和隐私说明已从 Provider 配置改为模型服务等级）
- 依赖 Phase 6.5（设置页账号区、游客 Free session 和后端 entitlement 已收口）
- 依赖 Phase 6.6（浏览器沉浸体验和 YouTube 视频模式基线已收口，避免历史 / 继续学习记录错误页面状态）
- 依赖 Phase 6.7（YouTube 听音翻译 Beta 和音频分钟额度已收口，避免历史 / 统计漏记视频听音学习状态）

**架构约束映射**：
- 层次边界：复习调度、历史和统计都在 native core；设置页只做配置与展示，不直接操作网页 DOM 或 Provider SDK。
- 目录职责：允许新增 `Review/`、`Privacy/`、`Persistence/` 细分模块和对应 SwiftUI 页面；禁止把网站 cookie 清理和学习数据清理混为同一删除动作。
- ADR 约束：原生收藏、复习、历史和隐私清理是 App Store 价值边界，本 Phase 必须完整成形；SwiftData 只保存服务等级快照和用户偏好，不保存 Provider 参数。
- 后续范围：不在本 Phase 内做 StoreKit、生产账号恢复、学习数据云同步或跨设备统计；账号会话只沿用 Phase 6.5 的基础。

**已知风险**：
- 复习优先级算法首版只需“可解释、可验证”，避免提前引入复杂 SRS 公式导致调试成本过高。

**验收标准**：
- 最低：用户能从收藏生成复习卡并提交三种反馈；历史页能回到原网页；设置页能切换目标语言并分别清理学习数据与 website data。
- 回归：Phase 5 的解释抽屉、收藏沉淀与搜索筛选，以及 Phase 3 的隐私提示仍正常。

---

## Phase 8: 站点适配 + YouTube 视频沉浸翻译完善 + 快捷入口管理

**交付内容**：
- 为 YouTube、Reddit、Wikipedia、AO3、X 建立独立 site adapter，并保留 generic fallback。
- 在 Phase 6.6 / 6.7 的视频模式基线上，完善 YouTube 标题、简介、评论、搜索结果翻译；watch / Shorts 有可访问字幕或可见字幕文本时优先使用字幕翻译；无字幕、字幕质量低或用户选择听音时使用听音翻译 Beta；安全区域不足时明确提示或降级，不影响页面文字翻译和播放。
- 支持首页常用站点快捷入口的添加、删除和排序，让浏览首页可按个人习惯定制。

**关键文件**：
- `[新增] packages/contracts/src/site-capability.ts` — 站点能力声明与 adapter 能力枚举
- `[修改] packages/contracts/src/video-caption.ts` — 扩展 Phase 6.6 的字幕状态，补齐收藏当前字幕句、时间位置和失败原因
- `[修改] packages/contracts/src/video-audio-translation.ts` — 扩展 Phase 6.7 的听音状态，补齐收藏当前听音句、失败原因和额度展示字段
- `[修改] packages/browser-agent/src/site-adapters/youtube.ts` — YouTube 页面文字、watch / Shorts 字幕状态和视频沉浸翻译完善
- `[修改] packages/browser-agent/src/overlay/video-caption-overlay.ts` — 双语字幕叠层、听音翻译叠层、降级字幕条、字幕不可用、听音失败和收藏反馈状态
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
- 依赖 Phase 6.6（需要 YouTube 视频模式基线、video caption contracts 和浏览器 chrome 修正）
- 依赖 Phase 6.7（需要 YouTube 听音翻译 contracts、ASR 路由和音频分钟额度）
- 依赖 Phase 7（需要历史与设置回归稳定）

**架构约束映射**：
- 层次边界：站点规则只进 `packages/browser-agent/src/site-adapters`；YouTube 能力只做保守学习增强，native 层只负责提示、收藏入口和状态展示。
- 目录职责：允许新增 / 扩展 site adapter、video caption overlay 和首页快捷入口管理页面；禁止在 `apps/ios` 中硬编码 DOM selector 或在 JS 中改动播放器行为。
- ADR 约束：YouTube 不能做替代客户端、不能下载媒体或完整字幕文件、不能去广告、不能后台听音；站点失败必须回退到通用文本识别、视频下方字幕条、听音翻译 Beta 或选区翻译。
- 后续范围：不提前支持 Netflix / Disney+ / Coursera，也不创建桌面端或 Android 站点壳。

**已知风险**：
- 第三方站点 DOM 经常变化，site adapter 需要与通用扫描共存，不能让单站点失败拖垮整页翻译。
- YouTube 字幕能力可能因地区、视频设置、登录状态或页面结构不可用；听音能力也可能因音质、权限、额度或 ASR 服务不可用失败；失败状态必须被当作正常产品状态处理。

**验收标准**：
- 最低：五个核心站点都能在各自主页面结构上获得更稳定的翻译结果；YouTube watch / Shorts 不出现阅读模式分段控件；有可访问字幕或可见字幕文本的视频能显示双语字幕叠层或降级字幕条；字幕不可用时可进入听音翻译 Beta 并遵守 Free 每天 10 分钟额度；字幕 / 听音失败不会影响页面文字翻译；用户可自定义首页快捷入口顺序。
- 回归：Phase 4 的 generic 翻译、Phase 5 的点词收藏、Phase 7 的历史与设置仍正常。

---

## Phase 8.5: 翻译分层重构（Free 文本翻译解耦大模型后端）

**交付内容**：
- 新建独立 `services/translation-proxy`：只负责转发第三方通用翻译（Google / 微软）、按 session 限额、文本分块、缓存、通用翻译 Provider fallback 和错误归一；该服务不判定 entitlement 等级，也不调用大模型或 ASR，独立于 `services/model-gateway` 部署。
- 把 iOS `AgentEnglishCore/Providers` 的翻译客户端改为按 session entitlement 路由：Free 文本翻译走 `translation-proxy`，Pro / Max 文本翻译、解释和听音仍走 `model-gateway`；收敛现状全量直连大模型 gateway `/v1/translate` 的链路这一迁移技术债。
- 让 Free 文本翻译在大模型后端未配置（`MODEL_SERVICE_ROOT` 未设）或故障时仍开箱可用，并补针对该解耦路径的 Swift / TS 测试，验证「gateway 缺位时 Free 仍能翻」。
- 把设置页隐私提示拆成两条数据流说明：Free 文本翻译经翻译代理转发到第三方通用翻译；Pro / Max 文本翻译与解释经大模型 gateway 处理。

**关键文件**：
- `[新增] services/translation-proxy/package.json` — 独立轻量翻译代理服务的依赖与启动脚本
- `[新增] services/translation-proxy/src/index.ts` — 服务入口、路由装配与配置加载（独立于 model-gateway）
- `[新增] services/translation-proxy/src/routes/translate.ts` — Free 文本翻译转发 API，校验 session 并执行分块与限额
- `[新增] services/translation-proxy/src/providers/` — 第三方通用翻译（Google / 微软）Provider adapter 与 fallback 边界
- `[新增] services/translation-proxy/src/quota/` — 按 session 的文本翻译限额与重置策略
- `[新增] services/translation-proxy/src/cache/` — 翻译结果缓存，降低重复请求与第三方调用成本
- `[新增] services/translation-proxy/tests/` — 转发、分块、限额、缓存与 fallback 的服务端测试
- `[修改] packages/contracts/src/translation.ts` — 如需区分 Free 文本翻译链路与大模型链路的请求 / 结果字段
- `[修改] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift` — 按 session entitlement 把 Free 文本翻译路由到 translation-proxy、Pro / Max 路由到 model-gateway
- `[新增] apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProxyClient.swift` — translation-proxy 请求编排、限额错误映射与错误归一（或在 `ModelServiceClient.swift` 内拆分对应路径）
- `[修改] apps/ios/AgentEnglish/Screens/SettingsView.swift` — 隐私提示拆成两条数据流文案（Free 文本→翻译代理→第三方通用翻译；Pro / Max 文本与解释→大模型 gateway）
- `[新增] apps/ios/AgentEnglishTests/TranslationTieringTests.swift` — Free 文本翻译在 `MODEL_SERVICE_ROOT` 未配置时仍可翻的路径测试与 entitlement 分流测试

**依赖前置 Phase**：
- 依赖 Phase 4（需要翻译请求 / 回填管线作为分层改造的基线）
- 依赖 Phase 6（需要 `services/model-gateway` 和 `ModelServiceClient` 作为 Pro / Max 路由目标）
- 依赖 Phase 6.5（需要 session entitlement 作为分流的授权事实源）
- 依赖 ADR-0005（翻译分层 + Free 轻量翻译代理解耦的技术决策）

**架构约束映射**：
- 层次边界：Free 文本翻译第三方转发、限额、分块、缓存和 fallback 只在 `services/translation-proxy`；iOS `Providers` 层只做按 entitlement 的路由编排、错误映射和错误归一；entitlement 等级判定仍是 `services/model-gateway` 与 session 的职责。
- 目录职责：允许新建 `services/translation-proxy/`（`src/routes`、`src/providers`、`src/quota`、`src/cache`、`tests`）并重构 iOS `Providers` 为分层路由；禁止把通用翻译 key 放进客户端，禁止在 `translation-proxy` 内调用大模型 / ASR，禁止 JS 或 iOS App 直接调用第三方翻译服务。
- ADR 约束：依据 ADR-0005，`translation-proxy` 与 `model-gateway` 独立部署、互不依赖，大模型后端未配置或故障时 Free 文本翻译必须仍可用；翻译 key 只托管在代理服务端。
- 后续范围：不在本 Phase 内做 Pro / Max 翻译链路的重构、StoreKit、跨平台 Web / Android 翻译壳，也不把账号同步纳入本 Phase。

**已知风险**：
- 现状 iOS 全量直连 `/v1/translate` 是「Free 用不了」的根因，重构需保证分流后 Pro / Max 既有翻译路径不被破坏，回归成本集中在 `Providers` 层。
- 第三方通用翻译（Google / 微软）的额度、计费和可用性存在外部不确定性，`translation-proxy` 必须具备限额、缓存和 Provider fallback，避免单一通用翻译失败拖垮 Free 文本翻译。

**验收标准**：
- 最低：大模型 gateway 未配置（`MODEL_SERVICE_ROOT` 未设）或不可用时，Free 文本翻译仍能完成翻译，并有覆盖该路径的测试。
- 分流：按 session entitlement 正确分流——Free 文本翻译走 translation-proxy，Pro / Max 文本翻译 / 解释走 model-gateway；修改客户端自报等级不能越权改变分流结果。
- 安全：第三方通用翻译 key 只在 `translation-proxy` 服务端，不进入 iOS / JS 客户端。
- 隐私：设置页隐私提示按两条数据流分别说明 Free 文本翻译与 Pro / Max 文本翻译 / 解释。
- 回归：Phase 4 的翻译回填管线、Phase 6 的 model-gateway / `ModelServiceClient` 请求路径、Phase 6.5 的 session entitlement 仍正常。

---

## Phase 8.6: YouTube 视频页 v2.5 隐形态 / 召唤态重构

**交付内容**：
- 移除 `WebBrowserView` 视频沉浸模式下底部常驻的 `videoCaptionToolbar` + `videoCaptionStatusBar`（现状 7 按钮工具条），收敛违反 v2.5「视频页不在底部常驻控件」的技术债。
- 进入 YouTube 视频页时进入 App UI 隐形态：YouTube 独占屏幕，App 只保留视频上的双语字幕叠层和左侧半透明召唤把手，不在底部常驻任何工具条或状态栏。
- 实现召唤态：点击左侧把手浮出精简胶囊菜单，仅包含返回、翻译开关、字幕 · 听音来源切换、收藏当前句四项，用完即隐，不长期占屏。
- 相应调整 `browser-agent` overlay 与 `apps/ios/AgentEnglish/Web` 的 native 视频状态以承载隐形态 / 召唤态切换；字幕叠层内容层（含听音状态展示）保持不变，不重做字幕 / 听音翻译能力。

**关键文件**：
- `[修改] apps/ios/AgentEnglish/Screens/WebBrowserView.swift` — 删除底部 `videoCaptionToolbar` / `videoCaptionStatusBar`，承载隐形态与召唤态布局和左侧把手
- `[修改] apps/ios/AgentEnglish/Web/WebBridgeController.swift` — 承载隐形态 / 召唤态状态、把手唤出与菜单收起的事件流转
- `[修改] apps/ios/AgentEnglish/Web/WebBridgeController+Recording.swift` — 如召唤态切换涉及字幕 · 听音来源 / 收藏当前句事件，需同步调整对应桥接
- `[修改] packages/browser-agent/src/overlay/video-caption-overlay.ts` — 召唤把手与精简胶囊菜单 overlay，或与 native 协作的渲染边界划分
- `[修改] packages/contracts/src/video-caption.ts` — 如需新增隐形态 / 召唤态状态枚举或菜单项动作字段
- `[新增] apps/ios/AgentEnglishTests/VideoSummonStateTests.swift` — 隐形态 / 召唤态状态与菜单四项行为的测试

**依赖前置 Phase**：
- 依赖 Phase 6.6（需要 YouTube 视频模式基线、video caption contracts 和浏览器沉浸 chrome）
- 依赖 Phase 6.7（需要字幕 / 听音来源切换与音频分钟额度状态）
- 依赖 Phase 8（需要 YouTube 站点适配与视频沉浸翻译完善后的稳定基线）
- 依赖 ADR-0004 v2.5 修订（隐形态 / 召唤态交互与合规边界）和 Design-Brief v2.5

**架构约束映射**：
- 层次边界：把手与召唤菜单的渲染按 ADR-0004 v2.5 在 `browser-agent` overlay 与 native 之间划分；SwiftUI 只承载隐形态 / 召唤态布局与状态，不硬编码 YouTube DOM selector，也不改动播放器行为。
- 目录职责：允许修改 `WebBrowserView`、`WebBridgeController` 与 `video-caption-overlay.ts`、扩展 `contracts` 状态枚举；禁止把视频页控件改回底部常驻工具条，禁止新增越层捷径。
- ADR 约束：依据 ADR-0004 v2.5，视频页不在底部常驻控件，把手与菜单不得遮挡 YouTube 播放器控件、进度条、右侧点赞 / 评论 / 分享、频道信息与品牌区域；无法安全叠加时降级。
- 后续范围：不在本 Phase 内重做字幕 / 听音翻译能力，不扩展 Reddit / Wikipedia / AO3 / X 的非视频交互，也不做 Netflix / Disney+ / Coursera。

**已知风险**：
- YouTube 播放器布局、安全区域和控件位置随地区 / 登录状态 / 页面结构变化，召唤把手与菜单的叠加位置需保证不遮挡播放器原生控件与品牌区域，否则触发合规风险。
- 隐形态 / 召唤态切换涉及 native 与 overlay 双端状态同步，需避免菜单残留占屏或把手丢失导致用户无法返回。

**验收标准**：
- 最低：YouTube 视频页不再出现任何底部常驻工具条或状态栏；隐形态下 YouTube 独占屏幕，App 仅保留视频上的双语字幕叠层和左侧召唤把手。
- 召唤态：点击把手浮出的精简菜单含返回、翻译开关、字幕 · 听音来源切换、收藏当前句四项，且用完即隐，不长期占屏。
- 合规：把手与菜单不遮挡 YouTube 播放器控件、进度条、右侧点赞 / 评论 / 分享、频道信息和品牌区域。
- 回归：Phase 6.6 的视频模式基线与字幕叠层、Phase 6.7 的字幕 / 听音切换与额度、Phase 8 的 YouTube 站点适配仍正常。

---

## Phase 8.7: YouTube 整站沉浸重构 + 修交互破坏

> 依据 ADR-0004 v2.6 修订段 + Product-Spec v2.6 + ARCHITECTURE v2.6（Browser agent 层 SPA 约束、Risk「YouTube SPA injection」、Dev Planning 输入）。真机验证 v2.5 实现暴露两个问题：① v2.5 只把视频播放页特殊化，YouTube 首页 / 列表 / 搜索 / Shorts 仍走通用文本网页管线、套了「原文 / 双语 / 学习」阅读模式控件 + 浏览工具条；② `browser-agent` 注入（`.atDocumentEnd` 一次性注入 + 全量 DOM 扫描 + 全局 touch / mouse 事件监听 + fixed overlay + 不监听 SPA 路由）破坏了 YouTube 单页应用的原生滑动 / 点击 / 路由。本 Phase 把 YouTube 从「普通可翻译网页 + 视频页特殊」重定位为「专门适配的视频站点」，并修复注入对原生交互的破坏；不重做字幕 / 听音翻译能力本身。

**交付内容**：
- 让 `WebBrowserView` 对 YouTube **整站**（首页 / 列表 / 搜索 / Shorts / 视频页）走极简 chrome：不显示 `browserBody` 的阅读显示模式分段控件（原文 / 双语 / 学习）和常驻浏览工具条；把「YouTube 整站隐形 + 仅视频播放页叠字幕」的判定从只认 `isVideoImmersiveMode` / `isYouTubeVideoURL` 的 `/watch`、`/shorts` 路径扩展为按 YouTube 域名整站识别（区分「整站隐形」与「仅视频页才叠字幕」两个不同判定）。
- 把 `browser-agent` YouTube adapter 与 runtime 注入改为 SPA 友好轻注入：监听前端路由变化（History API `pushState` / `replaceState` / `popstate`）在 YouTube 内前端路由切换时重判页面类型；不对 YouTube 做全量 DOM 扫描；不注册会干扰 YouTube 原生滚动 / 点击 / 手势的全局事件监听；overlay 不使用会干扰 YouTube 虚拟滚动的布局（避免 fixed 覆盖滚动容器）。
- 修复注入对原生交互的破坏，让 YouTube 整站能正常上下滑视频列表、点开视频 / Shorts、SPA 前端路由不报错不卡；同时移除 YouTube 页面文字翻译能力——首页 / 列表 / 搜索不注入翻译逻辑，视频播放页的双语字幕叠层 + v2.5 隐形态 / 召唤态保持可用、不回退。

**关键文件**：
- `[修改] apps/ios/AgentEnglish/Screens/WebBrowserView.swift` — YouTube 整站极简 chrome 分支（隐藏阅读显示模式分段控件与常驻浏览工具条）+ 整站识别判定，区分「整站隐形」与「仅视频页叠字幕」
- `[修改] apps/ios/AgentEnglish/Web/WebBridgeController+VideoCaption.swift` — YouTube 站点 / 页面类型判定从只认 `/watch`·`/shorts` 扩展为整站识别（新增 YouTube 整站判定，保留视频页才叠字幕的语义）
- `[修改] packages/browser-agent/src/site-adapters/youtube.ts` — YouTube 页面类型判定接入 SPA 前端路由重判、整站只在视频播放页声明字幕叠层能力、首页 / 列表 / 搜索不声明翻译注入
- `[修改] packages/browser-agent/src/runtime-source/ui-bridge.ts` — YouTube 走轻注入路径，监听 History API 路由变化重判页面类型，去除干扰原生滚动 / 点击 / 手势的全局事件监听
- `[修改] packages/browser-agent/src/runtime-source/scanner.ts` — YouTube 整站跳过全量 DOM 扫描，仅视频播放页走字幕句识别路径
- `[修改] packages/browser-agent/src/overlay/video-caption-overlay.ts` — 字幕叠层 overlay 布局避免干扰 YouTube 虚拟滚动（不用 fixed 覆盖滚动容器），整站非视频页不渲染翻译 overlay
- `[修改] packages/contracts/src/site-capability.ts` — 如需新增 YouTube 整站 / 页面类型与「整站隐形 / 仅视频页字幕 / 不注入翻译」站点状态字段（无需新增则保持现状）
- `[新增] apps/ios/AgentEnglishTests/YouTubeSiteImmersionTests.swift` — YouTube 整站识别、整站极简 chrome 判定与「仅视频页叠字幕」分支的测试
- `[新增] packages/browser-agent/tests/youtube-spa-injection.test.ts` — SPA 路由重判、YouTube 整站不全量扫描、不注册干扰原生交互的全局事件的注入行为测试

**依赖前置 Phase**：
- 依赖 Phase 6.6（需要 YouTube 视频模式基线、`VideoCaptionSegment` / `VideoCaptionOverlayState` contract 和浏览器沉浸 chrome）
- 依赖 Phase 8.6（需要 YouTube 视频页隐形态 / 召唤态 + 左侧召唤把手 + 精简胶囊菜单，本 Phase 在其之上扩展到整站且不得回退视频页交互）
- 依赖 Phase 8（需要 YouTube 站点适配基线；本 Phase 据 v2.6 移除其中的 YouTube 页面文字翻译，其余站点适配定位不变）
- 依赖 ADR-0004 v2.6 修订段（YouTube 整站重定位 + SPA 友好注入 + 绝不破坏交互 + 不做页面文字翻译）和 Product-Spec v2.6

**架构约束映射**：
- 层次边界：YouTube 整站 / 页面类型识别、SPA 路由监听、字幕句识别和 overlay 渲染只在 `packages/browser-agent`（`site-adapters/youtube.ts`、`runtime-source/`、`overlay/`）；`apps/ios` 入口层只承载 YouTube 整站极简 chrome 分支、整站隐形 / 视频页字幕状态展示，不硬编码 YouTube DOM selector；翻译 / 听音请求仍由 native `ModelServiceClient` / 分层 `Providers` 路由，JS 不直接调模型服务。
- 目录职责：允许修改 `WebBrowserView.swift`、`WebBridgeController+VideoCaption.swift`、`site-adapters/youtube.ts`、`runtime-source/ui-bridge.ts`、`runtime-source/scanner.ts`、`overlay/video-caption-overlay.ts` 和（如需）`contracts/src/site-capability.ts`；禁止在 `apps/ios` 中写 YouTube DOM 规则，禁止 `browser-agent` 修改 YouTube 播放器、下载媒体或完整字幕文件、遮挡控件 / 广告 / 品牌区域，禁止在 YouTube 非视频页注入翻译逻辑或套阅读显示模式 UI。
- ADR 约束：依据 ADR-0004 v2.6——YouTube 整站走原生体验，不在任何页面套阅读显示模式控件 / 常驻浏览工具条；YouTube adapter 走 SPA 友好轻注入（监听前端路由、不全量扫描、不注册干扰原生交互的全局事件、overlay 不破坏布局）；整站只在视频播放页做字幕叠层；YouTube 注入破坏原生交互（滑动 / 点击 / SPA 路由）属 review 阻断项；本版不做 YouTube 页面文字翻译。
- 后续范围：本版不做 YouTube 页面文字翻译（标题 / 简介 / 评论 / 搜索结果），该能力移除留作后续；不重做字幕 / 听音翻译能力（沿用 Phase 6.6 / 6.7 / 8.6）；不扩展 Reddit / Wikipedia / AO3 / X 适配（定位不变、延后）；不做 Netflix / Disney+ / Coursera；不做 YouTube 替代客户端、媒体 / 字幕下载、去广告或后台播放。

**已知风险**：
- YouTube 单页应用的前端路由、虚拟滚动和动态 DOM 行为复杂，SPA 路由监听与轻注入若覆盖不全，可能在某些页面类型切换时漏判或残留 overlay；本 Phase 必须以「整站不破坏原生交互」为硬验收，宁可少注入也不破坏滑动 / 点击 / 路由。
- 整站识别若过宽（误把非 YouTube 域名当 YouTube）或过窄（漏判 `music.youtube.com` / `m.youtube.com` / `youtu.be` 等），会导致 chrome 判定错误；整站隐形判定与「仅视频页叠字幕」判定必须分别覆盖各 YouTube 域名与页面类型。
- 移除 YouTube 页面文字翻译需确保不波及通用文本网页（Reddit / Wikipedia / AO3 / 文章）的翻译注入；YouTube 专属轻注入路径必须与通用扫描路径隔离，避免一处改动拖垮另一类页面。

**验收标准**：
- 最低：真机 / 模拟器在 App 内打开 YouTube，整站（首页 / 列表 / 搜索 / Shorts / 视频页）能正常操作——上下滑视频列表、点开 Shorts、进视频不报错不卡，SPA 前端路由切换正常；YouTube 首页 / 列表 / 搜索不出现阅读显示模式分段控件（原文 / 双语 / 学习）和常驻浏览工具条。
- 交互（review 阻断项）：YouTube 注入不破坏原生交互——滑动、点击、SPA 前端路由必须正常；YouTube adapter 走 SPA 友好轻注入（监听前端路由重判页面类型、不全量扫描、不注册干扰原生滚动 / 点击的全局事件、overlay 不破坏 YouTube 布局）；整站只在视频播放页注入字幕叠层，首页 / 列表 / 搜索不注入翻译逻辑。
- 视频页：视频播放页的双语字幕叠层 + v2.5 隐形态 / 召唤态（左侧召唤把手 + 精简胶囊菜单：返回 / 翻译开关 / 字幕 · 听音切换 / 收藏当前句）仍可用、不回退。
- 范围：YouTube 页面文字翻译能力已移除（首页 / 列表 / 搜索 / 评论不做文字翻译），不被当作缺失功能。
- 回归：Phase 8.5 的翻译分层（Free 文本翻译走翻译代理、`MODEL_SERVICE_ROOT` 未配置时仍可翻）、Phase 8.6 的视频页隐形态 / 召唤态、Phase 8 的其他站点（Reddit / Wikipedia / AO3 / X）适配与通用文本网页翻译均不被破坏。

---

## Phase 8.8: translation-proxy Free 翻译 provider 改用便宜大模型

> 依据 ADR-0005「v2.7 修订」段 + Product-Spec v2.7「AI 服务与模型等级」+ ARCHITECTURE v2.7（Translation proxy service 边界、Free translation proxy dependency risk、Dev Planning 输入）。Phase 8.5 已建立独立 `services/translation-proxy`（当时内部转发第三方通用翻译 Google / 微软）+ iOS `AgentEnglishCore/Providers` 按 entitlement 路由。v2.7 把 Free 文本 / 字幕翻译的 provider 实现从「第三方通用翻译 API」改为「产品方在服务端配置的便宜大模型（OpenAI 兼容 Chat Completions，如 DeepSeek V3 / Kimi / GLM / Qwen）」：Google Cloud / Azure 翻译账号申请麻烦、需信用卡，大模型 API 注册充值简单、成本低、翻译质量优于通用机器翻译。本 Phase **只改 `services/translation-proxy` 内部 provider 实现**——iOS 客户端 `Providers` 路由与 `services/model-gateway` 都不动；翻译分层 / 独立部署 / 故障隔离 / key 只在服务端 / 不做 BYOK / 跨端复用等核心决策全部保留，按 session 的 Free 限额、文本分块、缓存、错误归一、provider fallback 等既有基建复用。

**交付内容**：
- 在 `services/translation-proxy/src/providers/` 新增 OpenAI 兼容大模型 Chat Completions provider adapter：用翻译 prompt 调用大模型把英文文本翻成中文，逐 `segmentId` 回填译文；实现 `TranslationProviderAdapter` 接口、复用既有 `ProviderHttpTransport`（便于单测注入 stub、避免真实出网），prompt 必须约束模型只输出译文、不输出解释 / 标注 / 原文。
- 调整 provider 选择与默认：把便宜大模型 provider 设为默认 Free 翻译 provider；原 google / microsoft provider 保留接口作为后续可选的通用翻译通道（默认不启用），按可配置的 provider 列表与 fallback 顺序装配，不破坏既有 `translateWithFallback` 编排。
- 改配置装配：`src/env.ts` 与 `.env.example` 从 `GOOGLE_TRANSLATE_API_KEY` / `AZURE_TRANSLATOR_API_KEY` 改为大模型的 Base URL + API Key + 模型名（OpenAI 兼容），扩展 `TranslationProviderID` 以含大模型 provider；这些 key / Base URL 仍只在服务端从 `process.env` 读取，绝不内联、绝不进客户端。
- 复用既有基建：按 session 的 Free 限额（`src/quota/session-quota.ts`）、文本分块（`routes/translate.ts` 的 `chunkBySize`）、缓存（`src/cache/translation-cache.ts`）、错误归一（落在 contracts `ModelServiceErrorCode` 集合内）、provider fallback（`src/providers/fallback.ts`）保持不变；`routes/translate.ts` 仅在为适配大模型 provider 的分块 / token 约束所必需时做最小调整，请求 / 结果 contract（`/v1/translate-text` 入参与逐 segment 译文出参）不变。
- 扩展 `tests/translation-proxy.test.mjs`：补便宜大模型 provider 的翻译（happy path 逐 segment 译文）、分块、缓存命中、按 session 限额、fallback、错误归一覆盖，仍以注入式 stub adapter 断言、不连真实大模型、不依赖任何大模型 gateway 环境变量；保留并不回退「`MODEL_SERVICE_ROOT` 未配置时 Free 仍可翻」的解耦测试。

**关键文件**：
- `[新增] services/translation-proxy/src/providers/openai-compatible.ts` — OpenAI 兼容大模型 Chat Completions 翻译 provider adapter（翻译 prompt、逐 segment 译文解析、实现 `TranslationProviderAdapter`、复用 `ProviderHttpTransport`）
- `[修改] services/translation-proxy/src/env.ts` — `TranslationProviderID` 扩展含大模型 provider；`resolveProviders` 改为读取大模型 Base URL + API Key + 模型名（OpenAI 兼容）并把大模型 provider 设为默认，google / microsoft 保留为可选
- `[修改] services/translation-proxy/.env.example` — 从 `GOOGLE_TRANSLATE_API_KEY` / `AZURE_TRANSLATOR_API_KEY` 改为大模型 Base URL + API Key + 模型名占位键名（OpenAI 兼容），保留 PORT / 限额 / 分块阈值；通用翻译 key 降为后续可选注释
- `[修改] services/translation-proxy/src/providers/types.ts` — 如新增大模型 provider 需要的请求 / 响应类型或 provider 配置字段（仅在必要时扩展，保持 `TranslationProviderAdapter` 抽象稳定）
- `[修改] services/translation-proxy/src/index.ts` — provider 装配 / 默认选择接入大模型 provider（依赖解析 `resolveProxyDependencies` 装配默认 provider）
- `[修改] services/translation-proxy/src/routes/translate.ts` — 仅在适配大模型 provider 的分块 / token 约束所必需时做最小调整，保持请求 / 结果 contract 与错误归一码不变
- `[修改] services/translation-proxy/tests/translation-proxy.test.mjs` — 扩展大模型 provider 的翻译 / 分块 / 缓存 / 限额 / fallback / 错误归一覆盖，保留 `MODEL_SERVICE_ROOT` 未配置仍可翻的解耦测试
- iOS `apps/ios/AgentEnglishCore/.../Providers/`（含 `TranslationProxyClient.swift` / `TranslationProviderClient.swift`）与 `services/model-gateway/` 本 Phase **不改**（路由、契约、听音 ASR 链路保持原样）

**依赖前置 Phase**：
- 依赖 Phase 8.5（需要已建立的独立 `services/translation-proxy`、provider adapter 抽象 / fallback / 限额 / 分块 / 缓存基建，以及 iOS `Providers` 按 entitlement 路由——本 Phase 在其内部 provider 实现上做替换，不得回退其分层与 iOS 路由）
- 依赖 ADR-0005 v2.7 修订段（Free 翻译 provider：第三方通用翻译 → 便宜大模型；翻译分层 / 独立部署 / 故障隔离 / key 只在服务端 / 不做 BYOK / 跨端复用不变）
- 依赖 Product-Spec v2.7「AI 服务与模型等级」（便宜大模型翻译为 Free 默认）与 ARCHITECTURE v2.7（Translation proxy service 边界）

**架构约束映射**：
- 层次边界：Free 文本翻译的便宜大模型调用、翻译 prompt、限额、分块、缓存、fallback 和错误归一只在 `services/translation-proxy`；entitlement 等级判定仍归 `services/model-gateway` 与 session；iOS `Providers` 层只做按 entitlement 的路由编排（Free→translation-proxy，Pro / Max→model-gateway），本 Phase 不改其代码。
- 目录职责：允许修改 `services/translation-proxy/`（`src/providers`、`src/env.ts`、`.env.example`、`src/index.ts`、必要时 `src/routes/translate.ts`、`tests`）；禁止把大模型 / 翻译 key 或 Base URL 放进客户端 / `browser-agent` / App bundle，禁止在 `translation-proxy` 内调用 model-gateway 的强模型 / ASR 或判定 entitlement，禁止改动 iOS `Providers` 路由或 `services/model-gateway`。
- ADR 约束（ADR-0005 v2.7）：translation-proxy 与 model-gateway 仍独立部署、互不依赖，model-gateway（`MODEL_SERVICE_ROOT`）未配置 / 故障时 Free 文本翻译仍可用；只替换 proxy 内部 provider（通用翻译 → 便宜大模型），不回退到「Free 走 model-gateway」；翻译 key 只托管在 proxy 服务端、不向用户暴露任何 Provider / key / 配置入口（不做 BYOK）；数据流与隐私披露保持「Free 文本 → 自有翻译代理 → 便宜大模型 Provider」，本 Phase 不改 iOS 设置页隐私文案的两条数据流结构（措辞已在 Spec / ADR 同步）。
- 后续范围：不在本 Phase 重构 Pro / Max 翻译链路、不改听音 ASR（仍走 model-gateway，Free 每天 10 分钟），不做 BYOK / 用户可配置 provider，不做 Web / Android 翻译壳，不把通用翻译 provider 作为默认重新启用。

**已知风险**：
- 大模型翻译相比通用翻译 API 延迟与成本略高：prompt 必须严格约束「只输出译文、不输出解释 / 标注 / 原文 / 多余前后缀」，否则会污染逐 segment 回填；需要可验证的译文解析与对不规范输出的归一处理。
- 大模型有 token / 上下文长度限制：分块阈值（`TRANSLATION_PROXY_CHUNK_CHAR_LIMIT`）与多 segment 合并策略需与大模型 provider 适配，避免单块超限或逐 segment 顺序 / 数量错位；分块后逐 segment 译文必须可稳定映射回 `segmentId`。
- 大模型 provider 限流 / 偶发失败：必须复用既有限额、缓存与 provider fallback，单一大模型 provider 失败不得让 Free 文本翻译整体失败，错误必须归一到 contracts `ModelServiceErrorCode` 集合（如 `provider-fallback-failed` / `service-unavailable` / `quota-exceeded`），不裸抛字符串。
- 不得破坏 Phase 8.5 已建立的解耦与 iOS 路由：本 Phase 只动 proxy 内部 provider 实现，若误改 iOS `Providers` 路由、`/v1/translate-text` 契约或让 Free 链路隐式依赖 model-gateway，即视为回退（review 阻断项）。

**验收标准**：
- 最低：translation-proxy 单测全部通过，且覆盖便宜大模型 provider 的翻译（逐 segment 译文）、文本分块、缓存命中、按 session 限额（含跨 session 隔离与自报 tier 被忽略）、provider fallback、错误归一；TS strict 编译无 `any`。
- provider：默认 Free 翻译 provider 为便宜大模型（OpenAI 兼容 Chat Completions）；`.env.example` 与 `env.ts` 以大模型 Base URL + API Key + 模型名装配，google / microsoft 仅作后续可选通用翻译通道、默认不启用。
- 解耦（不回退）：model-gateway 未配置（`MODEL_SERVICE_ROOT` 未设）或不可用时 Free 文本翻译仍可完成（既有解耦测试保留通过），iOS `Providers` 按 entitlement 路由与 `services/model-gateway` 未被改动。
- 安全：大模型 / 翻译 key 与 Base URL 只在 `translation-proxy` 服务端，不进入 iOS / `browser-agent` / App bundle；不向用户暴露任何 Provider / key / 配置入口。
- 端到端（人工验收项）：在服务端配好便宜模型 key（OpenAI 兼容）+ 启动 translation-proxy 后，App 内用一个带可访问 CC 字幕的 YouTube 视频，能看到视频画面安全区域出现「英文原句 + 中文翻译」的双语字幕（Free 档、无需登录 / 配置），界面仍只显示 free translation、不暴露背后模型 / 厂商。
- 回归：Phase 8.5 的翻译分层与解耦、Phase 8.6 视频页隐形态 / 召唤态、Phase 8.7 YouTube 整站沉浸与 SPA 友好注入、Phase 8 其他站点适配与通用文本网页翻译均不被破坏。

---

## Phase 8.9: YouTube 视频字幕轨读取 + 播放进度同步

> 依据 ADR-0004「v2.8 修订」段 + Product-Spec v2.8（YouTube 边界字幕来源 + YouTube 视频沉浸翻译核心功能）+ ARCHITECTURE v2.8（Browser agent 层「视频自带字幕轨数据读取」职责、Input/Output boundary、YouTube caption 隐私行、YouTube Developer Policies 合规行）。真机验证暴露：现状字幕来源是「读播放器渲染的 DOM」（`packages/browser-agent/src/site-adapters/youtube.ts` 的 `readActiveYouTubeCaptionText` 读 `.ytp-caption-segment` 等渲染节点，`runtime-source/youtube-injection.ts` 同样 `document.querySelectorAll(".ytp-caption-segment")`），只在「横屏 watch + 用户手动开 CC」时可读，翻不了 Shorts（用户核心场景，竞品 Immersive Translate / Trancy 能翻）。本 Phase 把字幕来源从「渲染 DOM / 可见字幕」改为「读取视频自带的字幕轨数据（player response / timedtext，含自动生成字幕）」，按播放进度（`video.currentTime`）时间同步显示当前句，不依赖用户开 CC、覆盖 Shorts 与横屏。**这依赖 YouTube 内部接口（WKWebView 移动版 player response 结构、SPA 路由、timedtext fetch 鉴权都有失败风险），故第一步必须在真机 / 模拟器 WKWebView 的 YouTube 页面做技术 spike 验证「能读到 captionTracks + timedtext fetch 成功拿到带时间轴的字幕」，spike 通过再做时间同步 + 翻译 + overlay。** 本 Phase 只改「字幕文本怎么来」（DOM → 字幕轨数据 + 播放进度同步），下游翻译（Free→translation-proxy 分层，已解耦兜底）/ overlay 渲染链路尽量复用 Phase 6.6 / 8.6 / 8.7 现有实现；不重做整站沉浸（沿用 8.7）、不重做隐形态 / 召唤态（沿用 8.6）、不重做翻译分层（沿用 8.5 / 8.8）。

**交付内容**：
- **第一步技术 spike（前置闸门，spike 不通过不投入完整实现）**：在真机 / 模拟器 WKWebView 的 YouTube watch + Shorts 页面验证字幕轨可读链路——读 `ytInitialPlayerResponse` 或 `document.querySelector('#movie_player').getPlayerResponse()` 的 `.captions.playerCaptionsTracklistRenderer.captionTracks`，取轨的 `baseUrl`（timedtext），在页面上下文内 `fetch(baseUrl + "&fmt=json3")` 拿到带时间轴的字幕句并打通一次到 native 的桥接；产出一段可在真机跑、记录「能否读到 captionTracks / 各轨语言与是否自动生成 / timedtext fetch 是否成功（含 403 / 同源情况）/ WKWebView 移动版 player response 结构差异」的最小验证（spike 探针 + 真机验证笔记，结论写入本 Phase 验收记录）。spike 失败（如 timedtext fetch 在 WKWebView 内被鉴权拦截）→ 暂停后续实现并回报，不强行交付。
- spike 通过后实现字幕轨读取与解析（只在视频播放页）：在 `site-adapters/youtube.ts` 与 `runtime-source/youtube-injection.ts` 用字幕轨数据读取替换现状 `.ytp-caption-segment` DOM 读取——解析 `captionTracks`、按「英文 / 目标语言 / 自动生成轨」优先级选轨、fetch 选中轨的 timedtext（json3）解析为带 `startTimeSeconds` / `endTimeSeconds` 的字幕句序列；SPA 切视频后用 `getPlayerResponse()` 重取当前视频字幕轨（沿用 8.7 的 SPA 前端路由重判时机）。
- 实现按播放进度的时间同步：监听 `video` 的 `timeupdate`（节流）按 `currentTime` 在已解析字幕句序列中定位当前句，驱动 `VideoCaptionSegment.activeSegment` 更新与 overlay 渲染；当前句去重（沿用 `lastVideoCaptionSignature` 思路）避免重复 post / 重复翻译，逐句翻译请求做节流 + 缓存（相同句不重复打 proxy）。
- 复用既有翻译 / overlay 下游：当前句 `sourceText` 仍走现状链路（browser-agent 构建 `VideoCaptionOverlayState` → native `handleVideoCaptionState` → Free 走 translation-proxy / Pro·Max 走 model-gateway → `applyVideoCaptionOverlayState` 渲染双语 overlay），不在 browser-agent 直连模型；overlay 仍避开播放器控件 / 广告 / 品牌区域，无法安全叠加时降级（沿用 6.6 / 8.6）。
- 无字幕轨视频降级：无 `captionTracks`（如纯烧录字幕视频）时不报错，走听音翻译 Beta（Phase 6.7 已建，Free 每天 10 分钟）或字幕不可用提示；不做 OCR、不做画面字幕识别。
- 如契约需扩展则同步双端：`VideoCaptionSegment` 已有可选 `startTimeSeconds` / `endTimeSeconds`（字幕轨来源将实际填充）；如需新增字段（如选中轨语言 / 是否自动生成轨标识）则在 `packages/contracts/src/video-caption.ts` 做向后兼容扩展，并保持 TS fixture 与 Swift decoder 字段等价；改 `runtime-source/` 后重新生成 `apps/ios/AgentEnglish/Generated/BrowserAgentRuntimeSource.generated.swift`，确保无漂移。

**关键文件**：
- `[修改] packages/browser-agent/src/site-adapters/youtube.ts` — 字幕识别从读 `.ytp-caption-segment` 渲染 DOM 改为读字幕轨数据：解析 `getPlayerResponse()` / `ytInitialPlayerResponse` 的 `captionTracks`、按语言 / 自动生成优先级选轨、声明字幕轨来源下的字幕可用 / 不可用 / 降级能力（`readActiveYouTubeCaptionText` 改为字幕轨来源，或新增字幕轨读取并退役 DOM 读取路径）
- `[修改] packages/browser-agent/src/runtime-source/youtube-injection.ts` — 注入侧字幕来源改写：从 `document.querySelectorAll(".ytp-caption-segment")` 改为读 player response 的 `captionTracks` + 同源 fetch timedtext（json3）解析带时间轴字幕句；监听 `video` `timeupdate`（节流）按 `currentTime` 定位当前句、去重、驱动 overlay；SPA 切视频用 `getPlayerResponse()` 重取字幕轨
- `[修改] packages/browser-agent/src/runtime-source/youtube-overlay.ts` — 如时间同步导致 overlay 更新频次 / 当前句渲染方式变化所需的最小调整（仍避开播放器控件 / 广告 / 品牌区域、不破坏 YouTube 布局；无变化则保持现状）
- `[修改] packages/browser-agent/src/overlay/video-caption-overlay.ts` — 如当前句滚动显示 / 去重渲染需要的最小调整（仍只在视频播放页、降级为视频下方字幕条的逻辑不回退；无变化则保持现状）
- `[修改] packages/contracts/src/video-caption.ts` — 字幕轨来源填充已有 `startTimeSeconds` / `endTimeSeconds`；仅在确需时新增向后兼容字段（选中轨语言 / 自动生成轨标识等），保持 `VideoCaptionSegment` / `VideoCaptionOverlayState` 双端等价
- `[修改] apps/ios/AgentEnglish/Generated/BrowserAgentRuntimeSource.generated.swift` — 改 `runtime-source/` 后按既有生成流程重新生成，确保 Swift 侧注入源与 TS 源一致、无漂移（不手改）
- `[修改] packages/contracts/tests/fixtures/video-caption-youtube-watch.json` — 如契约扩展或时间轴字段语义变化，更新 watch 字幕状态 fixture 以反映字幕轨来源 + 时间轴；新增 Shorts 字幕轨来源 fixture（如 `video-caption-youtube-shorts.json`）覆盖 Shorts 场景
- `[新增] packages/browser-agent/tests/youtube-caption-track.test.mjs` — 字幕轨选轨（语言 / 自动生成优先级）、timedtext json3 解析为带时间轴字幕句、按 `currentTime` 时间同步定位当前句、当前句去重、无 `captionTracks` 降级到听音 / 提示的注入行为测试（以注入式 stub player response / timedtext payload 断言，不连真实 YouTube 接口）

**依赖前置 Phase**：
- 依赖 Phase 6.6（需要 YouTube 视频模式识别基线、`VideoCaptionSegment` / `VideoCaptionOverlayState` contract 与双端 fixture、视频字幕叠层 / 降级条 / 收藏当前句入口）
- 依赖 Phase 6.7（无字幕轨视频的听音翻译 Beta 降级路径、音频分钟额度、Free 每天 10 分钟）
- 依赖 Phase 8.6（视频页隐形态 / 召唤态 + 左侧召唤把手 + 精简胶囊菜单，本 Phase 在其上叠字幕轨来源的当前句，不得回退视频页交互）
- 依赖 Phase 8.7（YouTube 整站 SPA 友好轻注入 + 前端路由重判页面类型 + 整站只在视频播放页叠字幕；本 Phase 复用其 SPA 切视频重判时机来重取字幕轨，且不得破坏整站原生交互）
- 依赖 Phase 8.5 / 8.8（Free 文本 / 字幕翻译走 translation-proxy 分层、已解耦兜底；本 Phase 当前句翻译复用该链路，不改翻译分层）
- 依赖 ADR-0004 v2.8 修订段（字幕来源：渲染 DOM → 视频自带字幕轨数据）、Product-Spec v2.8 与 ARCHITECTURE v2.8（Browser agent 层字幕轨读取职责 + 合规边界）

**架构约束映射**：
- 层次边界（review 阻断）：字幕轨数据读取 / `captionTracks` 解析 / timedtext fetch + 解析 / 按 `currentTime` 的时间同步 / 当前句定位**只在 `packages/browser-agent`**（`site-adapters/youtube.ts`、`runtime-source/youtube-injection.ts`、必要时 `runtime-source/youtube-overlay.ts` / `overlay/video-caption-overlay.ts`）；`apps/ios` 入口层只承载视频字幕状态展示，不硬编码 YouTube DOM selector / 不解析字幕轨；当前句翻译仍由 native `ModelServiceClient` / 分层 `Providers`（Free→translation-proxy，Pro·Max→model-gateway）路由，**browser-agent 不直连模型 / 不持有翻译 key**。
- 目录职责：允许修改上述 `browser-agent` 字幕轨 / 注入 / overlay 文件、`contracts/src/video-caption.ts`（如需扩展）、相应 fixture，并重新生成 `BrowserAgentRuntimeSource.generated.swift`；禁止在 `apps/ios` 写字幕轨解析规则，禁止 `browser-agent` 调用模型服务 / 写本地数据库 / 修改 YouTube 播放器。
- ADR / 合规约束（review 阻断，ADR-0004 v2.8）：字幕只在播放当前视频时**实时读取其自带字幕轨数据用于翻译显示、只取当前播放所需**；**不保存为字幕文件、不离线缓存整轨、不再分发或搬运**；不下载 / 分离音视频、不替换 / 遮挡播放器控件 / 进度条 / 广告 / 品牌区域，无法安全叠加时降级为视频下方字幕条或提示；仍只在视频播放页做字幕翻译（v2.6 整站边界不变）。
- SPA / 交互约束（review 阻断，沿用 8.7）：SPA 切视频后用 `getPlayerResponse()` 重取当前视频字幕轨（接 8.7 前端路由重判时机）；不破坏 YouTube 原生交互（滑动 / 点击 / SPA 路由）、不注册干扰原生滚动 / 点击的全局事件、overlay 不破坏 YouTube 虚拟滚动布局；YouTube 非视频页不注入字幕逻辑。
- 后续范围：不做 OCR / 画面烧录字幕识别（无字幕轨走听音 Beta 或提示）；不重做整站沉浸 / 隐形态 / 召唤态 / 翻译分层（沿用既有 Phase）；不做字幕文件下载 / 离线整轨缓存 / 媒体下载；不扩展 Reddit / Wikipedia / AO3 / X；不做 Netflix / Disney+ / TED / Coursera。

**已知风险**：
- WKWebView 移动版 player response 结构可能与桌面版不同（字段路径 / `captionTracks` 位置差异），spike 必须先在真机 / 模拟器确认实际结构，不能假设与桌面 Web 一致。
- SPA 路由切换重取字幕轨的时机：切到新视频后 player response 可能尚未就绪 / 仍是上一个视频，需结合 8.7 的前端路由重判 + 适当重试 / 就绪判定，避免读到旧轨或读空。
- timedtext fetch 鉴权 / 同源风险：`baseUrl` fetch 可能需要页面上下文 / 同源 cookie，外部或跨上下文 fetch 易 403；spike 必须验证在 WKWebView 页面上下文内 fetch 能否成功，失败则回报（属 spike 闸门项）。
- 字幕轨多语言 / 自动生成轨选择：同一视频可能有多条轨（人工 / 自动生成 / 多语言），选轨优先级（英文 / 目标语言 / 自动生成）需明确且可降级，避免选错轨或在只有自动生成轨时漏选。
- 时间同步性能：`timeupdate` 触发频繁，未节流会导致过度计算 / 过度 post / 过度翻译；需节流 + 当前句去重，保证 Shorts 快切与长视频都流畅。
- 逐句翻译请求节流 / 缓存：按播放进度逐句翻译若不节流 / 不缓存会频繁打 translation-proxy；需相同句缓存命中、避免重复请求，且单句翻译失败不影响后续句与播放。
- 无字幕轨视频降级：纯烧录字幕 / 无 `captionTracks` 视频必须稳妥降级到听音 Beta 或字幕不可用提示，不报错、不空转、不伪装成功。
- 合规长期风险：字幕轨读取依赖 YouTube 内部接口，YouTube ToS / App Store 审核存在长期合规风险（与沉浸翻译类竞品同等做法），由产品方知情采用（ADR-0004 v2.8 已记录）。

**验收标准**：
- 闸门（技术 spike）：真机 / 模拟器 WKWebView 内打开 YouTube watch + Shorts，能读到 `captionTracks`、timedtext（json3）fetch 成功拿到带时间轴的字幕句，并打通一次到 native 的桥接；spike 结论（含 WKWebView 移动版结构差异 / fetch 鉴权情况）记录在案。spike 不通过则本 Phase 暂停并回报，不进入后续验收。
- 核心：真机上有字幕轨的 Shorts 与横屏 watch 视频**都能出按播放进度滚动的双语字幕**（英文原句 + 中文翻译），**不依赖用户手动开 CC**；SPA 切到新视频后能重取并显示新视频的字幕轨当前句。
- 降级：无字幕轨视频（纯烧录字幕等）走听音翻译 Beta 或字幕不可用提示，不报错、不空转。
- 合规（review 阻断）：字幕轨只实时读取用于翻译显示、不保存为文件、不离线缓存整轨、不再分发；不下载 / 分离媒体；overlay 不遮挡播放器控件 / 广告 / 品牌区域，无法安全叠加时降级。
- 交互（review 阻断）：不破坏 Phase 8.7 的 YouTube 整站原生交互（滑动 / 点击 / SPA 路由）；非视频页不注入字幕逻辑；时间同步的 `timeupdate` 监听已节流、当前句已去重，不卡顿。
- 质量门槛：TS strict 无 `any`、改动单文件 ≤300 行、`BrowserAgentRuntimeSource.generated.swift` 无漂移（按生成流程重生成、不手改）、`packages/browser-agent` 测试（含新增 `youtube-caption-track.test.mjs`）通过；如扩展契约则 TS fixture 与 Swift decoder 字段等价测试通过。
- 回归：Phase 6.6 / 6.7 视频模式与字幕 / 听音双路径、Phase 8.6 隐形态 / 召唤态、Phase 8.7 YouTube 整站沉浸与 SPA 友好注入、Phase 8.5 / 8.8 翻译分层与解耦、Phase 8 其他站点适配与通用文本网页翻译均不被破坏。

---

## Phase 9: 导出、回归加固与交付收口

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
- 依赖 Phase 1 到 Phase 8（需要完整功能面、回归样本和导出源数据）

**架构约束映射**：
- 层次边界：导出与测试都消费既有 contracts / core / browser-agent，不新增越层捷径；website data 清理仍走 native 隐私模块。
- 目录职责：允许补齐 `AgentEnglishTests/`、`packages/browser-agent/fixtures/`、`Persistence/` 和 root validation scripts；禁止为了测试方便把业务逻辑挪回 `src/` 或旧 Next 路径。
- ADR 约束：导出不能泄露 Keychain 服务令牌；隐私清理必须继续区分学习数据和网站数据；回归检查要覆盖 bridge、SwiftData、模型服务和站点 fixture。
- 后续范围：不在本 Phase 内引入账号同步、订阅支付或跨平台共享数据库。

**已知风险**：
- 导出编码与 fixture 维护成本会随站点数量上升，因此本 Phase 需要先把核心五站点和关键数据字段稳定下来。

**验收标准**：
- 最低：用户能导出 CSV / Markdown；错误和空状态完整；关键 repository、bridge 和 fixture 回归通过；新构建路径不再依赖旧 Next / Drizzle 产品入口。
- 回归：Phase 1 到 Phase 8 的全部核心流程仍可编译、启动并使用。

---

## 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 运行时 | iOS | 17+ | ADR 固定首版最低系统版本，供 SwiftData 与原生 WebView 方案使用 |
| 原生语言 | Swift | 6.x | iOS 原生壳与无 UI 核心模块主语言 |
| 原生 UI | SwiftUI | iOS 17 SDK | 首页、浏览页、收藏、复习、设置和底部抽屉 |
| Web 容器 | WebKit `WKWebView` | iOS 17 SDK | 承载真实网页浏览、`WKUserScript` 注入和 bridge 消息 |
| 本地持久化 | SwiftData | iOS 17+ | 收藏、历史、复习、统计、翻译缓存等非敏感数据 |
| 客户端令牌存储 | Keychain Services | iOS 17+ | 后端 session token、App 服务令牌、匿名设备令牌或会话引用；不保存第三方 Provider 凭证或固定生产等级 token |
| 后端运行时 | Node.js service | >=22.13.0 | `services/model-gateway`，承载游客 / 登录 session、entitlement、模型目录、Provider 密钥、额度和翻译 / 解释 API |
| 共享脚本语言 | TypeScript | 5.9.3 | `packages/contracts` 与 `packages/browser-agent` 开发语言 |
| JS 运行时 | Node.js | >=22.13.0 | workspace 构建和脚本运行环境 |
| 包管理 / Workspace | pnpm | 10.33.4 | 管理 `packages/contracts`、`packages/browser-agent`、`services/model-gateway` 和根脚本 |

## 数据库表（如有）

| 表名 | 创建 Phase | 修改记录 | 用途（含外键关系）|
|------|-----------|---------|------|
| `app_settings_records` | Phase 2 | Phase 3 增加隐私提示状态；Phase 6 改为服务等级 / 模型偏好快照；Phase 6.5 关联账号状态快照；Phase 7 增加目标语言、阅读显示模式默认值、数据保留策略 | 保存本机设置项；关联当前账号状态、服务等级和模型偏好快照 |
| `provider_profile_records` | Phase 2 | Phase 6 标记为迁移对象 | 旧直连 Provider 配置记录；Phase 6 后不得作为最终产品配置来源，可迁移为 `model_service_profile_records` 或删除 |
| `account_state_records` | Phase 6.5 | — | 保存用于展示的账号类型、邮箱脱敏文本、当前 entitlement、额度快照和最后同步时间；真实 session token 只在 Keychain |
| `model_service_profile_records` | Phase 6 | Phase 6.5 改为由 session entitlement 驱动 | 保存后台下发的服务等级、模型显示名、额度状态、默认模型偏好和最后同步时间；不保存 Provider 密钥、Base URL、真实内部模型名或授权 token |
| `saved_item_records` | Phase 2 | Phase 5 增加解释、来源上下文、搜索字段 | 收藏词 / 短语 / 句子；可生成 `review_card_records` |
| `review_card_records` | Phase 2 | Phase 7 增加 `lastReviewedAt`、`nextDueAt`、`feedbackState` | 主动回忆卡片；通过 `savedItemId` 关联 `saved_item_records` |
| `history_entry_records` | Phase 7 | — | 记录最近翻译网页与继续学习入口；可按站点清理 |
| `translation_cache_records` | Phase 4 | Phase 7 增加 `historyEntryId` 弱关联 | 以页面 / 文本 hash 关联翻译结果，减少重复请求 |
| `daily_stat_records` | Phase 7 | — | 保存每日翻译页数、收藏数、复习完成数和连续使用天数聚合结果 |
| `site_shortcut_records` | Phase 8 | — | 保存首页常用站点入口、图标、排序和启用状态 |

## 开发规则

**项目特定规则**（dev-builder 通用规则之外的项目约定）：
- 包管理器：`pnpm`
- 首版产品入口只能是 `apps/ios`；旧 `src/`、`.next/`、Drizzle 配置和 `data/agent-english.sqlite*` 都视为历史残留，不得复活为新入口或新数据源。
- 模型服务入口只能是 `services/model-gateway`；不得复活旧 `src/app/api/providers` 或旧游戏 Provider API。
- `packages/contracts` 是 bridge event、DTO、错误码和数据模型命名的事实源；Swift DTO 必须与其保持等价。
- 所有 WebView 与 JS 通信都必须经过结构化 `BridgeEvent`，禁止 SwiftUI View 拼接临时业务 JavaScript 处理收藏、翻译或解释。
- `packages/browser-agent` 只负责 DOM、overlay、selection 和 site adapter；不得持有 API Key、直接调用 Provider / 模型服务、写本地数据库或修改 YouTube 播放器核心行为。
- SwiftData 只保存非敏感学习数据、账号展示状态和服务等级快照；Keychain 只保存后端 session token、App 服务令牌或匿名设备令牌；Provider 凭证只在后端；website data 与学习数据必须分开提示和清理。
- 后端必须以 session entitlement 判定 Free / Pro / Max；iOS 请求体中的 `serviceTier` 不能作为授权依据。
- dev/staging 测试账号只能由 `ENABLE_DEV_AUTH=true` 启用；生产构建不得显示测试账号入口，生产后端不得接受测试账号登录。
- 若后续要支持 iOS 16 或更低版本、提前引入 Android / 订阅支付 / 正式账号恢复 / 云端学习数据，必须先新增 ADR，再改计划。

**通用规则**（按 dev-builder [开发规则]）：
- 详细见 dev-builder SKILL.md，本文件不重复定义
