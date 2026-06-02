import { ASRProviderError } from "./asr-provider";

/**
 * Phase 8.12 — InnerTube 音频流获取（后端服务端 fetch，非 browser-agent 同源）。
 *
 * 按 videoId 请求 InnerTube `/youtubei/v1/player`（ANDROID client，复用 ADR-0004 v2.8
 * 真机修订经验），从 `streamingData.adaptiveFormats` 选纯音频流（itag=139 优先、`audio/*`
 * mimeType 兜底、明文 url 无需解签名），返回音频流 URL + expire / 时长元信息。
 *
 * 合规：每次按 videoId 重取 player response，不缓存复用过期 URL；后端取 player response 与
 * 后续下载音频流走同一出口 IP（同进程 fetch），规避音频流 URL 的 IP 绑定（expire ~6h）。
 * 含云 IP 反爬重试 + 失败归一为听音不可用错误（不抛未捕获异常、不返回空 URL）。
 */

const INNERTUBE_PLAYER_ENDPOINT =
  "https://www.youtube.com/youtubei/v1/player";

const ANDROID_CLIENT_NAME = "ANDROID";
const DEFAULT_ANDROID_CLIENT_VERSION = "20.10.38";
const DEFAULT_ANDROID_SDK_VERSION = 31;
const PREFERRED_AUDIO_ITAG = 139;

const DEFAULT_MAX_RETRIES = 2;

export interface ResolvedAudioStream {
  videoId: string;
  itag: number;
  url: string;
  mimeType: string;
  /** Unix 秒（来自 URL `expire` query），用于不缓存复用过期 URL 的判定。 */
  expireUnixSeconds?: number;
  contentLengthBytes?: number;
  approxDurationSeconds?: number;
  bitrate?: number;
}

interface AdaptiveFormat {
  itag?: number;
  mimeType?: string;
  url?: string;
  signatureCipher?: string;
  cipher?: string;
  bitrate?: number;
  contentLength?: string;
  approxDurationMs?: string;
}

interface PlayerResponse {
  playabilityStatus?: { status?: string; reason?: string };
  streamingData?: { adaptiveFormats?: AdaptiveFormat[] };
}

/** 可注入 fetch 便于测试 stub（默认走 Node 全局 fetch）。 */
export interface FetchLikeResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  arrayBuffer?(): Promise<ArrayBuffer>;
}

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<FetchLikeResponse>;

export interface YouTubeAudioStreamDependencies {
  fetchImpl?: FetchLike;
  androidClientVersion?: string;
  androidSdkVersion?: number;
  maxRetries?: number;
}

export class AudioStreamUnavailableError extends ASRProviderError {
  constructor(message: string) {
    super("service-unavailable", message);
  }
}

export async function resolveYouTubeAudioStream(
  videoId: string,
  dependencies: YouTubeAudioStreamDependencies = {},
): Promise<ResolvedAudioStream> {
  if (!videoId) {
    throw new AudioStreamUnavailableError(
      "Listening translation requires a videoId to fetch the audio stream.",
    );
  }

  const fetchImpl = dependencies.fetchImpl ?? resolveGlobalFetch();
  const maxRetries = dependencies.maxRetries ?? DEFAULT_MAX_RETRIES;

  const player = await fetchPlayerResponseWithRetry(
    videoId,
    fetchImpl,
    maxRetries,
    dependencies,
  );

  const status = player.playabilityStatus?.status;
  if (status && status !== "OK") {
    throw new AudioStreamUnavailableError(
      `YouTube playability status is not OK (${status}).`,
    );
  }

  const formats = player.streamingData?.adaptiveFormats;
  if (!formats || formats.length === 0) {
    throw new AudioStreamUnavailableError(
      "No adaptiveFormats available for this video.",
    );
  }

  const selected = selectAudioFormat(formats);
  if (!selected || !selected.url) {
    throw new AudioStreamUnavailableError(
      "No plaintext audio stream is available for this video.",
    );
  }

  return {
    videoId,
    itag: selected.itag ?? PREFERRED_AUDIO_ITAG,
    url: selected.url,
    mimeType: selected.mimeType ?? "audio/mp4",
    expireUnixSeconds: parseExpire(selected.url),
    contentLengthBytes: parseIntOrUndefined(selected.contentLength),
    approxDurationSeconds: parseDurationSeconds(selected.approxDurationMs),
    bitrate: selected.bitrate,
  };
}

