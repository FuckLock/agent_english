# ADR-0005: Tiered Translation And Free Translation Proxy

## Status

**Superseded by ADR-0007**（Product-Spec v2.13：翻译统一入 model-gateway、暂废弃 translation-proxy，撤销本 ADR「Free 文本翻译走独立 proxy + 与付费 gateway 故障隔离」核心决策；proxy 代码暂保留、不再路由、不删，见 ADR-0007）。撤销原因：owner 重申模型系统统一、档位只管权限，proxy 的 Free 专用代理 + 故障隔离是额外复杂度。

原状态（保留沿革）：Accepted, introduced by Product-Spec v2.5；amended by v2.7（Free 翻译 provider 从第三方通用翻译改为产品方服务端配置的便宜大模型；翻译分层 / 独立代理 / 故障隔离 / 不做 BYOK 等核心决策不变，见末尾「v2.7 修订」段）

## Context

ADR-0002 把所有模型 / 翻译能力收敛到后台统一模型服务（`services/model-gateway`），iOS 现状把全部翻译都发往 gateway 的 `/v1/translate`。

实际运行暴露一个结构性问题：Free 文本翻译也强依赖大模型 gateway 是否就绪。一旦 gateway 未部署、`MODEL_SERVICE_ROOT` 未配置或服务故障，翻译请求直接失败（"未连接到模型服务"），Free 用户连最基础的网页 / 字幕文本翻译都用不了。这正是 v2.5 之前"Free 没法翻译"的根因——不是功能缺失，而是把廉价、高频、应当开箱即用的 Free 文本翻译，绑死在最重、成本最高、最依赖配置的大模型后端上。

Product-Spec v2.5 提出三条要求：
- Free 文本翻译必须开箱默认可用，不被自建大模型后端是否就绪卡住。
- 翻译能力要可跨端复用（当前 iOS，后续 Web 等），不绑死苹果端上框架。
- 澄清"不做 BYOK"仅指禁止用户自行配置大模型 Provider / Base URL / 模型名 / API Key，并不限制产品自身集成的第三方通用翻译服务（如 Google / 微软翻译）。

## Decision

采用翻译分层 + 独立轻量翻译代理：

- 新建独立服务 `services/translation-proxy`，只负责 Free 文本翻译：托管第三方通用翻译（Google / 微软等）key 并转发，按 session 做 Free 限额、文本分块、缓存、错误归一和通用翻译 Provider fallback。
- `services/model-gateway` 继续负责 Pro / Max 文本翻译、点词点句解释、学习卡生成和 YouTube 听音 ASR，以及 session / entitlement / 模型目录 / 密钥托管 / 额度。
- 两个服务独立部署、互不依赖：大模型 gateway 未配置或故障时，Free 文本翻译仍可经翻译代理独立工作；翻译代理故障时降级到选区 / 复制翻译并提示，不影响 Pro / Max 链路。
- iOS `AgentEnglishCore/Providers` 翻译客户端按 session entitlement 路由：Free 文本翻译 → translation-proxy；Pro / Max 文本翻译、解释、听音 → model-gateway。entitlement 仍以后端 session 为授权事实源，客户端不可自报等级。
- iOS 与后续 Web 共用同一 translation-proxy API，翻译能力不绑死端上框架。
- 听音 ASR 仍走 model-gateway，Free 每天 10 分钟；Free 文本翻译不限量（第三方通用翻译成本低）。
- 无论哪条链路，翻译 key 都不进客户端，也不向用户暴露任何 Provider / key / 配置入口。

## Alternatives Considered

