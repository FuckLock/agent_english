---
phase_id: Phase 6
status: locked
spec_refs:
  - "Product-Spec.md#AI 服务与模型等级"
  - "Product-Spec.md#隐私与数据"
  - "Product-Spec.md#MVP 范围"
design_refs:
  - "Design-Brief.md#设置页"
  - "design_export/c3Puy.png"
  - "design_export/LQ1Vj.png"
plan_refs:
  - "DEV-PLAN.md#Phase 6: 后台模型服务网关 + 服务等级设置"
  - "ARCHITECTURE.md#Layer Boundaries"
  - "PROJECT-STRUCTURE.md"
  - "docs/adr/ADR-0002-backend-managed-model-service.md"
round: 2
---

[功能验证 criteria]
1. 交付项：新增 `services/model-gateway` 作为当前范围的 Node 模型服务包，并纳入 workspace，而不是复活旧 `src/app/api/providers` 或旧游戏 API。
   验证手段：文件存在 + Grep 模式 + 命令输出 + 命令退出码
   验证条件：
    - 文件存在：`services/model-gateway/package.json`、`services/model-gateway/src/index.ts`
    - Grep 模式：`pnpm-workspace.yaml` 命中 `services/model-gateway`
    - Grep 模式：`services/model-gateway/package.json` 同时命中 `@agent-english/model-gateway`、`build`、`check`、`test`
    - 命令输出：`find . -path './src/app/api/providers/*' -o -path './src/server/providers/*'` 输出为空
    - 命令退出码：`pnpm --filter @agent-english/model-gateway check` 返回 0

2. 交付项：模型目录以产品等级表达 Free / Pro / Max，用户可见字段使用可读显示名，不把具体模型文案写死为客户端契约，也不泄露 Provider 密钥、Base URL、真实内部模型名、成本或 fallback 顺序。
   验证手段：文件存在 + Grep 模式 + 命令输出
   验证条件：
    - 文件存在：`services/model-gateway/src/catalog/model-catalog.ts`
    - Grep 模式：`services/model-gateway/src/catalog/model-catalog.ts` 同时命中 `Free`、`Pro`、`Max`、`displayName`、`capabilities`、`quota`
    - Grep 模式：`services/model-gateway/src/catalog/model-catalog.ts` 同时命中 `free`、`pro`、`max`、`locked|requiresTier|available`
    - Grep 模式：`services/model-gateway/src/catalog/model-catalog.ts` 命中 `displayName`
    - 命令输出：`rg -n 'apiKey|secretKey|baseURL|baseUrl|providerApiKey|cost|price|fallbackOrder|internalModel' services/model-gateway/src/catalog/model-catalog.ts packages/contracts/src apps/ios/AgentEnglish apps/ios/AgentEnglishCore/Sources/AgentEnglishCore` 输出为空

3. 交付项：后端提供模型目录、翻译、解释 API 路由，并用统一错误码表达额度不足、等级不可用、服务不可用、内容过长和 Provider fallback 失败。
   验证手段：文件存在 + Grep 模式 + 命令输出 + 命令退出码
   验证条件：
    - 文件存在：`services/model-gateway/src/routes/catalog.ts`、`services/model-gateway/src/routes/translate.ts`、`services/model-gateway/src/routes/explain.ts`
    - Grep 模式：`services/model-gateway/src/routes/translate.ts` 同时命中 `segmentId`、`segments`、`targetLanguage`、`serviceTier`
    - Grep 模式：`services/model-gateway/src/routes/explain.ts` 同时命中 `selectedText|sourceText`、`contextBefore`、`contextAfter`、`serviceTier`
    - 命令输出：`rg -n 'quota-exceeded|tier-unavailable|service-unavailable|content-too-long|provider-fallback-failed' services/model-gateway/src packages/contracts/src` 输出非空
    - 命令退出码：`pnpm --filter @agent-english/model-gateway test` 返回 0

4. 交付项：后端 Provider 路由、额度和速率限制只存在于 `services/model-gateway`，并保留 Free 层成本保护结构；iOS 与 browser-agent 不拥有 Provider 路由策略。
   验证手段：文件存在 + Grep 模式 + 命令输出
   验证条件：
    - 文件存在：`services/model-gateway/src/providers/provider-router.ts`、`services/model-gateway/src/quota/service-tier.ts`
    - Grep 模式：`services/model-gateway/src/providers/provider-router.ts` 同时命中 `route`、`fallback`、`provider`、`normalize`
    - Grep 模式：`services/model-gateway/src/quota/service-tier.ts` 同时命中 `Free`、`Pro`、`Max`、`quota`、`rateLimit|limit`
    - 命令输出：`rg -n 'provider-router|fallbackOrder|apiKey|secretKey|baseURL|baseUrl|Authorization|Bearer' apps/ios/AgentEnglish apps/ios/AgentEnglishCore/Sources/AgentEnglishCore packages/browser-agent/src` 输出为空

