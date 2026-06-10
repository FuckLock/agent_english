import type {
  VideoAudioFailureReason,
  VideoAudioTranslationState,
  VideoCaptionFailureReason,
  VideoCaptionOverlayState,
} from "@agent-english/contracts";

import { detectYouTubePage } from "../site-adapters/youtube";

export interface VideoCaptionOverlayElementLike {
  textContent: string | null;
  className?: string;
  id?: string;
  hidden?: boolean;
  dataset?: Record<string, string>;
  style?: Record<string, string>;
  parentElement?: VideoCaptionOverlayElementLike | null;
  children?: VideoCaptionOverlayElementLike[];
  appendChild?(child: VideoCaptionOverlayElementLike): void;
  remove?(): void;
}

export interface VideoCaptionOverlayDocumentLike {
  body?: VideoCaptionOverlayElementLike | null;
  createElement(tagName: string): VideoCaptionOverlayElementLike;
  getElementById?(id: string): VideoCaptionOverlayElementLike | null;
}

export const VIDEO_CAPTION_OVERLAY_ID = "agent-english-video-caption-overlay";
export const VIDEO_CAPTION_FALLBACK_ID = "agent-english-video-caption-fallback";

export const VIDEO_CAPTION_STATUS_LABELS = {
  detecting: "正在识别字幕",
  "caption-available": "字幕已识别",
  "caption-unavailable": "当前视频没有检测到可用字幕",
  translating: "字幕翻译中",
  translated: "字幕翻译完成",
  failed: "字幕翻译暂不可用",
  fallback: "已切换到降级字幕条",
} as const;

export const VIDEO_AUDIO_STATUS_LABELS = {
  idle: "听音翻译待开启",
  "privacy-required": "开启前请确认听音翻译隐私提示",
  "caption-primary": "字幕可用，优先使用字幕翻译",
  recognizing: "正在听音识别",
  translating: "听音翻译中",
  translated: "听音翻译完成",
  "quota-exhausted": "今日听音分钟已用完",
  stopped: "听音翻译已停止",
  closed: "听音翻译已关闭",
  failed: "听音翻译暂不可用",
} as const;

export function applyVideoCaptionOverlayState(
  documentLike: VideoCaptionOverlayDocumentLike,
  state: VideoCaptionOverlayState | VideoAudioTranslationState,
): VideoCaptionOverlayElementLike | null {
  // Phase 8.7 / A7.2：YouTube 非视频页绝不渲染翻译 / 字幕 surface；清除任何残留节点。
  if (!detectYouTubePage(state.url).isVideoPage) {
    removeCaptionSurfaces(documentLike);
    return null;
  }

  const overlayMode = resolvedOverlayMode(state);
  clearInactiveCaptionSurface(documentLike, overlayMode);

  if (overlayMode === "fallback-bar") {
    return renderCaptionSurface(documentLike, VIDEO_CAPTION_FALLBACK_ID, state);
  }

  return renderCaptionSurface(documentLike, VIDEO_CAPTION_OVERLAY_ID, state);
}

function removeCaptionSurfaces(
  documentLike: VideoCaptionOverlayDocumentLike,
): void {
  documentLike.getElementById?.(VIDEO_CAPTION_OVERLAY_ID)?.remove?.();
  documentLike.getElementById?.(VIDEO_CAPTION_FALLBACK_ID)?.remove?.();
}

export function messageForVideoCaptionFailure(
  failureReason: VideoCaptionFailureReason | undefined,
): string {
  switch (failureReason) {
    case "caption-unavailable":
      return "当前视频没有检测到可用字幕";
    case "overlay-unsafe":
      return "字幕叠层会遮挡播放器，已切换到下方字幕条";
    case "quota-exceeded":
      return "当前服务等级额度不足";
    case "tier-unavailable":
      return "当前模型需要更高服务等级";
    case "content-too-long":
      return "当前字幕过长，暂不能翻译";
    case "provider-fallback-failed":
    case "service-unavailable":
      return "模型服务暂不可用";
    default:
      return "字幕翻译暂不可用";
  }
}

export function messageForVideoAudioFailure(
  failureReason: VideoAudioFailureReason | undefined,
): string {
  switch (failureReason) {
    case "caption-primary":
      return "字幕可用，优先使用字幕翻译";
    case "caption-quality-low":
      return "字幕质量较低，可改用听音翻译 Beta";
    case "caption-unavailable":
      return "当前视频没有检测到可用字幕";
    case "privacy-disclosure-required":
      return "开启前请确认听音翻译隐私提示";
    case "audio-quota-exceeded":
    case "quota-exceeded":
      return "今日听音分钟已用完";
    case "audio-unavailable":
    case "asr-failed":
    case "service-unavailable":
    case "provider-fallback-failed":
      return "听音翻译暂不可用";
    default:
      return "听音翻译暂不可用";
  }
}