function selectAudioFormat(
  formats: AdaptiveFormat[],
): AdaptiveFormat | undefined {
  const plaintextAudio = formats.filter(
    (format) =>
      isAudioMime(format.mimeType)
      && typeof format.url === "string"
      && format.url.length > 0
      && !format.signatureCipher
      && !format.cipher,
  );

  if (plaintextAudio.length === 0) {
    return undefined;
  }

  // itag=139 优先（~49kbps 纯音频，体积最小、足够 ASR）。
  const preferred = plaintextAudio.find(
    (format) => format.itag === PREFERRED_AUDIO_ITAG,
  );
  if (preferred) {
    return preferred;
  }

  // 兜底：取码率最低的 audio/* 明文流（省带宽、足够识别）。
  return plaintextAudio.reduce((lowest, current) =>
    (current.bitrate ?? Number.MAX_SAFE_INTEGER)
    < (lowest.bitrate ?? Number.MAX_SAFE_INTEGER)
      ? current
      : lowest,
  );
}

function isAudioMime(mimeType: string | undefined): boolean {
  return typeof mimeType === "string" && mimeType.startsWith("audio");
}

async function fetchPlayerResponseWithRetry(
  videoId: string,
  fetchImpl: FetchLike,
  maxRetries: number,
  dependencies: YouTubeAudioStreamDependencies,
): Promise<PlayerResponse> {
  const body = JSON.stringify({
    context: {
      client: {
        clientName: ANDROID_CLIENT_NAME,
        clientVersion:
          dependencies.androidClientVersion ?? DEFAULT_ANDROID_CLIENT_VERSION,
        androidSdkVersion:
          dependencies.androidSdkVersion ?? DEFAULT_ANDROID_SDK_VERSION,
        hl: "en",
        gl: "US",
      },
    },
    videoId,
  });

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetchImpl(INNERTUBE_PLAYER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "com.google.android.youtube/20.10.38 (Linux; U; Android 12) gzip",
        },
        body,
      });

      // 云 IP 反爬：限流 / 风控多为 429 / 403 / 5xx → 重试；其它非 2xx 直接归一。
      if (!response.ok) {
        if (isRetriableStatus(response.status) && attempt < maxRetries) {
          lastError = new AudioStreamUnavailableError(
            `InnerTube player request failed with status ${response.status}.`,
          );
          continue;
        }
        throw new AudioStreamUnavailableError(
          `InnerTube player request failed with status ${response.status}.`,
        );
      }

      const text = await response.text();
      return parsePlayerResponse(text);
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) {
        break;
      }
    }
  }

  if (lastError instanceof AudioStreamUnavailableError) {
    throw lastError;
  }
  throw new AudioStreamUnavailableError(
    "Failed to reach InnerTube player endpoint for audio stream.",
  );
}

function parsePlayerResponse(text: string): PlayerResponse {
  try {
    return JSON.parse(text) as PlayerResponse;
  } catch {
    throw new AudioStreamUnavailableError(
      "InnerTube player response is not valid JSON.",
    );
  }
}

function isRetriableStatus(status: number): boolean {
  return status === 429 || status === 403 || status >= 500;
}

function parseExpire(url: string): number | undefined {
  try {
    const parsed = new URL(url);
    const expire = parsed.searchParams.get("expire");
    if (!expire) {
      return undefined;
    }
    const value = Number.parseInt(expire, 10);
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function parseIntOrUndefined(value: string | undefined): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDurationSeconds(approxDurationMs: string | undefined): number | undefined {
  const ms = parseIntOrUndefined(approxDurationMs);
  return ms === undefined ? undefined : Math.round(ms / 1000);
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
