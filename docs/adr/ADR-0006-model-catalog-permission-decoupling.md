# ADR-0006: Model Catalog And Permission Decoupling (Model List × minTier)

## Status

Accepted, introduced by Product-Spec v2.12. Extends ADR-0002（后端托管模型服务）与 ADR-0003（auth/session/entitlement）。不改 ADR-0005（translation-proxy / Free 文本翻译路径）。

## Context

ADR-0002 把模型 / Provider 密钥 / 模型目录 / Free·Pro·Max 路由收敛到 `services/model-gateway`。当前实现把"模型"和"档位"写死成 1:1，权限与模型目录交织，且没有账号级持久档位：

- `services/model-gateway/src/catalog/model-catalog.ts` 的 `BASE_OPTIONS`：3 个写死条目（`free-translate` / `pro-context` / `max-mentor`），模型即档位、一档死绑一个模型。
- `services/model-gateway/src/providers/provider-router.ts` 的 `providersForModel(modelID)`：写死 switch 把模型 id 映射到 provider fallback 链。
- `services/model-gateway/src/env.ts`：每个 vendor 只有一个槽、只能填一个模型名（`OPENAI_MODEL`），无法一个 vendor 挂多个模型。
- `services/model-gateway/src/entitlements/entitlement-service.ts` 的 `createEntitlementSnapshot` 直接调 `createModelCatalog`，把权限快照和模型目录耦在一起。
- 配额每请求从 0 重算：`index.ts` 给 translate/explain 路由传字面量 `0`，没有任何持久化用量；现状"按档位总量"实际并未跨请求生效。
- 没有"账号"实体：`AccountStatusKind` 里的 `signed-in` 从未被构造，真实登录（Apple/Google identity token 校验）是抛错桩；能产生的只有匿名游客 + 环境变量密码的 dev-pro/dev-max。后端无任何数据库 / 持久层（全仓零 ORM/KV 依赖，会话是进程内 `Map`）。

Product-Spec v2.12 把它拆成两个互不掺和的系统，唯一接口 = 一个档位值：

- **线A · 模型系统**：一份模型清单 × 每模型标 minTier；给档位返回该档可用模型（minTier 单调、高档累加）；vendor 凭证与真实模型名解耦；能力（解释/学习卡）按档位解锁。
- **线B · 权限系统**：账号级持久档位 + 多端一致 + 后端唯一真相源。

已锁产品决策（Product-Spec v2.12 / docs/MODEL-AND-PERMISSION-REDESIGN-PLAN.md）：D1 高档累加可用低档便宜模型；D2 解释/学习卡按档位、与选哪个模型无关；D3 配额先维持按档位总量；D4 贵模型高 minTier、Free 档必须便宜、minTier 即成本闸；A1 admin UI 缓做、先配置清单驱动；A2 权限做成 model-gateway 内独立模块、非独立服务。

范围裁定：**本 ADR 落地线A；线B 只定义边界 + 升级触发条件，不在本版实现**（账号实体、持久层都不存在，强做会阻塞线A 且与未来订阅 ADR 重叠）。

交付上下文：产品处于 TestFlight / 自用阶段（ARCHITECTURE.md），无公开 App Store 客户端，iOS 与后端同步重建——故契约可干净切，无需加字段 / 灰度 / 版本兼容。

## Decision

把模型系统与权限系统拆成两块，只靠一个档位值对接。线A 本版实现，线B 记为后续扩展。

### 线A — 模型系统（本版实现）

**1. 模型清单数据结构（两层，遵守 ADR-0002 密钥边界）**

- **后端内部完整清单**（model-gateway 内，唯一真相源、绝不下发客户端）：每条
  `{ id, vendor, realModelName, minTier, isDefaultForTier, fallbackVendors? }`。
  `vendor` / `realModelName` / `fallbackVendors` 属 ADR-0002 规定的"真实模型名 / 内部路由"，**只能存后端**。
- **客户端脱敏投影**（`packages/contracts` 的 `ModelOption`，下发给 iOS）：只含
  `{ id, displayName, summary, minTier, availability, requiredTier, quota }`，
  **不含 vendor / realModelName / fallbackVendors**。`minTier` 取代旧的 `tier`。
- 投影由 model-gateway 从内部清单生成；契约里不出现任何内部路由细节。

**2. 配置真相源（A1 落地）**

