# Project Structure - iPhone 英语学习浏览器

## Structural Pattern

| Concern | Decision |
|---|---|
| Project type | iPhone-first native mobile app with reusable browser injection packages. |
| Platform / runtime targets | Current: iOS. Future: Android, macOS, Windows, optional backend. |
| Chosen structure pattern | `apps/` for platform shells, `packages/` for reusable browser agent and contracts, `docs/` for architecture decisions, root docs for product/design/architecture. |
| Reason | iOS 原生能力和 App Store 交付是首版关键；网页 DOM 识别与翻译层逻辑天然可跨 WebView 复用，适合放入 TypeScript 包；未来平台不应复用 iOS UI，但应复用协议和注入脚本。 |

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
        Assets.xcassets/
      AgentEnglishCore/
        Sources/
          AgentEnglishCore/
            Bridge/
            Contracts/
            Persistence/
            Providers/
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
  docs/
    adr/
      ADR-0001-architecture-strategy.md
    research/
  design_export/
    clean_pencil/
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
| `apps/ios/` | create across DEV-PLAN Phase 2-3 | iOS App 工程、SwiftUI 界面、WKWebView 容器、原生导航、设置、Keychain、local data、Provider adapters。 | 放 Android、Windows、Next 页面或跨平台抽象口号；把 DOM 规则直接写进 SwiftUI View。 |
| `apps/ios/AgentEnglish/` | create across DEV-PLAN Phase 2-3 | App target、SwiftUI screens、WebView container、toolbars、sheets、navigation、asset catalog。 | 复习算法、Provider 协议细节、JS 注入源码、SwiftData migration 逻辑。 |
| `apps/ios/AgentEnglish/App/` | create in DEV-PLAN Phase 2 | App 生命周期、依赖注入、Tab navigation、root scene。 | 业务规则、DOM selector、Provider SDK 细节。 |
| `apps/ios/AgentEnglish/Screens/` | create in DEV-PLAN Phase 2, expand in later phases | 浏览首页、收藏、复习、设置等 SwiftUI 页面。 | 直接读写 WebView DOM、直接保存 API Key、临时拼接 bridge message。 |
| `apps/ios/AgentEnglish/Web/` | create in DEV-PLAN Phase 3 | WKWebView wrapper、toolbar、bottom sheet、message handler 入口和显示模式 UI。 | DOM 扫描算法、站点适配、翻译 Provider 调用。 |
| `apps/ios/AgentEnglishCore/` | create across DEV-PLAN Phase 2-3, expand later | Swift 无 UI 模块：收藏、历史、复习状态、Provider profile、bridge DTO、错误映射、隐私清理服务、SwiftData repository 接口。 | SwiftUI View、WKWebView DOM 选择器、站点 CSS selector、第三方网页品牌资源。 |
| `apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Bridge/` | create in DEV-PLAN Phase 3 | `BridgeEvent` decode/encode、schema version、request tracking、错误映射；Swift DTO 必须用 tests 与 `packages/contracts` 的 payload 字段保持等价。 | UI 展示、DOM selector、Provider 网络请求。 |
| `apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/` | create in DEV-PLAN Phase 2, expand in later phases | SwiftData models、repository implementation、migration、cache 清理；Keychain credential reference。 | 明文 API Key、WebKit cookie 管理、SwiftUI View state。 |
| `apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/` | create when Provider work starts in DEV-PLAN Phase 4 or later | Provider profile、translation/explanation request、rate-limit、retry、错误归一。 | 页面 overlay 渲染、收藏列表 UI、JS 注入源码。 |
| `apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Review/` | create in DEV-PLAN Phase 6 | 主动回忆卡、复习反馈、下一次复习优先级。 | 游戏化奖励、课程路径、页面 DOM 操作。 |
| `apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Privacy/` | create in DEV-PLAN Phase 3, expand in Phase 6 | Provider 数据发送提示、学习数据清理、网站数据清理提示策略。 | 悄悄上传浏览历史、替用户同意第三方数据发送。 |
| `apps/ios/AgentEnglishTests/` | create in DEV-PLAN Phase 2, expand in Phase 3 and later | Native core 单元测试、bridge contract decode 测试、SwiftData repository 测试、复习状态测试。 | 只做快照不验证业务规则。 |
| `apps/android/` | future documented only | 未来 Android 平台壳位置。 | 首版创建完整工程或复制 iOS 实现。 |
| `apps/macos/` | future documented only | 未来 macOS 平台壳位置。 | 首版创建桌面窗口或菜单实现。 |
| `apps/windows/` | future documented only | 未来 Windows 平台壳位置。 | 首版创建 WebView2 工程。 |
| `packages/browser-agent/` | create in DEV-PLAN Phase 1, expand in Phase 4-7 | TypeScript 注入脚本：DOM 文本识别、节点 id、翻译层插入、学习模式、选区事件、站点适配。 | 保存 API Key、直接调用 AI Provider、写本地数据库、修改 YouTube 播放器核心能力。 |
| `packages/browser-agent/src/bridge/` | create in DEV-PLAN Phase 1, expand in Phase 3-4 | Native 与 JS 的消息 envelope、版本协商、request/response 映射。 | 站点 DOM selector、Provider adapter、UI 文案。 |
| `packages/browser-agent/src/dom/` | create in DEV-PLAN Phase 4 | 通用文本节点扫描、可见性判断、段落合并、稳定 segment id。 | YouTube 专用规则、native 数据持久化。 |
| `packages/browser-agent/src/overlay/` | create in DEV-PLAN Phase 4 | 双语翻译层、学习模式折叠、段落状态渲染、轻量错误提示。 | 原生底部抽屉、Provider 调用、收藏数据库。 |
| `packages/browser-agent/src/site-adapters/` | create in DEV-PLAN Phase 7 | YouTube、Reddit、Wikipedia、AO3、X 等站点适配；每个站点独立文件。 | 通用 bridge 协议、跨站业务规则、平台权限。 |
| `packages/contracts/` | create in DEV-PLAN Phase 1, expand in later phases | JSON schema、TypeScript 类型、bridge event、数据模型命名、错误码；Swift DTO 必须与这里保持等价，新增 payload 要配套 TS fixture 与 Swift decoder/DTO 字段等价测试。 | UI 组件、平台存储实现、Provider 具体 SDK。 |
| `docs/adr/` | current | 架构决策记录。 | 产品需求正文、设计稿源文件、运行时代码。 |
| `docs/research/` | create when research artifacts exist | 官方政策、平台能力、竞品分析和调研记录。 | 未核实的库版本、临时代码片段。 |
| `design_export/clean_pencil/` | current | Pencil 设计导出图，用于实现和 review 对齐。 | 应用源码、生成代码、运行时资产。 |
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
| `packages/contracts/` | no | 由 DEV-PLAN Phase 1 创建，作为 bridge、数据模型和错误码事实源。 |
| `packages/browser-agent/` | no | 由 DEV-PLAN Phase 1 创建最小 bootstrap 包，后续 Phase 4-7 扩展 DOM、overlay 和站点适配。 |
| `apps/ios/` | no | 由 DEV-PLAN Phase 2-3 创建，避免架构阶段混入实现；创建时按 Phase 分别落 SwiftUI shell、SwiftData / Keychain、WKWebView 和 bridge 边界。 |
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
- 站点适配文件按站点域名或产品名命名，例如 `youtube.ts`、`reddit.ts`、`wikipedia.ts`、`ao3.ts`、`x.ts`。
- SwiftUI 页面命名以用户任务为准，例如 `BrowserHomeView`、`WebBrowserView`、`FavoritesView`、`ReviewView`、`SettingsView`。
- Native service 命名以职责为准，例如 `ProviderClient`、`FavoritesStore`、`ReviewScheduler`、`PrivacyDataManager`、`WebBridgeController`。
- SwiftData model 命名不直接暴露到 JS bridge；bridge 使用 `SavedItem`、`ReviewCard` 等 contracts 名称，SwiftData 可使用 `SavedItemRecord`、`ReviewCardRecord` 作为持久化类型。
- 跨端 payload 命名以 `packages/contracts` 为事实源；Swift DTO 字段名不允许为方便本地实现而改写，确需别名时必须在 decoder tests 中覆盖映射关系。

## Migration / Cleanup Notes

- 旧 `src/` 删除是符合产品重定义方向的；后续不应恢复旧游戏 API、页面、组件或数据库迁移。
- 当前 `package.json` 仍指向 Next、React、Drizzle 和旧数据库脚本；开发初始化时应改为 workspace 工具脚本，或者明确把旧依赖移除。
- 当前根目录存在 `.next/`、`data/agent-english.sqlite*` 和 Drizzle 配置，均属于旧 Web/游戏方向或构建残留；后续清理前不得把这些残留当作新 iOS 产品数据源。
- `public/assets/prologue/` 是旧游戏视觉资产，不能被新产品首页、复习页或设置页引用。
- `data/` 是否保留取决于是否有非旧游戏资料；如果只保存旧游戏数据，应在清理 Phase 删除或迁移到文档归档。
- `design_export/clean_pencil/` 只作为设计参照，不进入 App bundle，除非后续明确挑选品牌资产。
- 新 iOS 工程创建后，`DEV-PLAN.md` 的 affected files 应以 `apps/ios`、`packages/browser-agent`、`packages/contracts` 为主，不应再指向旧 `src/app`。
