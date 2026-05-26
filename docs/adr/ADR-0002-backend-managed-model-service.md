# ADR-0002: Backend-Managed Model Service

## Status

Accepted, amended by Product-Spec v2.4

## Context

Product-Spec v2.1 明确取消用户自定义 Provider、Base URL、模型名、API Key 和 BYOK。产品对用户展示 Free / Pro / Max 服务等级和可用模型档位，底层模型、Provider 密钥、额度和 fallback 由产品方统一管理。

如果 iOS App 继续直连 DeepSeek、OpenAI、Google、Anthropic 等 Provider，就必须把密钥或可滥用的访问方式放进客户端；这不适合公开产品，也无法做免费额度、付费等级、成本控制或滥用防护。

2026-05-22 补充：Product-Spec v2.2 和 ADR-0003 已把游客 Free 会话、可选登录、dev/staging Pro / Max 测试账号和后端 entitlement 纳入同一模型服务边界。本文仍负责“Provider 密钥和模型目录必须后端托管”的决策，session 与账号权益细节以 ADR-0003 为准。

2026-05-25 补充：Product-Spec v2.4 新增 YouTube 听音翻译 Beta。ASR 密钥、音频分钟额度、听音识别路由、fallback 和成本控制也必须归入同一后台模型服务边界；iOS App 和 `browser-agent` 都不能直连 ASR Provider。

## Decision

采用后台统一模型服务：

- iOS App 只调用自有模型服务 API，不直连第三方模型厂商。
- Provider / ASR 密钥、Base URL、真实模型名、成本信息和 fallback 顺序只保存在后端。
- 后端维护模型目录，把用户可见能力分为 Free / Pro / Max，并下发文本额度和音频分钟额度。
- App 设置页只展示当前服务等级、可用模型显示名、用量状态、目标语言和隐私说明。
- App 不展示 API Key 输入框，不提供自定义 Provider 或 BYOK。
- Free 层优先使用低成本翻译服务、低成本模型或低成本 ASR，并强制文本额度、音频分钟额度、缓存和速率限制；YouTube 听音翻译 Beta 默认每天 10 分钟。
- Pro / Max 层通过后端 entitlement 决定可用模型和调用上限。
- 听音翻译 API 只接受用户可见启用的短音频片段，默认不持久化完整音频，不提供下载音视频后转写能力。

## Alternatives Considered

| Alternative | Reason Not Chosen |
|---|---|
| 用户 BYOK / 自定义 Provider | 配置门槛高，普通用户不理解 Provider 参数；无法做统一套餐体验；用户体验会退化成开发者工具。 |
| App 内置 Provider 密钥直连模型厂商 | 密钥可被提取并滥用，无法保护成本，也无法安全支持公开发布。 |
| App 或 JS 直连 ASR Provider | ASR 密钥同样会泄露，也无法可靠执行 Free / Pro / Max 音频分钟额度、隐私提示和滥用防护。 |
| 只使用传统翻译 API，不引入 LLM | Free 层可以这样做，但 Pro / Max 的语境解释、学习卡生成和复杂句子说明需要 LLM。 |
| 后端代理所有学习数据并做云同步 | 当前只需要模型服务、额度和密钥托管；收藏、复习、历史仍先本地保存，避免提前扩大隐私和同步复杂度。 |

## Consequences

### Positive

- 普通用户不需要配置技术参数，设置页更像产品而不是 Provider 控制台。
- 第三方模型密钥不进入 App，降低泄露和滥用风险。
- 可以统一做 Free / Pro / Max、额度、用量、fallback、模型下线和成本控制。
- 可以统一做听音翻译分钟额度、ASR fallback、短片段处理和成本控制。
- 后续可以替换底层模型而不发版，只需要更新后端模型目录。

### Negative

- 首版从纯本地 App 变成 iOS App + 轻量后端，部署、监控、限流和密钥管理成为必做项。
- 页面文本会经过自有后端，隐私披露和数据保留策略必须更严谨。
- 听音翻译会让短音频片段经过自有后端和 ASR Provider，必须增加用户可见开关、停止入口、分钟额度、错误提示和默认不持久化策略。
- 现有直连 Provider / Keychain 凭证配置代码需要被重构为模型服务客户端。
- Free 层如果没有文本额度、音频分钟额度和缓存，会直接产生可观成本。

## Constraints

- iOS App 不允许保存第三方 Provider / ASR API Key、Base URL 或真实内部模型路由。
- `browser-agent` 不允许直接调用模型服务、第三方 Provider 或 ASR，只能通过 native bridge 交给 App。
- 后端模型服务不得保存完整浏览历史；除非后续另有账号 / 同步 ADR，否则收藏、复习、历史仍以本地 SwiftData 为主。
- 后端模型服务必须以 session entitlement 判定 Free / Pro / Max，不能信任客户端请求体自报等级；具体 session / auth 约束见 ADR-0003。
- 模型服务 API 必须返回用户可理解的错误：额度不足、音频分钟额度用完、当前等级不可用、服务暂不可用、内容过长、Provider / ASR fallback 失败。
- 设置页必须提示页面文本会发送到自有后端，并可能由后端转发给当前等级对应的第三方模型或翻译服务；听音翻译启用前必须提示短音频片段会发送到自有后端并可能转发给 ASR / 模型服务。

## Follow-Up Rules

- `ARCHITECTURE.md` 和 `PROJECT-STRUCTURE.md` 必须把 `services/model-gateway` 作为当前范围，而不是未来可选项。
- `DEV-PLAN.md` 必须插入 Provider 重构 Phase：移除用户 API Key 配置 UI，新增模型目录 contract、模型服务后端和 iOS 模型服务客户端。
- `DEV-PLAN.md` 必须在 YouTube 视频基线后插入听音翻译 Beta Phase：新增 ASR 路由、音频分钟额度、Free 10 分钟限制、隐私提示和听音 overlay 状态。
- 已完成 Phase 中出现的直连 Provider 能力视为技术债，不作为最终产品形态通过。
- 后续如果要做订阅支付、学习数据云同步或团队管理，需要新增 ADR，不能把这些隐含进模型服务改造或 ADR-0003 的测试账号基础里。
