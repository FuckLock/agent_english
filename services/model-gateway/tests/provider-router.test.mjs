import test from "node:test";
import assert from "node:assert/strict";

import { ChatCompletionsTransportError } from "../dist/providers/chat-completions.js";
import {
  routeExplanation,
  routeTranslation,
} from "../dist/providers/provider-router.js";

// env vendor 配置只含凭证（ADR-0006：已去 *_MODEL 槽，真实模型名随 registry 走）。
const env = {
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
    anthropic: {
      providerID: "anthropic",
      apiKey: "anthropic-secret",
      baseURL: "https://api.anthropic.example/v1",
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

test("provider router transmits the registry realModelName of the resolved model", async () => {
  const requests = [];
  // 旧 / 未知 preferredModelId → 回退该档默认模型（free 档默认 = deepseek-chat）。
  const result = await routeTranslation(
    {
      pageId: "page-1",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      serviceTier: "free",
      preferredModelId: "free-translate",
      segments: [
        { segmentId: "seg-1", sourceText: "Hello world." },
        { segmentId: "seg-2", sourceText: "Second paragraph." },
      ],
    },
    0,
    {
      env,
      transport: {
        async complete(request) {
          requests.push(request);
          return JSON.stringify({
            translations: [
              { segmentId: "seg-1", translatedText: "你好，世界。" },
              { segmentId: "seg-2", translatedText: "第二段。" },
            ],
          });
        },
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  // 真实模型名透传到请求体顶层 model 字段（来自 registry，非 vendor 配置）。
  assert.equal(requests[0].model, "deepseek-chat");
  // 脱敏投影 response.model 绝不含内部路由字段（ADR-0002 / ADR-0006 密钥边界）。
  assert.equal("vendor" in result.response.model, false);
  assert.equal("realModelName" in result.response.model, false);
  assert.equal("fallbackVendors" in result.response.model, false);
  assert.equal(requests[0].messages[1].content.includes('"segmentId":"seg-1"'), true);
  assert.equal(requests[0].messages[1].content.includes("简体中文"), true);
});

test("provider router falls back to next configured provider when the first provider fails", async () => {
  const calls = [];
  // 旧 / 未知 preferredModelId → pro 档默认 = openai-gpt-4o（fallbackVendors: [deepseek]）。
  const result = await routeTranslation(
    {
      pageId: "page-1",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      serviceTier: "pro",
      preferredModelId: "pro-context",
      segments: [{ segmentId: "seg-1", sourceText: "Hello world." }],
    },
    0,
    {
      env,
      transport: {
        async complete(request) {
          calls.push(request.provider.providerID);
          if (request.provider.providerID === "openai") {
            throw new ChatCompletionsTransportError(
              "network",
              "temporary provider outage",
            );
          }
          return JSON.stringify({
            translations: [
              { segmentId: "seg-1", translatedText: "你好，世界。" },
            ],
          });
        },
      },
    },
  );

  assert.equal(result.ok, true);
  // 路由链 = 模型条目自带 vendor + fallbackVendors（openai → deepseek）。
  assert.deepEqual(calls, ["openai", "deepseek"]);
});

test("provider router rejects a model whose minTier exceeds the account tier", async () => {
  // 服务端 minTier 重校验（ADR-0003）：free 账号请求 max 档模型（anthropic-claude-sonnet）→ tier-unavailable。
  const result = await routeExplanation(
    {
      pageId: "page-1",
      sourceText: "Hello world.",
      selectedText: "Hello",
      contextBefore: "Before",
      contextAfter: "After",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      serviceTier: "free",
      preferredModelId: "anthropic-claude-sonnet",
    },
    0,
    {
      env,
      transport: {
        async complete() {
          throw new Error("should not be called");
        },
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "tier-unavailable");
  assert.equal(result.requiredTier, "max");
  // 错误信息不泄露内部 vendor（anthropic）。
  assert.equal(result.message.includes("anthropic"), false);
});
