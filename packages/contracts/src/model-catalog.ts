import type { ModelQuotaState, ServiceTier } from "./model-service";

export const AUDIO_TRANSLATION_QUOTA_LIMITS: Record<ServiceTier, number> = {
  free: 10,
  pro: 60,
  max: 180,
};

export const AUDIO_TRANSLATION_CAPABILITIES = [
  "audio",
  "asr",
  "translation",
] as const;

export type AudioTranslationCapability =
  (typeof AUDIO_TRANSLATION_CAPABILITIES)[number];

export function audioQuotaLimitForTier(tier: ServiceTier): number {
  return AUDIO_TRANSLATION_QUOTA_LIMITS[tier];
}

export function createAudioQuotaState(
  tier: ServiceTier,
  usedMinutes: number,
  resetAt = nextAudioQuotaResetAt(),
): ModelQuotaState {
  const limit = audioQuotaLimitForTier(tier);
  const used = Math.max(0, Math.ceil(usedMinutes));
  const remaining = Math.max(0, limit - used);

  return {
    status: remaining === 0 ? "exhausted" : remaining <= 2 ? "limited" : "ok",
    used,
    limit,
    remaining,
    resetAt,
  };
}

function nextAudioQuotaResetAt(): string {
  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0);
  return resetAt.toISOString();
}
