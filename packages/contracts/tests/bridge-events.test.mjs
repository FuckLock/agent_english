import test from "node:test";
import assert from "node:assert/strict";

import {
  BRIDGE_BOOT_EVENT_TYPE,
  BRIDGE_PING_EVENT_TYPE,
  PAGE_READY_EVENT_TYPE,
  SELECTION_EXPLANATION_FAILED_EVENT_TYPE,
  SELECTION_REQUESTED_EVENT_TYPE,
  createBridgeEvent,
  schemaVersion,
} from "../dist/index.js";

test("createBridgeEvent creates a boot envelope with schema metadata", () => {
  const event = createBridgeEvent(BRIDGE_BOOT_EVENT_TYPE, {
    sessionId: "session-1",
    bridgeScope: "bootstrap",
  });

  assert.equal(event.schemaVersion, schemaVersion);
  assert.equal(event.eventType, BRIDGE_BOOT_EVENT_TYPE);
  assert.deepEqual(event.payload, {
    sessionId: "session-1",
    bridgeScope: "bootstrap",
  });
  assert.equal(event.result, undefined);
  assert.equal(event.error, undefined);
});

test("createBridgeEvent carries ping result and error fields", () => {
  const event = createBridgeEvent(
    BRIDGE_PING_EVENT_TYPE,
    {
      sessionId: "session-1",
      sentAt: "2026-05-20T00:00:00.000Z",
    },
    {
      result: { acknowledged: true },
      error: {
        code: "noop",
        message: "No failure",
      },
    },
  );

  assert.equal(event.eventType, BRIDGE_PING_EVENT_TYPE);
  assert.deepEqual(event.result, { acknowledged: true });
  assert.deepEqual(event.error, {
    code: "noop",
    message: "No failure",
  });
});

test("createBridgeEvent carries page-ready metadata", () => {
  const event = createBridgeEvent(
    PAGE_READY_EVENT_TYPE,
    {
      sessionId: "session-1",
      url: "https://www.wikipedia.org",
      title: "Wikipedia",
      loadedAt: "2026-05-20T00:00:00.000Z",
    },
    {
      requestId: "page-ready-session-1",
      pageId: "page-session-1",
    },
  );

  assert.equal(event.schemaVersion, schemaVersion);
  assert.equal(event.eventType, PAGE_READY_EVENT_TYPE);
  assert.equal(event.requestId, "page-ready-session-1");
  assert.equal(event.pageId, "page-session-1");
  assert.deepEqual(event.payload, {
    sessionId: "session-1",
    url: "https://www.wikipedia.org",
    title: "Wikipedia",
    loadedAt: "2026-05-20T00:00:00.000Z",
  });
});

test("createBridgeEvent preserves a selection payload fixture on the same event", () => {
  const selectionPayload = {
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
  const event = createBridgeEvent(
    SELECTION_REQUESTED_EVENT_TYPE,
    selectionPayload,
    {
      requestId: "selection-requested-sel-1",
      pageId: "page-1",
    },
  );

  assert.equal(event.schemaVersion, schemaVersion);
  assert.equal(event.eventType, SELECTION_REQUESTED_EVENT_TYPE);
  assert.equal(event.requestId, "selection-requested-sel-1");
  assert.deepEqual(event.payload, selectionPayload);
});

test("createBridgeEvent preserves selection failure fields on the same payload", () => {
  const failurePayload = {
    pageId: "page-1",
    selectionId: "sel-1",
    selectedText: "gloss over",
    contextBefore: "They tried to",
    contextAfter: "the policy change.",
    sourceUrl: "https://example.com/article",
    sourceTitle: "Example Article",
    containerPath: "body>article:nth-of-type(1)>p:nth-of-type(1)",
    kind: "phrase",
    failureReason: "selection-explanation-failed",
  };
  const event = createBridgeEvent(
    SELECTION_EXPLANATION_FAILED_EVENT_TYPE,
    failurePayload,
    {
      requestId: "selection-failed-sel-1",
      pageId: "page-1",
      error: {
        code: "selection.explanation.failed",
        message: "Provider response was empty.",
      },
    },
  );

  assert.equal(event.schemaVersion, schemaVersion);
  assert.equal(event.eventType, SELECTION_EXPLANATION_FAILED_EVENT_TYPE);
  assert.equal(event.payload.selectionId, "sel-1");
  assert.equal(event.payload.sourceUrl, "https://example.com/article");
  assert.equal(event.payload.failureReason, "selection-explanation-failed");
});
