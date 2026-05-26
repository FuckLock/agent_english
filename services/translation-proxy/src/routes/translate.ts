// Free 文本翻译转发 API：校验 session、分块、限额、缓存、Provider fallback、错误归一。
// translation-proxy 只做第三方通用翻译转发，绝不调用大模型与语音识别、绝不判定 entitlement 等级。

import { MODEL_SERVICE_ERROR_CODES } from "@agent-english/contracts";
import type { ModelServiceErrorCode } from "@agent-english/contracts";

import type { TranslationProxyEnv } from "../env";
import { TranslationCache } from "../cache/translation-cache";
import {
  AllProvidersFailedError,
  translateWithFallback,
} from "../providers/fallback";
import type {
  ProviderTranslateItem,
  TranslationProviderAdapter,
} from "../providers/types";
import {
  SessionQuotaExceededError,
  SessionQuotaTracker,
  type SessionQuotaSnapshot,
} from "../quota/session-quota";

export interface ProxyTranslateSegment {
  segmentId: string;
  sourceText: string;
}

export interface ProxyTranslateRequest {
  pageId: string;
  sourceLanguage: string;
  targetLanguage: string;
  segments: ProxyTranslateSegment[];
}

export interface ProxyTranslateSegmentResult {
  segmentId: string;
  translatedText: string;
}

export interface ProxyTranslateSuccessBody {
  pageId: string;
  sourceLanguage: string;
  targetLanguage: string;
  segmentResults: ProxyTranslateSegmentResult[];
  quota: SessionQuotaSnapshot;
}

export interface ProxyTranslateErrorBody {
  code: ModelServiceErrorCode;
  message: string;
  quota?: SessionQuotaSnapshot;
}

export interface ProxyTranslateRouteResponse {
  statusCode: number;
  body: ProxyTranslateSuccessBody | ProxyTranslateErrorBody;
}

export interface ProxyTranslateDependencies {
  env: TranslationProxyEnv;
  adapters: TranslationProviderAdapter[];
  quota: SessionQuotaTracker;
  cache: TranslationCache;
}

// 归一错误码——取值必须落在 contracts 已定义集合内，禁止裸字符串。
const QUOTA_EXCEEDED: ModelServiceErrorCode = "quota-exceeded";
const SERVICE_UNAVAILABLE: ModelServiceErrorCode = "service-unavailable";
const PROVIDER_FALLBACK_FAILED: ModelServiceErrorCode = "provider-fallback-failed";

export async function handleProxyTranslateRoute(
  sessionKey: string | null,
  request: ProxyTranslateRequest,
  dependencies: ProxyTranslateDependencies,
): Promise<ProxyTranslateRouteResponse> {
  if (!sessionKey) {
    return errorResponse(401, SERVICE_UNAVAILABLE, "Missing session token.");
  }
  if (request.segments.length === 0) {
    return errorResponse(400, SERVICE_UNAVAILABLE, "No segments to translate.");
  }

  // 限额以 session key 为分组键，而非请求体中客户端自报的 tier。
  let quotaSnapshot: SessionQuotaSnapshot;
  try {
    quotaSnapshot = dependencies.quota.reserve(
      sessionKey,
      request.segments.length,
    );
  } catch (error) {
    if (error instanceof SessionQuotaExceededError) {
      return {
        statusCode: 429,
        body: {
          code: QUOTA_EXCEEDED,
          message: "Free translation quota exceeded for this session.",
          quota: error.snapshot,
        },
      };
    }
    throw error;
  }

  const resultsBySegmentId = new Map<string, string>();
  const uncachedItems: ProviderTranslateItem[] = [];

  for (const segment of request.segments) {
    const cached = dependencies.cache.get(
      request.sourceLanguage,
      request.targetLanguage,
      segment.sourceText,
    );
    if (cached !== undefined) {
      resultsBySegmentId.set(segment.segmentId, cached);
    } else {
      uncachedItems.push({
        segmentId: segment.segmentId,
        sourceText: segment.sourceText,
      });
    }
  }

  if (uncachedItems.length > 0) {
    const chunks = chunkBySize(uncachedItems, dependencies.env.chunkCharLimit);
    try {
      for (const chunk of chunks) {
        const translated = await translateWithFallback(dependencies.adapters, {
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
          items: chunk,
        });
        for (const segment of translated.segments) {
          resultsBySegmentId.set(segment.segmentId, segment.translatedText);
          dependencies.cache.set(
            request.sourceLanguage,
            request.targetLanguage,
            sourceTextFor(chunk, segment.segmentId),
            segment.translatedText,
          );
        }
      }
    } catch (error) {
      if (error instanceof AllProvidersFailedError) {
        return errorResponse(
          503,
          PROVIDER_FALLBACK_FAILED,
          "All translation providers failed.",
        );
      }
      return errorResponse(
        503,
        SERVICE_UNAVAILABLE,
        "Translation proxy is unavailable right now.",
      );
    }
  }

  return {
    statusCode: 200,
    body: {
      pageId: request.pageId,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      segmentResults: request.segments.map((segment) => ({
        segmentId: segment.segmentId,
        translatedText: resultsBySegmentId.get(segment.segmentId) ?? "",
      })),
      quota: quotaSnapshot,
    },
  };
}

// 超长文本按块切分：每块字符总数不超过阈值；单 segment 自身超阈值时独立成块，
// 不直接整体拒绝（见 criteria B2）。
export function chunkBySize(
  items: ProviderTranslateItem[],
  charLimit: number,
): ProviderTranslateItem[][] {
  const chunks: ProviderTranslateItem[][] = [];
  let current: ProviderTranslateItem[] = [];
  let currentLength = 0;

  for (const item of items) {
    const itemLength = item.sourceText.length;
    if (current.length > 0 && currentLength + itemLength > charLimit) {
      chunks.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(item);
    currentLength += itemLength;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [[]];
}

function sourceTextFor(
  items: ProviderTranslateItem[],
  segmentId: string,
): string {
  return items.find((item) => item.segmentId === segmentId)?.sourceText ?? "";
}

function errorResponse(
  statusCode: number,
  code: ModelServiceErrorCode,
  message: string,
): ProxyTranslateRouteResponse {
  // 防御性断言：归一错误码必须在 contracts 集合内。
  void (MODEL_SERVICE_ERROR_CODES as readonly string[]).includes(code);
  return { statusCode, body: { code, message } };
}
