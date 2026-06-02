import { spawn } from "node:child_process";

import { AudioStreamUnavailableError, type FetchLike } from "./youtube-audio-stream";

/**
 * Phase 8.12 — 按播放进度拉音频流片段 + ffmpeg 转 16kHz 单声道 wav。
 *
 * 合规（ADR-0004 v2.11）：用完即弃——**纯内存 buffer / pipe，不落盘**（不持久化整轨、
 * 不缓存、不写学习数据）。只按 `playbackPositionSeconds` 计算 HTTP Range 区间拉当前片段
 * （不下整轨），ffmpeg 经 stdin/stdout 管道转码，wav buffer 用完即由 GC 回收。
 */

const DEFAULT_SEGMENT_SECONDS = 30;
const ABUSE_PROTECTION_MAX_SEGMENT_SECONDS = 90;
const DEFAULT_FFMPEG_BIN = "ffmpeg";
const TARGET_SAMPLE_RATE = 16000;
const TARGET_CHANNELS = 1;

export interface AudioSegmentByteRange {
  start: number;
  end: number;
}

export interface FetchedAudioSegment {
  /** 转码后的 16kHz 单声道 wav 数据（纯内存，不落盘）。 */
  wav: Buffer;
  range: AudioSegmentByteRange;
  segmentStartSeconds: number;
  segmentDurationSeconds: number;
}

export interface AudioStreamSource {
  url: string;
  contentLengthBytes?: number;
  approxDurationSeconds?: number;
  /** bits per second（来自 adaptiveFormats.bitrate）。 */
  bitrate?: number;
}

/**
 * ffmpeg 转码注入点：默认 spawn 系统 ffmpeg，测试可 stub。
 * startSeconds / durationSeconds 用于在解码端按进度截取目标窗口（-ss / -t）。
 */
export type TranscodeToWav = (
  input: Buffer,
  startSeconds: number,
  durationSeconds: number,
) => Promise<Buffer>;

export interface AudioSegmentFetcherDependencies {
  fetchImpl?: FetchLike;
  transcode?: TranscodeToWav;
  ffmpegBin?: string;
  segmentSeconds?: number;
}

export async function fetchAndTranscodeSegment(
  source: AudioStreamSource,
  playbackPositionSeconds: number,
  dependencies: AudioSegmentFetcherDependencies = {},
): Promise<FetchedAudioSegment> {
  const fetchImpl = dependencies.fetchImpl ?? resolveGlobalFetch();
  const segmentSeconds = clampSegmentSeconds(
    dependencies.segmentSeconds ?? DEFAULT_SEGMENT_SECONDS,
  );

  const segmentStartSeconds = Math.max(0, playbackPositionSeconds);
  const range = computeByteRange(source, segmentStartSeconds, segmentSeconds);

  const partial = await fetchRange(fetchImpl, source.url, range);

  // mp4 容器需要文件头（ftyp/moov atom）才能解码：Range 从 0 拉到「覆盖目标进度」的字节
  // （含头、不拉整轨末尾），在解码端用 ffmpeg -ss/-t 截取目标窗口（按进度拉当前片段）。
  const transcode = dependencies.transcode
    ?? createFfmpegTranscoder(dependencies.ffmpegBin ?? DEFAULT_FFMPEG_BIN);
  const wav = await transcode(partial, segmentStartSeconds, segmentSeconds);

  if (!wav || wav.length === 0) {
    throw new AudioStreamUnavailableError(
      "Audio segment transcoding produced no output.",
    );
  }

  return {
    wav,
    range,
    segmentStartSeconds,
    segmentDurationSeconds: segmentSeconds,
  };
}

export function computeByteRange(
  source: AudioStreamSource,
  segmentStartSeconds: number,
  segmentSeconds: number,
): AudioSegmentByteRange {
  const bytesPerSecond = estimateBytesPerSecond(source);
  const totalBytes = source.contentLengthBytes;

  // 从 0 拉以保留 mp4 容器头；end 覆盖到目标进度 + 窗口（含少量余量便于解码）。
  // end 随 playbackPositionSeconds 增大而增大（Range 区间由播放进度决定），
  // 但不拉整轨之后的多余字节（进度越靠后才拉得越多，仍是「当前片段所需」）。
  const start = 0;
  const padBytes = Math.ceil(bytesPerSecond * 1);
  let end = Math.ceil((segmentStartSeconds + segmentSeconds) * bytesPerSecond) + padBytes;

  if (typeof totalBytes === "number" && totalBytes > 0) {
    const maxIndex = totalBytes - 1;
    end = Math.min(end, maxIndex);
  }

  if (end <= start) {
    end = start + Math.ceil(segmentSeconds * bytesPerSecond) + padBytes;
  }

  return { start, end };
}

