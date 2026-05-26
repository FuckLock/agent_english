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
