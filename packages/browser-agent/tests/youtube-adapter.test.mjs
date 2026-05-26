import test from "node:test";
import assert from "node:assert/strict";

import {
  createYouTubeAudioTranslationState,
  createYouTubeVideoCaptionState,
  decideYouTubeAudioTranslationSource,
  detectYouTubePage,
  readActiveYouTubeCaptionText,
} from "../dist/index.js";

test("detects watch shorts and non-video YouTube pages", () => {
  assert.deepEqual(
    detectYouTubePage("https://m.youtube.com/watch?v=LmFME_-3icE"),
    {
      isYouTube: true,
      isVideoPage: true,
      pageKind: "youtube-watch",
      videoId: "LmFME_-3icE",
    },
  );
  assert.deepEqual(
    detectYouTubePage("https://www.youtube.com/shorts/abc123"),
    {
      isYouTube: true,
      isVideoPage: true,
      pageKind: "youtube-shorts",
      videoId: "abc123",
    },
  );
  assert.equal(
    detectYouTubePage("https://youtu.be/xyz987").pageKind,
    "youtube-watch",
  );
  assert.deepEqual(detectYouTubePage("https://www.youtube.com/results?search_query=english"), {
    isYouTube: true,
    isVideoPage: false,
  });
});

test("readActiveYouTubeCaptionText normalizes caption node text", () => {
  const documentLike = {
    querySelectorAll(selector) {
      if (selector !== ".ytp-caption-segment") {
        return [];
      }

      return [
        { textContent: " Ranking " },
        { textContent: "the best ice moments. " },
      ];
    },
  };

  assert.equal(
    readActiveYouTubeCaptionText(documentLike),
    "Ranking the best ice moments.",
  );
});

test("createYouTubeVideoCaptionState reports overlay state for active captions", () => {
  const state = createYouTubeVideoCaptionState({
    pageId: "page-1",
    url: "https://m.youtube.com/watch?v=LmFME_-3icE",
    title: "Hydrogen Peroxide",
    sourceLanguage: "English",
    targetLanguage: "简体中文",
    now: () => new Date("2026-05-24T19:52:00.000Z"),
    documentLike: {
      querySelectorAll() {
        return [{ textContent: "Ranking the best ice moments." }];
      },
    },
  });

  assert.equal(state?.siteKind, "youtube");
  assert.equal(state?.pageKind, "youtube-watch");
  assert.equal(state?.captionAvailability, "available");
  assert.equal(state?.overlayMode, "inline-overlay");
  assert.equal(state?.activeSegment?.sourceText, "Ranking the best ice moments.");
  assert.equal(state?.capabilities.includes("video-caption-overlay"), true);
});

test("captions stay primary when caption text exists", () => {
  const decision = decideYouTubeAudioTranslationSource({
    captionText: "Ranking the best ice moments.",
    captionQuality: "available",
  });

  assert.equal(decision.source, "caption");
  assert.equal(decision.audioBetaAvailable, false);
});

test("audio beta becomes available when captions are unavailable", () => {
  const decision = decideYouTubeAudioTranslationSource({
    captionText: "",
    captionQuality: "unavailable",
  });

  assert.equal(decision.source, "audio");
  assert.equal(decision.reason, "caption-unavailable");
});

test("audio beta becomes available when caption quality is low", () => {
  const decision = decideYouTubeAudioTranslationSource({
    captionText: "bad auto text",
    captionQuality: "low",
  });

  assert.equal(decision.source, "audio");
  assert.equal(decision.reason, "caption-quality-low");
});

test("manual audio selection overrides caption priority", () => {
  const decision = decideYouTubeAudioTranslationSource({
    captionText: "Ranking the best ice moments.",
    captionQuality: "available",
    manualAudioSelection: true,
  });

  assert.equal(decision.source, "audio");
  assert.equal(decision.reason, "manual-audio-selection");
});

test("createYouTubeAudioTranslationState exposes privacy first audio entry", () => {
  const state = createYouTubeAudioTranslationState({
    pageId: "page-1",
    url: "https://m.youtube.com/watch?v=LmFME_-3icE",
    title: "Hydrogen Peroxide",
    sourceLanguage: "English",
    targetLanguage: "简体中文",
    captionQuality: "unavailable",
    now: () => new Date("2026-05-24T19:52:00.000Z"),
  });

  assert.equal(state?.source, "audio");
  assert.equal(state?.status, "privacy-required");
  assert.equal(state?.capabilities.includes("video-audio-translation"), true);
});

test("runtime bridge exposes video audio event command names", async () => {
  const { BROWSER_AGENT_RUNTIME_SOURCE } = await import("../dist/index.js");

  assert.equal(BROWSER_AGENT_RUNTIME_SOURCE.includes("video.audio.state.changed"), true);
  assert.equal(BROWSER_AGENT_RUNTIME_SOURCE.includes("video.audio.quota.changed"), true);
  assert.equal(BROWSER_AGENT_RUNTIME_SOURCE.includes("requestVideoAudioTranslation"), true);
});
