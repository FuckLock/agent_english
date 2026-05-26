import type { ServiceTier } from "@agent-english/contracts";
import { audioQuotaLimitForTier } from "@agent-english/contracts";

export interface AudioMinuteQuotaState {
  serviceTier: ServiceTier;
  status: "ok" | "limited" | "exhausted";
  usedMinutes: number;
  limitMinutes: number;
  remainingMinutes: number;
  resetAt: string;
}

export interface AudioMinuteQuotaDecision {
  quota: AudioMinuteQuotaState;
  allowed: boolean;
  requestedMinutes: number;
}

const AUDIO_ABUSE_PROTECTION_MAX_SEGMENT_SECONDS = 90;

export function createAudioMinuteQuota(
  serviceTier: ServiceTier,
  usedMinutes: number,
  resetAt = nextResetAt(),
): AudioMinuteQuotaState {
  const limitMinutes = audioQuotaLimitForTier(serviceTier);
  const normalizedUsed = Math.max(0, Math.ceil(usedMinutes));
  const remainingMinutes = Math.max(0, limitMinutes - normalizedUsed);

  return {
    serviceTier,
    status:
      remainingMinutes === 0
        ? "exhausted"
        : remainingMinutes <= 2
          ? "limited"
          : "ok",
    usedMinutes: normalizedUsed,
    limitMinutes,
    remainingMinutes,
    resetAt,
  };
}

export function evaluateAudioMinuteQuota(
  serviceTier: ServiceTier,
  usedMinutes: number,
  requestedSeconds: number,
): AudioMinuteQuotaDecision {
  const requestedMinutes = requestedAudioMinutes(requestedSeconds);
  const quota = createAudioMinuteQuota(serviceTier, usedMinutes + requestedMinutes);

  return {
    quota,
    allowed:
      requestedSeconds > 0
      && requestedSeconds <= AUDIO_ABUSE_PROTECTION_MAX_SEGMENT_SECONDS
      && quota.usedMinutes <= quota.limitMinutes,
    requestedMinutes,
  };
}

export function requestedAudioMinutes(requestedSeconds: number): number {
  return Math.max(1, Math.ceil(Math.max(0, requestedSeconds) / 60));
}

export function audioQuotaLimitExceedsFree(serviceTier: ServiceTier): boolean {
  return audioQuotaLimitForTier(serviceTier) > 10;
}

function nextResetAt(): string {
  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0);
  return resetAt.toISOString();
}