| Alternative | Reason Not Chosen |
|---|---|
| 客户端直连第三方通用翻译 | 翻译 key 放进客户端会被提取滥用；改用非官方免 key 接口则不稳定且有 ToS 风险；iOS / Web 还要各自实现直连，无法共用限额与缓存。 |
| Free 仍走现有 model-gateway，只加一条低成本翻译路径 | Free 仍绑在大模型后端是否就绪上，没有解决"后端没配 Free 就死"的根因。 |
| Free 用端上翻译（如 Apple Translation 框架） | 绑死苹果生态，后续 Web / Android 无法复用；与 v2.5 跨端要求冲突。 |
| 把翻译代理合并进 model-gateway 作为一个内部路由 | 失去"独立部署、故障隔离"价值；大模型后端的配置 / 部署问题仍会拖垮 Free 文本翻译。 |

## Consequences

### Positive

- Free 文本翻译开箱默认可用，不再被大模型后端的配置或故障阻塞。
- 翻译成本与质量分层清晰：Free 用低成本通用翻译，Pro / Max 用大模型增强。
- translation-proxy 是无状态轻量转发服务，部署、扩容、监控成本远低于大模型 gateway。
- iOS 与后续 Web 共用同一翻译代理 API，跨端复用，不绑死端上能力。
- 翻译 key 仍只在服务端，符合"不做 BYOK / 不向客户端暴露 key"的安全边界。

### Negative

- 后端从单一 model-gateway 变成 gateway + translation-proxy 两个服务，部署、密钥管理和监控点增加。
- 两条翻译链路要维护一致的请求 / 结果 contract 和失败降级语义。
- iOS 现状全量走 `/v1/translate` 的翻译客户端需要重构为按 entitlement 路由。
- Free 文本翻译数据流多一个自有服务节点，隐私披露要覆盖"发送到自有翻译代理并转发给第三方通用翻译"。

## Constraints

- `services/translation-proxy` 不持有大模型 / ASR key，不判定 entitlement 等级，只读 session 做 Free 限额；entitlement 判定仍归 model-gateway。
- iOS 翻译客户端必须有"大模型 gateway 未配置 / 不可用时 Free 文本翻译仍可用"的测试，不能让 Free 链路隐式依赖 gateway。
- 客户端、`browser-agent` 和 App bundle 中不得出现任何翻译 key、Provider Base URL 或用户可配置的翻译来源入口。
- 设置页隐私说明必须区分两条数据流：Free 文本 → 自有翻译代理 → 第三方通用翻译；Pro / Max 文本与解释 → 大模型 gateway → 对应模型 / 翻译 Provider。
- 翻译代理与大模型 gateway 必须独立部署，任一故障不得让另一条链路整体不可用。

## Follow-Up Rules

- `ARCHITECTURE.md` 和 `PROJECT-STRUCTURE.md` 必须把 `services/translation-proxy` 作为当前范围，而不是未来可选项。
- `DEV-PLAN.md` 必须新增翻译分层 Phase：建立 `services/translation-proxy`、改 iOS Providers 为按 entitlement 路由、补 Free 文本翻译不依赖大模型后端的测试；并把 YouTube 视频页 v2.5 隐形态 / 召唤态重构纳入对应 Phase。
- 现状全量直连 `/v1/translate` 的翻译链路视为迁移技术债，在翻译分层 Phase 收敛，不作为最终形态通过。
- 后续 Web 端接入时复用同一 translation-proxy API，不得为 Web 单独把翻译 key 放进前端。
- 如需为 Free 引入更多通用翻译 Provider 或调整限额策略，在翻译代理内做，不回退到"Free 走大模型 gateway"。

---

## v2.7 修订（Free 翻译 provider：第三方通用翻译 → 便宜大模型）

Product-Spec v2.7 修订 Free 文本 / 字幕翻译的 provider 实现：`services/translation-proxy` 内部不再转发第三方通用翻译（Google / 微软），改为调用产品方在服务端配置的便宜大模型（OpenAI 兼容 Chat Completions，如 DeepSeek V3 / Kimi / GLM / Qwen 等），用翻译 prompt 生成中文译文。动机：Google Cloud / Azure 翻译账号申请麻烦、需信用卡；大模型 API（DeepSeek 等）注册充值简单、成本低、翻译质量优于通用机器翻译；产品方在服务端配一个便宜模型即可，简化实现、先把功能跑通。

