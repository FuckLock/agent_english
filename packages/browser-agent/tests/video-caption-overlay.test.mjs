import test from "node:test";
import assert from "node:assert/strict";

import {
  VIDEO_CAPTION_FALLBACK_ID,
  VIDEO_CAPTION_OVERLAY_ID,
  applyVideoCaptionOverlayState,
} from "../dist/index.js";

function createElement() {
  return {
    id: "",
    textContent: null,
    className: "",
    hidden: false,
    dataset: {},
    style: {},
    parentElement: null,
    children: [],
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
    },
    remove() {
      this.removed = true;
      if (this.parentElement) {
        this.parentElement.children = this.parentElement.children.filter(
          (node) => node !== this,
        );
        this.parentElement = null;
      }
    },
  };
}

function createDocument() {
  const body = createElement();
  return {
    body,
    createElement() {
      return createElement();
    },
    getElementById(id) {
      return body.children.find((child) => child.id === id) ?? null;
    },
  };
}

test("applyVideoCaptionOverlayState renders bilingual text in the overlay surface", () => {
  const documentLike = createDocument();
  const overlay = applyVideoCaptionOverlayState(documentLike, {
    pageId: "page-1",
    siteKind: "youtube",
    pageKind: "youtube-watch",
    url: "https://m.youtube.com/watch?v=abc",
    title: "Video",
    videoId: "abc",
    captionAvailability: "available",
    overlayMode: "inline-overlay",
    status: "translated",
    capabilities: ["captions-available", "video-caption-overlay"],
    activeSegment: {
      pageId: "page-1",
      segmentId: "vcap-1",
      videoId: "abc",
      sourceText: "Hello there.",
      translatedText: "你好。",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      capturedAt: "2026-05-24T19:52:00.000Z",
    },
    updatedAt: "2026-05-24T19:52:01.000Z",
  });

  assert.equal(overlay.id, VIDEO_CAPTION_OVERLAY_ID);
  assert.equal(overlay.textContent, "Hello there.\n你好。");
  assert.equal(overlay.dataset.agentEnglishStatus, "translated");
});

test("applyVideoCaptionOverlayState renders unavailable captions as fallback bar", () => {
  const documentLike = createDocument();
  const fallback = applyVideoCaptionOverlayState(documentLike, {
    pageId: "page-1",
    siteKind: "youtube",
    pageKind: "youtube-shorts",
    url: "https://m.youtube.com/shorts/abc",
    title: "Short",
    videoId: "abc",
    captionAvailability: "unavailable",
    overlayMode: "fallback-bar",
    status: "caption-unavailable",
    capabilities: ["captions-unavailable", "video-caption-fallback"],
    failureReason: "caption-unavailable",
    message: "当前视频没有检测到可用字幕。",
    updatedAt: "2026-05-24T19:52:01.000Z",
  });

  assert.equal(fallback.id, VIDEO_CAPTION_FALLBACK_ID);
  assert.equal(fallback.textContent, "当前视频没有检测到可用字幕。");
});

test("unsafe audio overlay falls back to fallback bar", () => {
  const documentLike = createDocument();
  const fallback = applyVideoCaptionOverlayState(documentLike, {
    pageId: "page-1",
    siteKind: "youtube",
    pageKind: "youtube-watch",
    url: "https://m.youtube.com/watch?v=abc",
    title: "Video",
    videoId: "abc",
    captionAvailability: "unavailable",
    source: "audio",
    overlayMode: "inline-overlay",
    status: "failed",
    capabilities: ["audio-translation-beta", "video-audio-translation"],
    failureReason: "asr-failed",
    message: "听音翻译暂不可用",
    updatedAt: "2026-05-24T19:52:01.000Z",
  });

  assert.equal(fallback.id, VIDEO_CAPTION_FALLBACK_ID);
  assert.equal(fallback.textContent, "听音翻译暂不可用");
});

test("audio state renders recognizing quota exhausted and failed copy", () => {
  const recognizingDocument = createDocument();
  const recognizing = applyVideoCaptionOverlayState(recognizingDocument, {
    pageId: "page-1",
    siteKind: "youtube",
    pageKind: "youtube-watch",
    url: "https://m.youtube.com/watch?v=abc",
    title: "Video",
    videoId: "abc",
    captionAvailability: "unavailable",
    source: "audio",
    overlayMode: "inline-overlay",
    status: "recognizing",
    capabilities: ["audio-translation-beta", "video-audio-translation"],
    updatedAt: "2026-05-24T19:52:01.000Z",
  });
  assert.equal(recognizing.textContent, "正在听音识别");

  const quotaDocument = createDocument();
  const quota = applyVideoCaptionOverlayState(quotaDocument, {
    pageId: "page-1",
    siteKind: "youtube",
    pageKind: "youtube-watch",
    url: "https://m.youtube.com/watch?v=abc",
    title: "Video",
    videoId: "abc",
    captionAvailability: "unavailable",
    source: "audio",
    overlayMode: "inline-overlay",
    status: "quota-exhausted",
    capabilities: ["audio-translation-beta", "video-audio-translation"],
    quota: {
      serviceTier: "free",
      status: "exhausted",
      usedMinutes: 10,
      limitMinutes: 10,
      remainingMinutes: 0,
      resetAt: "2026-05-25T00:00:00.000Z",
    },
    updatedAt: "2026-05-24T19:52:01.000Z",
  });
  assert.equal(quota.textContent, "今日听音分钟已用完");
});

