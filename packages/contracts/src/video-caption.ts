import type { SiteCapability } from "./site-capability";
import type { ModelServiceErrorCode } from "./model-service";

export const VIDEO_CAPTION_PAGE_KINDS = [
  "youtube-watch",
  "youtube-shorts",
] as const;

export type VideoCaptionPageKind = (typeof VIDEO_CAPTION_PAGE_KINDS)[number];

export const VIDEO_CAPTION_AVAILABILITY = [
  "unknown",
  "available",
  "unavailable",
] as const;

export type VideoCaptionAvailability =
  (typeof VIDEO_CAPTION_AVAILABILITY)[number];

export const VIDEO_CAPTION_OVERLAY_MODES = [
  "hidden",
  "inline-overlay",
  "fallback-bar",
] as const;

export type VideoCaptionOverlayMode =
  (typeof VIDEO_CAPTION_OVERLAY_MODES)[number];

export const VIDEO_CAPTION_OVERLAY_STATUSES = [
  "detecting",
  "caption-available",
  "caption-unavailable",
  "translating",
  "translated",
  "failed",
  "fallback",
] as const;

export type VideoCaptionOverlayStatus =
  (typeof VIDEO_CAPTION_OVERLAY_STATUSES)[number];

export const VIDEO_CAPTION_FAILURE_REASONS = [
  "caption-unavailable",
  "overlay-unsafe",
  "translation-failed",
] as const;

export type VideoCaptionFailureReason =
  | (typeof VIDEO_CAPTION_FAILURE_REASONS)[number]
  | ModelServiceErrorCode;

export interface VideoCaptionSegment {
  pageId: string;
  segmentId: string;
  videoId?: string;
  sourceText: string;
  translatedText?: string;
  sourceLanguage: string;
  targetLanguage: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  containerPath?: string;
  capturedAt: string;
}

export interface VideoCaptionOverlayState {
  pageId: string;
  siteKind: "youtube";
  pageKind: VideoCaptionPageKind;
  url: string;
  title: string;
  videoId?: string;
  captionAvailability: VideoCaptionAvailability;
  overlayMode: VideoCaptionOverlayMode;
  status: VideoCaptionOverlayStatus;
  capabilities: SiteCapability[];
  activeSegment?: VideoCaptionSegment;
  failureReason?: VideoCaptionFailureReason;
  message?: string;
  updatedAt: string;
}

export function createVideoCaptionSegmentId(
  pageId: string,
  sourceText: string,
  capturedAt: string,
): string {
  const seed = `${pageId}:${sourceText.replace(/\s+/g, " ").trim()}:${capturedAt.slice(0, 19)}`;
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `vcap-${(hash >>> 0).toString(16)}`;
}
