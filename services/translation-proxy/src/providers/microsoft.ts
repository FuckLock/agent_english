// Microsoft / Azure Translator 通用翻译 adapter。
// subscription key 由服务端 env 注入，绝不内联、绝不下发客户端。

import type { TranslationProviderRuntimeConfig } from "../env";
import { FetchProviderHttpTransport } from "./http-transport";
import {
  ProviderTransportError,
  type ProviderHttpTransport,
  type ProviderTranslateRequest,
  type ProviderTranslateResult,
  type TranslationProviderAdapter,
} from "./types";

interface AzureTranslateEntryShape {
  translations?: Array<{ text?: unknown }>;
}

export class MicrosoftTranslateAdapter implements TranslationProviderAdapter {
  public readonly providerID = "microsoft" as const;

  public constructor(
    private readonly config: TranslationProviderRuntimeConfig,
    private readonly transport: ProviderHttpTransport =
      new FetchProviderHttpTransport(),
  ) {}

  public async translate(
    request: ProviderTranslateRequest,
  ): Promise<ProviderTranslateResult> {
    const url = `${this.config.endpoint}?api-version=3.0&from=${encodeURIComponent(
      request.sourceLanguage,
    )}&to=${encodeURIComponent(request.targetLanguage)}`;

    const headers: Record<string, string> = {
      "Ocp-Apim-Subscription-Key": this.config.apiKey,
    };
    if (this.config.region) {
      headers["Ocp-Apim-Subscription-Region"] = this.config.region;
    }

    const payload = await this.transport.postJSON(
      url,
      headers,
      request.items.map((item) => ({ Text: item.sourceText })),
    );

    const translations = parseAzureTranslations(payload);
    if (translations.length !== request.items.length) {
      throw new ProviderTransportError(
        this.providerID,
        "Microsoft translation count mismatch.",
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

function parseAzureTranslations(payload: unknown): string[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return "";
    }
    const shape = entry as AzureTranslateEntryShape;
    const first = shape.translations?.[0];
    return first && typeof first.text === "string" ? first.text : "";
  });
}