5. 交付项：`packages/contracts` 定义并导出模型服务事实源，覆盖 `ServiceTier`、模型目录、模型偏好、额度状态、错误码、翻译/解释请求与结果。
   验证手段：文件存在 + Grep 模式 + 命令退出码
   验证条件：
    - 文件存在：`packages/contracts/src/model-service.ts`、`packages/contracts/src/index.ts`
    - Grep 模式：`packages/contracts/src/model-service.ts` 同时命中 `ServiceTier`、`ModelCatalog`、`ModelOption`、`ModelQuotaState`、`ModelServiceErrorCode`、`TranslateRequest`、`TranslateResponse`、`ExplainRequest`、`ExplainResponse`
    - Grep 模式：`packages/contracts/src/index.ts` 命中 `model-service`
    - 命令退出码：`pnpm --filter @agent-english/contracts test` 返回 0

6. 交付项：iOS 新增 `ModelServiceClient`，翻译和解释请求通过自有模型服务完成；Phase 4-5 的直连 Provider transport 不再是产品默认路径。
   验证手段：文件存在 + Grep 模式 + 命令输出 + 命令退出码
   验证条件：
    - 文件存在：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ModelServiceClient.swift`
    - Grep 模式：`ModelServiceClient.swift` 同时命中 `modelCatalog|catalog`、`translate`、`explain`、`serviceTier`、`quota`、`URLSession|HTTPURLResponse`
    - Grep 模式：`TranslationProviderClient.swift` 和 `ExplanationProviderClient.swift` 命中 `ModelServiceClient`
    - 命令输出：`rg -n 'OpenAICompatible|ProviderRequestConfiguration|apiKey|baseURL|modelName' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/TranslationProviderClient.swift apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ExplanationProviderClient.swift apps/ios/AgentEnglish/Screens/SettingsView.swift` 输出为空
    - 命令退出码：`swift test --package-path apps/ios --filter ModelServiceClientTests` 返回 0

7. 交付项：本地持久化从 Provider 配置迁移为服务等级 / 模型偏好快照；SwiftData 不保存第三方密钥、Base URL、真实内部模型名或 BYOK 字段。
   验证手段：文件存在 + Grep 模式 + 命令输出
   验证条件：
    - 文件存在：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/TranslationProviderSettingsStore.swift`
    - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/TranslationProviderSettingsStore.swift` 同时命中 `serviceTier`、`modelPreference|preferredModel`、`quota|usage`、`lastSyncedAt`
    - 命令输出：`rg -n 'apiKey|secretKey|baseURL|baseUrl|BYOK|customProvider|modelName|credentialReference|keychainReference' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence apps/ios/AgentEnglish/Screens/SettingsView.swift` 输出为空
    - 命令输出：`rg -n 'ProviderProfile|ProviderConfiguration|OpenAICompatibleProviderTransport' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence apps/ios/AgentEnglish/Screens/SettingsView.swift` 输出为空

[UI 一致性 criteria]
8. 交付项：设置页按 v2.1 设计稿展示服务等级、默认模型 / 模型选择入口、可用档位、用量状态、目标语言和隐私说明；不出现 Provider、API Key、Base URL、BYOK、自定义模型等工程配置。
   验证手段：文件存在 + Grep 模式 + 命令输出
   验证条件：
    - 文件存在：`apps/ios/AgentEnglish/Screens/SettingsView.swift`
    - Grep 模式：`SettingsView.swift` 同时命中 `服务等级|Service Tier`、`默认模型|模型`、`额度|quota|usage`、`目标语言|targetLanguage`、`隐私|Privacy`
    - Grep 模式：`SettingsView.swift` 命中 `Free`、`Pro`、`Max`
    - 命令输出：`rg -n 'Provider|API Key|apiKey|Base URL|baseURL|BYOK|自定义 Provider|自定义模型|模型名' apps/ios/AgentEnglish/Screens/SettingsView.swift` 输出为空
    - Grep 模式：`SettingsView.swift` 命中 `翻译文本|页面文本|模型服务|自有后端`

9. 交付项：模型选择交互覆盖入口、分组选择、当前选中、Free 用户点 Pro 锁定态和 Pro 用户点 Max 锁定态，且与 `design_export/LQ1Vj.png` 的产品表达一致。
   验证手段：文件存在 + Grep 模式 + 命令输出
   验证条件：
    - 文件存在：`apps/ios/AgentEnglish/Screens/SettingsView.swift` 或独立 `ModelPickerView.swift`
    - Grep 模式：模型选择 UI 文件同时命中 `选择模型`、`已选`、`需要 Pro|需升级|查看 Pro`、`需要 Max|查看 Max`
    - Grep 模式：模型选择 UI 文件命中 `Free 服务|Free Service`、`Pro 模型|Pro`、`Max 模型|Max`
    - 命令输出：`rg -n 'API Key|Provider|Base URL|BYOK|apiKey|baseURL|customProvider' apps/ios/AgentEnglish/Screens` 输出为空

10. 交付项：额度不足、当前等级不可用和模型服务不可用状态以用户可理解文案展示，不暴露 `gateway`、Provider 内部错误、HTTP 栈细节或第三方密钥信息。
    验证手段：Grep 模式 + 命令输出
    验证条件：
    - Grep 模式：`apps/ios/AgentEnglish/Screens apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers` 同时命中 `额度不足|quota`、`需要 Pro|tier`、`服务暂不可用|serviceUnavailable`
    - 命令输出：`rg -n 'gateway|provider-fallback|HTTPURLResponse|statusCode|apiKey|secret|baseURL' apps/ios/AgentEnglish/Screens` 输出为空
    - Grep 模式：错误映射文件或 `ModelServiceClient.swift` 命中 `quota-exceeded`、`tier-unavailable`、`service-unavailable` 到用户文案的映射

[架构与安全 criteria]
11. 交付项：`browser-agent` 仍只负责 DOM、overlay、selection 和 bridge，不直接调用模型服务或第三方 Provider。
    验证手段：命令输出
    验证条件：
    - 命令输出：`rg -n 'fetch\\(|XMLHttpRequest|URLSession|Authorization|Bearer|apiKey|secretKey|baseURL|baseUrl|provider-router' packages/browser-agent/src` 输出为空
    - 命令输出：`rg -n 'translate|explain|selection|BridgeEvent|postMessage' packages/browser-agent/src` 输出非空

12. 交付项：Provider 密钥和真实 Provider 路由只在后端内部出现；客户端、contracts、设计稿实现和本地 persistence 不保存第三方密钥。
    验证手段：命令输出
    验证条件：
    - 命令输出：`rg -n 'apiKey|secretKey|ANTHROPIC|OPENAI|DEEPSEEK|GOOGLE_API|Authorization|Bearer' apps packages/contracts packages/browser-agent` 输出为空
    - 命令输出：`rg -n 'apiKey|secretKey|Authorization|Bearer' services/model-gateway/src/routes services/model-gateway/src/catalog services/model-gateway/src/quota` 输出为空
    - 命令输出：`rg -n 'apiKey|secretKey|Authorization|Bearer|process\\.env' services/model-gateway/src/providers services/model-gateway/src/env.ts` 输出非空

13. 交付项：模型服务后端不保存完整浏览历史、收藏、复习或完整页面文本日志；收藏 / 复习 / 历史仍留在 iOS 本地 SwiftData 范围。
    验证手段：命令输出
    验证条件：
    - 命令输出：`rg -n 'browserHistory|BrowsingHistory|SavedItem|ReviewCard|ReviewQueue|favorite|bookmark|fullPageText|pageHtml|pageSnapshot|fullTextLog|pageTextLog|learningHistory|reviewHistory' services/model-gateway/src` 输出为空
    - 命令输出：`rg -n 'SavedItem|ReviewCard|History|SwiftData|@Model' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence` 输出非空

[回归 criteria]
14. 交付项：Phase 4 网页翻译和 Phase 5 点词解释 / 收藏不因模型服务重构退化；既有测试继续通过，并新增模型服务相关行为测试。
    验证手段：命令输出 + 命令退出码
    验证条件：
    - 命令输出：`rg -n 'ModelServiceClient|ModelCatalog|ServiceTier|quota|tier-unavailable|service-unavailable' apps/ios/AgentEnglishTests packages/contracts/tests services/model-gateway` 输出非空
    - 命令退出码：`pnpm --filter @agent-english/contracts test` 返回 0
    - 命令退出码：`pnpm --filter @agent-english/browser-agent test` 返回 0
    - 命令退出码：`pnpm --filter @agent-english/model-gateway test` 返回 0
    - 命令退出码：`swift test --package-path apps/ios` 返回 0

15. 交付项：Phase 6 构建、测试和安全检查通过；本 Phase 不新增订阅支付、账号同步、云端学习数据、Android/macOS/Windows、站点适配、导出等 future-scope。
    验证手段：命令输出 + 命令退出码
    验证条件：
    - 命令退出码：`pnpm check` 返回 0
    - 命令退出码：`pnpm build` 返回 0
    - 命令退出码：`pnpm test` 返回 0
    - 命令退出码：`swift build --package-path apps/ios` 返回 0
    - 命令退出码：`swift test --package-path apps/ios` 返回 0
    - 命令退出码：`pnpm audit --audit-level critical --registry=https://registry.npmjs.org/` 返回 0
    - 命令输出：`find . -path './apps/android/*' -o -path './apps/macos/*' -o -path './apps/windows/*'` 输出为空
    - 命令输出：`find services/model-gateway packages/contracts packages/browser-agent apps/ios -type f | rg '(subscription|billing|payment|cloud-sync|sync-service|export-service)'` 输出为空
