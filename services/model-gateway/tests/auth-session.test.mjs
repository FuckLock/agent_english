import test from "node:test";
import assert from "node:assert/strict";

import { handleDevLogin } from "../dist/auth/dev-auth.js";
import {
  applySessionEntitlement,
  resolveSessionEntitlement,
} from "../dist/entitlements/entitlement-service.js";
import { handleTranslateRoute } from "../dist/routes/translate.js";
import { SessionStore } from "../dist/sessions/session-store.js";

const mockEnv = {
  port: 4100,
  providers: {},
  auth: {
    enableDevAuth: true,
    testProPassword: "pro-password",
    testMaxPassword: "max-password",
    isProduction: false,
  },
};

test("dev auth disabled in production returns auth-disabled", () => {
  const sessionStore = new SessionStore();
  const response = handleDevLogin(
    {
      email: "test-pro@agentenglish.local",
      password: "pro-password",
    },
    {
      ...mockEnv,
      auth: {
        ...mockEnv.auth,
        isProduction: true,
      },
    },
    sessionStore,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.code, "auth-disabled");
});

test("dev auth creates Pro and Max sessions for test accounts", () => {
  const sessionStore = new SessionStore();
  const pro = handleDevLogin(
    {
      email: "test-pro@agentenglish.local",
      password: "pro-password",
    },
    mockEnv,
    sessionStore,
  );
  const max = handleDevLogin(
    {
      email: "test-max@agentenglish.local",
      password: "max-password",
    },
    mockEnv,
    sessionStore,
  );

  assert.equal(pro.statusCode, 200);
  assert.equal(max.statusCode, 200);
  assert.equal(pro.body.session.account.serviceTier, "pro");
  assert.equal(max.body.session.account.serviceTier, "max");
});

test("session entitlement ignores client serviceTier and returns tier-unavailable", async () => {
  const sessionStore = new SessionStore();
  const guest = sessionStore.createGuestSession();
  const entitlement = resolveSessionEntitlement(
    {
      authorization: `Bearer ${guest.sessionToken}`,
    },
    mockEnv,
    sessionStore,
  );

  assert.equal("statusCode" in entitlement, false);

  // env 配齐 vendor 凭证，使高档模型进入目录、参与服务端 minTier 重校验。
  const routingEnv = {
    ...mockEnv,
    providers: {
      deepseek: {
        providerID: "deepseek",
        apiKey: "deepseek-secret",
        baseURL: "https://api.deepseek.example/v1",
        timeoutMs: 15000,
      },
      openai: {
        providerID: "openai",
        apiKey: "openai-secret",
        baseURL: "https://api.openai.example/v1",
        timeoutMs: 15000,
      },
    },
  };

  // 客户端自报 serviceTier=max 被忽略（实际是 guest=free）；请求 pro 档真实模型 openai-gpt-4o
  // → 服务端 minTier 重校验拒绝（ADR-0003，不信任客户端自报档位）。
  const response = await handleTranslateRoute(
    applySessionEntitlement(
      {
        pageId: "page-1",
        sourceLanguage: "English",
        targetLanguage: "简体中文",
        serviceTier: "max",
        preferredModelId: "openai-gpt-4o",
        segments: [{ segmentId: "seg-1", sourceText: "Hello world." }],
      },
      entitlement,
    ),
    0,
    {
      env: routingEnv,
      entitlement,
      transport: {
        async complete() {
          throw new Error("should not route a locked model");
        },
      },
    },
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.code, "tier-unavailable");
  assert.equal(response.body.error.requiredTier, "pro");
});

test("model routes reject missing session token before using guest entitlement", () => {
  const entitlement = resolveSessionEntitlement({}, mockEnv, new SessionStore());

  assert.equal("statusCode" in entitlement, true);
  assert.equal(entitlement.statusCode, 401);
  assert.equal(entitlement.body.error.message, "Model service session is required.");
});

test("session store can restore and revoke a logout token", () => {
  const sessionStore = new SessionStore();
  const guest = sessionStore.createGuestSession();

  assert.equal(sessionStore.session(guest.sessionToken)?.account.kind, "guest");
  sessionStore.revoke(guest.sessionToken);
  assert.equal(sessionStore.session(guest.sessionToken), null);
});
