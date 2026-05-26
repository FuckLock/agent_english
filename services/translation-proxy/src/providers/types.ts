// 通用翻译 Provider adapter 的共享类型。
// translation-proxy 只做 Free 文本翻译第三方转发，禁止任何大模型与语音识别调用。

import type { TranslationProviderID } from "../env";

export interface ProviderTranslateItem {
  segmentId: string;
  sourceText: string;
}

export interface ProviderTranslateRequest {
  sourceLanguage: string;
  targetLanguage: string;
  items: ProviderTranslateItem[];
}

export interface ProviderTranslateSegment {
  segmentId: string;
  translatedText: string;
}

export interface ProviderTranslateResult {
  providerID: TranslationProviderID;
  segments: ProviderTranslateSegment[];
}

// 通用翻译 Provider adapter 抽象：注入 stub 即可在测试中替换真实第三方调用。
export interface TranslationProviderAdapter {
  readonly providerID: TranslationProviderID;
  translate(
    request: ProviderTranslateRequest,
  ): Promise<ProviderTranslateResult>;
}

// 第三方通用翻译网络传输抽象，便于单测注入 stub，避免真实出网。
export interface ProviderHttpTransport {
  postJSON(
    url: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<unknown>;
}

export class ProviderTransportError extends Error {
  public constructor(
    public readonly providerID: TranslationProviderID,
    message: string,
  ) {
    super(message);
    this.name = "ProviderTransportError";
  }
}
