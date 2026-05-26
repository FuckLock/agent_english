import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  VIDEO_CAPTION_STATE_CHANGED_EVENT_TYPE,
  createBridgeEvent,
  createVideoCaptionSegmentId,
  schemaVersion,
} from "../dist/index.js";

const fixturePath = path.resolve(
  import.meta.dirname,
  "fixtures/video-caption-youtube-watch.json",
);

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

test("video caption fixture preserves YouTube watch overlay fields", () => {
  assert.equal(fixture.schemaVersion, schemaVersion);
  assert.equal(fixture.eventType, VIDEO_CAPTION_STATE_CHANGED_EVENT_TYPE);
  assert.equal(fixture.payload.siteKind, "youtube");
  assert.equal(fixture.payload.pageKind, "youtube-watch");
  assert.equal(fixture.payload.captionAvailability, "available");
  assert.equal(fixture.payload.overlayMode, "inline-overlay");
  assert.equal(fixture.payload.status, "translated");
  assert.equal(
    fixture.payload.capabilities.includes("video-caption-overlay"),
    true,
  );
  assert.equal(
    fixture.payload.activeSegment.translatedText,
    "冰上瞬间排名。",
  );
});

test("video caption state can be wrapped in a bridge envelope", () => {
  const event = createBridgeEvent(
    VIDEO_CAPTION_STATE_CHANGED_EVENT_TYPE,
    fixture.payload,
    {
      requestId: fixture.requestId,
      pageId: fixture.pageId,
    },
  );

  assert.equal(event.eventType, VIDEO_CAPTION_STATE_CHANGED_EVENT_TYPE);
  assert.equal(event.requestId, "video-caption-state-vcap-1");
  assert.equal(event.payload.activeSegment.segmentId, "vcap-1");
});

test("createVideoCaptionSegmentId returns stable caption ids", () => {
  assert.equal(
    createVideoCaptionSegmentId(
      "page-youtube-watch-1",
      "Ranking the best ice moments.",
      "2026-05-24T19:52:00.000Z",
    ),
    createVideoCaptionSegmentId(
      "page-youtube-watch-1",
      "Ranking the best ice moments.",
      "2026-05-24T19:52:00.500Z",
    ),
  );
});
