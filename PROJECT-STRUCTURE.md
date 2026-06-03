# Project Structure - iPhone 英语学习浏览器

## Structural Pattern

| Concern | Decision |
|---|---|
| Project type | iPhone-first native mobile app with reusable browser injection packages. |
| Platform / runtime targets | Current: iOS + backend model gateway（auth / session / entitlement / Pro·Max / ASR）+ 独立轻量 translation-proxy（Free 文本翻译）. Future: Web app, Android, macOS, Windows, billing backend expansion and optional learning data sync. |
| Chosen structure pattern | `apps/` for platform shells, `packages/` for reusable browser agent and contracts, `services/` for backend model gateway（auth/session/entitlement/Pro·Max/ASR）和独立 translation-proxy（Free 文本翻译）, `docs/` for architecture decisions, root docs for product/design/architecture. |
| Reason | iOS 原生能力和 App Store 交付是首版关键；网页 DOM 识别与翻译层逻辑天然可跨 WebView 复用，适合放入 TypeScript 包；取消用户 BYOK 后，Provider / ASR 密钥、模型目录、会话、权益、文本额度、音频分钟额度和 fallback 必须进入后端服务；未来平台不应复用 iOS UI，但应复用协议、注入脚本和模型服务 API。 |

## Directory Tree

```text
agent_english/
  apps/
    ios/
      AgentEnglish/
        App/
        Screens/
        Web/
        Settings/
        Account/
        Assets.xcassets/
      AgentEnglishCore/
        Sources/
          AgentEnglishCore/
            Bridge/
            Contracts/
            Persistence/
            Providers/
            Account/
            Review/
            Privacy/
      AgentEnglishTests/
    android/
    macos/
    windows/
  packages/
    browser-agent/
      src/
        bridge/
        dom/
        overlay/
        site-adapters/
        modes/
        index.ts
      fixtures/
      package.json
    contracts/
      schemas/
      src/
      package.json
  services/
    model-gateway/
      src/
        auth/
        sessions/
        entitlements/
        catalog/
        routes/
        providers/
        quota/
        privacy/
        index.ts
      package.json
      tests/
    translation-proxy/
      src/
        routes/
        providers/
        quota/
        cache/
        index.ts
      package.json
      tests/
  docs/
    adr/
      ADR-0001-architecture-strategy.md
      ADR-0002-backend-managed-model-service.md
      ADR-0003-auth-session-entitlement.md
      ADR-0004-youtube-video-immersive-translation.md
    research/
  design_export/
    clean_pencil/
    5mGHS.png
    bCKWH.png
    uTNzx.png
  Product-Spec.md
  Design-Brief.md
  ARCHITECTURE.md
  PROJECT-STRUCTURE.md
  package.json
  pnpm-workspace.yaml
```

## Directory Responsibilities