function estimateBytesPerSecond(source: AudioStreamSource): number {
  if (typeof source.bitrate === "number" && source.bitrate > 0) {
    return source.bitrate / 8;
  }
  if (
    typeof source.contentLengthBytes === "number"
    && typeof source.approxDurationSeconds === "number"
    && source.approxDurationSeconds > 0
  ) {
    return source.contentLengthBytes / source.approxDurationSeconds;
  }
  // 兜底：按 itag=139 的 ~49kbps 估算（~6.1 KB/s）。
  return 6250;
}

async function fetchRange(
  fetchImpl: FetchLike,
  url: string,
  range: AudioSegmentByteRange,
): Promise<Buffer> {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { Range: `bytes=${range.start}-${range.end}` },
    });
  } catch {
    throw new AudioStreamUnavailableError(
      "Failed to fetch the audio stream segment.",
    );
  }

  // 206 Partial Content 预期；部分 CDN 对小文件回 200 整段，也接受。
  if (!response.ok && response.status !== 206) {
    throw new AudioStreamUnavailableError(
      `Audio stream segment request failed with status ${response.status}.`,
    );
  }

  return readBodyToBuffer(response);
}

async function readBodyToBuffer(response: {
  arrayBuffer?: () => Promise<ArrayBuffer>;
  text(): Promise<string>;
}): Promise<Buffer> {
  if (typeof response.arrayBuffer === "function") {
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  }
  const text = await response.text();
  return Buffer.from(text, "binary");
}

/**
 * 纯内存 ffmpeg 管道转码：mp4 片段写 stdin → 16kHz 单声道 wav 从 stdout 收。
 * 不落盘、不写临时文件 → 用完即弃由「根本不落盘」天然保证（P1 (b) 分支）。
 */
function createFfmpegTranscoder(ffmpegBin: string): TranscodeToWav {
  return (input: Buffer, startSeconds: number, durationSeconds: number) =>
    new Promise<Buffer>((resolve, reject) => {
      const args = [
        "-nostdin",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
      ];
      // 解码端按进度截取目标窗口（-ss 在 -i 后为精确 seek、-t 限时长）。
      if (startSeconds > 0) {
        args.push("-ss", startSeconds.toFixed(3));
      }
      if (durationSeconds > 0) {
        args.push("-t", durationSeconds.toFixed(3));
      }
      args.push(
        "-ar",
        String(TARGET_SAMPLE_RATE),
        "-ac",
        String(TARGET_CHANNELS),
        "-f",
        "wav",
        "pipe:1",
      );

      const child = spawn(ffmpegBin, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

      child.on("error", (error: Error) => {
        reject(
          new AudioStreamUnavailableError(
            `Failed to spawn ffmpeg for audio transcoding: ${error.message}`,
          ),
        );
      });

      child.on("close", (code: number | null) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
          return;
        }
        const stderr = Buffer.concat(errChunks).toString("utf8").slice(0, 300);
        reject(
          new AudioStreamUnavailableError(
            `ffmpeg transcoding failed (code ${code ?? "unknown"}): ${stderr}`,
          ),
        );
      });

      child.stdin.on("error", () => {
        // ffmpeg 提前退出可能触发 EPIPE，由 close 分支统一归一。
      });
      child.stdin.write(input);
      child.stdin.end();
    });
}

function clampSegmentSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_SEGMENT_SECONDS;
  }
  return Math.min(seconds, ABUSE_PROTECTION_MAX_SEGMENT_SECONDS);
}

function resolveGlobalFetch(): FetchLike {
  const globalFetch = (globalThis as { fetch?: unknown }).fetch;
  if (typeof globalFetch !== "function") {
    throw new AudioStreamUnavailableError(
      "Global fetch is unavailable in this runtime.",
    );
  }
  return globalFetch as FetchLike;
}
