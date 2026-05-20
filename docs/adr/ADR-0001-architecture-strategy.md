# ADR-0001: Architecture Strategy

## Status

Accepted

## Context

产品已从旧版 English Monster Quest 重大重定义为 iPhone 英语学习浏览器。首版目标是苹果手机端，核心能力是内置浏览器、网页双语翻译、点词点句解释、收藏、复习和隐私设置。后续可能扩展到 Android、macOS、Windows，但当前不能把全平台开发变成首版负担。架构压力集中在三个方面：iOS 需要稳定的原生 WebView、原生持久化和 App Store 交付能力；网页翻译层和站点适配未来应尽量复用；学习数据和 Provider 边界不能散落在 UI 或注入脚本里。

## Decision

采用“iOS 原生壳 + 可复用 WebView 注入包 + 稳定 contracts”的架构。首版产品入口是 `apps/ios`，使用 SwiftUI、WKWebView、SwiftData、Keychain 和 WebKit website data store 实现原生学习闭环；网页文本识别、翻译层插入、学习模式和站点适配放入 `packages/browser-agent`，编译成 JS 后注入 WKWebView；native 与 injected script 之间只通过 `packages/contracts` 定义的结构化 bridge 消息通信。未来 Android、macOS、Windows 重写平台壳和本地系统能力，但优先复用 `browser-agent`、contracts、Provider 行为约束和学习数据模型命名。

## Alternatives Considered

| Alternative | Reason Not Chosen |
|---|---|
| SwiftUI + WKWebView 单体应用 | 首版最快，但 DOM 规则、翻译层、学习数据和 Provider 逻辑容易写死在 iOS UI 中，未来 Android 和 Windows 几乎只能重写全部。 |
| React Native 或 Flutter 一次做多端 | 能减少一部分 UI 重复，但 WebView 注入、iOS 审核、Keychain、原生浏览器体验和复杂网页桥接仍需要大量平台代码；当前首版目标是先把 iOS 做稳。 |
| Next.js / PWA / Web App | 与 iPhone 原生学习浏览器和 App Store 交付目标冲突，容易退化成网页套壳或链接集合，无法提供足够稳定的原生收藏、复习和隐私能力。 |
| Capacitor / Tauri 优先 | 可以包装 Web 技术，但 iOS WebView 浏览器内再套 Web App 会增加桥接层，且当前需要对第三方网页做注入和原生学习工具，不适合先走包装路线。 |
| Kotlin Multiplatform 或 Rust shared core | 长期可复用性强，但首版会增加构建、桥接、移动端集成和团队认知成本；当前真正跨平台复用点是网页注入脚本和协议，而不是完整业务内核。 |
| 后端优先代理所有翻译和学习数据 | 有利于统一额度和同步，但首版强调本地、隐私和自用验证；后端会提前引入账号、服务部署、密钥托管和合规成本。 |
| Core Data / SQLite 作为首版持久化 | 可覆盖更低 iOS 版本，也更成熟，但首版没有账号同步和复杂关系模型；当前按 iOS 17+ TestFlight 自用验证，SwiftData 与 SwiftUI 集成更直接。若后续要求 iOS 16 或更早版本，再新增 ADR 切换。 |

## Consequences

### Positive

- iOS 首版可以使用最直接的 SwiftUI、WKWebView、Keychain 和本地存储能力，降低浏览器容器和 App Store 交付风险。
- `browser-agent` 把 DOM 识别、翻译层和站点适配从 iOS UI 中隔离出来，未来 Android WebView、macOS WKWebView、Windows WebView2 可复用。
- `contracts` 让 native 与 JS bridge、收藏、复习、Provider 错误码有稳定命名，后续 planner、generator、review 都有明确边界。
- 不需要为了未来平台牺牲首版 iPhone 体验，也不会把未来平台完全锁死在 Swift 单体里。

### Negative

- 首版需要同时维护 Swift 和 TypeScript 两套代码边界，bridge contract 设计必须先做好。
- iOS 侧 DTO 与 TypeScript schema 需要保持同步，后续需要 contract 测试或生成策略。
- SwiftData 默认要求首版最低系统版本按 iOS 17+ 处理；如果目标用户覆盖更旧系统，需要调整持久化路线。
- Android、Windows 的 UI 和本地存储仍然要重写，不能期待一次实现全端 UI。
- 旧 Next/Drizzle 工具链需要清理，否则容易让开发计划误判新产品入口。

### Constraints

- 首版任何 WebView 与 JS 通信必须通过结构化 `BridgeEvent`，不能由 SwiftUI View 拼接临时业务脚本。
- `browser-agent` 不能保存凭证、调用 AI Provider 或写本地数据库。
- Provider 凭证只能存 Keychain；收藏、历史、复习和翻译缓存进入 SwiftData；网站 cookie/localStorage 归 WebKit website data store 管理。
- 页面文本发送给第三方 Provider 必须可被用户理解和控制。
- YouTube 只做页面文字和可访问字幕的保守学习增强，不修改播放器、不下载媒体、不去广告。
- 原生收藏、复习、历史、隐私清理和 Provider 设置是 App Store 原生价值边界，不能被开发计划省略。

## Follow-Up Rules

- `DEV-PLAN.md` 必须读取 `ARCHITECTURE.md`、`PROJECT-STRUCTURE.md` 和本 ADR 后再拆 Phase。
- DEV-PLAN Phase 1-3 共同构成首个实现 tranche：Phase 1 先建立 `packages/contracts`、`packages/browser-agent` 和 workspace 最小可验证骨架；Phase 2 建立 `apps/ios` 原生 Tab 壳、SwiftData model 和 Keychain credential reference；Phase 3 建立 WKWebView 进入流、bridge schema native decode 和 WebKit website data 清理提示。
- 在 DEV-PLAN Phase 1-3 全部完成前，不得进入站点适配、真实 Provider 调用或网页翻译业务堆叠。
- 每个 Phase 的 criteria 必须说明是否触碰 native shell、browser-agent、contracts、local data 或 provider adapters。
- 若后续决定把 Android 提前为当前目标，必须新增 ADR 评估 Kotlin/Compose、Android WebView 注入时机和 contracts 复用方式。
- 若后续决定增加后端代理或账号同步，必须新增 ADR 评估密钥托管、隐私、数据保留、同步冲突和发布成本。
