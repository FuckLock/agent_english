import test from "node:test";
import assert from "node:assert/strict";

import {
  computeByteRange,
  fetchAndTranscodeSegment,
} from "../dist/providers/audio-segment-fetcher.js";

const source = {
  url: "https://stub.example/audio",
  contentLengthBytes: 302957,
  approxDurationSeconds: 49,
  bitrate: 49954,
};

test("byte range end grows with playbackPositionSeconds (range decided by progress)", () => {
  const early = computeByteRange(source, 2, 30);
  const later = computeByteRange(source, 40, 30);

  // 从 0 拉以保留 mp4 容器头。
  assert.equal(early.start, 0);
  assert.equal(later.start, 0);
  // 进度越靠后 → end 越大（Range 区间由 playbackPositionSeconds 决定）。
  assert.ok(later.end > early.end);
  // 不超过整轨末尾（不下整轨之后多余字节）。
  assert.ok(later.end <= source.contentLengthBytes - 1);
});

test("fetched segment is pure in-memory buffer (used-and-discarded, no file path)", async () => {
  const fetchCalls = [];
  const fetchImpl = async (url, init) => {
    fetchCalls.push(init.headers.Range);
    return {
      ok: false,
      status: 206,
      async arrayBuffer() {
        return new Uint8Array([1, 2, 3, 4]).buffer;
      },
      async text() {
        return "";
      },
    };
  };

  // stub transcode：避免真实 ffmpeg，断言 start/duration 透传 + 返回内存 buffer。
  let transcodeArgs;
  const transcode = async (input, startSeconds, durationSeconds) => {
    transcodeArgs = { isBuffer: Buffer.isBuffer(input), startSeconds, durationSeconds };
    return Buffer.from("wav-bytes");
  };

  const result = await fetchAndTranscodeSegment(source, 12, {
    fetchImpl,
    transcode,
    segmentSeconds: 30,
  });

  // HTTP Range 请求发出（bytes= 头）。
  assert.equal(fetchCalls.length, 1);
  assert.ok(fetchCalls[0].startsWith("bytes="));
  // 转码输入是内存 buffer，按进度截窗。
  assert.equal(transcodeArgs.isBuffer, true);
  assert.equal(transcodeArgs.startSeconds, 12);
  assert.equal(transcodeArgs.durationSeconds, 30);
  // 返回纯内存 wav buffer，无落盘文件路径。
  assert.ok(Buffer.isBuffer(result.wav));
  assert.equal(typeof result.wav.length, "number");
  assert.equal("path" in result, false);
  assert.equal("filePath" in result, false);
  assert.equal(result.segmentStartSeconds, 12);
});
