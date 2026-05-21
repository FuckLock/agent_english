import test from "node:test";
import assert from "node:assert/strict";

import {
  createSavedItemFromSelection,
  SAVED_ITEM_KINDS,
} from "../dist/index.js";

test("SavedItem canonical kinds stay scoped to word phrase sentence", () => {
  assert.deepEqual(SAVED_ITEM_KINDS, ["word", "phrase", "sentence"]);
});

test("createSavedItemFromSelection keeps canonical SavedItem field names", () => {
  const savedItem = createSavedItemFromSelection(
    {
      pageId: "page-1",
      selectionId: "sel-1",
      selectedText: "gloss over",
      contextBefore: "They tried to",
      contextAfter: "the policy change.",
      sourceUrl: "https://example.com/article",
      sourceTitle: "Example Article",
      containerPath: "body>article:nth-of-type(1)>p:nth-of-type(1)",
      kind: "phrase",
      translation: "轻描淡写地带过",
      explanation: "这里表示故意弱化问题的重要性。",
      examples: ["They glossed over the delay in the meeting."],
    },
    "2026-05-21T00:00:00.000Z",
  );

  assert.deepEqual(savedItem, {
    sourceUrl: "https://example.com/article",
    sourceTitle: "Example Article",
    selectedText: "gloss over",
    contextBefore: "They tried to",
    contextAfter: "the policy change.",
    translation: "轻描淡写地带过",
    explanation: "这里表示故意弱化问题的重要性。",
    kind: "phrase",
    createdAt: "2026-05-21T00:00:00.000Z",
  });
  assert.equal("pageTitle" in savedItem, false);
  assert.equal("originalText" in savedItem, false);
});
