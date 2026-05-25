---
phase_id: Phase 6.5
status: locked
spec_refs:
  - "Product-Spec.md#账号、会话与权益"
  - "Product-Spec.md#AI 服务与模型等级"
  - "Product-Spec.md#MVP 范围"
design_refs:
  - "Design-Brief.md#设置页"
  - "Design-Brief.md#设计稿补充（v2.2）"
  - "design_export/5mGHS.png"
  - "design_export/pcJl4.png"
  - "design_export/AFoPz.png"
  - "design_export/bCKWH.png"
  - "design_export/pVL5t.png"
  - "design_export/a0Ke7.png"
  - "design_export/wpYO6.png"
  - "design_export/1olbx.png"
  - "design_export/uTNzx.png"
plan_refs:
  - "DEV-PLAN.md#Phase 6.5: 账号会话 + 后端权益 + Dev 测试账号"
  - "ARCHITECTURE.md#Layer Boundaries"
  - "PROJECT-STRUCTURE.md"
  - "docs/adr/ADR-0003-auth-session-entitlement.md"
round: 1
---

[功能验证 criteria]
1. 交付项：`packages/contracts` 定义并导出账号会话事实源，覆盖游客、正式登录、dev/staging Pro、dev/staging Max、后端 entitlement 和 auth 错误码。
   验证手段：文件存在 + Grep 模式 + 命令退出码
   验证条件：
   - 文件存在：`packages/contracts/src/auth-session.ts`、`packages/contracts/tests/auth-session.test.mjs`
   - Grep 模式：`packages/contracts/src/auth-session.ts` 同时命中 `AuthSession`、`AccountStatus`、`EntitlementSnapshot`、`DevLoginRequest`、`DevLoginResponse`
   - Grep 模式：`packages/contracts/src/auth-session.ts` 同时命中 `AuthErrorCode`、`auth-disabled`、`invalid-credentials`、`identity-token-invalid`
   - Grep 模式：`packages/contracts/src/auth-session.ts` 同时命中 `guest`、`signed-in`、`dev-pro`、`dev-max`、`free`、`pro`、`max`
   - Grep 模式：`packages/contracts/src/auth-session.ts` 同时命中 `sessionToken`、`expiresAt`、`quota`、`catalog`、`account`
   - Grep 模式：`packages/contracts/src/index.ts` 命中 `auth-session`
   - 命令退出码：`pnpm --filter @agent-english/contracts test` 返回 0

2. 交付项：后端提供游客 session、dev/staging 测试登录、logout 和 session entitlement 校验，不再依赖固定 Free / Pro / Max service token 作为产品授权。
   验证手段：文件存在 + Grep 模式 + 命令输出 + 命令退出码
   验证条件：
   - 文件存在：`services/model-gateway/src/sessions/session-store.ts`、`services/model-gateway/src/auth/dev-auth.ts`、`services/model-gateway/src/entitlements/entitlement-service.ts`
   - Grep 模式：`services/model-gateway/src/index.ts` 同时命中 `/v1/sessions/guest`、`/v1/auth/dev-login`、`/v1/auth/logout`
   - Grep 模式：`services/model-gateway/src/auth/dev-auth.ts` 同时命中 `ENABLE_DEV_AUTH`、`test-pro@agentenglish.local`、`test-max@agentenglish.local`
   - Grep 模式：`services/model-gateway/src/auth/dev-auth.ts` 同时命中 `DEV_AUTH_TEST_PRO_PASSWORD|TEST_PRO_PASSWORD`、`DEV_AUTH_TEST_MAX_PASSWORD|TEST_MAX_PASSWORD`
   - Grep 模式：`services/model-gateway/src/entitlements/entitlement-service.ts` 同时命中 `resolveSessionEntitlement`、`free`、`pro`、`max`
   - 命令输出：`rg -n 'MODEL_SERVICE_TOKEN_FREE|MODEL_SERVICE_TOKEN_PRO|MODEL_SERVICE_TOKEN_MAX' services/model-gateway/src apps/ios/AgentEnglish apps/ios/AgentEnglishCore/Sources/AgentEnglishCore` 输出为空
   - 命令输出：`rg -n 'test-pro-password|test-max-password|adminpro|adminmax|password\\s*=\\s*\"' services/model-gateway/src apps/ios/AgentEnglish apps/ios/AgentEnglishCore/Sources/AgentEnglishCore` 输出为空
   - 命令退出码：`pnpm --filter @agent-english/model-gateway test` 返回 0

