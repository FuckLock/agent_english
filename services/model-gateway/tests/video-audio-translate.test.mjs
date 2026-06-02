import test from "node:test";
import assert from "node:assert/strict";

import { createModelCatalog } from "../dist/catalog/model-catalog.js";
import { audioQuotaLimitExceedsFree } from "../dist/quota/audio-minute-quota.js";
import { handleVideoAudioTranslateRoute } from "../dist/routes/video-audio-translate.js";

const entitlement = {
  account: {
    kind: "guest",
    displayName: "游客模式",
    serviceTier: "free",
    isTestAccount: false,
  },
  serviceTier: "free",
  sessionToken: "session-free",
  tokenPresent: true,
};

const baseRequest = {
  pageId: "page-youtube-watch-1",
  url: "https://m.youtube.com/watch?v=LmFME_-3icE",
  title: "Hydrogen Peroxide",
  videoId: "LmFME_-3icE",
  sourceLanguage: "English",
  targetLanguage: "简体中文",
  serviceTier: "free",
  preferredModelId: "free-translate",
  audioSegmentId: "vaud-1",
  audioDurationSeconds: 42,
  captionQuality: "unavailable",
  privacyDisclosureAccepted: true,
};

const mockEnv = {
  port: 4100,
  providers: {
    deepseek: {
      providerID: "deepseek",
      apiKey: "mock-token",
      model: "mock-translate",
      baseURL: "https://model.example/v1",
      timeoutMs: 15000,
    },
  },
  auth: {
    enableDevAuth: true,
    testProPassword: "pro-password",
    testMaxPassword: "max-password",
    isProduction: false,
  },
};

test("free audio quota is ten minutes", () => {
  assert.equal(createModelCatalog("free").audioQuota.limit, 10);
});

test("pro and max audio quotas exceed free", () => {
  assert.equal(audioQuotaLimitExceedsFree("pro"), true);
  assert.equal(audioQuotaLimitExceedsFree("max"), true);
});

test("audio quota reset and abuse protection are enforced", async () => {
  const exhausted = await handleVideoAudioTranslateRoute(baseRequest, 10, {
    entitlement,
  });
  assert.equal(exhausted.statusCode, 429);
  assert.equal(exhausted.body.state.quota.resetAt.length > 0, true);

  const abusive = await handleVideoAudioTranslateRoute(
    { ...baseRequest, audioDurationSeconds: 600 },
    0,
    { entitlement },
  );
  assert.equal(abusive.statusCode, 429);
});

test("rejects missing session token before audio translation", async () => {
  const response = await handleVideoAudioTranslateRoute(baseRequest, 0, {});

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.message, "Model service session is required.");
});

test("returns 429 when free audio quota is exhausted", async () => {
  const response = await handleVideoAudioTranslateRoute(baseRequest, 10, {
    entitlement,
  });

  assert.equal(response.statusCode, 429);
  assert.equal(response.body.error.code, "quota-exceeded");
});

test("ignores request serviceTier when entitlement is lower", async () => {
  const response = await handleVideoAudioTranslateRoute(
    { ...baseRequest, serviceTier: "max", playbackPositionSeconds: 12 },
    0,
    {
      entitlement,
      // Phase 8.12：取流 / 拉片段 stub，避免连真实 YouTube（不在 CI 连网）。
      resolveAudioStream: stubResolveAudioStream,
      fetchAudioSegment: stubFetchAudioSegment,
      asrProvider: new MockASRProvider("Ranking the best ice moments."),
      env: mockEnv,
      transport: new MockTransport({
        completions: [
          JSON.stringify({
            translations: [
              { segmentId: "vaud-1", translatedText: "冰上瞬间排名。" },
            ],
          }),
        ],
      }),
    },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.serviceTier, "free");
  assert.equal(response.body.quota.limitMinutes, 10);
});

test("returns provider-safe audio fallback error", async () => {
  const response = await handleVideoAudioTranslateRoute(baseRequest, 0, {
    entitlement,
    resolveAudioStream: stubResolveAudioStream,
    fetchAudioSegment: stubFetchAudioSegment,
    asrProvider: {
      async recognize() {
        throw new Error("upstream failed");
      },
    },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, "provider-fallback-failed");
  assert.equal(response.body.error.message.includes("route"), false);
});

async function stubResolveAudioStream() {
  return {
    videoId: "LmFME_-3icE",
    itag: 139,
    url: "https://stub.example/audio?expire=9999999999",
    mimeType: 'audio/mp4; codecs="mp4a.40.5"',
    expireUnixSeconds: 9999999999,
    contentLengthBytes: 302957,
    approxDurationSeconds: 49,
    bitrate: 49954,
  };
}

async function stubFetchAudioSegment(_source, playbackPositionSeconds) {
  return {
    wav: Buffer.from("stub-wav-bytes"),
    range: { start: 0, end: 65535 },
    segmentStartSeconds: playbackPositionSeconds ?? 0,
    segmentDurationSeconds: 30,
  };
}

class MockASRProvider {
  constructor(transcript) {
    this.transcript = transcript;
  }

  async recognize() {
    return {
      transcript: this.transcript,
      sourceLanguage: "English",
      startTimeSeconds: 12,
      endTimeSeconds: 17,
    };
  }
}

class MockTransport {
  constructor({ completions = [] } = {}) {
    this.completions = [...completions];
  }

  async complete() {
    return this.completions.shift() ?? JSON.stringify({});
  }
}
