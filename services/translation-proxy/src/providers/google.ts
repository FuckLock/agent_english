// Google Cloud Translation 通用翻译 adapter。
// API key 由服务端 env 注入，绝不内联、绝不下发客户端。

import type { TranslationProviderRuntimeConfig } from "../env";
import { FetchProviderHttpTransport } from "./http-transport";
import {
  ProviderTransportError,
  type ProviderHttpTransport,
  type ProviderTranslateRequest,
  type ProviderTranslateResult,
  type TranslationProviderAdapter,
} from "./types";

interface GoogleTranslateResponseShape {
  data?: {
    translations?: Array<{ translatedText?: unknown }>;
  };
}

export class GoogleTranslateAdapter implements TranslationProviderAdapter {
  public readonly providerID = "google" as const;

  public constructor(
    private readonly config: TranslationProviderRuntimeConfig,
    private readonly transport: ProviderHttpTransport =
      new FetchProviderHttpTransport(),
  ) {}

  public async translate(
    request: ProviderTranslateRequest,
  ): Promise<ProviderTranslateResult> {
    const url = `${this.config.endpoint}?key=${encodeURIComponent(this.config.apiKey)}`;
    const payload = await this.transport.postJSON(
      url,
      {},
      {
        q: request.items.map((item) => item.sourceText),
        source: request.sourceLanguage,
        target: request.targetLanguage,
        format: "text",
      },
    );

    const translations = parseGoogleTranslations(payload);
    if (translations.length !== request.items.length) {
      throw new ProviderTransportError(
        this.providerID,
        "Google translation count mismatch.",
      );
    }

    return {
      providerID: this.providerID,
      segments: request.items.map((item, index) => ({
        segmentId: item.segmentId,
        translatedText: translations[index],
      })),
    };
  }
}

function parseGoogleTranslations(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null) {
    return [];
  }
  const shape = payload as GoogleTranslateResponseShape;
  const items = shape.data?.translations;
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) =>
    typeof item.translatedText === "string" ? item.translatedText : "",
  );
}
