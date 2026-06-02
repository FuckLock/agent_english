#!/usr/bin/env node
// Phase 8.12 — 后端听音全链路 e2e（脱离 iOS，连真实 YouTube + 本机 ffmpeg/Whisper）。
//
// 链路：videoId → InnerTube 取流(itag=139) → 按进度 Range 拉片段 + ffmpeg 16kHz wav
//      → 自部署 Whisper 识别英文 + 时间轴 → 翻译（routeTranslation 分层 / 缺 provider 时 mock）
// 断言三要素：英文原句（非空）+ 中文译文（非空且≠英文）+ 时间轴（start/end 存在）。
//
// 缺工具 / 网络失败 → 非零退出（不静默成功）。不进 CI（依赖外部 YouTube + 本机工具）。
//
// 用法：
//   node scripts/listening-backend-e2e/run.mjs [videoId] [playbackPositionSeconds]
// 默认 videoId = 2QtsWjF3e78（v2.11 本机已验证的无字幕 Shorts）。
//
// 环境变量：
//   WHISPER_BIN（默认 whisper-cli）/ WHISPER_MODEL（必填，如 /tmp/ggml-base.en.bin）/ WHISPER_LANGUAGE（默认 en）
//   翻译段：若配齐 model-gateway provider env 则走真实 routeTranslation；否则用 mock 译文跑通链路。

import { spawnSync } from "node:child_process";

const DEFAULT_VIDEO_ID = "2QtsWjF3e78";

function fail(message) {
  console.error(`[e2e] FAIL: ${message}`);
  process.exit(1);
}

function checkTool(bin) {
  const probe = spawnSync(bin, ["-version"], { stdio: "ignore" });
  if (probe.error) {
    const alt = spawnSync(bin, ["--help"], { stdio: "ignore" });
    if (alt.error) {
      fail(`required tool not found on PATH: ${bin}`);
    }
  }
}

async function main() {
  const videoId = process.argv[2] ?? DEFAULT_VIDEO_ID;
  const playbackPositionSeconds = Number.parseInt(process.argv[3] ?? "5", 10);

  console.log(`[e2e] videoId=${videoId} playbackPositionSeconds=${playbackPositionSeconds}`);

  // 1) 工具检查（缺工具直接退出）。
  checkTool("ffmpeg");
  const whisperBin = process.env.WHISPER_BIN ?? "whisper-cli";
  checkTool(whisperBin);
  if (!process.env.WHISPER_MODEL) {
    fail("WHISPER_MODEL env is required (e.g. /tmp/ggml-base.en.bin).");
  }

  // 2) 加载已构建的后端模块（需先 pnpm --filter @agent-english/model-gateway build）。
  let resolveYouTubeAudioStream;
  let fetchAndTranscodeSegment;
  let WhisperASRProvider;
  let routeTranslation;
  try {
    ({ resolveYouTubeAudioStream } = await import(
      "../../services/model-gateway/dist/providers/youtube-audio-stream.js"
    ));
    ({ fetchAndTranscodeSegment } = await import(
      "../../services/model-gateway/dist/providers/audio-segment-fetcher.js"
    ));
    ({ WhisperASRProvider } = await import(
      "../../services/model-gateway/dist/providers/asr-provider.js"
    ));
    ({ routeTranslation } = await import(
      "../../services/model-gateway/dist/providers/provider-router.js"
    ));
  } catch (error) {
    fail(
      `cannot load built model-gateway modules (run "pnpm --filter @agent-english/model-gateway build" first): ${error?.message ?? error}`,
    );
  }

  // 3) 取流（真实 InnerTube；网络失败/反爬 → 抛错退出）。
  let stream;
  try {
    stream = await resolveYouTubeAudioStream(videoId);
  } catch (error) {
    fail(`audio stream resolution failed (network/anti-scraping?): ${error?.message ?? error}`);
  }
  console.log(`[e2e] stream itag=${stream.itag} expire=${stream.expireUnixSeconds} bytes=${stream.contentLengthBytes}`);

  // 4) Range 拉片段 + ffmpeg 转码（真实）。
  let segment;
  try {
    segment = await fetchAndTranscodeSegment(stream, playbackPositionSeconds);
  } catch (error) {
    fail(`range fetch / ffmpeg transcode failed: ${error?.message ?? error}`);
  }
  console.log(`[e2e] wav bytes=${segment.wav.length} range=${segment.range.start}-${segment.range.end}`);

  // 5) Whisper 识别（真实，只产英文 + 时间轴）。
  let transcript;
  try {
    const asr = new WhisperASRProvider();
    transcript = await asr.recognize(
      { videoId, audioSegmentId: "vaud-e2e", playbackPositionSeconds },
      { wav: segment.wav, segmentStartSeconds: segment.segmentStartSeconds },
    );
  } catch (error) {
    fail(`whisper recognition failed: ${error?.message ?? error}`);
  }

  const english = (transcript.transcript ?? "").trim();
  if (english.length === 0) {
    fail("ASR produced empty english transcript.");
  }
  console.log(`[e2e] english: ${english.slice(0, 120)}${english.length > 120 ? "…" : ""}`);

  // 6) 翻译（routeTranslation 分层；缺 provider env 时 mock 译文跑通链路）。
  let chinese;
  const routed = await routeTranslation(
    {
      pageId: "page-e2e",
      sourceLanguage: transcript.sourceLanguage,
      targetLanguage: "简体中文",
      serviceTier: "free",
      preferredModelId: "free-translate",
      segments: [{ segmentId: "vaud-e2e", sourceText: english }],
    },
    0,
  ).catch(() => ({ ok: false }));

  if (routed.ok && routed.response.segmentResults[0]?.translatedText) {
    chinese = routed.response.segmentResults[0].translatedText;
    console.log("[e2e] translation via routeTranslation (real provider).");
  } else {
    chinese = `【模拟译文】${english}`;
    console.log("[e2e] WARN: no model-gateway provider env configured → using mock translation.");
  }

  // 7) 三要素断言。
  if (!chinese || chinese.trim().length === 0) {
    fail("chinese translation is empty.");
  }
  if (chinese === english) {
    fail("chinese translation equals english (not translated).");
  }
  if (
    typeof transcript.startTimeSeconds !== "number"
    || transcript.endTimeSeconds === undefined
  ) {
    fail(`timeline missing: start=${transcript.startTimeSeconds} end=${transcript.endTimeSeconds}`);
  }

  console.log(`[e2e] chinese: ${chinese.slice(0, 120)}`);
  console.log(`[e2e] timeline: ${transcript.startTimeSeconds}s - ${transcript.endTimeSeconds}s`);
  console.log("[e2e] PASS: english + chinese + timeline all present.");
}

main().catch((error) => {
  fail(`unexpected error: ${error?.stack ?? error}`);
});
