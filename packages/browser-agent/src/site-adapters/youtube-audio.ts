import {
  type SiteCapability,
  type VideoAudioTranslationState,
  createVideoAudioSegmentId,
} from "@agent-english/contracts";
import { detectYouTubePage } from "./youtube";

export interface YouTubeAudioTranslationDecisionInput {
  captionText?: string;
  captionQuality?: "available" | "low" | "unavailable";
  manualAudioSelection?: boolean;
}

export interface YouTubeAudioTranslationDecision {
  source: "caption" | "audio";
  audioBetaAvailable: boolean;
  reason:
    | "caption-primary"
    | "caption-quality-low"
    | "caption-unavailable"
    | "manual-audio-selection";
}

export function decideYouTubeAudioTranslationSource(
  input: YouTubeAudioTranslationDecisionInput,
): YouTubeAudioTranslationDecision {
  const captionText = normalizeCaptionText(input.captionText ?? "");
  if (input.manualAudioSelection) {
    return {
      source: "audio",
      audioBetaAvailable: true,
      reason: "manual-audio-selection",
    };
  }

  if (!captionText || input.captionQuality === "unavailable") {
    return {
      source: "audio",
      audioBetaAvailable: true,
      reason: "caption-unavailable",
    };
  }

  if (input.captionQuality === "low") {
    return {
      source: "audio",
      audioBetaAvailable: true,
      reason: "caption-quality-low",
    };
  }

  return {
    source: "caption",
    audioBetaAvailable: false,
    reason: "caption-primary",
  };
}

export function createYouTubeAudioTranslationState(options: {
  pageId: string;
  url: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  captionText?: string;
  captionQuality?: "available" | "low" | "unavailable";
  manualAudioSelection?: boolean;
  now?: () => Date;
}): VideoAudioTranslationState | null {
  const detection = detectYouTubePage(options.url);
  if (!detection.isVideoPage || !detection.pageKind) {
    return null;
  }

  const updatedAt = (options.now ?? (() => new Date()))().toISOString();
  const decision = decideYouTubeAudioTranslationSource(options);
  const captionAvailability =
    options.captionQuality === "available" || decision.source === "caption"
      ? "available"
      : options.captionQuality === "low"
        ? "available"
        : "unavailable";
  const capabilities: SiteCapability[] =
    decision.source === "audio"
      ? [
          captionAvailability === "available"
            ? "captions-available"
            : "captions-unavailable",
          "audio-translation-beta",
          "video-audio-translation",
          "selection-fallback",
        ]
      : [
          "captions-available",
          "video-caption-overlay",
          "audio-translation-beta",
          "selection-fallback",
        ];

  return {
    pageId: options.pageId,
    siteKind: "youtube",
    pageKind: detection.pageKind,
    url: options.url,
    title: options.title,
    videoId: detection.videoId,
    captionAvailability,
    source: decision.source,
    overlayMode: decision.source === "audio" ? "inline-overlay" : "hidden",
    status: decision.source === "audio" ? "privacy-required" : "caption-primary",
    capabilities,
    activeSegment:
      decision.source === "audio"
        ? {
            pageId: options.pageId,
            audioSegmentId: createVideoAudioSegmentId(options.pageId, updatedAt),
            videoId: detection.videoId,
            source: "audio",
            sourceText: "",
            sourceLanguage: options.sourceLanguage,
            targetLanguage: options.targetLanguage,
            capturedAt: updatedAt,
          }
        : undefined,
    failureReason: decision.source === "caption" ? "caption-primary" : undefined,
    message:
      decision.source === "audio"
        ? "听音翻译 Beta 会在你确认后识别当前视频音频。"
        : "字幕可用，优先使用字幕翻译。",
    updatedAt,
  };
}

function normalizeCaptionText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
