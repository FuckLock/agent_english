import test from "node:test";
import assert from "node:assert/strict";

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

const proEntitlement = {
  account: {
    kind: "test",
    displayName: "Pro",
    serviceTier: "pro",
    isTestAccount: true,
  },
  serviceTier: "pro",
  sessionToken: "session-pro",
  tokenPresent: true,
};

const baseRequest = {
  pageId: "page-youtube-shorts-1",
  url: "https://www.youtube.com/shorts/2QtsWjF3e78",
  title: "Suits clip",
  videoId: "2QtsWjF3e78",
  sourceLanguage: "English",
  targetLanguage: "简体中文",
  serviceTier: "free",
  preferredModelId: "free-translate",
  audioSegmentId: "vaud-1",
  audioDurationSeconds: 49,
  playbackPositionSeconds: 12,
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
    openai: {
      providerID: "openai",
      apiKey: "mock-token",
      model: "mock-pro",
      baseURL: "https://model.example/v1",
      timeoutMs: 15000,
    },
    anthropic: {
      providerID: "anthropic",
      apiKey: "mock-token",
      model: "mock-max",
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

function makeStreamStub() {
  const stub = {
    calls: 0,
    async resolve() {
      stub.calls += 1;
      return {
        videoId: "2QtsWjF3e78",
        itag: 139,
        url: "https://stub.example/audio?expire=9999999999",
        mimeType: 'audio/mp4; codecs="mp4a.40.5"',
        expireUnixSeconds: 9999999999,
        contentLengthBytes: 302957,
        approxDurationSeconds: 49,
        bitrate: 49954,
      };
    },
  };
  return stub;
}

function makeSegmentStub() {
  const stub = {
    calls: 0,
    async fetch(_source, playbackPositionSeconds) {
      stub.calls += 1;
      return {
        wav: Buffer.from("stub-wav-bytes"),
        range: { start: 0, end: 65535 },
        segmentStartSeconds: playbackPositionSeconds ?? 0,
        segmentDurationSeconds: 30,
      };
    },
  };
  return stub;
}

function makeWhisperStub({ transcript, startTimeSeconds, endTimeSeconds, throws } = {}) {
  const stub = {
    calls: 0,
    lastAudio: undefined,
    async recognize(_request, audio) {
      stub.calls += 1;
      stub.lastAudio = audio;
      if (throws) {
        throw new Error("whisper crashed");
      }
      return {
        transcript: transcript ?? "The last thing I want to do is sleep with your sister.",
        sourceLanguage: "English",
        startTimeSeconds: startTimeSeconds ?? 12,
        endTimeSeconds: endTimeSeconds ?? 17,
      };
    },
  };
  return stub;
}

class MockTransport {
  constructor(translations) {
    this.translations = translations;
  }

  async complete() {
    return JSON.stringify({ translations: this.translations });
  }
}

function deps({ stream, segment, whisper, env, transport, entitlement: ent } = {}) {
  return {
    entitlement: ent ?? entitlement,
    resolveAudioStream: stream ? stream.resolve : undefined,
    fetchAudioSegment: segment ? segment.fetch : undefined,
    asrProvider: whisper,
    env: env ?? mockEnv,
    transport,
  };
}

// (a) 正常路径：取流 stub + Whisper stub（英文 + 时间轴）→ 200 含英文 + 中文 + 时间轴。
test("(a) happy path produces english + chinese + timeline", async () => {
  const stream = makeStreamStub();
  const segment = makeSegmentStub();
  const whisper = makeWhisperStub({});
  const transport = new MockTransport([
    { segmentId: "vaud-1", translatedText: "我最不想做的就是和你妹妹上床。" },
  ]);

  const response = await handleVideoAudioTranslateRoute(
    baseRequest,
    0,
    deps({ stream, segment, whisper, transport }),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(stream.calls, 1);
  assert.equal(segment.calls, 1);
  assert.equal(whisper.calls, 1);
  // ASR 收到转码后的 wav buffer（后端自取音频，非前端载荷）。
  assert.ok(Buffer.isBuffer(whisper.lastAudio.wav));
  assert.equal(whisper.lastAudio.segmentStartSeconds, 12);

  const seg = response.body.segment;
  assert.equal(seg.sourceText, "The last thing I want to do is sleep with your sister.");
  assert.equal(seg.translatedText, "我最不想做的就是和你妹妹上床。");
  assert.notEqual(seg.translatedText, seg.sourceText);
  assert.equal(seg.startTimeSeconds, 12);
  assert.equal(seg.endTimeSeconds, 17);
});

// J1：去掉 routeTranslation 桩（transport 不产译文）→ 无中文，只有英文。
test("(J1) without translation transport there is no chinese (asr is english-only)", async () => {
  const stream = makeStreamStub();
  const segment = makeSegmentStub();
  const whisper = makeWhisperStub({});
  // transport 返回空 translations → 译文 undefined（证明中文只来自 routeTranslation）。
  const transport = new MockTransport([]);

  const response = await handleVideoAudioTranslateRoute(
    baseRequest,
    0,
    deps({ stream, segment, whisper, transport }),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.segment.sourceText.length > 0, true);
  assert.equal(response.body.segment.translatedText, undefined);
});

// J2：相同英文下传不同 preferredModelId → 响应 model 字段随之变化（透传翻译路由）。
test("(J2) preferredModelId is passed through to translation routing", async () => {
  const stream = makeStreamStub();
  const segment = makeSegmentStub();
  const whisper = makeWhisperStub({});
  const transport = new MockTransport([
    { segmentId: "vaud-1", translatedText: "译文" },
  ]);

  const free = await handleVideoAudioTranslateRoute(
    { ...baseRequest, preferredModelId: "free-translate" },
    0,
    deps({ stream: makeStreamStub(), segment: makeSegmentStub(), whisper: makeWhisperStub({}), transport: new MockTransport([{ segmentId: "vaud-1", translatedText: "译文" }]) }),
  );

  const pro = await handleVideoAudioTranslateRoute(
    { ...baseRequest, preferredModelId: "pro-context" },
    0,
    deps({
      stream,
      segment,
      whisper,
      transport,
      entitlement: proEntitlement,
    }),
  );

  assert.equal(free.statusCode, 200);
  assert.equal(pro.statusCode, 200);
  assert.equal(free.body.model.id, "free-translate");
  assert.equal(pro.body.model.id, "pro-context");
  assert.notEqual(free.body.model.id, pro.body.model.id);
});

// (b) 字幕优先：captionText + available + 非手动 → 409 caption-primary，取流/Whisper 未被调用。
test("(b) caption-primary short-circuits before stream/ASR", async () => {
  const stream = makeStreamStub();
  const segment = makeSegmentStub();
  const whisper = makeWhisperStub({});

  const response = await handleVideoAudioTranslateRoute(
    {
      ...baseRequest,
      captionText: "Hello world",
      captionQuality: "available",
      manualAudioSelection: false,
    },
    0,
    deps({ stream, segment, whisper, transport: new MockTransport([]) }),
  );

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.state.failureReason, "caption-primary");
  assert.equal(stream.calls, 0);
  assert.equal(segment.calls, 0);
  assert.equal(whisper.calls, 0);
});

// (c) 额度用完：usedAudioMinutes 达上限 → 429 quota-exhausted，未进入 ASR。
test("(c) quota exhausted returns 429 without ASR", async () => {
  const stream = makeStreamStub();
  const segment = makeSegmentStub();
  const whisper = makeWhisperStub({});

  const response = await handleVideoAudioTranslateRoute(
    baseRequest,
    10,
    deps({ stream, segment, whisper, transport: new MockTransport([]) }),
  );

  assert.equal(response.statusCode, 429);
  assert.equal(response.body.error.code, "quota-exceeded");
  assert.equal(stream.calls, 0);
  assert.equal(whisper.calls, 0);
});

// (d) ASR 失败：Whisper 抛错 → 503 asr-failed（经 mapASRFallbackError）。
test("(d) whisper failure maps to asr-failed/503", async () => {
  const stream = makeStreamStub();
  const segment = makeSegmentStub();
  const whisper = makeWhisperStub({ throws: true });

  const response = await handleVideoAudioTranslateRoute(
    baseRequest,
    0,
    deps({ stream, segment, whisper, transport: new MockTransport([]) }),
  );

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.state.failureReason, "asr-failed");
  assert.equal(response.body.error.code, "provider-fallback-failed");
});

// (e) 取流失败：stub 取流归一为听音不可用 → 归一错误，不 500、不未捕获。
test("(e) stream resolution failure is normalized (no 500, no uncaught)", async () => {
  const failingStream = {
    async resolve() {
      // 模拟取流模块归一抛出的 service-unavailable。
      const error = new Error("No plaintext audio stream is available.");
      error.code = "service-unavailable";
      throw error;
    },
  };
  const segment = makeSegmentStub();
  const whisper = makeWhisperStub({});

  const response = await handleVideoAudioTranslateRoute(
    baseRequest,
    0,
    {
      entitlement,
      resolveAudioStream: failingStream.resolve,
      fetchAudioSegment: segment.fetch,
      asrProvider: whisper,
      env: mockEnv,
      transport: new MockTransport([]),
    },
  );

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.state.failureReason, "asr-failed");
  // Whisper 未被调用（取流先失败）。
  assert.equal(whisper.calls, 0);
});