function renderCaptionSurface(
  documentLike: VideoCaptionOverlayDocumentLike,
  id: string,
  state: VideoCaptionOverlayState | VideoAudioTranslationState,
): VideoCaptionOverlayElementLike {
  const surface = ensureCaptionSurface(documentLike, id);
  surface.className =
    id === VIDEO_CAPTION_OVERLAY_ID
      ? "agent-english-video-caption-overlay"
      : "agent-english-video-caption-fallback";
  surface.dataset = {
    ...(surface.dataset ?? {}),
    agentEnglishStatus: state.status,
    agentEnglishPageKind: state.pageKind,
    agentEnglishSource: isAudioState(state) ? state.source : "caption",
  };
  surface.textContent = captionTextForState(state);
  surface.hidden = resolvedOverlayMode(state) === "hidden";
  surface.style = surfaceStyle(id);

  return surface;
}

function captionTextForState(
  state: VideoCaptionOverlayState | VideoAudioTranslationState,
): string {
  if (isAudioState(state)) {
    if (state.failureReason) {
      return state.message ?? messageForVideoAudioFailure(state.failureReason);
    }

    const sourceText = state.activeSegment?.sourceText ?? "";
    const translatedText = state.activeSegment?.translatedText ?? "";

    if (sourceText && translatedText) {
      return `${sourceText}\n${translatedText}`;
    }

    if (sourceText) {
      return `${sourceText}\n${VIDEO_AUDIO_STATUS_LABELS[state.status]}`;
    }

    if (state.quota?.remainingMinutes === 0) {
      return "今日听音分钟已用完";
    }

    return state.message ?? VIDEO_AUDIO_STATUS_LABELS[state.status];
  }

  if (state.failureReason) {
    return state.message ?? messageForVideoCaptionFailure(state.failureReason);
  }

  const sourceText = state.activeSegment?.sourceText ?? "";
  const translatedText = state.activeSegment?.translatedText ?? "";

  if (sourceText && translatedText) {
    return `${sourceText}\n${translatedText}`;
  }

  if (sourceText) {
    // 等待期只显示原文（去掉「字幕翻译中」等占位行）：译文经 JS 预埋或 native 推回后
    // 再补第二行，观感与 YouTube 原生字幕一致（与 runtime-source/youtube-overlay 等价）。
    return sourceText;
  }

  return state.message ?? VIDEO_CAPTION_STATUS_LABELS[state.status];
}

function clearInactiveCaptionSurface(
  documentLike: VideoCaptionOverlayDocumentLike,
  overlayMode: VideoCaptionOverlayState["overlayMode"],
): void {
  const inactiveId =
    overlayMode === "fallback-bar"
      ? VIDEO_CAPTION_OVERLAY_ID
      : VIDEO_CAPTION_FALLBACK_ID;
  documentLike.getElementById?.(inactiveId)?.remove?.();
}

function resolvedOverlayMode(
  state: VideoCaptionOverlayState | VideoAudioTranslationState,
): VideoCaptionOverlayState["overlayMode"] {
  if (
    isAudioState(state)
    && (state.failureReason === "audio-quota-exceeded"
      || state.failureReason === "asr-failed")
  ) {
    return "fallback-bar";
  }

  return state.overlayMode;
}

function isAudioState(
  state: VideoCaptionOverlayState | VideoAudioTranslationState,
): state is VideoAudioTranslationState {
  return "source" in state;
}

function ensureCaptionSurface(
  documentLike: VideoCaptionOverlayDocumentLike,
  id: string,
): VideoCaptionOverlayElementLike {
  const existing = documentLike.getElementById?.(id);
  if (existing) {
    return existing;
  }

  const surface = documentLike.createElement("div");
  surface.id = id;
  documentLike.body?.appendChild?.(surface);
  return surface;
}

// Phase 8.7 / A7.1：字幕叠层不再用 position:fixed 覆盖整个滚动容器（会脱离文档流、
// 干扰 YouTube 虚拟滚动）。改为 position:absolute 相对视频播放器局部容器、bottom 锚定到
// 视频安全区下方，并以 pointerEvents:none 保证不拦截 YouTube 原生滚动 / 点击手势。
function surfaceStyle(id: string): Record<string, string> {
  if (id === VIDEO_CAPTION_FALLBACK_ID) {
    return {
      position: "absolute",
      left: "12px",
      right: "12px",
      bottom: "12%",
      zIndex: "2147483000",
      padding: "9px 12px",
      borderRadius: "12px",
      background: "rgba(15, 23, 42, 0.82)",
      color: "#ffffff",
      fontSize: "14px",
      lineHeight: "1.35",
      whiteSpace: "pre-line",
      pointerEvents: "none",
    };
  }

  return {
    position: "absolute",
    left: "50%",
    bottom: "12%",
    transform: "translateX(-50%)",
    maxWidth: "82%",
    zIndex: "2147483000",
    padding: "6px 10px",
    borderRadius: "4px",
    background: "rgba(0, 0, 0, 0.72)",
    color: "#ffffff",
    fontSize: "15px",
    lineHeight: "1.32",
    textAlign: "center",
    whiteSpace: "pre-line",
    pointerEvents: "none",
  };
}
