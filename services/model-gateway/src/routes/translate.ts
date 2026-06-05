import type {
  ModelOption,
  ModelServiceError,
  ServiceTier,
  TranslateRequest,
  TranslateResponse,
} from "@agent-english/contracts";

import { createModelCatalog } from "../catalog/model-catalog";
import { createQuotaState } from "../quota/service-tier";
import type { ServiceEntitlement } from "../entitlements/entitlement-service";
import {
  routeTranslation,
  type ProviderRouterDependencies,
} from "../providers/provider-router";

export interface TranslateRouteResponse {
  statusCode: number;
  body: TranslateResponse;
}

export async function handleTranslateRoute(
  request: TranslateRequest,
  usedQuota = 0,
  dependencies?: ProviderRouterDependencies & { entitlement?: ServiceEntitlement },
): Promise<TranslateRouteResponse> {
  void dependencies?.entitlement;
  const routed = await routeTranslation(request, usedQuota, dependencies);

  if (!routed.ok) {
    return {
      statusCode: statusCodeForError(routed.errorCode),
      body: {
        pageId: request.pageId,
        serviceTier: request.serviceTier,
        model: fallbackModelOption(
          request.serviceTier,
          request.preferredModelId,
          usedQuota,
        ),
        segmentResults: request.segments.map((segment) => ({
          segmentId: segment.segmentId,
          errorCode: routed.errorCode,
        })),
        quota: createQuotaState(request.serviceTier, usedQuota),
        error: toErrorPayload(
          routed.errorCode,
          routed.message,
          routed.requiredTier,
        ),
      },
    };
  }

  return {
    statusCode: 200,
    body: routed.response,
  };
}

/**
 * 错误兜底时的占位 model：未命中 preferredModelId 则回退该档默认模型
 * （catalog.defaultModelId → isDefaultForTier），不再写死旧字面量 id。
 */
function fallbackModelOption(
  serviceTier: ServiceTier,
  preferredModelId: string | undefined,
  usedQuota: number,
): ModelOption {
  const catalog = createModelCatalog(serviceTier);
  const option =
    catalog.options.find((candidate) => candidate.id === preferredModelId)
    ?? catalog.options.find((candidate) => candidate.id === catalog.defaultModelId)
    ?? catalog.options[0];
  return {
    ...option,
    quota: createQuotaState(serviceTier, usedQuota),
  };
}

function statusCodeForError(errorCode: ModelServiceError["code"]): number {
  switch (errorCode) {
    case "quota-exceeded":
      return 429;
    case "tier-unavailable":
      return 403;
    case "content-too-long":
      return 413;
    case "service-unavailable":
    case "provider-fallback-failed":
      return 503;
    case "privacy-disclosure-required":
      return 400;
  }
}

function toErrorPayload(
  code: ModelServiceError["code"],
  message: string,
  requiredTier?: ModelServiceError["requiredTier"],
): ModelServiceError {
  return {
    code,
    message,
    retryable:
      code === "service-unavailable"
      || code === "provider-fallback-failed",
    requiredTier,
  };
}
