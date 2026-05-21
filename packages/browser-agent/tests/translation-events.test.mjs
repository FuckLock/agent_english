import test from "node:test";
import assert from "node:assert/strict";

import {
  createTranslationCompletedEvent,
  createTranslationFailedEvent,
  createTranslationRequestedEvent,
} from "../dist/index.js";

const translationFixture = {
  pageId: "page-1",
  pageContext: {
    pageId: "page-1",
    url: "https://example.com/article",
    title: "Example Article",
    sourceLanguage: "English",
    targetLanguage: "简体中文",
    displayMode: "bilingual",
    capabilities: [
      "readable-page",
      "inline-translation",
      "selection-fallback",
    ],
    siteKind: "generic",
  },
  sourceLanguage: "English",
  targetLanguage: "简体中文",
  displayMode: "bilingual",
  capabilities: [
    "readable-page",
    "inline-translation",
    "selection-fallback",
  ],
  segments: [
    {
      pageId: "page-1",
      segmentId: "seg-1",
      sourceText: "Hello world.",
      containerPath: "body>article:nth-of-type(1)>p:nth-of-type(1)",
      sourceLanguage: "English",
      isVisible: true,
      capabilities: ["readable-page", "inline-translation"],
    },
  ],
};

test("createTranslationRequestedEvent preserves requestId, pageId and segmentId", () => {
  const event = createTranslationRequestedEvent(translationFixture, {
    requestId: "translation-requested-page-1",
    pageId: "page-1",
  });

  assert.equal(event.requestId, "translation-requested-page-1");
  assert.equal(event.pageId, "page-1");
  assert.equal(event.payload.pageContext.pageId, "page-1");
  assert.equal(event.payload.segments[0].segmentId, "seg-1");
});

test("createTranslationCompletedEvent carries translated result fields", () => {
  const event = createTranslationCompletedEvent(
    {
      pageId: "page-1",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      displayMode: "learning",
      capabilities: ["readable-page", "selection-fallback"],
      segmentResults: [
        {
          segmentId: "seg-1",
          translatedText: "你好，世界。",
        },
      ],
      resultsBySegmentId: {
        "seg-1": {
          segmentId: "seg-1",
          translatedText: "你好，世界。",
        },
      },
    },
    {
      requestId: "translation-completed-page-1",
      pageId: "page-1",
    },
  );

  assert.equal(event.payload.displayMode, "learning");
  assert.equal(
    event.payload.resultsBySegmentId["seg-1"].translatedText,
    "你好，世界。",
  );
});

test("createTranslationFailedEvent reports failureReason without UI labels", () => {
  const event = createTranslationFailedEvent(
    {
      pageId: "page-1",
      segmentId: "seg-1",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      displayMode: "bilingual",
      capabilities: ["readable-page", "selection-fallback"],
      failureReason: "provider-not-configured",
    },
    {
      requestId: "translation-failed-page-1",
      pageId: "page-1",
    },
  );

  assert.equal(event.payload.failureReason, "provider-not-configured");
  assert.equal(typeof event.payload.failureMessage, "undefined");
});
