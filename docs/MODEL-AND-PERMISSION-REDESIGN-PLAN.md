# 权限系统 与 模型系统 重设计方案（待审核）

> 状态：**设计草案，待 owner 审核**。本轮不写代码。
> 适用范围：`services/model-gateway`（后端）+ `packages/contracts`（共享契约）+ `apps/ios`（前端适配）。

---

## 0. 一句话目标

**模型是模型，权限是权限。** 两个互不掺和的系统，靠"一个档位值"对接。

```
权限系统（管"人"）   账号 → 档位(free / pro / max)
   │  • 档位绑账号、存后端，不绑设备
   │  • 同一账号在 iOS / Web / 安卓登录 → 档位完全一致
   │  • 后端唯一真相源，客户端不可自报
   │
   │  交出唯一一个东西：「这个用户是什么档」
   ▼
模型系统（管"模型"）  后台一份模型清单，每个模型标 minTier(最低可用档)
        • 给一个档位 → 返回该档能用的模型（高档累加看到低档的）
        • 它不知道"你是谁"，只认档位
```

**两者唯一接口 = 一个档位值。** 权限系统永不碰模型，模型系统永不碰账号/登录。

---

## 1. 两个系统各自做成什么样

### 1.1 权限系统（管"人"）
- 一个用户 = 一个**账号**；账号上挂一个**档位**（free / pro / max）。
- 档位**存后端、绑账号**，不绑设备 → **同一账号多端登录，看到的档位一致**；后台改该账号档位，所有端都变。（关键要求）
- 登录默认 free；订阅后升 pro / max（真订阅/计费是后话，先留接口，不实现）。
- **后端是唯一真相源，客户端不能自报档位**（安全铁律，沿用 ADR-0005）。
- 「档位解锁哪些功能（点词解释 / 学习卡）」归这边——属于"这个档能干啥"。

### 1.2 模型系统（管"模型"）
- 后台维护**一份模型清单**，每条 = 一个真实 LLM：`{ id, 显示名, vendor, 真实模型名, minTier }`。
- **加模型 = 加一条配置**，不改逻辑。一个 vendor 可挂多个模型（解决现在"OpenAI 只能填一个模型名"）。
- 对外只提供一件事：**给我一个档位，我返回这个档能用哪些模型**（minTier 单调，高档累加）。
- 不碰账号、不碰登录、不判"你是不是真 Pro"——那是权限系统的事。

### 1.3 它俩怎么连
用户登录 → 权限系统给出档位 → 模型系统按档位列出可用模型 → 用户选一个 → 用它翻译/解释。

---

## 2. 已锁定的产品决策

| 编号 | 决策 | 结论 |
|---|---|---|
| D1 | 高档能否用低档（便宜）模型 | **能，累加**（minTier 单调，Max 也能选便宜模型省额度） |
| D2 | 解释 / 学习卡按什么解锁 | **按档位**（Pro 以上有，与选哪个模型无关）——归权限系统 |
| D3 | 配额怎么算 | **先维持按档位总量**（free 20 / pro 200 / max 800），按模型配额以后再说 |
| D4 | 成本红线 | 贵模型给高 minTier、便宜模型给低 minTier；Free 那个必须便宜（如 DeepSeek）。minTier 即成本闸 |
| A1 | 后台配模型的"管理界面"(admin UI) | **缓做**。先用配置清单驱动（owner 口述、我改配置）。设计时预留干净数据结构，将来 admin UI 直接接上、不动核心 |
| A2 | 权限做成什么形态 | **模块**（在 model-gateway 内界限分明的一块，代码独立、同一部署）。非独立服务 |

---

## 3. 现在差在哪（为什么要改）

