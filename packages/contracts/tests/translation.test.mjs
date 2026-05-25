import test from "node:test";
import assert from "node:assert/strict";

import {
  TRANSLATION_COMPLETED_EVENT_TYPE,
  TRANSLATION_FAILED_EVENT_TYPE,
  TRANSLATION_REQUESTED_EVENT_TYPE,
  createBridgeEvent,
  createTranslationResult,
  createTranslationResultMap,
  schemaVersion,
} from "../dist/index.js";

const translationFixture = {
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
  segments: [
    {
      pageId: "page-1",
      segmentId: "seg-1",
      sourceText: "First paragraph.",
      containerPath: "body>article:nth-of-type(1)>p:nth-of-type(1)",
      sourceLanguage: "English",
      isVisible: true,
      capabilities: ["readable-page", "inline-translation"],
    },
    {
      pageId: "page-1",
      segmentId: "seg-2",
      sourceText: "Second paragraph.",
      containerPath: "body>article:nth-of-type(1)>p:nth-of-type(2)",
      sourceLanguage: "English",
      isVisible: true,
      capabilities: ["readable-page", "selection-fallback"],
    },
  ],
};

test("translation fixture preserves cross-boundary field names", () => {
  assert.equal(translationFixture.pageContext.pageId, "page-1");
  assert.equal(translationFixture.segments[0].segmentId, "seg-1");
  assert.equal(translationFixture.pageContext.sourceLanguage, "English");
  assert.equal(translationFixture.pageContext.targetLanguage, "简体中文");
  assert.equal(translationFixture.pageContext.displayMode, "bilingual");
  assert.equal(
    translationFixture.pageContext.capabilities.includes("inline-translation"),
    true,
  );
});

test("createTranslationResultMap builds a segment result equivalence record", () => {
  const resultsBySegmentId = createTranslationResultMap([
    {
      segmentId: "seg-1",
      translatedText: "第一段。",
    },
    {
      segmentId: "seg-2",
      translatedText: "第二段。",
      failureReason: "translation-failed",
    },
  ]);

  assert.deepEqual(resultsBySegmentId, {
    "seg-1": {
      segmentId: "seg-1",
      translatedText: "第一段。",
    },
    "seg-2": {
      segmentId: "seg-2",
      translatedText: "第二段。",
      failureReason: "translation-failed",
    },
  });
});

test("createTranslationResult supports roundTrip map creation for completed payloads", () => {
  const payload = createTranslationResult({
    pageId: "page-1",
    sourceLanguage: "English",
    targetLanguage: "简体中文",
    displayMode: "bilingual",
    capabilities: [
      "readable-page",
      "inline-translation",
      "selection-fallback",
    ],
    segmentResults: [
      {
        segmentId: "seg-1",
        translatedText: "第一段。",
      },
      {
        segmentId: "seg-2",
        translatedText: "第二段。",
        failureReason: "translation-failed",
      },
    ],
    failureReason: "translation-failed",
  });

  assert.equal(payload.resultsBySegmentId["seg-1"].translatedText, "第一段。");
  assert.equal(
    payload.resultsBySegmentId["seg-2"].failureReason,
    "translation-failed",
  );
});

test("translation requested event keeps fixture payload fields inside the envelope", () => {
  const event = createBridgeEvent(
    TRANSLATION_REQUESTED_EVENT_TYPE,
    {
      pageId: translationFixture.pageContext.pageId,
      pageContext: translationFixture.pageContext,
      sourceLanguage: translationFixture.pageContext.sourceLanguage,
      targetLanguage: translationFixture.pageContext.targetLanguage,
      displayMode: translationFixture.pageContext.displayMode,
      capabilities: translationFixture.pageContext.capabilities,
      segments: translationFixture.segments,
    },
    {
      requestId: "translation-requested-page-1",
      pageId: translationFixture.pageContext.pageId,
    },
  );

  assert.equal(event.schemaVersion, schemaVersion);
  assert.equal(event.eventType, TRANSLATION_REQUESTED_EVENT_TYPE);
  assert.equal(event.requestId, "translation-requested-page-1");
  assert.equal(event.pageId, "page-1");
  assert.equal(event.payload.pageContext.pageId, "page-1");
  assert.equal(event.payload.segments[0].segmentId, "seg-1");
});

test("translation completed event keeps resultsBySegmentId equivalence fields", () => {
  const payload = createTranslationResult({
    pageId: "page-1",
    sourceLanguage: "English",
    targetLanguage: "简体中文",
    displayMode: "learning",
    capabilities: [
      "readable-page",
      "inline-translation",
      "selection-fallback",
    ],
    segmentResults: [
      {
        segmentId: "seg-1",
        translatedText: "第一段。",
      },
    ],
  });
  const event = createBridgeEvent(
    TRANSLATION_COMPLETED_EVENT_TYPE,
    payload,
    {
      requestId: "translation-completed-page-1",
      pageId: "page-1",
    },
  );

  assert.equal(event.eventType, TRANSLATION_COMPLETED_EVENT_TYPE);
  assert.equal(event.payload.displayMode, "learning");
  assert.equal(
    event.payload.resultsBySegmentId["seg-1"].translatedText,
    "第一段。",
  );
});

test("translation failed event preserves failureReason and schemaVersion", () => {
  const event = createBridgeEvent(
    TRANSLATION_FAILED_EVENT_TYPE,
    {
      pageId: "page-1",
      segmentId: "seg-2",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      displayMode: "bilingual",
      capabilities: ["readable-page", "selection-fallback"],
      failureReason: "service-unavailable",
    },
    {
      requestId: "translation-failed-page-1",
      pageId: "page-1",
      error: {
        code: "translation.failed",
        message: "Provider failed",
      },
    },
  );

  assert.equal(event.schemaVersion, schemaVersion);
  assert.equal(event.eventType, TRANSLATION_FAILED_EVENT_TYPE);
  assert.equal(event.payload.failureReason, "service-unavailable");
  assert.equal(event.error?.code, "translation.failed");
});
