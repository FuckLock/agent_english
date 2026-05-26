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

export interface ASRProvider {
  recognize(request: VideoAudioTranslateRequest): Promise<ASRRecognitionResult>;
}

export class UnavailableASRProvider implements ASRProvider {
  async recognize(): Promise<ASRRecognitionResult> {
    throw new ASRProviderError("service-unavailable", "ASR service is unavailable.");
  }
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
