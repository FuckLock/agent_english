import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";

import type {
  DevLoginRequest,
  ExplainRequest,
  TranslateRequest,
  VideoAudioTranslateRequest,
} from "@agent-english/contracts";

import { handleDevLogin } from "./auth/dev-auth";
import {
  MODEL_REGISTRY,
  validateModelRegistry,
} from "./catalog/model-registry";
import { loadGatewayEnv, type GatewayEnv, type ProviderID } from "./env";
import {
  applySessionEntitlement,
  extractSessionToken,
  resolveSessionEntitlement,
} from "./entitlements/entitlement-service";
import type { ProviderRouterDependencies } from "./providers/provider-router";
import { handleCatalogRoute } from "./routes/catalog";
import { handleExplainRoute } from "./routes/explain";
import { handleTranslateRoute } from "./routes/translate";
import { handleVideoAudioTranslateRoute } from "./routes/video-audio-translate";
import { defaultSessionStore } from "./composition";
import type { SessionStore } from "./sessions/session-store";

export interface ModelGatewayServerDependencies extends ProviderRouterDependencies {
  env?: GatewayEnv;
  sessionStore?: SessionStore;
}

export function createModelGatewayServer(
  dependencies: ModelGatewayServerDependencies = {},
) {
  return createServer(async (request, response) => {
    const routeURL = new URL(request.url ?? "/", "http://127.0.0.1");
    const env = dependencies.env ?? loadGatewayEnv();
    const sessionStore = dependencies.sessionStore ?? defaultSessionStore;

    if (request.method === "POST" && routeURL.pathname === "/v1/sessions/guest") {
      const token = extractSessionToken(request.headers);
      const restoredSession = token ? sessionStore.session(token) : null;
      return sendJSON(response, {
        statusCode: 200,
        body: restoredSession ?? sessionStore.createGuestSession(),
      });
    }

    if (request.method === "POST" && routeURL.pathname === "/v1/auth/dev-login") {
      const body = (await readJSON(request)) as DevLoginRequest;
      return sendJSON(response, handleDevLogin(body, env, sessionStore));
    }

    if (request.method === "POST" && routeURL.pathname === "/v1/auth/logout") {
      const token = extractSessionToken(request.headers);
      if (token) {
        sessionStore.revoke(token);
      }
      return sendJSON(response, {
        statusCode: 200,
        body: sessionStore.createGuestSession(),
      });
    }

    const entitlement = resolveSessionEntitlement(
      request.headers,
      env,
      sessionStore,
    );

    if ("statusCode" in entitlement) {
      return sendJSON(response, entitlement);
    }

    if (request.method === "GET" && routeURL.pathname === "/v1/model-catalog") {
      return sendJSON(response, handleCatalogRoute(entitlement));
    }

    if (request.method === "POST" && routeURL.pathname === "/v1/translate") {
      const body = (await readJSON(request)) as TranslateRequest;
      return sendJSON(
        response,
        await handleTranslateRoute(
          applySessionEntitlement(body, entitlement),
          0,
          {
            ...dependencies,
            env,
            entitlement,
          },
        ),
      );
    }

    if (request.method === "POST" && routeURL.pathname === "/v1/explain") {
      const body = (await readJSON(request)) as ExplainRequest;
      return sendJSON(
        response,
        await handleExplainRoute(
          applySessionEntitlement(body, entitlement),
          0,
          {
            ...dependencies,
            env,
            entitlement,
          },
        ),
      );
    }

    if (request.method === "POST" && routeURL.pathname === "/v1/video-audio-translate") {
      const body = (await readJSON(request)) as VideoAudioTranslateRequest;
      return sendJSON(
        response,
        await handleVideoAudioTranslateRoute(
          applySessionEntitlement(body, entitlement),
          0,
          {
            ...dependencies,
            env,
            entitlement,
          },
        ),
      );
    }

    sendJSON(response, {
      statusCode: 404,
      body: {
        code: "service-unavailable",
        message: "Route not found.",
      },
    });
  });
}

export function startModelGatewayServer(): void {
  const env = loadGatewayEnv();
  // 启动期 registry 硬校验（ADR-0006 决策 2）：非法配置（id 重复 / minTier 非法 /
  // 每档非恰一默认 / fallbackVendors 引用未配 vendor）→ throw 拒启；
  // 缺凭证 → 该模型不进目录、其余正常（registry 校验内部已区分两类语义）。
  validateModelRegistry(MODEL_REGISTRY, {
    configuredVendors: configuredVendorSet(env),
  });
  createModelGatewayServer({ env }).listen(env.port);
}

function configuredVendorSet(env: GatewayEnv): Set<ProviderID> {
  const vendors = new Set<ProviderID>();
  for (const providerID of Object.keys(env.providers) as ProviderID[]) {
    if (env.providers[providerID]) {
      vendors.add(providerID);
    }
  }
  return vendors;
}

if (require.main === module) {
  startModelGatewayServer();
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
