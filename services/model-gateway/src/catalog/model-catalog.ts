import type {
  ModelCatalog,
  ModelOption,
  ServiceTier,
} from "@agent-english/contracts";
import { createAudioQuotaState } from "@agent-english/contracts";

import type { ProviderID } from "../env";
import {
  createQuotaState,
  isTierAvailable,
  requiredTierForModel,
} from "../quota/service-tier";
import {
  MODEL_REGISTRY,
  validateModelRegistry,
  type ModelRegistryEntry,
} from "./model-registry";

const ALL_VENDORS: readonly ProviderID[] = ["openai", "deepseek", "anthropic"];

export interface CreateModelCatalogOptions {
  /**
   * env 中实际配置了凭证的 vendor 集合；未配 vendor 的模型不进目录（缺凭证降级）。
   * 不传则默认全部 vendor 已配置（展示用途，回归现有「该档全部模型可见」行为）。
   */
  configuredVendors?: ReadonlySet<ProviderID>;
}

/**
 * 由后端模型清单 registry 驱动生成「档位 → 脱敏目录投影」（ADR-0006 决策 1/6）。
 *
 * - 按 minTier 累加：返回 `minTier ≤ currentTier` 的全部模型（D1 高档累加低档便宜模型）。
 * - 投影输出 `minTier`（ADR-0006 决策 5 干净切：`tier→minTier` 已完成，无旧字段、无双轨）。
 * - 投影**绝不含**任何后端内部路由字段（ADR-0002 密钥边界）。
 * - 门控不再从此处产出——能力门控迁档位（见 entitlements/），此处 capabilities 仅作描述性展示。
 */
export function createModelCatalog(
  currentTier: ServiceTier,
  options: CreateModelCatalogOptions = {},
): ModelCatalog {
  const configuredVendors =
    options.configuredVendors ?? new Set<ProviderID>(ALL_VENDORS);
  const availableEntries = validateModelRegistry(MODEL_REGISTRY, {
    configuredVendors,
  });

  const quota = createQuotaState(currentTier, 0);
  const optionsList = availableEntries
    .filter((entry) => isTierAvailable(currentTier, entry.minTier))
    .map((entry) => toModelOption(entry, currentTier));

  const defaultModelId =
    availableEntries.find(
      (entry) => entry.minTier === currentTier && entry.isDefaultForTier,
    )?.id
    ?? optionsList[0]?.id
    ?? availableEntries[0]?.id;

  return {
    currentTier,
    availableTiers: ["free", "pro", "max"],
    defaultModelId,
    options: optionsList,
    quota,
    audioQuota: createAudioQuotaState(currentTier, 0),
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * registry 条目 → 脱敏 ModelOption 投影。
 * 只取展示字段（id / displayName / summary / minTier / capabilities）+ 档位派生的可用性 / 配额，
 * 后端内部路由字段一律不进投影。
 */
function toModelOption(
  entry: ModelRegistryEntry,
  currentTier: ServiceTier,
): ModelOption {
  const requiredTier = requiredTierForModel(entry.minTier, currentTier);
  const display = displayMetadata(entry);

  return {
    id: entry.id,
    minTier: entry.minTier,
    displayName: display.displayName,
    summary: display.summary,
    capabilities: capabilitiesForTier(entry.minTier),
    availability: isTierAvailable(currentTier, entry.minTier)
      ? "available"
      : requiredTier === entry.minTier
        ? "requiresTier"
        : "locked",
    requiredTier,
    quota: createQuotaState(entry.minTier, 0),
  };
}

const TIER_LABEL: Record<ServiceTier, string> = {
  free: "Free 服务",
  pro: "Pro 模型",
  max: "Max 模型",
};

const TIER_SUMMARY: Record<ServiceTier, string> = {
  free: "适合通用网页翻译、快速释义和每日 10 分钟听音 Beta。",
  pro: "适合整段语境解释和更稳定的长句处理。",
  max: "适合复杂句深挖、例句扩展和学习建议。",
};

function displayMetadata(entry: ModelRegistryEntry): {
  displayName: string;
  summary: string;
} {
  return {
    displayName: `${TIER_LABEL[entry.minTier]} · ${entry.id}`,
    summary: TIER_SUMMARY[entry.minTier],
  };
}

/**
 * 描述性能力按档位累加（D2：能力随档位解锁，与选哪个模型无关）。
 * 本 Phase 仍挂在 ModelOption.capabilities 上作展示；门控判定由档位层（entitlements/）负责。
 */
function capabilitiesForTier(minTier: ServiceTier): string[] {
  const free = ["translation", "glossary", "audio", "asr"];
  const pro = [...free, "explanation", "examples"];
  const max = [...pro, "review"];
  switch (minTier) {
    case "free":
      return free;
    case "pro":
      return pro;
    case "max":
      return max;
  }
}
