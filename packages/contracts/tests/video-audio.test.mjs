import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  VIDEO_AUDIO_QUOTA_CHANGED_EVENT_TYPE,
  VIDEO_AUDIO_STATE_CHANGED_EVENT_TYPE,
  audioQuotaLimitForTier,
  createAudioQuotaState,
  createBridgeEvent,
  schemaVersion,
} from "../dist/index.js";

const fixturePath = path.resolve(
  import.meta.dirname,
  "fixtures/video-audio-youtube-watch.json",
);

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

test("video audio fixture preserves YouTube audio translation fields", () => {
  assert.equal(fixture.schemaVersion, schemaVersion);
  assert.equal(fixture.eventType, VIDEO_AUDIO_STATE_CHANGED_EVENT_TYPE);
  assert.equal(fixture.payload.activeSegment.audioSegmentId, "vaud-1");
  assert.equal(fixture.payload.quota.remainingMinutes, 7);
  assert.equal(fixture.payload.quota.resetAt, "2026-05-25T00:00:00.000Z");
});

test("video audio state can be wrapped in a bridge event", () => {
  const event = createBridgeEvent(
    VIDEO_AUDIO_STATE_CHANGED_EVENT_TYPE,
    fixture.payload,
    {
      requestId: fixture.requestId,
      pageId: fixture.pageId,
    },
  );

  assert.equal(event.eventType, VIDEO_AUDIO_STATE_CHANGED_EVENT_TYPE);
  assert.equal(event.payload.activeSegment.audioSegmentId, "vaud-1");
});

test("audio quota can be wrapped in a bridge event", () => {
  const quota = createAudioQuotaState("free", 3, "2026-05-25T00:00:00.000Z");
  const event = createBridgeEvent(VIDEO_AUDIO_QUOTA_CHANGED_EVENT_TYPE, {
    serviceTier: "free",
    status: quota.status,
    usedMinutes: quota.used,
    limitMinutes: quota.limit,
    remainingMinutes: quota.remaining,
    resetAt: quota.resetAt,
  });

  assert.equal(event.eventType, VIDEO_AUDIO_QUOTA_CHANGED_EVENT_TYPE);
  assert.equal(event.payload.remainingMinutes, 7);
  assert.equal(audioQuotaLimitForTier("pro") > audioQuotaLimitForTier("free"), true);
});
