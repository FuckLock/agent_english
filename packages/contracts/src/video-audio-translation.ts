import type { ModelOption, ModelServiceError, ServiceTier } from "./model-service";
import type { SiteCapability } from "./site-capability";
import type {
  VideoCaptionAvailability,
  VideoCaptionOverlayMode,
  VideoCaptionPageKind,
} from "./video-caption";

export const VIDEO_AUDIO_TRANSLATION_SOURCES = [
  "caption",
  "audio",
] as const;

export type VideoAudioTranslationSource =
  (typeof VIDEO_AUDIO_TRANSLATION_SOURCES)[number];

export const VIDEO_AUDIO_TRANSLATION_STATUSES = [
  "idle",
  "privacy-required",
  "caption-primary",
  "recognizing",
  "translating",
  "translated",
  "quota-exhausted",
  "stopped",
  "closed",
  "failed",
] as const;

export type VideoAudioTranslationStatus =
  (typeof VIDEO_AUDIO_TRANSLATION_STATUSES)[number];

export const VIDEO_AUDIO_FAILURE_REASONS = [
  "caption-primary",
  "caption-quality-low",
  "caption-unavailable",
  "privacy-disclosure-required",
  "audio-quota-exceeded",
  "audio-unavailable",
  "asr-failed",
] as const;

export type VideoAudioFailureReason =
  | (typeof VIDEO_AUDIO_FAILURE_REASONS)[number]
  | ModelServiceError["code"];

export interface AudioTranslationQuota {
  serviceTier: ServiceTier;
  status: "ok" | "limited" | "exhausted";
  usedMinutes: number;
  limitMinutes: number;
  remainingMinutes: number;
  resetAt: string;
}

export interface VideoAudioSegment {
  pageId: string;
  audioSegmentId: string;
  videoId?: string;
  source: VideoAudioTranslationSource;
  sourceText: string;
  translatedText?: string;
  sourceLanguage: string;
  targetLanguage: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  capturedAt: string;
}

export interface VideoAudioTranslationState {
  pageId: string;
  siteKind: "youtube";
  pageKind: VideoCaptionPageKind;
  url: string;
  title: string;
  videoId?: string;
  captionAvailability: VideoCaptionAvailability;
  source: VideoAudioTranslationSource;
  overlayMode: VideoCaptionOverlayMode;
  status: VideoAudioTranslationStatus;
  capabilities: SiteCapability[];
  activeSegment?: VideoAudioSegment;
  quota?: AudioTranslationQuota;
  failureReason?: VideoAudioFailureReason;
  message?: string;
  updatedAt: string;
}

export interface VideoAudioTranslateRequest {
  pageId: string;
  url: string;
  title: string;
  /**
   * 听音路径的关键输入（Phase 8.12）：无字幕轨视频走后端听音时，后端按 videoId
   * 取 YouTube 音频流（InnerTube ANDROID client → adaptiveFormats）。可选性保留以兼容
   * 字幕主路径请求，但听音路径必须携带，否则后端无法取流（归一为听音不可用）。
   */
  videoId?: string;
  sourceLanguage: string;
  targetLanguage: string;
  serviceTier: ServiceTier;
  preferredModelId?: string;
  audioSegmentId: string;
  audioDurationSeconds: number;
  /**
   * 听音路径的当前播放进度（秒，Phase 8.12）：后端据此按 Range 拉取音频流当前片段、
   * 回填识别句的时间轴。app 只传进度，不在前端采集 / 上传任何音频数据载荷。
   */
  playbackPositionSeconds?: number;
  captionText?: string;
  captionQuality?: "available" | "low" | "unavailable";
  manualAudioSelection?: boolean;
  privacyDisclosureAccepted: boolean;
}

export interface VideoAudioTranslateResponse {
  pageId: string;
  serviceTier: ServiceTier;
  model: ModelOption;
  segment?: VideoAudioSegment;
  quota: AudioTranslationQuota;
  state: VideoAudioTranslationState;
  error?: ModelServiceError;
}

export function createVideoAudioSegmentId(
  pageId: string,
  capturedAt: string,
): string {
  const seed = `${pageId}:audio:${capturedAt.slice(0, 19)}`;
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `vaud-${(hash >>> 0).toString(16)}`;
}
