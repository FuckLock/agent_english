import test from "node:test";
import assert from "node:assert/strict";

import { createModelGatewayServer } from "../dist/index.js";
import { createModelCatalog } from "../dist/catalog/model-catalog.js";
import { handleExplainRoute } from "../dist/routes/explain.js";
import { handleTranslateRoute } from "../dist/routes/translate.js";

// env vendor 配置只含凭证（ADR-0006：已去 *_MODEL 槽）。
const mockEnv = {
  port: 4100,
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
  auth: {
    enableDevAuth: true,
    testProPassword: "pro-password",
    testMaxPassword: "max-password",
    isProduction: false,
  },
};

test("model catalog exposes Free Pro Max tiers without internal routing fields", () => {
  const catalog = createModelCatalog("free");

  assert.deepEqual(catalog.availableTiers, ["free", "pro", "max"]);
  assert.equal(catalog.options[0].displayName.includes("Free"), true);
  assert.equal("fallbackOrder" in catalog.options[0], false);
  assert.equal("cost" in catalog.options[0], false);
  // 脱敏投影绝不携带后端内部路由字段（ADR-0002 / ADR-0006 密钥边界）。
  for (const option of catalog.options) {
    assert.equal("vendor" in option, false);
    assert.equal("realModelName" in option, false);
    assert.equal("fallbackVendors" in option, false);
  }
});

test("registry-driven catalog accumulates lower tiers into higher tiers (D1)", () => {
  // 加一条模型 = 加一条 registry 配置即生效；目录条数随 registry 条目而定。
  const free = createModelCatalog("free");
  const pro = createModelCatalog("pro");
  const max = createModelCatalog("max");

  // 按档位累加：高档 options 数量 >= 低档。
  assert.equal(pro.options.length >= free.options.length, true);
  assert.equal(max.options.length >= pro.options.length, true);

  // D1：高档目录的 id 集合 ⊇ 低档目录的 id 集合。
  const freeIds = new Set(free.options.map((option) => option.id));
  const maxIds = new Set(max.options.map((option) => option.id));
  for (const id of freeIds) {
    assert.equal(maxIds.has(id), true);
  }
});

test("a single vendor credential backs multiple registry models (multi-to-one)", () => {
  // openai 凭证同时支撑 free 档 openai-gpt-4o-mini 与 pro 档 openai-gpt-4o
  // （解「一 vendor 只能填一个模型名」约束）——两条 id 不同的模型都出现在 max 档累加目录中。
  const maxIds = new Set(
    createModelCatalog("max").options.map((option) => option.id),
  );
  assert.equal(maxIds.has("openai-gpt-4o-mini"), true);
  assert.equal(maxIds.has("openai-gpt-4o"), true);
});

test("translate route maps segmentId results and quota state", async () => {
  const transport = new MockTransport({
    completions: [
      JSON.stringify({
        translations: [
          { segmentId: "seg-1", translatedText: "你好，世界。" },
        ],
      }),
    ],
  });

  const response = await handleTranslateRoute(
    {
      pageId: "page-1",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      serviceTier: "free",
      preferredModelId: "free-translate",
      segments: [
        {
          segmentId: "seg-1",
          sourceText: "Hello world.",
        },
      ],
    },
    0,
    {
      env: mockEnv,
      transport,
    },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.segmentResults[0].segmentId, "seg-1");
  assert.equal(response.body.segmentResults[0].translatedText, "你好，世界。");
  assert.equal(response.body.quota.limit > 0, true);
});

test("translate route returns generic fallback-safe API error message", async () => {
  const transport = new MockTransport({
    errors: [new Error("provider failed"), new Error("provider failed")],
  });

  const response = await handleTranslateRoute(
    {
      pageId: "page-1",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      serviceTier: "free",
      preferredModelId: "free-translate",
      segments: [{ segmentId: "seg-1", sourceText: "Hello world." }],
    },
    0,
    {
      env: mockEnv,
      transport,
    },
  );

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, "provider-fallback-failed");
  assert.equal(response.body.error.message.includes("Provider route failed"), false);
  assert.equal(response.body.error.message.includes("deepseek"), false);
  assert.equal(response.body.error.message.includes("fallback"), false);
});

test("explain route returns context aware explanation payload", async () => {
  const transport = new MockTransport({
    completions: [
      JSON.stringify({
        translation: "轻描淡写地带过",
        explanation: "这里表示有意淡化问题的重要性。",
        examples: ["They glossed over the delay in the meeting."],
      }),
    ],
  });

  const response = await handleExplainRoute(
    {
      pageId: "page-1",
      sourceText: "They tried to gloss over the policy change.",
      selectedText: "gloss over",
      contextBefore: "They tried to",
      contextAfter: "the policy change.",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      serviceTier: "pro",
      preferredModelId: "pro-context",
    },
    0,
    {
      env: mockEnv,
      transport,
    },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.translation, "轻描淡写地带过");
  assert.equal(response.body.examples.length, 1);
});

test("server exports a request handler", () => {
  const server = createModelGatewayServer();

  assert.equal(typeof server.emit, "function");
  server.close();
});

class MockTransport {
  constructor({ completions = [], errors = [] } = {}) {
    this.completions = [...completions];
    this.errors = [...errors];
  }

  async complete() {
    if (this.errors.length > 0) {
      throw this.errors.shift();
    }

    return this.completions.shift() ?? JSON.stringify({});
  }
}
