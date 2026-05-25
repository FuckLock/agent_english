import test from "node:test";
import assert from "node:assert/strict";

import { ChatCompletionsTransportError } from "../dist/providers/chat-completions.js";
import {
  routeExplanation,
  routeTranslation,
} from "../dist/providers/provider-router.js";

const env = {
  port: 4100,
  providers: {
    deepseek: {
      providerID: "deepseek",
      apiKey: "deepseek-secret",
      model: "deepseek-chat",
      baseURL: "https://api.deepseek.example/v1",
      timeoutMs: 15000,
    },
    openai: {
      providerID: "openai",
      apiKey: "openai-secret",
      model: "gpt-4.1-mini",
      baseURL: "https://api.openai.example/v1",
      timeoutMs: 15000,
    },
    anthropic: {
      providerID: "anthropic",
      apiKey: "anthropic-secret",
      model: "claude-sonnet-4-compat",
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

test("provider router sends chat-completions payload with selected provider model", async () => {
  const requests = [];
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
  assert.equal(requests[0].provider.model, "deepseek-chat");
  assert.equal(requests[0].messages[1].content.includes('"segmentId":"seg-1"'), true);
  assert.equal(requests[0].messages[1].content.includes("简体中文"), true);
});

test("provider router falls back to next configured provider when the first provider fails", async () => {
  const calls = [];
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
  assert.deepEqual(calls, ["openai", "deepseek"]);
});

test("provider router propagates requiredTier without exposing provider details", async () => {
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
      preferredModelId: "max-mentor",
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
  assert.equal(result.message.includes("anthropic"), false);
});
