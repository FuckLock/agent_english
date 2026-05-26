// 通用翻译 Provider fallback 编排：按顺序尝试每个 adapter，
// 首选失败则切换到下一个；全部失败抛出归一错误（见 criteria C3）。
// 单一通用翻译 Provider 失败不让 Free 文本翻译整体失败。

import {
  ProviderTransportError,
  type ProviderTranslateRequest,
  type ProviderTranslateResult,
  type TranslationProviderAdapter,
} from "./types";

export class AllProvidersFailedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AllProvidersFailedError";
  }
}

export async function translateWithFallback(
  adapters: TranslationProviderAdapter[],
  request: ProviderTranslateRequest,
): Promise<ProviderTranslateResult> {
  if (adapters.length === 0) {
    throw new AllProvidersFailedError(
      "No translation provider is configured.",
    );
  }

  let lastError: unknown = null;

  for (const adapter of adapters) {
    try {
      return await adapter.translate(request);
    } catch (error) {
      lastError = error;
      // 单个 Provider 失败：记录并 fallback 到下一个，不让 Free 整体失败。
      continue;
    }
  }

  const detail =
    lastError instanceof ProviderTransportError
      ? lastError.message
      : lastError instanceof Error
        ? lastError.message
        : "unknown provider error";
  throw new AllProvidersFailedError(
    `All translation providers failed: ${detail}`,
  );
}
