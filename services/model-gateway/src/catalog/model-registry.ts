import type { ServiceTier } from "@agent-english/contracts";

import type { ProviderID } from "../env";

/**
 * 后端内部模型清单（ADR-0006 决策 1/2）——唯一真相源、编译期 TS 常量、**绝不下发**。
 *
 * `vendor` / `realModelName` / `fallbackVendors` 属 ADR-0002 规定的「真实模型名 / 内部路由」，
 * 只能存后端：客户端脱敏投影（ModelOption，见 model-catalog.ts）绝不携带这三字段。
 *
 * 加一条模型 = 加一条配置 + 重部署（admin UI 缓做，A1）；路由逻辑不动（provider-router 读条目自带字段）。
 */
export interface ModelRegistryEntry {
  /** 客户端可见 id（投影里下发）；registry 内唯一。 */
  id: string;
  /** 真实厂商凭证 key（env 中已配置才进目录）；只存后端。 */
  vendor: ProviderID;
  /** 真实模型名（请求体 model 字段实际取值）；只存后端、绝不下发。 */
  realModelName: string;
  /** 解锁该模型所需的最低档位（minTier 单调累加；D4 成本闸）。 */
  minTier: ServiceTier;
  /** 是否为该档位默认模型；每档恰一个为 true（启动期硬校验）。 */
  isDefaultForTier: boolean;
  /** 备用 vendor 链（按序回退）；引用的 vendor 必须已配置，否则启动硬错误；只存后端。 */
  fallbackVendors?: ProviderID[];
}

/**
 * 编译期模型清单常量（A1：配置驱动，无运行时 fetch / 文件 IO）。
 *
 * 一个 vendor 凭证可被多条模型条目引用（解「一 vendor 只能填一个模型名」约束）：
 * 此处 `openai` 同时被 `openai-gpt-4o-mini`（free 档）与 `openai-gpt-4o`（pro 档）引用。
 */
export const MODEL_REGISTRY: readonly ModelRegistryEntry[] = [
  {
    id: "deepseek-chat",
    vendor: "deepseek",
    realModelName: "deepseek-chat",
    minTier: "free",
    isDefaultForTier: true,
  },
  {
    id: "openai-gpt-4o-mini",
    vendor: "openai",
    realModelName: "gpt-4o-mini",
    minTier: "free",
    isDefaultForTier: false,
    fallbackVendors: ["deepseek"],
  },
  {
    id: "openai-gpt-4o",
    vendor: "openai",
    realModelName: "gpt-4o",
    minTier: "pro",
    isDefaultForTier: true,
    fallbackVendors: ["deepseek"],
  },
  {
    id: "anthropic-claude-sonnet",
    vendor: "anthropic",
    realModelName: "claude-sonnet-4-latest",
    minTier: "max",
    isDefaultForTier: true,
    fallbackVendors: ["openai", "deepseek"],
  },
] as const;

const VALID_TIERS: readonly ServiceTier[] = ["free", "pro", "max"];

/** registry 校验抛出的启动期硬错误（非法配置 = 拒启，区别于「缺凭证降级」）。 */
export class ModelRegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRegistryValidationError";
  }
}

export interface ValidateModelRegistryOptions {
  /** env 中实际配置了凭证的 vendor 集合（用于「缺凭证降级」判定）。 */
  configuredVendors: ReadonlySet<ProviderID>;
}

/**
 * 启动期 registry 校验（ADR-0006 决策 2）。两类语义**必须区分**：
 *
 * 1. **非法配置 → 启动硬错误（throw）**：
 *    - id 重复
 *    - minTier ∉ {free, pro, max}
 *    - 某档非恰一个 isDefaultForTier（缺 / 多）
 *    - fallbackVendors 引用 env 未配置的 vendor（仅对「会进目录」的条目校验，见下）
 *
 * 2. **缺凭证 → 该模型不进目录、其余正常（不 throw、无孤儿）**：
 *    - 某条目主 vendor 在 env 未配凭证 → 从返回清单中剔除该条目，校验不报错。
 *
 * id 唯一 / minTier / 每档默认数是纯配置正确性，对全量 registry 校验（与 env 无关）。
 * fallbackVendors 校验只针对「主 vendor 已配置（即会进目录）」的条目：主 vendor 未配的
 * 条目整体不进目录，其备用链不再参与校验（与「否则不进目录」语义一致）。
 *
 * @returns 过滤掉「主 vendor 缺凭证」后的有效清单（用于驱动目录生成）。
 * @throws ModelRegistryValidationError 当遇到第 1 类非法配置。
 */
export function validateModelRegistry(
  registry: readonly ModelRegistryEntry[],
  options: ValidateModelRegistryOptions,
): readonly ModelRegistryEntry[] {
  const { configuredVendors } = options;

  // —— 非法配置（throw）：id 唯一 ——
  const seenIds = new Set<string>();
  for (const entry of registry) {
    if (seenIds.has(entry.id)) {
      throw new ModelRegistryValidationError(
        `Duplicate model id in registry: "${entry.id}".`,
      );
    }
    seenIds.add(entry.id);
  }

  // —— 非法配置（throw）：minTier 合法 ——
  for (const entry of registry) {
    if (!VALID_TIERS.includes(entry.minTier)) {
      throw new ModelRegistryValidationError(
        `Invalid minTier "${entry.minTier}" for model "${entry.id}".`,
      );
    }
  }

  // —— 非法配置（throw）：每档恰一个 isDefaultForTier ——
  for (const tier of VALID_TIERS) {
    const defaultsForTier = registry.filter(
      (entry) => entry.minTier === tier && entry.isDefaultForTier,
    );
    if (defaultsForTier.length !== 1) {
      throw new ModelRegistryValidationError(
        `Tier "${tier}" must have exactly one isDefaultForTier model, found ${defaultsForTier.length}.`,
      );
    }
  }

  // —— 缺凭证降级（不 throw）：主 vendor 未配凭证 → 剔除该条目，其余正常 ——
  const availableEntries = registry.filter((entry) =>
    configuredVendors.has(entry.vendor),
  );

  // —— 非法配置（throw）：进目录条目的 fallbackVendors 必须已配置 ——
  for (const entry of availableEntries) {
    for (const fallbackVendor of entry.fallbackVendors ?? []) {
      if (!configuredVendors.has(fallbackVendor)) {
        throw new ModelRegistryValidationError(
          `Model "${entry.id}" references unconfigured fallback vendor "${fallbackVendor}".`,
        );
      }
    }
  }

  return availableEntries;
}
