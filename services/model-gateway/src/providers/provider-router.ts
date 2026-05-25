import type {
  ExplainRequest,
  ExplainResponse,
  ModelServiceErrorCode,
  ServiceTier,
  TranslateRequest,
  TranslateResponse,
} from "@agent-english/contracts";

import type { GatewayEnv, ProviderID } from "../env";
import { loadGatewayEnv } from "../env";
import {
  buildExplainMessages,
  buildTranslateMessages,
  ChatCompletionsTransportError,
  FetchChatCompletionsTransport,
  parseExplainResponse,
  parseTranslateResponse,
  type ChatCompletionsTransport,
} from "./chat-completions";
import { createModelCatalog } from "../catalog/model-catalog";
import { consumeQuota, isTierAvailable } from "../quota/service-tier";

export interface ProviderRouterDependencies {
  env?: GatewayEnv;
  transport?: ChatCompletionsTransport;
}

export interface RoutedServiceSuccess<TResponse> {
  ok: true;
  response: TResponse;
}

export interface RoutedServiceFailure {
  ok: false;
  errorCode: ModelServiceErrorCode;
  message: string;
  requiredTier?: ServiceTier;
}

export type RoutedServiceResult<TResponse> =
  | RoutedServiceSuccess<TResponse>
  | RoutedServiceFailure;

export async function routeTranslation(
  request: TranslateRequest,
  usedQuota: number,
  dependencies?: ProviderRouterDependencies,
): Promise<RoutedServiceResult<TranslateResponse>> {
  if (request.segments.length === 0) {
    return failure("service-unavailable", "Model service is unavailable right now.");
  }

  const totalLength = request.segments.reduce(
    (sum, segment) => sum + segment.sourceText.length,
    0,
  );
  if (totalLength > 1800) {
    return failure("content-too-long", "Content is too long to translate.");
  }

  const catalog = createModelCatalog(request.serviceTier);
  const selectedModel =
    catalog.options.find((option) => option.id === request.preferredModelId)
    ?? catalog.options.find((option) => option.id === catalog.defaultModelId)
    ?? catalog.options[0];

  if (!isTierAvailable(request.serviceTier, selectedModel.tier)) {
    return failure(
      "tier-unavailable",
      "Current tier cannot use this model.",
      selectedModel.tier,
    );
  }

  const quota = consumeQuota(
    request.serviceTier,
    usedQuota,
    request.segments.length,
  );
  if (quota.used > quota.limit) {
    return failure("quota-exceeded", "Quota has been exhausted for this tier.");
  }

  const router = createProviderRouter(dependencies);
  const routed = await routeProvider(
    providersForModel(selectedModel.id),
    router,
    async (providerID) => {
      const content = await router.transport.complete({
        provider: router.provider(providerID),
        messages: buildTranslateMessages(request),
        temperature: 0.2,
      });
      return {
        providerID,
        translations: parseTranslateResponse(content),
      };
    },
  );

  if (!routed.ok) {
    return routed;
  }

  const translatedTextBySegmentID = Object.fromEntries(
    routed.translations.map((item) => [item.segmentId, item.translatedText]),
  );

  return {
    ok: true,
    response: {
      pageId: request.pageId,
      serviceTier: request.serviceTier,
      model: selectedModel,
      segmentResults: request.segments.map((segment) => ({
        segmentId: segment.segmentId,
        translatedText: translatedTextBySegmentID[segment.segmentId],
      })),
      quota,
    },
  };
}

export async function routeExplanation(
  request: ExplainRequest,
  usedQuota: number,
  dependencies?: ProviderRouterDependencies,
): Promise<RoutedServiceResult<ExplainResponse>> {
  if (request.sourceText.length > 1000) {
    return failure("content-too-long", "Content is too long to explain.");
  }

  const catalog = createModelCatalog(request.serviceTier);
  const selectedModel =
    catalog.options.find((option) => option.id === request.preferredModelId)
    ?? catalog.options.find((option) => option.id === catalog.defaultModelId)
    ?? catalog.options[0];

  if (!isTierAvailable(request.serviceTier, selectedModel.tier)) {
    return failure(
      "tier-unavailable",
      "Current tier cannot use this model.",
      selectedModel.tier,
    );
  }

  const quota = consumeQuota(request.serviceTier, usedQuota, 1);
  if (quota.used > quota.limit) {
    return failure("quota-exceeded", "Quota has been exhausted for this tier.");
  }

  const router = createProviderRouter(dependencies);
  const routed = await routeProvider(
    providersForModel(selectedModel.id),
    router,
    async (providerID) => {
      const content = await router.transport.complete({
        provider: router.provider(providerID),
        messages: buildExplainMessages(request),
        temperature: 0.2,
      });
      return {
        providerID,
        explanation: parseExplainResponse(content),
      };
    },
  );

  if (!routed.ok) {
    return routed;
  }

  return {
    ok: true,
    response: {
      pageId: request.pageId,
      serviceTier: request.serviceTier,
      model: selectedModel,
      translation: routed.explanation.translation,
      explanation: routed.explanation.explanation,
      examples: routed.explanation.examples,
      quota,
    },
  };
}

export function createProviderRouter(
  dependencies: ProviderRouterDependencies = {},
): {
  env: GatewayEnv;
  transport: ChatCompletionsTransport;
  provider: (providerID: ProviderID) => NonNullable<GatewayEnv["providers"][ProviderID]>;
} {
  const env = dependencies.env ?? loadGatewayEnv();
  const transport = dependencies.transport ?? new FetchChatCompletionsTransport();

  return {
    env,
    transport,
    provider(providerID) {
      const provider = env.providers[providerID];
      if (!provider) {
        throw new ChatCompletionsTransportError(
          "not-configured",
          "Provider config is missing.",
        );
      }
      return provider;
    },
  };
}

async function routeProvider<TSuccess>(
  providers: ProviderID[],
  router: ReturnType<typeof createProviderRouter>,
  invoke: (providerID: ProviderID) => Promise<TSuccess>,
): Promise<({ ok: true } & TSuccess) | RoutedServiceFailure> {
  let sawConfiguredProvider = false;

  for (const providerID of providers) {
    const providerConfig = router.env.providers[providerID];
    if (!providerConfig) {
      continue;
    }
    sawConfiguredProvider = true;

    try {
      return {
        ok: true,
        ...(await invoke(providerID)),
      };
    } catch (error) {
      const normalized = normalizeProviderFailure(error);
      if (normalized === "service-unavailable") {
        continue;
      }
      return failure(normalized, "Model service is unavailable right now.");
    }
  }

  return failure(
    sawConfiguredProvider
      ? "provider-fallback-failed"
      : "service-unavailable",
    "Model service is unavailable right now.",
  );
}

function providersForModel(modelID: string): ProviderID[] {
  switch (modelID) {
    case "max-mentor":
      return ["anthropic", "openai"];
    case "pro-context":
      return ["openai", "deepseek"];
    case "free-translate":
    default:
      return ["deepseek", "openai"];
  }
}

function normalizeProviderFailure(error: unknown): ModelServiceErrorCode {
  if (error instanceof ChatCompletionsTransportError) {
    switch (error.kind) {
      case "not-configured":
      case "network":
      case "http":
        return "service-unavailable";
      case "invalid-response":
        return "provider-fallback-failed";
    }
  }

  return "provider-fallback-failed";
}

function failure(
  errorCode: ModelServiceErrorCode,
  message: string,
  requiredTier?: ServiceTier,
): RoutedServiceFailure {
  return {
    ok: false,
    errorCode,
    message,
    requiredTier,
  };
}