- 本版后端内部清单 = model-gateway 内的编译期 TypeScript 常量（如 `catalog/model-registry.ts`）。加模型 = 加一条配置 + 重部署；admin UI 缓做。
- 数据结构保持干净，将来 admin UI / 运行时存储可直接替换数据源、不动下游消费者。
- 启动时校验配置：id 唯一；minTier 取值合法（free/pro/max）；每条模型的 vendor 在 env 中已配置凭证，否则该模型标记为不可用 / 不进目录（不产生"孤儿模型"）；每个档位恰有一个 `isDefaultForTier`；`fallbackVendors` 引用的 vendor 均已配置。校验失败属启动期硬错误，不静默放行半残目录。

**3. provider-router 改造 + env 解耦**

- 废掉 `providersForModel` switch：路由改为读所选模型自带的 `vendor` + `realModelName`（+ `fallbackVendors` 链）。
- `env.ts`：vendor 配置 = `{ apiKey, baseURL, timeoutMs }`，**去掉单一模型名槽**；真实模型名来自模型清单条目。一个 vendor 凭证可被多个模型条目引用，解决"一个 vendor 只能填一个模型名"。

**4. 能力按档位解锁（D2）**

- 解释 / 学习卡等**访问门控能力**由档位决定，不由所选模型决定。把门控能力从 `ModelOption` 挪到档位层（如 EntitlementSnapshot 上的 tier→capabilities，或契约内的档位能力集）。
- 高档用户选了便宜的低档模型，解释 / 学习卡照常可用。`ModelOption` 不再承载访问门控能力；模型条目可保留描述性能力（如 translation/audio/asr），但门控判定一律走档位。

**5. 契约变更策略（干净切）**

- `ModelOption.tier → minTier`；能力门控语义迁到档位。因处于 TestFlight / 无公开客户端，iOS 与后端同步重建，采用**干净重命名**（不保留旧字段、不做双轨），优于加字段 / 版本化迁移。
- 旧语义 model id（`free-translate` / `pro-context` / `max-mentor`）由基于真实模型的新 id 取代；任何已持久化引用（客户端 `preferredModelId`、收藏卡、日志）按"未知 id → 回退该档默认模型"读取处理。无公开用户 → 无需灰度。

**6. 权限 ↔ 模型目录解耦**

- `createEntitlementSnapshot` 不再构建模型目录。权限模块只负责"账号 → 档位"，产出档位值 + 档位能力 + 配额；模型系统接收档位、产出目录。entitlement 端点可组合二者，但两模块代码分离，权限模块不得 import 目录构建器。

**7. 配额边界（D3，含已知缺口）**

- 维持按档位总量（文本 Free 20 / Pro 200 / Max 800；听音 Free 10 分钟/天）。
- 现状配额每请求从 0 重算、未持久化——本 ADR 将其记为**线A 明确接受的已知缺口**，本版**不引入**配额持久化。账号级配额持久化 + 多端共享 + 并发原子自增 + 听音分钟持久化均属线B / 后续 phase。
- 线A 不得回归现有按档位配额形状，也不得宣称"多端配额一致"。

**8. 权限模块形态 + 线B 占位（A2）**

- 权限保持 model-gateway 内界限分明的模块（`entitlements/` + `sessions/` + `auth/`），与目录代码分离、同部署，**非独立服务**。
- 升级路径：`ServiceTier` / `AccountStatus` / `EntitlementSnapshot` 契约保持稳定，将来线B（乃至独立 `services/auth`）可挂接、客户端无感。
- 升级触发条件（满足任一）：① 出现第二个要判权限的后端；② 接真订阅 / 计费。

### 线B — 权限系统（定义边界，本版不实现）

- 目标形态：一个账号挂一个档位；档位存后端、绑账号、不绑设备 → 同一账号多端登录档位一致，后台改档、所有端都变；后端唯一真相源，客户端不能自报档位（沿用 ADR-0003 已确立的"后端 entitlement 为授权事实源、忽略客户端 serviceTier"）。
- 不在本版实现：账号实体、持久化存储、多端一致、账号级配额都需要"账号 + 持久层"，二者当前皆不存在。本版继续用游客会话 + dev/staging 测试账号撑测试，足以验证线A。
- 归属：线B 是 ADR-0002/ADR-0003 所述"未来订阅 / 计费需单独 ADR"的那一份的核心内容；落地时新增 ADR（或并入订阅 ADR），不隐含进本 ADR 的线A 实现。

### Translation-proxy 边界（⚠️ 本段已被 ADR-0007 取代）

> **更新（v2.13 / ADR-0007）**：本段当时的判断「Free 文本翻译物理路径仍走 proxy / translation-proxy 边界不变」**已被 ADR-0007 撤销**。新口径：所有档位（含 Free）的翻译统一走 model-gateway，translation-proxy 暂废弃（代码保留、不再路由）。下方原文保留作沿革。