| Path | Status | Responsibility | Forbidden |
|---|---|---|---|
| `apps/ios/` | create across DEV-PLAN Phase 2-3; account UI expands in Phase 6.5; video audio UI expands in Phase 6.7 | iOS App 工程、SwiftUI 界面、WKWebView 容器、原生导航、设置、账号状态展示、Keychain session token、local data、模型服务客户端、视频听音翻译状态和额度展示。 | 放 Android、Windows、Next 页面或跨平台抽象口号；把 DOM 规则直接写进 SwiftUI View；展示 Provider API Key 配置；让客户端自报 Free / Pro / Max 作为授权；后台静默听音。 |
| `apps/ios/AgentEnglish/` | create across DEV-PLAN Phase 2-3 | App target、SwiftUI screens、WebView container、toolbars、sheets、navigation、asset catalog。 | 复习算法、Provider 协议细节、JS 注入源码、SwiftData migration 逻辑、第三方 Provider 密钥。 |
| `apps/ios/AgentEnglish/App/` | create in DEV-PLAN Phase 2 | App 生命周期、依赖注入、Tab navigation、root scene。 | 业务规则、DOM selector、Provider SDK 细节、后台模型路由策略。 |
| `apps/ios/AgentEnglish/Screens/` | create in DEV-PLAN Phase 2, expand in later phases | 浏览首页、收藏、复习、设置等 SwiftUI 页面；设置页只展示账号状态、服务等级、模型档位、用量和隐私。 | 直接读写 WebView DOM、直接保存 API Key、展示自定义 Provider / BYOK 表单、临时拼接 bridge message、显示生产环境测试账号入口。 |
| `apps/ios/AgentEnglish/Account/` | create in DEV-PLAN Phase 6.5 if UI split is useful | 登录 sheet、游客 / 已登录 / dev 测试账号状态组件、退出登录确认、账号删除入口占位。 | 保存 session token、验证 Apple / Google token、决定后端 entitlement、展示 Provider 技术参数。 |
| `apps/ios/AgentEnglish/Web/` | create in DEV-PLAN Phase 3 | WKWebView wrapper、可收起 toolbar、bottom sheet、message handler 入口、文本型网页阅读显示模式 UI、YouTube 视频沉浸模式状态承载、字幕 / 听音来源状态、听音额度轻提示。 | DOM 扫描算法、站点适配、翻译 Provider 调用或模型服务路由、在 YouTube 视频页常驻阅读模式分段控件、后台录音或下载音视频。 |
| `apps/ios/AgentEnglishCore/` | create across DEV-PLAN Phase 2-3, expand later | Swift 无 UI 模块：收藏、历史、复习状态、账号 / session 状态、模型目录快照、服务等级、bridge DTO、视频翻译来源 / 听音额度 DTO、错误映射、隐私清理服务、SwiftData repository 接口、模型服务客户端。 | SwiftUI View、WKWebView DOM 选择器、站点 CSS selector、第三方网页品牌资源、第三方 Provider / ASR 密钥、固定生产等级 token、后台静默音频采集。 |
| `apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Bridge/` | create in DEV-PLAN Phase 3 | `BridgeEvent` decode/encode、schema version、request tracking、错误映射；Swift DTO 必须用 tests 与 `packages/contracts` 的 payload 字段保持等价。 | UI 展示、DOM selector、Provider 网络请求、模型服务网络实现。 |
| `apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/` | create in DEV-PLAN Phase 2, expand in later phases | SwiftData models、repository implementation、migration、cache 清理；Keychain 只保存后端 session token、App 服务令牌或匿名设备令牌。 | 明文 API Key、第三方 Provider 密钥、固定生产等级 token、WebKit cookie 管理、SwiftUI View state。 |
| `apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/` | existing provider adapter area; tiered translation routing added in translation tiering phase | 翻译 / 解释客户端：按 entitlement 把 Free 文本翻译路由到轻量翻译代理、Pro / Max 文本翻译与解释和听音路由到大模型 gateway；service-tier / audio-quota error mapping、retry、错误归一；Free 文本翻译在大模型 gateway 未就绪时仍可用；旧的全量直连 `/v1/translate` 链路作为迁移技术债收敛。 | 页面 overlay 渲染、收藏列表 UI、JS 注入源码、第三方 Provider / ASR 密钥和 Base URL 配置、把翻译 key 放进客户端。 |
| `apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Account/` | create in DEV-PLAN Phase 6.5 | `AuthSession` / `AccountStatus` / `EntitlementSnapshot` Swift DTO、session bootstrap、logout、dev/staging login client、Keychain session token 编排。 | 直接验证 Google / Apple identity token、硬编码测试账号密码、保存 Provider 凭证、把客户端选择的等级当授权。 |
| `apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Review/` | create in DEV-PLAN Phase 6 | 主动回忆卡、复习反馈、下一次复习优先级。 | 游戏化奖励、课程路径、页面 DOM 操作。 |
| `apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Privacy/` | create in DEV-PLAN Phase 3, expand in Phase 6 | 模型服务数据发送提示、后端转发说明、学习数据清理、网站数据清理提示策略。 | 悄悄上传浏览历史、替用户同意第三方数据发送。 |
| `apps/ios/AgentEnglishTests/` | create in DEV-PLAN Phase 2, expand in Phase 3 and later | Native core 单元测试、bridge contract decode 测试、SwiftData repository 测试、复习状态测试。 | 只做快照不验证业务规则。 |
| `apps/android/` | future documented only | 未来 Android 平台壳位置。 | 首版创建完整工程或复制 iOS 实现。 |
| `apps/macos/` | future documented only | 未来 macOS 平台壳位置。 | 首版创建桌面窗口或菜单实现。 |
| `apps/windows/` | future documented only | 未来 Windows 平台壳位置。 | 首版创建 WebView2 工程。 |
| `packages/browser-agent/` | create in DEV-PLAN Phase 1, expand in Phase 4-8 | TypeScript 注入脚本：DOM 文本识别、节点 id、文本型网页翻译层、学习模式、选区事件、YouTube 当前字幕句识别、视频字幕 / 听音翻译叠层、降级条、站点适配。 | 保存 API Key、直接调用 AI Provider / ASR 或模型服务、写本地数据库、修改 YouTube 播放器核心能力、下载完整字幕文件、下载或分离音视频、遮挡 YouTube 控件 / 广告 / 品牌区域。 |
| `packages/browser-agent/src/bridge/` | create in DEV-PLAN Phase 1, expand in Phase 3-4 | Native 与 JS 的消息 envelope、版本协商、request/response 映射。 | 站点 DOM selector、Provider adapter、模型服务客户端、UI 文案。 |
| `packages/browser-agent/src/dom/` | create in DEV-PLAN Phase 4 | 通用文本节点扫描、可见性判断、段落合并、稳定 segment id。 | YouTube 专用规则、native 数据持久化。 |
| `packages/browser-agent/src/overlay/` | create in DEV-PLAN Phase 4, expand in Phase 6.6 / 6.7 / 8 | 文本型网页双语翻译层、学习模式折叠、段落状态渲染、YouTube 视频字幕叠层、听音翻译叠层、视频下方降级条、轻量错误提示。 | 原生底部抽屉、Provider / ASR 调用、模型服务调用、收藏数据库、遮挡 YouTube 播放器控件或广告。 |
| `packages/browser-agent/src/site-adapters/` | create in DEV-PLAN Phase 6.6 for YouTube baseline, expand in Phase 6.7 / 8 | YouTube、Reddit、Wikipedia、AO3、X 等站点适配；YouTube adapter 先负责 watch / Shorts 视频沉浸翻译、字幕可用性、听音 fallback 可展示状态；Phase 8 再扩展 YouTube 页面文字与其它核心站点。 | 通用 bridge 协议、跨站业务规则、平台权限、下载字幕文件、替换播放器、下载或分离音视频。 |
| `packages/contracts/` | create in DEV-PLAN Phase 1, expand in later phases | JSON schema、TypeScript 类型、bridge event、账号 / session / entitlement DTO、`VideoCaptionSegment` / `VideoCaptionOverlayState`、`VideoAudioSegment` / `VideoAudioTranslationState` / `AudioTranslationQuota`、数据模型命名、错误码；Swift DTO 必须与这里保持等价，新增 payload 要配套 TS fixture 与 Swift decoder/DTO 字段等价测试。 | UI 组件、平台存储实现、Provider / ASR 具体 SDK 或密钥。 |
| `services/model-gateway/` | create in model service refactor phase; auth expands in Phase 6.5; audio expands in Phase 6.7 | 后端模型服务：游客 session、登录 session、dev/staging 测试账号、entitlement、模型目录、Free / Pro / Max 等级、Provider / ASR 密钥读取、Provider / ASR adapter、文本额度、音频分钟额度、用量、fallback、翻译 / 解释 / 听音翻译 API。 | App UI、WKWebView DOM 规则、收藏 / 复习本地学习数据、完整浏览历史存储、完整音频持久化、旧游戏 API、向客户端暴露 Provider / ASR 密钥、接受客户端自报服务等级。 |
| `services/model-gateway/src/auth/` | create in DEV-PLAN Phase 6.5 | Apple / Google identity token 验证边界、dev/staging password login、生产环境 auth feature gate。 | 在生产启用测试账号、信任客户端 user id、把测试密码写入源码。 |
| `services/model-gateway/src/sessions/` | create in DEV-PLAN Phase 6.5 | 游客 session 创建 / 恢复、登录 session 签发 / 撤销、session token 校验和过期策略。 | 存完整浏览历史、暴露 token 到日志、把 session 逻辑写进 routes 临时代码。 |
| `services/model-gateway/src/entitlements/` | create in DEV-PLAN Phase 6.5 | Free / Pro / Max 权益判定、测试账号等级映射、模型目录授权过滤、quota 输入。 | 信任客户端 `serviceTier`、处理 StoreKit 交易；订阅支付需后续 ADR。 |
| `services/model-gateway/src/catalog/` | create in model service refactor phase | 模型目录、模型显示名、等级、能力、上下线状态和 fallback 策略。 | Provider 密钥明文硬编码、用户学习数据。 |
| `services/model-gateway/src/routes/` | create in model service refactor phase; auth routes expand in Phase 6.5; audio route expands in Phase 6.7 | `/v1/sessions/guest`、`/v1/auth/dev-login`、`/v1/auth/logout`、`/v1/model-catalog`、`/v1/translate`、`/v1/explain`、`/v1/video-audio-translate` 等服务 API。 | 网页 DOM 选择器、SwiftUI 状态、无 session 授权的模型调用、完整音频上传存储接口。 |
| `services/model-gateway/src/providers/` | create in model service refactor phase | 后端内部 Provider / ASR adapter、请求归一、重试、错误映射。 | 暴露 API Key 给客户端、保存完整浏览历史或完整音频。 |
| `services/model-gateway/src/quota/` | create in model service refactor phase | Free / Pro / Max 文本额度、音频分钟额度、速率限制、用量统计和滥用保护；Free 听音翻译每天 10 分钟。 | 支付 UI、App Store 订阅流程。 |
| `services/translation-proxy/` | create in translation tiering phase | 独立轻量翻译转发服务：Free 文本翻译路由到第三方通用翻译（Google / 微软）、按 session 限额、分块、缓存、错误归一、通用翻译 Provider fallback；独立于 model-gateway 部署，gateway 故障不影响 Free 文本翻译；iOS / Web 跨端共用。 | 大模型 / ASR 调用、entitlement 等级判定、完整浏览历史、向客户端暴露翻译 key、页面渲染或本地学习数据持久化。 |
| `docs/adr/` | current | 架构决策记录。 | 产品需求正文、设计稿源文件、运行时代码。 |
| `docs/research/` | create when research artifacts exist | 官方政策、平台能力、竞品分析和调研记录。 | 未核实的库版本、临时代码片段。 |
| `design_export/` | current | Pencil 设计导出图，用于实现和 review 对齐；v2.2 账号 / 登录 / 模型服务错误状态稿、v2.3 YouTube 视频沉浸翻译状态稿、v2.4 听音翻译 Beta 状态稿保存在根层 PNG，旧基础页面在 `clean_pencil/`。 | 应用源码、生成代码、运行时资产。 |
| `public/assets/prologue/` | legacy cleanup target | 旧 English Monster Quest 资源残留。 | 新产品继续引用这些游戏资源。 |
| `data/` | legacy cleanup target unless explicitly repurposed | 旧本地数据目录。 | 新产品首版业务数据源。 |
| `src/` | do not recreate for new product | 旧 Next 产品入口已删除。 | 新产品业务实现、iOS 入口、WebView 注入实现。 |
| Root `package.json` | update during implementation setup | pnpm workspace、browser-agent/contracts 构建脚本、验证脚本。 | 继续保留旧 Next app 作为产品入口。 |

