import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  ModelServiceErrorCode,
  VideoAudioTranslateRequest,
} from "@agent-english/contracts";

export interface ASRRecognitionResult {
  transcript: string;
  sourceLanguage: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
}

/**
 * 转码后的音频输入（Phase 8.12）：route 先取流 + Range 拉片段 + ffmpeg 转 16kHz wav，
 * 再把 wav buffer 与片段起点交给 ASR provider。ASR 只产英文文字，不做翻译。
 */
export interface ASRAudioInput {
  wav: Buffer;
  /** 片段相对整轨的起点（秒），用于把识别时间轴回填为绝对时间。 */
  segmentStartSeconds?: number;
}

export interface ASRProvider {
  recognize(
    request: VideoAudioTranslateRequest,
    audio?: ASRAudioInput,
  ): Promise<ASRRecognitionResult>;
}

export class UnavailableASRProvider implements ASRProvider {
  async recognize(): Promise<ASRRecognitionResult> {
    throw new ASRProviderError("service-unavailable", "ASR service is unavailable.");
  }
}

/**
 * 自部署 Whisper（whisper.cpp `whisper-cli`）ASR provider（Phase 8.12）。
 *
 * 只做「英文语音 → 英文文字 + 时间轴」，**不翻译、不产中文、不调任何翻译厂商**；翻译由 route
 * 层的翻译路由分层完成（识别与翻译解耦）。二进制 / 模型 / 档位 / 语言仅来自后端环境变量
 * （WHISPER_BIN / WHISPER_MODEL / WHISPER_LANGUAGE / ASR_TRANSCODE_TIMEOUT_MS），不进客户端。
 */
export class WhisperASRProvider implements ASRProvider {
  private readonly bin: string;
  private readonly modelPath: string;
  private readonly language: string;
  private readonly timeoutMs: number;

  constructor(config: Partial<WhisperASRConfig> = {}) {
    const resolved = resolveWhisperConfig(config);
    this.bin = resolved.bin;
    this.modelPath = resolved.modelPath;
    this.language = resolved.language;
    this.timeoutMs = resolved.timeoutMs;
  }

  async recognize(
    request: VideoAudioTranslateRequest,
    audio?: ASRAudioInput,
  ): Promise<ASRRecognitionResult> {
    if (!audio || audio.wav.length === 0) {
      throw new ASRProviderError(
        "service-unavailable",
        "Whisper ASR requires transcoded audio input.",
      );
    }

    const workDir = await mkdtemp(join(tmpdir(), "ae-asr-"));
    const wavPath = join(workDir, "segment.wav");
    try {
      await writeFile(wavPath, audio.wav);
      const json = await this.runWhisper(wavPath);
      const segmentStart = audio.segmentStartSeconds ?? 0;
      return parseWhisperOutput(json, this.language, segmentStart);
    } catch (error) {
      if (error instanceof ASRProviderError) {
        throw error;
      }
      throw new ASRProviderError(
        "service-unavailable",
        `Whisper recognition failed: ${describeError(error)}`,
      );
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private runWhisper(wavPath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const child = spawn(
        this.bin,
        [
          "-m",
          this.modelPath,
          "-f",
          wavPath,
          "-l",
          this.language,
          "--output-json",
          "--output-file",
          wavPath,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      const errChunks: Buffer[] = [];
      child.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(
          new ASRProviderError(
            "service-unavailable",
            "Whisper recognition timed out.",
          ),
        );
      }, this.timeoutMs);

      child.on("error", (error: Error) => {
        clearTimeout(timer);
        reject(
          new ASRProviderError(
            "service-unavailable",
            `Failed to spawn whisper-cli: ${error.message}`,
          ),
        );
      });

      child.on("close", async (code: number | null) => {
        clearTimeout(timer);
        if (code !== 0) {
          const stderr = Buffer.concat(errChunks).toString("utf8").slice(0, 300);
          reject(
            new ASRProviderError(
              "service-unavailable",
              `whisper-cli exited with code ${code ?? "unknown"}: ${stderr}`,
            ),
          );
          return;
        }
        try {
          const { readFile } = await import("node:fs/promises");
          const json = await readFile(`${wavPath}.json`, "utf8");
          resolve(json);
        } catch (readError) {
          reject(
            new ASRProviderError(
              "service-unavailable",
              `Failed to read whisper output: ${describeError(readError)}`,
            ),
          );
        }
      });
    });
  }
}

export interface WhisperASRConfig {
  bin: string;
  modelPath: string;
  language: string;
  timeoutMs: number;
}

function resolveWhisperConfig(
  overrides: Partial<WhisperASRConfig>,
): WhisperASRConfig {
  const bin = overrides.bin ?? process.env.WHISPER_BIN ?? "whisper-cli";
  const modelPath = overrides.modelPath ?? process.env.WHISPER_MODEL ?? "";
  const language =
    overrides.language ?? process.env.WHISPER_LANGUAGE ?? "en";
  const timeoutMs = overrides.timeoutMs ?? parseTimeoutMs();

  if (!modelPath) {
    throw new ASRProviderError(
      "service-unavailable",
      "WHISPER_MODEL is not configured for the ASR provider.",
    );
  }

  return { bin, modelPath, language, timeoutMs };
}

function parseTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.ASR_TRANSCODE_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60000;
}

interface WhisperJsonToken {
  offsets?: { from?: number; to?: number };
  text?: string;
}

interface WhisperJsonSegment {
  text?: string;
  offsets?: { from?: number; to?: number };
  tokens?: WhisperJsonToken[];
}

interface WhisperJson {
  transcription?: WhisperJsonSegment[];
}

function parseWhisperOutput(
  rawJson: string,
  language: string,
  segmentStartSeconds: number,
): ASRRecognitionResult {
  let parsed: WhisperJson;
  try {
    parsed = JSON.parse(rawJson) as WhisperJson;
  } catch {
    throw new ASRProviderError(
      "service-unavailable",
      "Whisper output is not valid JSON.",
    );
  }

  const segments = parsed.transcription ?? [];
  const transcript = segments
    .map((segment) => (segment.text ?? "").trim())
    .filter((text) => text.length > 0)
    .join(" ")
    .trim();

  if (transcript.length === 0) {
    throw new ASRProviderError(
      "service-unavailable",
      "Whisper produced an empty transcript.",
    );
  }

  // whisper.cpp offsets 单位为毫秒（相对片段起点）→ 转绝对秒。
  const firstFrom = segments[0]?.offsets?.from;
  const lastTo = segments[segments.length - 1]?.offsets?.to;

  const startTimeSeconds =
    typeof firstFrom === "number"
      ? segmentStartSeconds + firstFrom / 1000
      : segmentStartSeconds;
  const endTimeSeconds =
    typeof lastTo === "number" ? segmentStartSeconds + lastTo / 1000 : undefined;

  return {
    transcript,
    sourceLanguage: language === "en" ? "English" : language,
    startTimeSeconds,
    endTimeSeconds,
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export class ASRProviderError extends Error {
  constructor(
    readonly code: ModelServiceErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function normalizeASRProviderFailure(error: unknown): ModelServiceErrorCode {
  if (error instanceof ASRProviderError) {
    return error.code;
  }

  return "provider-fallback-failed";
}

export function mapASRFallbackError(error: unknown): {
  code: ModelServiceErrorCode;
  message: string;
} {
  return {
    code: normalizeASRProviderFailure(error),
    message: "Audio translation is unavailable right now.",
  };
}
