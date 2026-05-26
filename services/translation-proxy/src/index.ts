// translation-proxy 服务入口：装配 HTTP server、加载配置、构建通用翻译 Provider adapter。
// 独立于大模型 gateway 服务部署，双向零依赖：本文件不 import 任何大模型 gateway 路径。
// 只负责 Free 文本翻译第三方转发，绝不调用大模型与语音识别、绝不判定 entitlement 等级。

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";

import { loadTranslationProxyEnv } from "./env";
import type { TranslationProxyEnv } from "./env";
import { TranslationCache } from "./cache/translation-cache";
import { GoogleTranslateAdapter } from "./providers/google";
import { MicrosoftTranslateAdapter } from "./providers/microsoft";
import type { TranslationProviderAdapter } from "./providers/types";
import { SessionQuotaTracker } from "./quota/session-quota";
import {
  handleProxyTranslateRoute,
  type ProxyTranslateDependencies,
  type ProxyTranslateRequest,
} from "./routes/translate";
import { extractSessionKey } from "./session/session-key";

export interface TranslationProxyServerDependencies {
  env?: TranslationProxyEnv;
  adapters?: TranslationProviderAdapter[];
  quota?: SessionQuotaTracker;
  cache?: TranslationCache;
}

export function buildProviderAdapters(
  env: TranslationProxyEnv,
): TranslationProviderAdapter[] {
  return env.providers.map((provider) =>
    provider.providerID === "google"
      ? new GoogleTranslateAdapter(provider)
      : new MicrosoftTranslateAdapter(provider),
  );
}

export function resolveProxyDependencies(
  dependencies: TranslationProxyServerDependencies = {},
): ProxyTranslateDependencies {
  const env = dependencies.env ?? loadTranslationProxyEnv();
  return {
    env,
    adapters: dependencies.adapters ?? buildProviderAdapters(env),
    quota:
      dependencies.quota
      ?? new SessionQuotaTracker({ segmentLimit: env.sessionSegmentLimit }),
    cache: dependencies.cache ?? new TranslationCache(),
  };
}

export function createTranslationProxyServer(
  dependencies: TranslationProxyServerDependencies = {},
) {
  const resolved = resolveProxyDependencies(dependencies);

  return createServer(async (request, response) => {
    const routeURL = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && routeURL.pathname === "/healthz") {
      return sendJSON(response, { statusCode: 200, body: { status: "ok" } });
    }

    if (request.method === "POST" && routeURL.pathname === "/v1/translate-text") {
      const sessionKey = extractSessionKey(request.headers);
      const body = (await readJSON(request)) as ProxyTranslateRequest;
      const result = await handleProxyTranslateRoute(sessionKey, body, resolved);
      return sendJSON(response, result);
    }

    sendJSON(response, {
      statusCode: 404,
      body: { code: "service-unavailable", message: "Route not found." },
    });
  });
}

export function startTranslationProxyServer(): void {
  const env = loadTranslationProxyEnv();
  createTranslationProxyServer({ env }).listen(env.port);
}

if (require.main === module) {
  startTranslationProxyServer();
}

async function readJSON(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJSON(
  response: ServerResponse,
  routeResponse: { statusCode: number; body: unknown },
): void {
  response.statusCode = routeResponse.statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(routeResponse.body));
}
