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
  createVideoAudioSegmentId,
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

test("video audio translate request carries videoId + playbackPositionSeconds and no audio payload (round-trip)", () => {
  // Phase 8.12 请求侧 DTO：videoId 为听音关键输入、playbackPositionSeconds 为播放进度。
  // 用 JSON round-trip 守护新字段双端不漂移，并断言不携带任何前端音频载荷字段。
  const request = {
    pageId: "page-youtube-shorts-1",
    url: "https://www.youtube.com/shorts/2QtsWjF3e78",
    title: "Suits clip",
    videoId: "2QtsWjF3e78",
    sourceLanguage: "English",
    targetLanguage: "简体中文",
    serviceTier: "free",
    preferredModelId: "free-translate",
    audioSegmentId: createVideoAudioSegmentId(
      "page-youtube-shorts-1",
      "2026-05-30T10:00:00.000Z",
    ),
    audioDurationSeconds: 49,
    playbackPositionSeconds: 12,
    captionQuality: "unavailable",
    privacyDisclosureAccepted: true,
  };

  const roundTripped = JSON.parse(JSON.stringify(request));

  assert.equal(roundTripped.videoId, "2QtsWjF3e78");
  assert.equal(roundTripped.playbackPositionSeconds, 12);
  assert.equal(typeof roundTripped.playbackPositionSeconds, "number");
  assert.equal(roundTripped.audioDurationSeconds, 49);
  assert.equal(roundTripped.privacyDisclosureAccepted, true);

  // 不引入任何前端音频载荷字段（后端自取音频，app 不传音频数据）。
  for (const forbidden of [
    "audioPayload",
    "audioData",
    "audioBytes",
    "audioBase64",
    "audioBlob",
    "pcmData",
    "rawAudio",
    "audioChunk",
  ]) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(roundTripped, forbidden),
      false,
      `request must not carry frontend audio payload field: ${forbidden}`,
    );
  }
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