## Creation Policy

| Path | Create Now | Reason |
|---|---|---|
| `ARCHITECTURE.md` | yes | 开发计划必须先读取架构边界。 |
| `PROJECT-STRUCTURE.md` | yes | 开发计划必须知道目录职责和禁止边界。 |
| `docs/adr/ADR-0001-architecture-strategy.md` | yes | 技术路线选择需要留痕。 |
| `docs/adr/ADR-0002-backend-managed-model-service.md` | yes | 后台托管模型目录、Provider / ASR 密钥和 Free / Pro / Max 路由决策需要留痕。 |
| `docs/adr/ADR-0003-auth-session-entitlement.md` | yes | 游客会话、可选登录、测试账号和后端 entitlement 决策需要留痕。 |
| `docs/adr/ADR-0004-youtube-video-immersive-translation.md` | yes | YouTube 视频页与文本型网页使用不同交互模型，需要记录字幕叠层、听音翻译 Beta、降级和合规边界。 |
| `packages/contracts/` | no | 由 DEV-PLAN Phase 1 创建，作为 bridge、数据模型和错误码事实源；模型服务 refactor 时扩展模型目录、服务等级和额度 contract。 |
| `packages/browser-agent/` | no | 由 DEV-PLAN Phase 1 创建最小 bootstrap 包，后续 Phase 4-8 扩展 DOM、overlay 和站点适配。 |
| `apps/ios/` | no | 由 DEV-PLAN Phase 2-3 创建，避免架构阶段混入实现；创建时按 Phase 分别落 SwiftUI shell、SwiftData / Keychain、WKWebView 和 bridge 边界。 |
| `services/model-gateway/` | no | 已由模型服务 refactor Phase 创建或扩展；后续 Phase 6.5 只补 auth/session/entitlement，不在结构文档阶段写实现。 |
| `services/translation-proxy/` | no | 由翻译分层 Phase 创建：Free 文本翻译独立转发服务，不在结构文档阶段写实现。 |
| `apps/android/` | no | 后续平台，不进入首版实现。 |
| `apps/macos/` | no | 后续平台，不进入首版实现。 |
| `apps/windows/` | no | 后续平台，不进入首版实现。 |
| `src/` | no | 旧 Next 入口，不为新产品恢复。 |
| `public/assets/prologue/` | no | 旧游戏资源，后续清理。 |

