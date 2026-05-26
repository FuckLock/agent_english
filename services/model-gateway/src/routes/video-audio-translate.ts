import type {
  ModelOption,
  ModelServiceError,
  VideoAudioTranslateRequest,
  VideoAudioTranslateResponse,
  VideoAudioTranslationState,
} from "@agent-english/contracts";
import { createModelCatalog } from "../catalog/model-catalog";
import type { ServiceEntitlement } from "../entitlements/entitlement-service";
import {
  mapASRFallbackError,
  UnavailableASRProvider,
  type ASRProvider,
} from "../providers/asr-provider";
import {
  routeTranslation,
  type ProviderRouterDependencies,
} from "../providers/provider-router";
import {
  createAudioMinuteQuota,
  evaluateAudioMinuteQuota,
} from "../quota/audio-minute-quota";

export interface VideoAudioRouteResponse {
  statusCode: number;
  body: VideoAudioTranslateResponse | { error: ModelServiceError };
}

export interface VideoAudioRouteDependencies extends ProviderRouterDependencies {
  entitlement?: ServiceEntitlement;
  asrProvider?: ASRProvider;
}

export async function handleVideoAudioTranslateRoute(
  request: VideoAudioTranslateRequest,
  usedAudioMinutes = 0,
  dependencies: VideoAudioRouteDependencies = {},
): Promise<VideoAudioRouteResponse> {
  const entitlement = dependencies.entitlement;
  if (!entitlement?.tokenPresent) {
    return errorOnly("service-unavailable", "Model service session is required.", 401);
  }

  const effectiveRequest = {
    ...request,
    serviceTier: entitlement.serviceTier,
  };

  if (!effectiveRequest.privacyDisclosureAccepted) {
    return failureResponse(
      effectiveRequest,
      usedAudioMinutes,
      "privacy-disclosure-required",
      "Please confirm the audio privacy disclosure before listening translation.",
      400,
      "privacy-required",
    );
  }

  if (
    effectiveRequest.captionText
    && effectiveRequest.captionQuality === "available"
    && !effectiveRequest.manualAudioSelection
  ) {
    return failureResponse(
      effectiveRequest,
      usedAudioMinutes,
      "service-unavailable",
      "Captions remain the primary translation source for this video.",
      409,
      "caption-primary",
      "caption-primary",
    );
  }

  const quotaDecision = evaluateAudioMinuteQuota(
    effectiveRequest.serviceTier,
    usedAudioMinutes,
    effectiveRequest.audioDurationSeconds,
  );
  if (!quotaDecision.allowed) {
    return failureResponse(
      effectiveRequest,
      usedAudioMinutes,
      "quota-exceeded",
      "Audio quota has been exhausted for this tier.",
      429,
      "quota-exhausted",
      "audio-quota-exceeded",
    );
  }

  const asrProvider = dependencies.asrProvider ?? new UnavailableASRProvider();
  let transcript;
  try {
    transcript = await asrProvider.recognize(effectiveRequest);
  } catch (error) {
    const mapped = mapASRFallbackError(error);
    return failureResponse(
      effectiveRequest,
      usedAudioMinutes,
      mapped.code,
      mapped.message,
      503,
      "failed",
      "asr-failed",
    );
  }

  const routed = await routeTranslation(
    {
      pageId: effectiveRequest.pageId,
      sourceLanguage: transcript.sourceLanguage,
      targetLanguage: effectiveRequest.targetLanguage,
      serviceTier: effectiveRequest.serviceTier,
      preferredModelId: effectiveRequest.preferredModelId,
      segments: [
        {
          segmentId: effectiveRequest.audioSegmentId,
          sourceText: transcript.transcript,
        },
      ],
    },
    0,
    dependencies,
  );

  if (!routed.ok) {
    return failureResponse(
      effectiveRequest,
      usedAudioMinutes,
      routed.errorCode,
      routed.message,
      statusCodeForError(routed.errorCode),
      "failed",
    );
  }

  const quota = quotaDecision.quota;
  const translatedText = routed.response.segmentResults[0]?.translatedText;
  const now = new Date().toISOString();
  const segment = {
    pageId: effectiveRequest.pageId,
    audioSegmentId: effectiveRequest.audioSegmentId,
    videoId: effectiveRequest.videoId,
    source: "audio" as const,
    sourceText: transcript.transcript,
    translatedText,
    sourceLanguage: transcript.sourceLanguage,
    targetLanguage: effectiveRequest.targetLanguage,
    startTimeSeconds: transcript.startTimeSeconds,
    endTimeSeconds: transcript.endTimeSeconds,
    capturedAt: now,
  };

  return {
    statusCode: 200,
    body: {
      pageId: effectiveRequest.pageId,
      serviceTier: effectiveRequest.serviceTier,
      model: routed.response.model,
      segment,
      quota,
      state: stateForRequest(effectiveRequest, {
        status: "translated",
        activeSegment: segment,
        quota,
        updatedAt: now,
      }),
    },
  };
}

