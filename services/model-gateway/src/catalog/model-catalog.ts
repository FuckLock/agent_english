import type {
  ModelCatalog,
  ModelOption,
  ServiceTier,
} from "@agent-english/contracts";

import {
  createQuotaState,
  isTierAvailable,
  requiredTierForModel,
} from "../quota/service-tier";
import { createAudioQuotaState } from "@agent-english/contracts";

export function createModelCatalog(currentTier: ServiceTier): ModelCatalog {
  const quota = createQuotaState(currentTier, 0);
  const options = BASE_OPTIONS.map((option) => {
    const requiredTier = requiredTierForModel(option.tier, currentTier);
    return {
      ...option,
      availability: isTierAvailable(currentTier, option.tier)
        ? "available"
        : requiredTier === option.tier
          ? "requiresTier"
          : "locked",
      requiredTier,
      quota: createQuotaState(option.tier, 0),
    } satisfies ModelOption;
  });

  const defaultModelId =
    options.find((option) => option.tier === currentTier)?.id ?? options[0].id;

  return {
    currentTier,
    availableTiers: ["free", "pro", "max"],
    defaultModelId,
    options,
    quota,
    audioQuota: createAudioQuotaState(currentTier, 0),
    lastUpdatedAt: new Date().toISOString(),
  };
}

const BASE_OPTIONS: Array<
  Omit<ModelOption, "availability" | "requiredTier" | "quota">
> = [
  {
    id: "free-translate",
    tier: "free",
    displayName: "Free 服务 · 轻量翻译",
    summary: "适合通用网页翻译、快速释义和每日 10 分钟听音 Beta。",
    capabilities: ["translation", "glossary", "audio", "asr"],
  },
  {
    id: "pro-context",
    tier: "pro",
    displayName: "Pro 模型 · 语境精读",
    summary: "适合整段语境解释和更稳定的长句处理。",
    capabilities: ["translation", "explanation", "examples", "audio", "asr"],
  },
  {
    id: "max-mentor",
    tier: "max",
    displayName: "Max 模型 · 深度讲解",
    summary: "适合复杂句深挖、例句扩展和学习建议。",
    capabilities: ["translation", "explanation", "examples", "review", "audio", "asr"],
  },
];
