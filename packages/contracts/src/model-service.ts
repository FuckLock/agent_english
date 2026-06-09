export const SERVICE_TIERS = [
  "free",
  "pro",
  "max",
] as const;

export type ServiceTier = (typeof SERVICE_TIERS)[number];

export const MODEL_AVAILABILITY_STATES = [
  "available",
  "requiresTier",
  "locked",
] as const;

export type ModelAvailabilityState =
  (typeof MODEL_AVAILABILITY_STATES)[number];

export const MODEL_SERVICE_ERROR_CODES = [
  "quota-exceeded",
  "tier-unavailable",
  "service-unavailable",
  "content-too-long",
  "provider-fallback-failed",
  "privacy-disclosure-required",
] as const;

export type ModelServiceErrorCode =
  (typeof MODEL_SERVICE_ERROR_CODES)[number];

export interface ModelQuotaState {
  status: "ok" | "limited" | "exhausted";
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface ModelOption {
  id: string;
  minTier: ServiceTier;
  displayName: string;
  summary: string;
  capabilities: string[];
  availability: ModelAvailabilityState;
  requiredTier?: ServiceTier;
  quota: ModelQuotaState;
}

export interface ModelCatalog {
  currentTier: ServiceTier;
  availableTiers: ServiceTier[];
  defaultModelId: string;
  options: ModelOption[];
  quota: ModelQuotaState;
  audioQuota: ModelQuotaState;
  lastUpdatedAt: string;
}

export interface ModelPreference {
  serviceTier: ServiceTier;
  preferredModelId: string;
  targetLanguage: string;
}

export interface ModelServiceError {
  code: ModelServiceErrorCode;
  message: string;
  retryable: boolean;
  requiredTier?: ServiceTier;
}

export interface TranslateSegment {
  segmentId: string;
  sourceText: string;
}

export interface TranslateRequest {
  pageId: string;
  sourceLanguage: string;
  targetLanguage: string;
  serviceTier: ServiceTier;
  preferredModelId?: string;
  segments: TranslateSegment[];
}

export interface TranslateSegmentResult {
  segmentId: string;
  translatedText?: string;
  errorCode?: ModelServiceErrorCode;
}

export interface TranslateResponse {
  pageId: string;
  serviceTier: ServiceTier;
  model: ModelOption;
  segmentResults: TranslateSegmentResult[];
  quota: ModelQuotaState;
  error?: ModelServiceError;
}

export interface ExplainRequest {
  pageId: string;
  sourceText: string;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  sourceLanguage: string;
  targetLanguage: string;
  serviceTier: ServiceTier;
  preferredModelId?: string;
}

export interface ExplainResponse {
  pageId: string;
  serviceTier: ServiceTier;
  model: ModelOption;
  translation: string;
  explanation: string;
  examples: string[];
  quota: ModelQuotaState;
  error?: ModelServiceError;
}