3. 交付项：后端模型目录、翻译和解释 API 都以 session entitlement 授权，忽略客户端请求体自报的 `serviceTier`。
   验证手段：Grep 模式 + 命令退出码
   验证条件：
   - Grep 模式：`services/model-gateway/src/index.ts` 命中 `/v1/model-catalog`
   - Grep 模式：`services/model-gateway/src/routes/catalog.ts`（现有 `/v1/model-catalog` 路由文件）命中 `EntitlementSnapshot|ServiceEntitlement|session`
   - Grep 模式：`services/model-gateway/src/routes/translate.ts` 命中 `entitlement`
   - Grep 模式：`services/model-gateway/src/routes/explain.ts` 命中 `entitlement`
   - Grep 模式：`services/model-gateway/tests/auth-session.test.mjs` 同时命中 `ignores client serviceTier`、`tier-unavailable`、`dev auth disabled`
   - Grep 模式：`services/model-gateway/tests/auth-session.test.mjs` 同时命中 `production`、`test-pro@agentenglish.local`、`test-max@agentenglish.local`
   - 命令退出码：`pnpm --filter @agent-english/model-gateway test` 返回 0

4. 交付项：iOS native core 有账号 session 客户端，启动可创建 / 恢复游客 session，dev/staging 登录会替换 Keychain session token，logout 回到游客 Free。
   验证手段：文件存在 + Grep 模式 + 命令退出码
   验证条件：
   - 文件存在：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Account/AccountSessionClient.swift`、`apps/ios/AgentEnglishTests/AccountSessionClientTests.swift`
   - Grep 模式：`AccountSessionClient.swift` 同时命中 `bootstrapGuestSession`、`loginDevAccount`、`logout`、`EntitlementSnapshot`、`KeychainCredentialStore`
   - Grep 模式：`KeychainCredentialStore.swift` 命中 `sessionTokenAlias|saveSessionToken|loadSessionToken|deleteSessionToken`
   - Grep 模式：`AccountSessionClientTests.swift` 同时命中 `guest`、`test-pro`、`test-max`、`logout`、`Keychain`
   - 命令退出码：`swift test` 返回 0

5. 交付项：iOS 模型服务请求附带后端 session token，设置页显示账号状态区，并覆盖游客 Free、公开登录入口、dev Pro、dev Max、退出登录、登录失败 / 模型目录同步失败、额度不足和等级不可用用户文案。
   验证手段：Grep 模式 + 命令退出码
   验证条件：
   - Grep 模式：`apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Providers/ModelServiceClient.swift` 同时命中 `Authorization`、`sessionToken`、`/v1/model-catalog`
   - Grep 模式：`apps/ios/AgentEnglish/Screens/SettingsView.swift` 同时命中 `账号状态`、`游客`、`Free`、`Apple 登录|Apple`、`Google 登录|Google`
   - Grep 模式：`apps/ios/AgentEnglish/Screens/SettingsView.swift` 同时命中 `Pro 测试`、`Max 测试`、`退出登录|退出`、`删除账号`
   - Grep 模式：`apps/ios/AgentEnglish/Screens/SettingsView.swift` 同时命中 `ENABLE_DEV_AUTH|isDevAuthEnabled|devAuthEnabled`、`生产|production|隐藏`
   - Grep 模式：`apps/ios/AgentEnglish/Screens/SettingsView.swift` 同时命中 `模型目录同步失败`、`额度`、`需要 Pro|需要 Max`
   - 命令退出码：`swift test` 返回 0
   - 命令退出码：`xcodebuild -project apps/ios/AgentEnglish.xcodeproj -scheme AgentEnglish -configuration Debug -destination "platform=iOS Simulator,name=iPhone 16 Pro,OS=18.6" -derivedDataPath /private/tmp/AgentEnglishDerived build` 返回 0

[架构与安全 criteria]
6. 交付项：敏感边界可机器验证，iOS App、SwiftData、browser-agent 不保存 Provider API Key、Base URL、真实模型名或固定生产等级 token。
   验证手段：命令输出
   验证条件：
   - 命令输出：`rg -n 'apiKey|secretKey|baseURL|baseUrl|providerApiKey|OPENAI_API_KEY|DEEPSEEK_API_KEY|ANTHROPIC_SECRET_KEY|MODEL_SERVICE_TOKEN_(FREE|PRO|MAX)|free-service-token|pro-service-token|max-service-token' apps/ios/AgentEnglish apps/ios/AgentEnglishCore/Sources/AgentEnglishCore packages/browser-agent/src` 输出为空
   - 命令输出：`rg -n 'sessionToken|AuthSession|EntitlementSnapshot|AccountStatus' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Account` 输出非空
   - 命令输出：`rg -n 'sessionToken' apps/ios/AgentEnglishCore/Sources/AgentEnglishCore/Persistence/LearningRecords.swift` 输出为空

7. 交付项：生产环境隐藏并拒绝 dev/staging 测试账号，Apple / Google 身份 token 只允许后端验证，不允许客户端 user id 直接作为身份事实源。
   验证手段：Grep 模式 + 命令输出
   验证条件：
   - Grep 模式：`services/model-gateway/src/auth/dev-auth.ts` 同时命中 `ENABLE_DEV_AUTH`、`auth-disabled`、`production`
   - Grep 模式：`services/model-gateway/tests/auth-session.test.mjs` 同时命中 `dev auth disabled`、`production`、`auth-disabled`
   - Grep 模式：`services/model-gateway/src/auth/dev-auth.ts` 同时命中 `identityToken|verifyApple|verifyGoogle|backend`
   - 命令输出：`rg -n 'clientUserId|userId.*trusted|trusted.*userId' services/model-gateway/src apps/ios/AgentEnglish apps/ios/AgentEnglishCore/Sources/AgentEnglishCore` 输出为空

8. 交付项：Phase 非目标没有被实现或暴露为当前功能。
   验证手段：命令输出
   验证条件：
   - 命令输出：`rg -n 'StoreKit|SKPayment|Product\\.products|充值|订阅管理|cloud sync|云同步|Google-only' apps/ios services/model-gateway/src packages/contracts/src` 输出为空

9. 交付项：设计稿 9 个 v2.2 状态被实现验收引用，至少覆盖游客、Pro 测试、Max 测试、公开登录、dev 登录、登录失败、目录同步失败、额度不足和等级不可用。
   验证手段：文件存在 + Grep 模式
   验证条件：
   - 文件存在：`design_export/5mGHS.png`、`design_export/pcJl4.png`、`design_export/AFoPz.png`、`design_export/bCKWH.png`、`design_export/pVL5t.png`、`design_export/a0Ke7.png`、`design_export/wpYO6.png`、`design_export/1olbx.png`、`design_export/uTNzx.png`
   - Grep 模式：`apps/ios/AgentEnglish/Screens/SettingsView.swift` 同时命中 `游客`、`Pro 测试`、`Max 测试`、`Apple`、`Google`、`登录未完成|登录失败`、`模型目录同步失败`、`额度`、`需要 Pro|需要 Max`

[回归 criteria]
- `pnpm --filter @agent-english/contracts test` 返回 0。
- `pnpm --filter @agent-english/model-gateway test` 返回 0。
- `swift test` 返回 0。
- `xcodebuild -project apps/ios/AgentEnglish.xcodeproj -scheme AgentEnglish -configuration Debug -destination "platform=iOS Simulator,name=iPhone 16 Pro,OS=18.6" -derivedDataPath /private/tmp/AgentEnglishDerived build` 返回 0。
