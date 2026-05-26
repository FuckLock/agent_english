import {
  GENERIC_SITE_CAPABILITIES,
  type SiteCapability,
  type VideoCaptionOverlayState,
  type VideoCaptionPageKind,
  createVideoCaptionSegmentId,
} from "@agent-english/contracts";

export interface YouTubePageDetection {
  isYouTube: boolean;
  isVideoPage: boolean;
  pageKind?: VideoCaptionPageKind;
  videoId?: string;
}

export interface YouTubeCaptionElementLike {
  textContent?: string | null;
}

export interface YouTubeCaptionDocumentLike {
  title?: string;
  location?: { href?: string };
  querySelectorAll?(selector: string): Iterable<YouTubeCaptionElementLike>;
}

export interface CreateYouTubeVideoCaptionStateOptions {
  pageId: string;
  url: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  now?: () => Date;
  documentLike?: YouTubeCaptionDocumentLike;
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const CAPTION_SELECTORS = [
  ".ytp-caption-segment",
  ".ytp-caption-window-container",
  ".caption-window",
];

export function youtubePageCapabilities(urlText: string): SiteCapability[] {
  const detection = detectYouTubePage(urlText);
  const baseCapabilities: SiteCapability[] = [
    ...GENERIC_SITE_CAPABILITIES,
    "comments",
    "search-results",
    "dynamic-content",
    "selection-fallback",
  ];

  if (!detection.isVideoPage) {
    return uniqueCapabilities(baseCapabilities);
  }

  return uniqueCapabilities([
    ...baseCapabilities,
    "captions-unavailable",
    "video-caption-fallback",
    "audio-translation-beta",
    "video-audio-translation",
  ]);
}

export function detectYouTubePage(urlText: string): YouTubePageDetection {
  let url;

  try {
    url = new URL(urlText);
  } catch {
    return { isYouTube: false, isVideoPage: false };
  }

  if (!YOUTUBE_HOSTS.has(url.hostname)) {
    return { isYouTube: false, isVideoPage: false };
  }

  if (url.hostname === "youtu.be") {
    const videoId = normalizedPathPart(url.pathname);
    return {
      isYouTube: true,
      isVideoPage: Boolean(videoId),
      pageKind: videoId ? "youtube-watch" : undefined,
      videoId,
    };
  }

  if (url.pathname === "/watch") {
    const videoId = url.searchParams.get("v") ?? undefined;
    return {
      isYouTube: true,
      isVideoPage: Boolean(videoId),
      pageKind: videoId ? "youtube-watch" : undefined,
      videoId,
    };
  }

  if (url.pathname.startsWith("/shorts/")) {
    const videoId = normalizedPathPart(url.pathname.replace(/^\/shorts\//, ""));
    return {
      isYouTube: true,
      isVideoPage: Boolean(videoId),
      pageKind: videoId ? "youtube-shorts" : undefined,
      videoId,
    };
  }

  return { isYouTube: true, isVideoPage: false };
}

export function readActiveYouTubeCaptionText(
  documentLike: YouTubeCaptionDocumentLike,
): string {
  const nodes =
    CAPTION_SELECTORS.map((selector) =>
      Array.from(documentLike.querySelectorAll?.(selector) ?? []),
    ).find((matches) => matches.length > 0) ?? [];

  return normalizeCaptionText(
    nodes
      .map((node) => node.textContent ?? "")
      .join(" "),
  );
}

export function createYouTubeVideoCaptionState(
  options: CreateYouTubeVideoCaptionStateOptions,
): VideoCaptionOverlayState | null {
  const detection = detectYouTubePage(options.url);
  if (!detection.isVideoPage || !detection.pageKind) {
    return null;
  }

  const now = options.now ?? (() => new Date());
  const updatedAt = now().toISOString();
  const captionText = options.documentLike
    ? readActiveYouTubeCaptionText(options.documentLike)
    : "";
  const capabilities: SiteCapability[] = captionText
    ? [
        "captions-available",
        "video-caption-overlay",
        "audio-translation-beta",
        "selection-fallback",
      ]
    : [
        "captions-unavailable",
        "video-caption-fallback",
        "audio-translation-beta",
        "video-audio-translation",
        "selection-fallback",
      ];

  return {
    pageId: options.pageId,
    siteKind: "youtube",
    pageKind: detection.pageKind,
    url: options.url,
    title: options.title,
    videoId: detection.videoId,
    captionAvailability: captionText ? "available" : "unavailable",
    overlayMode: captionText ? "inline-overlay" : "fallback-bar",
    status: captionText ? "caption-available" : "caption-unavailable",
    capabilities,
    activeSegment: captionText
      ? {
          pageId: options.pageId,
          segmentId: createVideoCaptionSegmentId(
            options.pageId,
            captionText,
            updatedAt,
          ),
          videoId: detection.videoId,
          sourceText: captionText,
          sourceLanguage: options.sourceLanguage,
          targetLanguage: options.targetLanguage,
          containerPath: ".ytp-caption-segment",
          capturedAt: updatedAt,
        }
      : undefined,
    failureReason: captionText ? undefined : "caption-unavailable",
    message: captionText ? undefined : "当前视频没有检测到可用字幕。",
    updatedAt,
  };
}

function normalizedPathPart(pathname: string): string | undefined {
  const value = pathname.replace(/^\/+/, "").split(/[/?#]/)[0]?.trim();
  return value || undefined;
}

function normalizeCaptionText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function uniqueCapabilities(capabilities: readonly SiteCapability[]): SiteCapability[] {
  return Array.from(new Set(capabilities));
}
