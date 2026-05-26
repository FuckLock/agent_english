import type {
  ExplainRequest,
  ExplainResponse,
  ModelServiceError,
} from "@agent-english/contracts";

import { createQuotaState } from "../quota/service-tier";
import type { ServiceEntitlement } from "../entitlements/entitlement-service";
import {
  routeExplanation,
  type ProviderRouterDependencies,
} from "../providers/provider-router";

export interface ExplainRouteResponse {
  statusCode: number;
  body: ExplainResponse;
}

export async function handleExplainRoute(
  request: ExplainRequest,
  usedQuota = 0,
  dependencies?: ProviderRouterDependencies & { entitlement?: ServiceEntitlement },
): Promise<ExplainRouteResponse> {
  void dependencies?.entitlement;
  const routed = await routeExplanation(request, usedQuota, dependencies);

  if (!routed.ok) {
    return {
      statusCode: statusCodeForError(routed.errorCode),
      body: {
        pageId: request.pageId,
        serviceTier: request.serviceTier,
        model: {
          id: request.preferredModelId ?? "free-translate",
          tier: request.serviceTier,
          displayName: "模型服务暂不可用",
          summary: "当前请求未命中可用模型。",
          capabilities: ["explanation"],
          availability: "available",
          quota: createQuotaState(request.serviceTier, usedQuota),
        },
        translation: "",
        explanation: "",
        examples: [],
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