test("fallback bar remains available for unsafe caption overlay", () => {
  const documentLike = createDocument();
  const fallback = applyVideoCaptionOverlayState(documentLike, {
    pageId: "page-1",
    siteKind: "youtube",
    pageKind: "youtube-shorts",
    url: "https://m.youtube.com/shorts/abc",
    title: "Short",
    videoId: "abc",
    captionAvailability: "available",
    overlayMode: "fallback-bar",
    status: "fallback",
    capabilities: ["video-caption-fallback"],
    failureReason: "overlay-unsafe",
    updatedAt: "2026-05-24T19:52:01.000Z",
  });

  assert.equal(fallback.id, VIDEO_CAPTION_FALLBACK_ID);
});

// Phase 8.7 / E4 — A7.1: caption overlay must not be a scroll-covering full-screen
// fixed layer. The surface is positioned (not static) but does not stretch the whole
// viewport (no top:0/left:0 full-bleed fixed), and never intercepts native gestures.
test("E4: caption overlay surface is not a scroll-covering full-screen fixed layer", () => {
  const documentLike = createDocument();
  const overlay = applyVideoCaptionOverlayState(documentLike, {
    pageId: "page-1",
    siteKind: "youtube",
    pageKind: "youtube-watch",
    url: "https://m.youtube.com/watch?v=abc",
    title: "Video",
    videoId: "abc",
    captionAvailability: "available",
    overlayMode: "inline-overlay",
    status: "translated",
    capabilities: ["captions-available", "video-caption-overlay"],
    activeSegment: {
      pageId: "page-1",
      segmentId: "vcap-1",
      videoId: "abc",
      sourceText: "Hello there.",
      translatedText: "你好。",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      capturedAt: "2026-05-24T19:52:00.000Z",
    },
    updatedAt: "2026-05-24T19:52:01.000Z",
  });

  // Not the legacy full-screen fixed overlay that covers the scroll container.
  assert.notEqual(overlay.style.position, "fixed");
  // Bottom-anchored within the video safe area, not full-bleed top/left fixed.
  assert.equal(overlay.style.top === "0" || overlay.style.top === "0px", false);
  // Must never intercept native scroll / tap gestures.
  assert.equal(overlay.style.pointerEvents, "none");
});

test("E4: fallback bar surface is not a scroll-covering full-screen fixed layer", () => {
  const documentLike = createDocument();
  const fallback = applyVideoCaptionOverlayState(documentLike, {
    pageId: "page-1",
    siteKind: "youtube",
    pageKind: "youtube-shorts",
    url: "https://m.youtube.com/shorts/abc",
    title: "Short",
    videoId: "abc",
    captionAvailability: "unavailable",
    overlayMode: "fallback-bar",
    status: "caption-unavailable",
    capabilities: ["captions-unavailable", "video-caption-fallback"],
    failureReason: "caption-unavailable",
    message: "当前视频没有检测到可用字幕。",
    updatedAt: "2026-05-24T19:52:01.000Z",
  });

  assert.notEqual(fallback.style.position, "fixed");
  assert.equal(fallback.style.pointerEvents, "none");
});

// Phase 8.7 / E4 — A7.2: YouTube non-video pages render no caption / fallback surface.
test("E4: YouTube non-video page renders no caption surface", () => {
  const documentLike = createDocument();
  const result = applyVideoCaptionOverlayState(documentLike, {
    pageId: "page-1",
    siteKind: "youtube",
    pageKind: "youtube-watch",
    url: "https://www.youtube.com/feed/subscriptions",
    title: "Subscriptions",
    videoId: undefined,
    captionAvailability: "unavailable",
    overlayMode: "inline-overlay",
    status: "caption-unavailable",
    capabilities: ["captions-unavailable"],
    updatedAt: "2026-05-24T19:52:01.000Z",
  });

  assert.equal(result, null, "non-video page must not render a surface");
  assert.equal(documentLike.getElementById(VIDEO_CAPTION_OVERLAY_ID), null);
  assert.equal(documentLike.getElementById(VIDEO_CAPTION_FALLBACK_ID), null);
});

test("E4: navigating from video to non-video page clears residual surface", () => {
  const documentLike = createDocument();
  // Render a fallback surface while on a video page.
  applyVideoCaptionOverlayState(documentLike, {
    pageId: "page-1",
    siteKind: "youtube",
    pageKind: "youtube-watch",
    url: "https://www.youtube.com/watch?v=abc",
    title: "Video",
    videoId: "abc",
    captionAvailability: "unavailable",
    overlayMode: "fallback-bar",
    status: "caption-unavailable",
    capabilities: ["captions-unavailable", "video-caption-fallback"],
    updatedAt: "2026-05-24T19:52:01.000Z",
  });
  assert.notEqual(documentLike.getElementById(VIDEO_CAPTION_FALLBACK_ID), null);

  // Then apply a non-video-page state: residual surface must be removed.
  applyVideoCaptionOverlayState(documentLike, {
    pageId: "page-1",
    siteKind: "youtube",
    pageKind: "youtube-watch",
    url: "https://www.youtube.com/",
    title: "Home",
    videoId: undefined,
    captionAvailability: "unavailable",
    overlayMode: "inline-overlay",
    status: "caption-unavailable",
    capabilities: ["captions-unavailable"],
    updatedAt: "2026-05-24T19:52:02.000Z",
  });

  assert.equal(documentLike.getElementById(VIDEO_CAPTION_OVERLAY_ID), null);
  assert.equal(documentLike.getElementById(VIDEO_CAPTION_FALLBACK_ID), null);
});
