import test from "node:test";
import assert from "node:assert/strict";

import {
  createSelectionExplanationCompletedEvent,
  createSelectionExplanationFailedEvent,
  createSelectionRequestedEvent,
} from "../dist/index.js";

const selectionFixture = {
  pageId: "page-1",
  selectionId: "sel-1",
  selectedText: "gloss over",
  contextBefore: "They tried to",
  contextAfter: "the policy change.",
  sourceUrl: "https://example.com/article",
  sourceTitle: "Example Article",
  containerPath: "body>article:nth-of-type(1)>p:nth-of-type(1)",
  kind: "phrase",
};

test("createSelectionRequestedEvent preserves page and selection fields", () => {
  const event = createSelectionRequestedEvent(selectionFixture, {
    requestId: "selection-requested-sel-1",
    pageId: "page-1",
  });

  assert.equal(event.requestId, "selection-requested-sel-1");
  assert.equal(event.pageId, "page-1");
  assert.equal(event.payload.selectionId, "sel-1");
  assert.equal(event.payload.sourceTitle, "Example Article");
});

test("createSelectionExplanationCompletedEvent carries explanation content", () => {
  const event = createSelectionExplanationCompletedEvent(
    {
      ...selectionFixture,
      translation: "轻描淡写地带过",
      explanation: "这里表示故意弱化问题的重要性。",
      examples: ["They glossed over the delay in the meeting."],
    },
    {
      requestId: "selection-completed-sel-1",
      pageId: "page-1",
    },
  );

  assert.equal(event.payload.translation, "轻描淡写地带过");
  assert.equal(event.payload.examples[0], "They glossed over the delay in the meeting.");
});

test("createSelectionExplanationFailedEvent carries failureReason", () => {
  const event = createSelectionExplanationFailedEvent(
    {
      ...selectionFixture,
      failureReason: "service-unavailable",
    },
    {
      requestId: "selection-failed-sel-1",
      pageId: "page-1",
    },
  );

  assert.equal(event.payload.failureReason, "service-unavailable");
  assert.equal(event.payload.contextBefore, "They tried to");
});
