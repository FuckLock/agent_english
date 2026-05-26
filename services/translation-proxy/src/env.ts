// translation-proxy 服务端环境装配。
// 第三方通用翻译 key 只在此处从 process.env 读取，绝不内联字面量，绝不进客户端。

export type TranslationProviderID = "google" | "microsoft";

export interface TranslationProviderRuntimeConfig {
  providerID: TranslationProviderID;
  apiKey: string;
  endpoint: string;
  region?: string;
}

export interface TranslationProxyEnv {
  port: number;
  sessionSegmentLimit: number;
  chunkCharLimit: number;
  providers: TranslationProviderRuntimeConfig[];
}

const DEFAULT_PORT = 4200;
const DEFAULT_SESSION_SEGMENT_LIMIT = 2000;
const DEFAULT_CHUNK_CHAR_LIMIT = 1200;

export function loadTranslationProxyEnv(
  env: NodeJS.ProcessEnv = process.env,
): TranslationProxyEnv {
  return {
    port: positiveIntOr(env.TRANSLATION_PROXY_PORT, DEFAULT_PORT),
    sessionSegmentLimit: positiveIntOr(
      env.TRANSLATION_PROXY_SESSION_SEGMENT_LIMIT,
      DEFAULT_SESSION_SEGMENT_LIMIT,
    ),
    chunkCharLimit: positiveIntOr(
      env.TRANSLATION_PROXY_CHUNK_CHAR_LIMIT,
      DEFAULT_CHUNK_CHAR_LIMIT,
    ),
    providers: resolveProviders(env),
  };
}

function resolveProviders(
  env: NodeJS.ProcessEnv,
): TranslationProviderRuntimeConfig[] {
  const providers: TranslationProviderRuntimeConfig[] = [];

  const googleKey = env.GOOGLE_TRANSLATE_API_KEY;
  if (googleKey && googleKey.length > 0) {
    providers.push({
      providerID: "google",
      apiKey: googleKey,
      endpoint:
        env.GOOGLE_TRANSLATE_ENDPOINT
        ?? "https://translation.googleapis.com/language/translate/v2",
    });
  }

  const azureKey = env.AZURE_TRANSLATOR_API_KEY;
  if (azureKey && azureKey.length > 0) {
    providers.push({
      providerID: "microsoft",
      apiKey: azureKey,
      endpoint:
        env.AZURE_TRANSLATOR_ENDPOINT
        ?? "https://api.cognitive.microsofttranslator.com/translate",
      region: env.AZURE_TRANSLATOR_REGION,
    });
  }

  return providers;
}

function positiveIntOr(rawValue: string | undefined, fallback: number): number {
  if (rawValue === undefined) {
    return fallback;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}
