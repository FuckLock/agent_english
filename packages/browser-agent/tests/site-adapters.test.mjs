import test from "node:test";
import assert from "node:assert/strict";

import {
  detectSiteAdapter,
  detectYouTubePage,
  isAO3URL,
  isRedditURL,
  isWikipediaURL,
  isXURL,
} from "../dist/index.js";

test("detects YouTube watch and Shorts pages", () => {
  const watch = detectYouTubePage("https://m.youtube.com/watch?v=LmFME_-3icE");
  const shorts = detectYouTubePage("https://www.youtube.com/shorts/abc123");
  const adapter = detectSiteAdapter("https://m.youtube.com/watch?v=LmFME_-3icE");

  assert.equal(watch.isYouTube, true);
  assert.equal(watch.isVideoPage, true);
  assert.equal(watch.pageKind, "youtube-watch");
  assert.equal(watch.videoId, "LmFME_-3icE");
  assert.equal(shorts.pageKind, "youtube-shorts");
  assert.equal(adapter.siteKind, "youtube");
  assert.ok(adapter.capabilities.includes("video-audio-translation"));
  assert.ok(adapter.capabilities.includes("search-results"));
});

test("detects Reddit Wikipedia AO3 and X", () => {
  assert.equal(isRedditURL("https://www.reddit.com/r/EnglishLearning/"), true);
  assert.equal(isWikipediaURL("https://en.wikipedia.org/wiki/Language"), true);
  assert.equal(isAO3URL("https://archiveofourown.org/works/123"), true);
  assert.equal(isXURL("https://x.com/example/status/1"), true);

  assert.equal(
    detectSiteAdapter("https://old.reddit.com/r/EnglishLearning/").siteKind,
    "reddit",
  );
  assert.equal(
    detectSiteAdapter("https://en.wikipedia.org/wiki/Language").siteKind,
    "wikipedia",
  );
  assert.equal(
    detectSiteAdapter("https://archiveofourown.org/works/123").siteKind,
    "ao3",
  );
  assert.equal(detectSiteAdapter("https://twitter.com/example").siteKind, "x");
});

test("falls back to generic capabilities", () => {
  const adapter = detectSiteAdapter("https://example.com/article");

  assert.equal(adapter.siteKind, "generic");
  assert.deepEqual(adapter.capabilities, [
    "readable-page",
    "inline-translation",
    "selection-fallback",
  ]);
});
