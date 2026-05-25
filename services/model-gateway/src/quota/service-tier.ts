import type { ModelQuotaState, ServiceTier } from "@agent-english/contracts";

const TIER_LIMITS: Record<
  ServiceTier,
  { tierLabel: "Free" | "Pro" | "Max"; quota: number; rateLimit: number }
> = {
  free: {
    tierLabel: "Free",
    quota: 20,
    rateLimit: 6,
  },
  pro: {
    tierLabel: "Pro",
    quota: 200,
    rateLimit: 24,
  },
  max: {
    tierLabel: "Max",
    quota: 800,
    rateLimit: 60,
  },
};

export function createQuotaState(
  tier: ServiceTier,
  used: number,
): ModelQuotaState {
  const { quota } = TIER_LIMITS[tier];
  const remaining = Math.max(0, quota - used);

  return {
    status: remaining === 0 ? "exhausted" : remaining <= 3 ? "limited" : "ok",
    used,
    limit: quota,
    remaining,
    resetAt: nextResetAt(),
  };
}

export function consumeQuota(
  tier: ServiceTier,
  currentUsed: number,
  requestedUnits: number,
): ModelQuotaState {
  return createQuotaState(tier, currentUsed + requestedUnits);
}

export function isTierAvailable(
  currentTier: ServiceTier,
  modelTier: ServiceTier,
): boolean {
  return tierRank(currentTier) >= tierRank(modelTier);
}

export function requiredTierForModel(
  modelTier: ServiceTier,
  currentTier: ServiceTier,
): ServiceTier | undefined {
  if (isTierAvailable(currentTier, modelTier)) {
    return undefined;
  }

  return modelTier;
}

export function getTierRateLimit(tier: ServiceTier): number {
  return TIER_LIMITS[tier].rateLimit;
}

export function quotaLimitForTier(tier: ServiceTier): number {
  return TIER_LIMITS[tier].quota;
}

function tierRank(tier: ServiceTier): number {
  switch (tier) {
    case "free":
      return 0;
    case "pro":
      return 1;
    case "max":
      return 2;
  }
}

function nextResetAt(): string {
  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0);
  return resetAt.toISOString();
}
