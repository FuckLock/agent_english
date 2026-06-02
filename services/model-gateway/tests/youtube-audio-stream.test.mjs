import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveYouTubeAudioStream,
  AudioStreamUnavailableError,
} from "../dist/providers/youtube-audio-stream.js";

function makeFetch(payloadOrStatuses) {
  // payloadOrStatuses: object → 单次成功 JSON；array → 逐次返回 { status, body }
  const queue = Array.isArray(payloadOrStatuses)
    ? [...payloadOrStatuses]
    : null;
  const calls = [];

  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (queue) {
      const next = queue.shift() ?? { status: 500, body: "" };
      return {
        ok: next.status >= 200 && next.status < 300,
        status: next.status,
        async text() {
          return typeof next.body === "string"
            ? next.body
            : JSON.stringify(next.body);
        },
      };
    }
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify(payloadOrStatuses);
      },
    };
  };

  fetchImpl.calls = calls;
  return fetchImpl;
}

const itag139Url =
  "https://rr3.googlevideo.com/videoplayback?expire=1780384158&itag=139&mime=audio%2Fmp4";

function playerWith(formats, status = "OK") {
  return {
    playabilityStatus: { status },
    streamingData: { adaptiveFormats: formats },
  };
}

test("selects itag=139 plaintext audio stream among many formats", async () => {
  const fetchImpl = makeFetch(
    playerWith([
      { itag: 137, mimeType: 'video/mp4; codecs="avc1"', url: "https://v/137", bitrate: 2000000 },
      { itag: 140, mimeType: 'audio/mp4; codecs="mp4a.40.2"', url: "https://a/140", bitrate: 130000 },
      {
        itag: 139,
        mimeType: 'audio/mp4; codecs="mp4a.40.5"',
        url: itag139Url,
        bitrate: 49954,
        contentLength: "302957",
        approxDurationMs: "49412",
      },
    ]),
  );

  const resolved = await resolveYouTubeAudioStream("2QtsWjF3e78", { fetchImpl });

  assert.equal(resolved.itag, 139);
  assert.equal(resolved.url, itag139Url);
  assert.equal(resolved.mimeType.startsWith("audio"), true);
  assert.equal(resolved.contentLengthBytes, 302957);
  assert.equal(resolved.approxDurationSeconds, 49);
  assert.equal(resolved.bitrate, 49954);
  // 请求体走 ANDROID client。
  assert.equal(fetchImpl.calls[0].init.method, "POST");
  assert.equal(fetchImpl.calls[0].init.body.includes("ANDROID"), true);
});

test("falls back to lowest-bitrate audio/* when itag=139 is absent", async () => {
  const fetchImpl = makeFetch(
    playerWith([
      { itag: 140, mimeType: 'audio/mp4; codecs="mp4a.40.2"', url: "https://a/140", bitrate: 130000 },
      { itag: 251, mimeType: 'audio/webm; codecs="opus"', url: "https://a/251", bitrate: 95000 },
    ]),
  );

  const resolved = await resolveYouTubeAudioStream("vid", { fetchImpl });

  assert.equal(resolved.itag, 251);
  assert.equal(resolved.url, "https://a/251");
  assert.equal(resolved.mimeType.startsWith("audio"), true);
});

test("parses expire from the stream url", async () => {
  const fetchImpl = makeFetch(
    playerWith([
      {
        itag: 139,
        mimeType: "audio/mp4",
        url: itag139Url,
        bitrate: 49954,
      },
    ]),
  );

  const resolved = await resolveYouTubeAudioStream("vid", { fetchImpl });
  assert.equal(resolved.expireUnixSeconds, 1780384158);
});

test("skips ciphered formats and normalizes when no plaintext audio", async () => {
  const fetchImpl = makeFetch(
    playerWith([
      {
        itag: 139,
        mimeType: "audio/mp4",
        signatureCipher: "s=abc&url=https://a/139",
        bitrate: 49954,
      },
    ]),
  );

  await assert.rejects(
    () => resolveYouTubeAudioStream("vid", { fetchImpl }),
    (error) => {
      assert.ok(error instanceof AudioStreamUnavailableError);
      assert.equal(error.code, "service-unavailable");
      return true;
    },
  );
});

test("normalizes when adaptiveFormats is missing", async () => {
  const fetchImpl = makeFetch({ playabilityStatus: { status: "OK" }, streamingData: {} });

  await assert.rejects(
    () => resolveYouTubeAudioStream("vid", { fetchImpl }),
    (error) => error instanceof AudioStreamUnavailableError,
  );
});

test("normalizes when playability status is not OK", async () => {
  const fetchImpl = makeFetch(
    playerWith([], "LOGIN_REQUIRED"),
  );

  await assert.rejects(
    () => resolveYouTubeAudioStream("vid", { fetchImpl }),
    (error) => error instanceof AudioStreamUnavailableError,
  );
});

test("retries on anti-scraping status then succeeds, finally normalizes", async () => {
  // 第一次 429（反爬限流）→ 重试 → 第二次成功。
  const fetchImpl = makeFetch([
    { status: 429, body: "" },
    {
      status: 200,
      body: playerWith([
        { itag: 139, mimeType: "audio/mp4", url: itag139Url, bitrate: 49954 },
      ]),
    },
  ]);

  const resolved = await resolveYouTubeAudioStream("vid", { fetchImpl, maxRetries: 2 });
  assert.equal(resolved.itag, 139);
  assert.equal(fetchImpl.calls.length, 2);
});

test("normalizes when anti-scraping persists past retries (no uncaught, no empty url)", async () => {
  const fetchImpl = makeFetch([
    { status: 403, body: "" },
    { status: 403, body: "" },
    { status: 403, body: "" },
  ]);

  await assert.rejects(
    () => resolveYouTubeAudioStream("vid", { fetchImpl, maxRetries: 2 }),
    (error) => {
      assert.ok(error instanceof AudioStreamUnavailableError);
      return true;
    },
  );
});

test("requires a videoId", async () => {
  await assert.rejects(
    () => resolveYouTubeAudioStream(""),
    (error) => error instanceof AudioStreamUnavailableError,
  );
});