## Naming Rules

- 平台应用目录使用平台名：`apps/ios`、`apps/android`、`apps/macos`、`apps/windows`。
- 可复用包只放平台无关能力：`packages/browser-agent`、`packages/contracts`。
- Bridge 事件使用动词或状态前缀，例如 `page.text.detected`、`translation.requested`、`translation.completed`、`selection.changed`、`favorite.created`。
- 数据模型用稳定英文名，和 `ARCHITECTURE.md` 的 Shared Contracts 保持一致。
- 账号与权益 DTO 命名固定为 `AuthSession`、`AccountStatus`、`EntitlementSnapshot`；后端内部可以有 `SessionRecord` / `UserEntitlementRecord`，但不得让客户端请求体中的 `serviceTier` 成为授权事实源。
- 站点适配文件按站点域名或产品名命名，例如 `youtube.ts`、`reddit.ts`、`wikipedia.ts`、`ao3.ts`、`x.ts`。
- YouTube 视频沉浸翻译相关 payload 命名固定使用 `VideoCaptionSegment`、`VideoCaptionOverlayState`、`VideoAudioSegment`、`VideoAudioTranslationState`、`AudioTranslationQuota`，避免和文本型网页的 `PageTextSegment` / `TranslationResult` 混用。
- SwiftUI 页面命名以用户任务为准，例如 `BrowserHomeView`、`WebBrowserView`、`FavoritesView`、`ReviewView`、`SettingsView`。
- Native service 命名以职责为准，例如 `ModelServiceClient`、`FavoritesStore`、`ReviewScheduler`、`PrivacyDataManager`、`WebBridgeController`。
- SwiftData model 命名不直接暴露到 JS bridge；bridge 使用 `SavedItem`、`ReviewCard` 等 contracts 名称，SwiftData 可使用 `SavedItemRecord`、`ReviewCardRecord` 作为持久化类型。
- 跨端 payload 命名以 `packages/contracts` 为事实源；Swift DTO 字段名不允许为方便本地实现而改写，确需别名时必须在 decoder tests 中覆盖映射关系。