### 不变（本 ADR 核心决策全部保留）

- 翻译分层 + 独立轻量翻译代理结构不变：Free 走独立 `services/translation-proxy`，Pro / Max 与听音 ASR 走 `services/model-gateway`。
- 两服务独立部署、故障隔离：model-gateway 未配置 / 故障时 Free 文本翻译仍可经 translation-proxy 独立工作。
- iOS 按 entitlement 路由不变：Free → translation-proxy（`TRANSLATION_PROXY_ROOT`），Pro / Max / 听音 → model-gateway；iOS 客户端与 model-gateway 代码不改。
- key 只在服务端、不进客户端 / `browser-agent` / App bundle；不向用户暴露任何 Provider / key / 配置入口；不做 BYOK（仅指禁用户自配大模型）。
- 按 session 做 Free 限额、文本分块、缓存、错误归一、Provider fallback 等基建不变。
- 跨端复用同一 translation-proxy API（iOS / 后续 Web）。

### 变更

- translation-proxy 的 provider 层：从「Google / 微软 HTTP 翻译 API」换成「OpenAI 兼容大模型 Chat Completions provider」（翻译 prompt）。默认 provider 改为便宜大模型；原 google / microsoft provider 可移除或保留为后续可选的通用翻译通道。
- 配置项：`.env` 从 `GOOGLE_TRANSLATE_API_KEY` / `AZURE_TRANSLATOR_API_KEY` 改为大模型的 Base URL + API Key + 模型名（OpenAI 兼容），仍只在服务端。
- 数据流与隐私披露：Free 文本 → 自有翻译代理 → 便宜大模型 Provider（替代原「→ 第三方通用翻译」）。

### 与既有原则的关系

- 「不回退到 Free 走 model-gateway」仍成立：Free 仍走独立 translation-proxy，只是 proxy 内部 provider 从通用翻译换成便宜大模型；proxy（便宜模型 / Free）与 gateway（强模型 / 付费 + ASR）仍是两套独立部署、故障隔离的后端。
- Alternatives 中「客户端直连第三方通用翻译」「Free 走 model-gateway」「端上翻译」被否决的理由对便宜大模型同样成立：key 不进客户端、Free 不绑大模型 gateway、不绑端上框架。

### 解耦兜底修正（Phase 8.8 真机验证发现）

真机验证暴露一个解耦漏洞：translation-proxy 把请求的 session token 当**不透明的限额分组键**（`session/session-key.ts`，不验真伪），但**强制要求有 token**（无 token → 401 Missing session token）。而 iOS 此前 `TranslationProxyEndpointConfiguration.resolvedSessionToken()` 只从 Keychain 读 model-gateway 创建游客 session 时存入的 token——model-gateway 未起时 Keychain 无 token，proxy 401，Free 文本翻译反而用不了。即「Free 不依赖 gateway」在运行时并未真正成立（Free 隐式依赖 gateway 签发 session token）。

修正（仅改 iOS、不改 proxy）：`resolvedSessionToken()` 优先用 gateway session token；无 gateway token 时回退到本地生成并持久化的**设备级匿名标识**（`KeychainCredentialStore.loadOrCreateAnonymousProxyToken`，形如 `anon-<UUID>`），仅作 proxy 的 Free 限额分组键、不用于 gateway 鉴权。这样 model-gateway 未起 / 未配置时 Free 文本翻译仍可独立工作，真正落实本 ADR 的解耦目标。

约束补充：
- proxy 的 session token 是**限额分组键、非身份凭证**；entitlement 仍由 model-gateway + session 判定（proxy 不判），匿名标识不赋予任何等级 / 权益。
- 解耦验证不能只看「proxy 代码不读 gateway 环境变量」，还要保证「iOS 在 gateway 未起时仍能给 proxy 一个稳定的限额 key」——后者由设备级匿名标识兜底 + iOS 测试（无 gateway token 时 `resolvedSessionToken` 非 nil 且跨调用稳定）覆盖。