function failureResponse(
  request: VideoAudioTranslateRequest,
  usedAudioMinutes: number,
  code: ModelServiceError["code"],
  message: string,
  statusCode: number,
  status: VideoAudioTranslationState["status"],
  failureReason?: VideoAudioTranslationState["failureReason"],
): VideoAudioRouteResponse {
  const quota = createAudioMinuteQuota(request.serviceTier, usedAudioMinutes);
  const error = errorPayload(code, message);

  return {
    statusCode,
    body: {
      pageId: request.pageId,
      serviceTier: request.serviceTier,
      model: fallbackModel(request),
      quota,
      state: stateForRequest(request, {
        status,
        quota,
        failureReason: failureReason ?? code,
        message,
        updatedAt: new Date().toISOString(),
      }),
      error,
    },
  };
}

function errorOnly(
  code: ModelServiceError["code"],
  message: string,
  statusCode: number,
): VideoAudioRouteResponse {
  return {
    statusCode,
    body: { error: errorPayload(code, message) },
  };
}

function stateForRequest(
  request: VideoAudioTranslateRequest,
  overrides: Partial<VideoAudioTranslationState>,
): VideoAudioTranslationState {
  return {
    pageId: request.pageId,
    siteKind: "youtube",
    pageKind: request.url.includes("/shorts/") ? "youtube-shorts" : "youtube-watch",
    url: request.url,
    title: request.title,
    videoId: request.videoId,
    captionAvailability:
      request.captionQuality === "available"
        ? "available"
        : request.captionQuality === "low"
          ? "available"
          : "unavailable",
    source: "audio",
    overlayMode: "inline-overlay",
    status: "recognizing",
    capabilities: [
      request.captionQuality === "available" ? "captions-available" : "captions-unavailable",
      "audio-translation-beta",
      "video-audio-translation",
      "selection-fallback",
    ],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function fallbackModel(request: VideoAudioTranslateRequest): ModelOption {
  const catalog = createModelCatalog(request.serviceTier);
  return (
    catalog.options.find((option) => option.id === request.preferredModelId)
    ?? catalog.options.find((option) => option.id === catalog.defaultModelId)
    ?? catalog.options[0]
  );
}

function errorPayload(
  code: ModelServiceError["code"],
  message: string,
): ModelServiceError {
  return {
    code,
    message,
    retryable:
      code === "service-unavailable"
      || code === "provider-fallback-failed",
  };
}

function statusCodeForError(code: ModelServiceError["code"]): number {
  switch (code) {
    case "quota-exceeded":
      return 429;
    case "tier-unavailable":
      return 403;
    case "content-too-long":
      return 413;
    case "privacy-disclosure-required":
      return 400;
    case "service-unavailable":
    case "provider-fallback-failed":
      return 503;
  }
}