## Migration / Cleanup Notes

- 旧 `src/` 删除是符合产品重定义方向的；后续不应恢复旧游戏 API、页面、组件或数据库迁移。
- **[已清理 2026-06]** 根级 Next.js / React / Drizzle 残骸已移除：`next.config.mjs`、`postcss.config.mjs`、`drizzle.config.ts`、根 `tsconfig.json`、`next-env.d.ts`，以及根 `package.json` 中的 web 依赖（next/react/react-dom/lucide-react/tailwind/drizzle/better-sqlite3/zod 及对应 @types）。根 `package.json` 现仅保留 workspace 脚本 + TS 工具（typescript/tsx/@types/node）。
- **[已清理 2026-06]** `.next/`（构建缓存）、`data/agent-english.sqlite*`（旧 Web 数据库）已删，`data/` 空目录一并移除。新 iOS 产品数据源为原生 SwiftData，不依赖此处。
- **[已清理 2026-06]** `public/assets/prologue/`（旧游戏视觉资产）及空 `public/` 目录已删。
- `design_export/` 保留（owner 决定先留），只作为设计参照，不进入 App bundle，除非后续明确挑选品牌资产。
- 根 `Package.swift`（SwiftPM 清单，targets 指向 `apps/ios/*`）与 `.build/`（Swift 构建产物，gitignored）为 iOS 构建依赖，**非残骸，保留**。
- 当前根级真实结构：`apps/`（前端，现 iOS）+ `services/`（公用后端）+ `packages/`（共享 contracts / browser-agent）+ `docs/` + `scripts/` + 文档与配置。
- 新 iOS 工程创建后，`DEV-PLAN.md` 的 affected files 应以 `apps/ios`、`packages/browser-agent`、`packages/contracts` 为主，不应再指向旧 `src/app`。
