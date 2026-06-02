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
  ASRProviderError,
  mapASRFallbackError,
  WhisperASRProvider,
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
import {
  resolveYouTubeAudioStream,
  type ResolvedAudioStream,
  type YouTubeAudioStreamDependencies,
} from "../providers/youtube-audio-stream";
import {
  fetchAndTranscodeSegment,
  type AudioSegmentFetcherDependencies,
  type FetchedAudioSegment,
} from "../providers/audio-segment-fetcher";

export interface VideoAudioRouteResponse {
  statusCode: number;
  body: VideoAudioTranslateResponse | { error: ModelServiceError };
}

/** 取流注入点（默认走真实 InnerTube 取流，测试可 stub）。 */
export type ResolveAudioStreamFn = (
  videoId: string,
  dependencies?: YouTubeAudioStreamDependencies,
) => Promise<ResolvedAudioStream>;

/** 拉片段 + 转码注入点（默认走真实 Range + ffmpeg，测试可 stub）。 */
export type FetchAudioSegmentFn = (
  source: ResolvedAudioStream,
  playbackPositionSeconds: number,
  dependencies?: AudioSegmentFetcherDependencies,
) => Promise<FetchedAudioSegment>;

export interface VideoAudioRouteDependencies extends ProviderRouterDependencies {
  entitlement?: ServiceEntitlement;
  asrProvider?: ASRProvider;
  resolveAudioStream?: ResolveAudioStreamFn;
  fetchAudioSegment?: FetchAudioSegmentFn;
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

  // Phase 8.12：ASR 输入改为后端自取音频流——
  // 取流（F1）→ 按播放进度 Range 拉片段 + ffmpeg 转 16kHz wav（F2）→ Whisper 识别英文（F3）。
  const resolveAudioStream =
    dependencies.resolveAudioStream ?? resolveYouTubeAudioStream;
  const fetchAudioSegment =
    dependencies.fetchAudioSegment ?? fetchAndTranscodeSegment;
  const asrProvider = dependencies.asrProvider ?? new WhisperASRProvider();

  let transcript;
  try {
    if (!effectiveRequest.videoId) {
      throw new ASRProviderError(
        "service-unavailable",
        "Listening translation requires a videoId to fetch the audio stream.",
      );
    }

    const stream = await resolveAudioStream(effectiveRequest.videoId);
    const segment = await fetchAudioSegment(
      stream,
      effectiveRequest.playbackPositionSeconds ?? 0,
    );
    transcript = await asrProvider.recognize(effectiveRequest, {
      wav: segment.wav,
      segmentStartSeconds: segment.segmentStartSeconds,
    });
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
