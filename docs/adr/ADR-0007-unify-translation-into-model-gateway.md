# ADR-0007: Unify Translation Into Model-Gateway (Deprecate Translation-Proxy)

## Status

Accepted, introduced by Product-Spec v2.13. **Supersedes ADR-0005**（Tiered Translation And Free Translation Proxy）的「Free 文本翻译走独立 translation-proxy / 与付费 gateway 故障隔离」决策；**修正 ADR-0006** 的「translation-proxy 物理路径不变」边界。translation-proxy 代码暂保留、不再路由（非永久删除）。

## Context

ADR-0005 把 Free 文本翻译拆到独立 `services/translation-proxy`（自配便宜大模型、与付费 model-gateway 故障隔离），目标是「Free 不被大模型后端是否就绪卡住」。ADR-0006（线A）把 model-gateway 的模型目录重构成「模型清单 × minTier」，Free 档已有便宜默认模型（`deepseek-chat`）。

owner 重申产品本意：**模型系统统一**——所有档位都用 model-gateway 的同一套模型系统，free / pro / max 只是开放的**权限不同**（可用模型范围 + 配额 + 解锁功能如解释 / 学习卡），翻译机制本身无区别。在这个前提下，translation-proxy 的「Free 专用代理 + 故障隔离」是额外复杂度（两套后端、两条链路 contract、双份限额 / 缓存 / 错误归一），与统一目标冲突。

运行期也暴露了这个分裂的成本：iOS 当前把 Free 文本 / 字幕翻译路由到 translation-proxy（`TranslationProviderClient`），proxy 没起时 Free 翻译失败（视频页显示「字幕翻译暂不可用」），而 model-gateway 已能用 free 档模型直接翻译。

## Decision

统一翻译入 model-gateway：

- 所有档位（含 Free）的文本 / 字幕翻译都走 model-gateway 的 `/v1/translate`，用 registry 的对应档模型——Free 用 free 档默认模型（如 `deepseek-chat`）。
- free / pro / max 的差异**只在权限档位**（可用模型范围 + 配额 + 解锁功能），翻译调用机制无区别；后端按 session entitlement 路由，客户端不可自报档位（沿用 ADR-0003）。
- translation-proxy **暂废弃**：`services/translation-proxy` 代码保留、不再被路由，后续再决定删除还是另作他用（非本版决策）。
- iOS `TranslationProviderClient` 路由从「Free→proxy / Pro·Max→gateway」改为「所有档位→model-gateway」。

## Alternatives Considered

| Alternative | Reason Not Chosen |
|---|---|
| 保留 translation-proxy 做 Free 故障隔离（ADR-0005 现状） | 与「模型系统统一、档位只管权限」的产品本意冲突；维护两套后端 + 两条 contract + 双份限额 / 缓存是额外复杂度，early-stage 不值。 |
| 永久删除 translation-proxy 代码 | owner 要「暂废弃、后续再说」，不永久删；保留代码留后路（将来若需为 Free 单独降本 / 降级再启用）。 |
| Free 走 gateway，但在 gateway 内部加一层 proxy-fallback | 把 proxy 逻辑塞进 gateway 又把「统一」复杂化了；统一就是只走 registry，不另设兜底链路。 |

## Consequences

### Positive

- 一套后端、一条翻译链路、一份 contract / 限额 / 缓存 / 错误归一——复杂度大降。
- 档位语义干净：free / pro / max = 权限不同，翻译机制一致，契合 ADR-0006 线A「模型系统统一」。
- 加模型 / 调模型只在 model-gateway registry 一处。

### Negative

- 放弃 ADR-0005 的核心保证「Free 翻译与大模型后端故障隔离、gateway 没起仍可翻」——统一后 Free 翻译依赖 model-gateway 在跑；gateway 故障 → Free 也翻不了（降级到选区 / 复制翻译提示）。
- 已落地的 translation-proxy 服务变成 parked 死代码（保留但不跑），短期是技术债。

### Constraints

- `services/translation-proxy` 不再被任何客户端路由；保留代码但不进发布的运行路径（若将来彻底移除，另起决策）。
- model-gateway 必须能服务 Free 档翻译（free 档至少一个 `minTier=free` 的可用模型；registry 已有 `deepseek-chat`）。
- 后端按 session entitlement 路由，`preferredModelId` minTier 重校验（ADR-0003），不信任客户端自报档位。
- Free 翻译失败（gateway 不可用 / 额度耗尽）时给明确提示 + 选区 / 复制降级，不伪装成功。

## Follow-Up Rules

- `ARCHITECTURE.md` / `PROJECT-STRUCTURE.md`：把「两条翻译链路解耦」原则、translation-proxy 平台矩阵 / 层次 / 目录职责改为「统一走 model-gateway、proxy 暂废弃 parked」（本 ADR 同批已改）。
- ADR-0005 标 `Superseded by ADR-0007`；ADR-0006 的「Translation-proxy 边界（不变）」段标注被本 ADR 取代。
- `DEV-PLAN.md` 新增 phase：iOS `TranslationProviderClient` 路由改 Free→model-gateway、删 / 改过时的 proxy 分流测试（`TranslationTieringTests`）、隐私文案从「Free→翻译代理」改「Free→model-gateway」。
- 设置页 / 隐私披露：Free 文本发送目标从「自有翻译代理」改为「model-gateway」。

## References

- ADR-0005 Tiered Translation And Free Translation Proxy（superseded by this）: docs/adr/ADR-0005-tiered-translation-proxy.md
- ADR-0006 Model Catalog And Permission Decoupling: docs/adr/ADR-0006-model-catalog-permission-decoupling.md
- ADR-0002 Backend-Managed Model Service: docs/adr/ADR-0002-backend-managed-model-service.md
- ADR-0003 Auth Session And Entitlement Foundation: docs/adr/ADR-0003-auth-session-entitlement.md
- Product-Spec.md v2.13「AI 服务与模型等级 → 模型系统与权限系统」段