// Q1：缺 session token → 401。
test("(Q1) missing session token returns 401", async () => {
  const response = await handleVideoAudioTranslateRoute(baseRequest, 0, {});
  assert.equal(response.statusCode, 401);
});

// Q2：伪报 serviceTier=max 但 entitlement=free → 额度按 free（10 分钟），不越权。
test("(Q2) spoofed serviceTier cannot escalate quota", async () => {
  const stream = makeStreamStub();
  const segment = makeSegmentStub();
  const whisper = makeWhisperStub({});
  const transport = new MockTransport([
    { segmentId: "vaud-1", translatedText: "译文" },
  ]);

  const response = await handleVideoAudioTranslateRoute(
    { ...baseRequest, serviceTier: "max" },
    0,
    deps({ stream, segment, whisper, transport }),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.serviceTier, "free");
  assert.equal(response.body.quota.limitMinutes, 10);
});

// R1：隐私未接受 → 400 privacy-required。
test("(R1) privacy not accepted returns 400 privacy-required", async () => {
  const stream = makeStreamStub();
  const segment = makeSegmentStub();
  const whisper = makeWhisperStub({});

  const response = await handleVideoAudioTranslateRoute(
    { ...baseRequest, privacyDisclosureAccepted: false },
    0,
    deps({ stream, segment, whisper, transport: new MockTransport([]) }),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, "privacy-disclosure-required");
  assert.equal(stream.calls, 0);
});