- 模型清单 × minTier 是 **model-gateway 的目录**：由 `/v1/model-catalog` 下发，驱动 Pro/Max 的 translate/explain/听音翻译路由 + iOS SettingsView 展示与默认选择。
- ADR-0005 的 Free 文本翻译路由到 `services/translation-proxy`（其内部自配便宜大模型）**保持不变**。`preferredModelId` 实质作用于 model-gateway 所服务的调用；Free 文本翻译物理路径仍走 proxy。
- 目录中某个 free-minTier 条目是"用户看到的便宜翻译"的展示标签；其后端绑定（proxy vs gateway）是内部细节、不向用户暴露，也不在本 ADR 内改动 proxy。

## Alternatives Considered

| Alternative | Reason Not Chosen |
|---|---|
| 维持"模型=档位"1:1 + per-model switch | 一个 vendor 加不了第二个模型；高档不能选便宜模型；每加一个模型都要动路由逻辑。 |
| 把完整模型清单（含 realModelName/vendor）下发客户端 | 违反 ADR-0002 密钥边界：真实模型名 / 内部路由只能在后端。 |
| 加字段 / 版本化契约迁移（保留 tier 再加 minTier） | 无公开客户端（TestFlight），干净切更省更清晰，双轨是无谓复杂度。 |
| 本版即做账号级档位 + 持久化（线B） | 账号实体与数据库都不存在；会阻塞线A 且与未来订阅 ADR 范围重叠。 |
| 让 translation-proxy 也按模型清单驱动 | 超出线A 范围；与 ADR-0005 独立 Free 路径冲突；v1 不需要。 |
| 本版即上运行时存储 / DB 模型配置 + admin UI（A1） | owner 口述配置清单对 v1 足够；admin UI 缓做；编译期常量避免过早引入基建。 |

## Consequences

### Positive

- 加模型 = 加一条配置；高档可选便宜模型省配额；能力随档位一致解锁。
- vendor 与模型名解耦，一个 vendor 挂 N 个模型。
- 权限与目录分离，为将来 admin UI 与独立 `services/auth` 留干净接口、不返工。
- 真实模型名 / 内部路由仍只在后端，守住 ADR-0002 安全边界。

### Negative

- 破坏性契约变更需 iOS 同步重建（TestFlight 阶段可接受）。
- "配额未持久化"的缺口被明确保留为已知技术债：线B 落地前，多端配额不准。
- 旧语义 model id 的已持久化引用需迁移 / 回退处理。

### Constraints

- `vendor` / `realModelName` / `fallbackVendors` 永不进 `packages/contracts` 或客户端；只在 model-gateway 内部。
- 模型清单配置必须启动期校验（id 唯一 / minTier 合法 / vendor 凭证存在 / 每档一个默认 / 无孤儿）。
- 权限模块不得依赖模型目录构建器；目录系统不得读取账号 / 登录。
- 线A 不得引入账号持久化，也不得宣称多端配额一致。
- 服务端必须对 `preferredModelId` 重新校验（所选模型 minTier ≤ 账号档位），永不信任客户端自报档位（沿用 ADR-0003）。

## Follow-Up Rules

- `ARCHITECTURE.md` / `PROJECT-STRUCTURE.md` 必须更新：模型目录 = 后端内部清单（model registry）+ 契约脱敏投影；权限与目录解耦；vendor 凭证与模型名解耦。
- `DEV-PLAN.md` 必须新增线A phase（拆分由 planner 定）：后端模型 registry + 校验；provider-router 改造 + env vendor/模型名解耦；contracts `ModelOption` tier→minTier + 能力迁到档位；entitlement/目录解耦；iOS SettingsView 适配 + 旧 model id 迁移。
- `DEV-PLAN.md` 必须把线B（账号级持久档位 / 多端一致 / 账号级配额）记为**独立后续 phase、本版不做**，触发条件 = 真订阅 / 计费或第二个判权限后端。
- 配额持久化 / 多端共享 / 并发原子自增 / 听音分钟持久化属线B 范围；任何线A criteria 不得声明多端配额一致。
- 未来订阅 / 计费 ADR（依 ADR-0002/0003）吸收线B 的账号级持久档位决策。

## References

- ADR-0002 Backend-Managed Model Service: docs/adr/ADR-0002-backend-managed-model-service.md
- ADR-0003 Auth Session And Entitlement Foundation: docs/adr/ADR-0003-auth-session-entitlement.md
- ADR-0005 Tiered Translation And Free Translation Proxy: docs/adr/ADR-0005-tiered-translation-proxy.md
- Product-Spec.md v2.12 「AI 服务与模型等级 → 模型系统与权限系统」段
- docs/MODEL-AND-PERMISSION-REDESIGN-PLAN.md（已锁决策 D1–D4 / A1 / A2 来源）