### 3.1 模型系统：现在"模型=档位"写死
- `services/model-gateway/src/catalog/model-catalog.ts` 的 `BASE_OPTIONS`——3 个写死条目（free-translate / pro-context / max-mentor），模型即档位，1 档死绑 1 个。
- `services/model-gateway/src/providers/provider-router.ts` 的 `providersForModel(modelID)`——写死 switch 把"模型 id"映射到 provider fallback 链。
- `services/model-gateway/src/env.ts`——只有 3 个 vendor 槽（openai/deepseek/anthropic），每 vendor 仅 1 个模型名，无法一个 vendor 挂多个模型。
- → **改成「模型清单 + 每个模型标 minTier」+「vendor 凭证与模型名解耦」。**

### 3.2 权限系统：现在只有"按设备"，没有"按账号"
- 现有 `entitlements/` + `sessions/` + `auth/` + `quota/` 散着；tier 是假的（访客=free，dev-login 测试账号=pro/max），**没有账号级持久档位** → 同一用户换设备登录档位对不上。
- model-catalog 当前被耦合进 `createEntitlementSnapshot`（权限与模型目录交织）。
- → **改成「账号级档位，多端一致」+「拢成一块清晰的权限模块」+「解开权限↔模型目录的耦合」。**

---

## 4. 权限系统放哪（"独立"的两层含义）

| 层 | 含义 | 现在要不要 |
|---|---|---|
| ① 代码独立 | 权限逻辑自成清晰一块，不和模型搅在一起 | **要，现在做**（这就是"权限是权限"） |
| ② 部署独立 | `services/auth` 单进程单部署 | **现在不值**：只有 model-gateway 一个消费者；auth 挂了谁都没法授权、model-gateway 照样歇菜（隔离救不了）；徒增网络调用+一套部署 |

- **铁律**：权限永远在后端，所有端调同一接口；端的数量不影响它放哪。
- **共享语言已就位**：`AccountStatus` / `ServiceTier` / `EntitlementSnapshot` 已在 `packages/contracts`，多端多服务共用。
- **本次形态（已定）**：方案甲 = model-gateway 内独立**模块**。
- **将来升级为独立 `services/auth` 服务的触发条件**（满足任一）：① 出现第二个要判权限的后端；② 接真订阅/计费。靠 contracts 平滑升级、客户端无感、不返工。

---

## 5. 怎么做（分步，本轮不写码）

1. **product-spec-builder**：把"权限系统"和"模型系统"两块产品定义分别写清进 `Product-Spec.md`——含多端档位一致、账号级档位、模型清单×minTier、档位解锁功能、D1–D4。
2. **architecture-builder**：出 `docs/adr/ADR-0006-*`，定两块的边界、数据模型、契约改动、账号级档位怎么存取、权限模块边界（将来可升级为独立服务）。
3. **planner → dev-builder**：按 phase 实现。

---

## 6. 影响文件（参考，实现期细化）

- `services/model-gateway/src/catalog/model-catalog.ts`（`BASE_OPTIONS` → 模型清单）
- `services/model-gateway/src/providers/provider-router.ts`（`providersForModel` switch → 读模型自带 vendor / 真实模型名）
- `services/model-gateway/src/env.ts`（vendor 凭证 ↔ 模型名解耦，支持 N 模型）
- `services/model-gateway/src/entitlements/`、`sessions/`、`auth/`（拢成清晰的权限模块；账号级档位）
- `services/model-gateway/src/quota/service-tier.ts`（tier 闸保留）
- `packages/contracts/src/model-service.ts`（`ModelOption.tier` → `minTier`；可能加 vendor 等字段）
- `apps/ios`（`SettingsView` 模型选择器已存在，适配新 catalog 字段）

---

## 7. 验证（实现期）

- 同一账号在两个设备登录 → 档位一致；后台改该账号档位 → 两端都变。
- 后台配 ≥2 个模型分属不同 minTier → free 只见 free 模型，pro 见 free+pro，max 见全部。
- 切模型真命中对应 vendor / 真实模型名（看 model-gateway 日志）。
- 既有 catalog / translate / explain 测试适配后全绿。
