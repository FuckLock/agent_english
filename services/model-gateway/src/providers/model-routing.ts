import type { ModelOption, ServiceTier } from "@agent-english/contracts";

import { createModelCatalog } from "../catalog/model-catalog";
import {
  MODEL_REGISTRY,
  validateModelRegistry,
  type ModelRegistryEntry,
} from "../catalog/model-registry";
import type { GatewayEnv, ProviderID } from "../env";
import { isTierAvailable } from "../quota/service-tier";

export interface ResolvedModelRouting {
  ok: true;
  /** 脱敏投影（给 response.model；不含路由字段）。 */
  option: ModelOption;
  /** 路由 provider 链 = 主 vendor + fallbackVendors（读自 registry 条目，仅后端）。 */
  providers: ProviderID[];
  /** 真实模型名（透传给 transport 的请求体 model 字段，仅后端）。 */
  realModelName: string;
}

export interface ModelRoutingFailure {
  ok: false;
  errorCode: "tier-unavailable";
  requiredTier: ServiceTier;
}

/**
 * 由 registry 驱动选模型 + 组装路由（ADR-0006 决策 3 + ADR-0003 服务端重校验）：
 * - 命中 preferredModelId：若其 minTier 超账号档位 → tier-unavailable（永不信任客户端自报档位）。
 * - 未命中（未知 / 旧 id）：回退该档默认模型（isDefaultForTier）。
 * - 路由字段（vendor / realModelName / fallbackVendors）只从 registry 取、绝不进 response。
 */
export function resolveModelRouting(
  serviceTier: ServiceTier,
  preferredModelId: string | undefined,
  env: GatewayEnv,
): ResolvedModelRouting | ModelRoutingFailure {
  const configuredVendors = configuredVendorSet(env);
  const availableEntries = validateModelRegistry(MODEL_REGISTRY, {
    configuredVendors,
  });

  const requested = preferredModelId
    ? availableEntries.find((entry) => entry.id === preferredModelId)
    : undefined;

  // 命中且超档 → 服务端重校验拒绝（不回退、不路由）。
  if (requested && !isTierAvailable(serviceTier, requested.minTier)) {
    return {
      ok: false,
      errorCode: "tier-unavailable",
      requiredTier: requested.minTier,
    };
  }

  // 命中可用模型 → 用它；否则回退该档默认（旧 / 未知 id 兜底）。
  const entry =
    requested
    ?? defaultEntryForTier(availableEntries, serviceTier)
    ?? availableEntries[0];

  const catalog = createModelCatalog(serviceTier, { configuredVendors });
  const option =
    catalog.options.find((candidate) => candidate.id === entry.id)
    ?? catalog.options.find((candidate) => candidate.id === catalog.defaultModelId)
    ?? catalog.options[0];

  return {
    ok: true,
    option,
    providers: providerChainForEntry(entry),
    realModelName: entry.realModelName,
  };
}

function defaultEntryForTier(
  entries: readonly ModelRegistryEntry[],
  serviceTier: ServiceTier,
): ModelRegistryEntry | undefined {
  return (
    entries.find(
      (entry) =>
        entry.minTier === serviceTier
        && entry.isDefaultForTier
        && isTierAvailable(serviceTier, entry.minTier),
    )
    ?? entries.find((entry) => isTierAvailable(serviceTier, entry.minTier))
  );
}

function providerChainForEntry(entry: ModelRegistryEntry): ProviderID[] {
  const chain: ProviderID[] = [entry.vendor];
  for (const fallbackVendor of entry.fallbackVendors ?? []) {
    if (!chain.includes(fallbackVendor)) {
      chain.push(fallbackVendor);
    }
  }
  return chain;
}

function configuredVendorSet(env: GatewayEnv): Set<ProviderID> {
  const vendors = new Set<ProviderID>();
  for (const providerID of Object.keys(env.providers) as ProviderID[]) {
    if (env.providers[providerID]) {
      vendors.add(providerID);
    }
  }
  return vendors;
}
