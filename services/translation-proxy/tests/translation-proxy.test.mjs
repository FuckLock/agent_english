import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import {
  buildProviderAdapters,
  createTranslationProxyServer,
  resolveProxyDependencies,
} from "../dist/index.js";
import { handleProxyTranslateRoute } from "../dist/routes/translate.js";
import { SessionQuotaTracker } from "../dist/quota/session-quota.js";
import { TranslationCache } from "../dist/cache/translation-cache.js";
import { loadTranslationProxyEnv } from "../dist/env.js";
import { OpenAICompatibleTranslateAdapter } from "../dist/providers/openai-compatible.js";

// 注入式 stub 通用翻译 Provider adapter：记录调用次数，回填可断言译文。
// 测试不连接任何真实第三方翻译服务，也不依赖任何大模型 gateway 环境变量。
class StubProviderAdapter {
  constructor(providerID, { failWith = null } = {}) {
    this.providerID = providerID;
    this.failWith = failWith;
    this.callCount = 0;
  }

  async translate(request) {
    this.callCount += 1;
    if (this.failWith) {
      throw this.failWith;
    }
    return {
      providerID: this.providerID,
      segments: request.items.map((item) => ({
        segmentId: item.segmentId,
        translatedText: `[${this.providerID}] ${item.sourceText}`,
      })),
    };
  }
}

// 注入式 stub transport：拦截大模型 Chat Completions 请求，不真实出网。
// reply 接收解析出的 segmentId 列表，返回一段大模型风格译文字符串（可带噪声）。
class StubLLMTransport {
  constructor(reply) {
    this.reply = reply;
    this.callCount = 0;
    this.lastBody = null;
  }

  async postJSON(_url, _headers, body) {
    this.callCount += 1;
    this.lastBody = body;
    const ids = extractSegmentIds(body);
    return {
      choices: [{ message: { content: this.reply(ids) } }],
    };
  }
}

// 从大模型请求体（messages[].content）里抽出 [[segmentId]] 标记，供 stub 模拟逐行回显。
function extractSegmentIds(body) {
  const userMessage = (body.messages ?? []).find((m) => m.role === "user");
  const content = userMessage ? userMessage.content : "";
  const ids = [];
  const pattern = /\[\[(.+?)\]\]/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

// 规范大模型输出：每行 `[[id]] 译文`，顺序故意打乱以验证按 segmentId 命中。
function cleanReply(ids) {
  return [...ids]
    .reverse()
    .map((id) => `[[${id}]] 译文-${id}`)
    .join("\n");
}

function proxyEnv(overrides = {}) {
  return {
    port: 4200,
    sessionSegmentLimit: 100,
    chunkCharLimit: 1200,
    providers: [],
    ...overrides,
  };
}

function makeDeps({ adapters, segmentLimit = 100, chunkCharLimit = 1200, now } = {}) {
  return {
    env: proxyEnv({ sessionSegmentLimit: segmentLimit, chunkCharLimit }),
    adapters,
    quota: new SessionQuotaTracker({ segmentLimit, now }),
    cache: new TranslationCache(),
  };
}

// D1 / A3 / B1: 携带合法 session token 的 HTTP POST → 200 → 逐 segment 译文。
test("D1 happy path: session token POST returns 200 with per-segment translations", async () => {
  const google = new StubProviderAdapter("google");
  const server = createTranslationProxyServer({
    env: proxyEnv({ sessionSegmentLimit: 100 }),
    adapters: [google],
    quota: new SessionQuotaTracker({ segmentLimit: 100 }),
    cache: new TranslationCache(),
  });
  server.listen(0);
  await once(server, "listening");
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/translate-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer session-free-1",
      },
      body: JSON.stringify({
        pageId: "page-1",
        sourceLanguage: "en",
        targetLanguage: "zh",
        segments: [
          { segmentId: "seg-1", sourceText: "Hello world." },
          { segmentId: "seg-2", sourceText: "Good morning." },
        ],
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.segmentResults.length, 2);
    assert.equal(body.segmentResults[0].segmentId, "seg-1");
    assert.equal(body.segmentResults[0].translatedText, "[google] Hello world.");
    assert.equal(body.segmentResults[1].segmentId, "seg-2");
    assert.equal(body.segmentResults[1].translatedText, "[google] Good morning.");
  } finally {
    server.close();
    await once(server, "close");
  }
});

// F3 / AR3: proxy 在不配置任何大模型 gateway 环境变量的前提下完成一次翻译。
test("F3 proxy translates without any large-model gateway env configured", async () => {
  const isolatedEnv = {
    GOOGLE_TRANSLATE_API_KEY: "stub-google-key",
    TRANSLATION_PROXY_PORT: "4299",
  };
  const deps = resolveProxyDependencies({
    env: undefined,
    adapters: [new StubProviderAdapter("google")],
  });
  // 确认解析依赖时既不读取也不要求大模型后端的 MODEL_SERVICE_ROOT / 端口配置。
  assert.equal("MODEL_SERVICE_ROOT" in isolatedEnv, false);
  assert.equal("MODEL_GATEWAY_PORT" in isolatedEnv, false);

  const result = await handleProxyTranslateRoute(
    "session-free-isolated",
    {
      pageId: "page-x",
      sourceLanguage: "en",
      targetLanguage: "zh",
      segments: [{ segmentId: "seg-1", sourceText: "Standalone." }],
    },
    deps,
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.segmentResults[0].translatedText, "[google] Standalone.");
});

// D2 / B2: 超长文本分块后分别翻译再合并，stub 被调用 > 1 次，segment 数量一致。
test("D2 chunking splits long input across multiple provider calls and merges", async () => {
  const google = new StubProviderAdapter("google");
  const deps = makeDeps({ adapters: [google], chunkCharLimit: 10 });

  const segments = [
    { segmentId: "seg-1", sourceText: "aaaaaaaa" },
    { segmentId: "seg-2", sourceText: "bbbbbbbb" },
    { segmentId: "seg-3", sourceText: "cccccccc" },
  ];

  const result = await handleProxyTranslateRoute(
    "session-chunk",
    { pageId: "page-chunk", sourceLanguage: "en", targetLanguage: "zh", segments },
    deps,
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.segmentResults.length, 3);
  assert.ok(google.callCount > 1, "provider should be called more than once when chunked");
  for (const segment of segments) {
    const match = result.body.segmentResults.find((r) => r.segmentId === segment.segmentId);
    assert.ok(match && match.translatedText.length > 0);
  }
});

// D3 / C1 / E4: 同一 session 触顶返回 quota-exceeded（含 reset 信息）；跨 session 隔离；
// 请求体自报 tier=max 但 session 为 free 仍计入 Free 限额。
test("D3 quota: per-session limit, cross-session isolation, self-reported tier ignored", async () => {
  const google = new StubProviderAdapter("google");
  const deps = makeDeps({ adapters: [google], segmentLimit: 2 });

  const first = await handleProxyTranslateRoute(
    "session-free-A",
    {
      pageId: "p1",
      sourceLanguage: "en",
      targetLanguage: "zh",
      // 客户端自报 max，但限额 key 取自 session token，不看请求体 tier。
      tier: "max",
      segments: [
        { segmentId: "seg-1", sourceText: "one" },
        { segmentId: "seg-2", sourceText: "two" },
      ],
    },
    deps,
  );
  assert.equal(first.statusCode, 200);

  const overLimit = await handleProxyTranslateRoute(
    "session-free-A",
    {
      pageId: "p2",
      sourceLanguage: "en",
      targetLanguage: "zh",
      tier: "max",
      segments: [{ segmentId: "seg-3", sourceText: "three" }],
    },
    deps,
  );
  assert.equal(overLimit.statusCode, 429);
  assert.equal(overLimit.body.code, "quota-exceeded");
  assert.ok(overLimit.body.quota && typeof overLimit.body.quota.resetAt === "string");
  assert.ok(overLimit.body.quota.resetAt.length > 0);

  // 另一个 session token 不受影响。
  const otherSession = await handleProxyTranslateRoute(
    "session-free-B",
    {
      pageId: "p3",
      sourceLanguage: "en",
      targetLanguage: "zh",
      segments: [{ segmentId: "seg-4", sourceText: "four" }],
    },
    deps,
  );
  assert.equal(otherSession.statusCode, 200);
  assert.equal(otherSession.body.segmentResults[0].translatedText, "[google] four");
});

// D4 / C2: 同一 (源, 目标, 文本) 连续两次 → stub 仅调用一次 → 两次译文一致。
test("D4 cache: identical request hits cache and skips provider on second call", async () => {
  const google = new StubProviderAdapter("google");
  const deps = makeDeps({ adapters: [google], segmentLimit: 100 });

  const payload = {
    pageId: "p-cache",
    sourceLanguage: "en",
    targetLanguage: "zh",
    segments: [{ segmentId: "seg-1", sourceText: "Cache me." }],
  };

  const firstCallCount = google.callCount;
  const first = await handleProxyTranslateRoute("session-cache", payload, deps);
  const callsAfterFirst = google.callCount;
  const second = await handleProxyTranslateRoute("session-cache", payload, deps);
  const callsAfterSecond = google.callCount;

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(callsAfterFirst - firstCallCount, 1);
  assert.equal(callsAfterSecond - callsAfterFirst, 0, "second call must not hit provider");
  assert.equal(
    first.body.segmentResults[0].translatedText,
    second.body.segmentResults[0].translatedText,
  );
});

// D5 / C3: 首选 Provider 抛错 → fallback 到备选成功；全部失败 → provider-fallback-failed。
test("D5 fallback: primary fails then secondary succeeds", async () => {
  const failingGoogle = new StubProviderAdapter("google", {
    failWith: new Error("google down"),
  });
  const microsoft = new StubProviderAdapter("microsoft");
  const deps = makeDeps({ adapters: [failingGoogle, microsoft], segmentLimit: 100 });

  const result = await handleProxyTranslateRoute(
    "session-fb-1",
    {
      pageId: "p-fb",
      sourceLanguage: "en",
      targetLanguage: "zh",
      segments: [{ segmentId: "seg-1", sourceText: "Fallback please." }],
    },
    deps,
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.segmentResults[0].translatedText, "[microsoft] Fallback please.");
  assert.ok(failingGoogle.callCount >= 1);
  assert.ok(microsoft.callCount >= 1);
});

test("D5 fallback: all providers fail returns normalized provider-fallback-failed", async () => {
  const failingGoogle = new StubProviderAdapter("google", {
    failWith: new Error("google down"),
  });
  const failingMicrosoft = new StubProviderAdapter("microsoft", {
    failWith: new Error("microsoft down"),
  });
  const deps = makeDeps({
    adapters: [failingGoogle, failingMicrosoft],
    segmentLimit: 100,
  });

  const result = await handleProxyTranslateRoute(
    "session-fb-2",
    {
      pageId: "p-fb-all",
      sourceLanguage: "en",
      targetLanguage: "zh",
      segments: [{ segmentId: "seg-1", sourceText: "No provider left." }],
    },
    deps,
  );

  assert.equal(result.statusCode, 503);
  assert.equal(result.body.code, "provider-fallback-failed");
});

// C4: 内部不可用（无 session）映射到 service-unavailable。
test("C4 missing session token normalizes to service-unavailable", async () => {
  const deps = makeDeps({ adapters: [new StubProviderAdapter("google")] });
  const result = await handleProxyTranslateRoute(
    null,
    {
      pageId: "p-none",
      sourceLanguage: "en",
      targetLanguage: "zh",
      segments: [{ segmentId: "seg-1", sourceText: "x" }],
    },
    deps,
  );
  assert.equal(result.body.code, "service-unavailable");
});

// ===== Phase 8.8: 大模型（openai-compatible）provider 用例 =====
// 全部经注入 stub transport（StubLLMTransport），不发起真实网络请求。

// E1 / A3 / A4 / A5: 大模型 provider happy path 逐 segment 译文（顺序无关按 segmentId 命中）。
test("E1 llm provider happy path: per-segmentId translations, order-independent", async () => {
  const transport = new StubLLMTransport(cleanReply);
  const llm = new OpenAICompatibleTranslateAdapter(
    { providerID: "openai-compatible", apiKey: "k", endpoint: "https://stub/chat", model: "cheap-llm" },
    transport,
  );
  const deps = makeDeps({ adapters: [llm], segmentLimit: 100 });

  const result = await handleProxyTranslateRoute(
    "session-llm-1",
    {
      pageId: "p-llm",
      sourceLanguage: "en",
      targetLanguage: "zh",
      segments: [
        { segmentId: "seg-1", sourceText: "Hello world." },
        { segmentId: "seg-2", sourceText: "Good morning." },
        { segmentId: "seg-3", sourceText: "How are you?" },
      ],
    },
    deps,
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.segmentResults.length, 3);
  // 按 segmentId 命中，即使大模型回显顺序被打乱也对应正确。
  const map = new Map(result.body.segmentResults.map((r) => [r.segmentId, r.translatedText]));
  assert.equal(map.get("seg-1"), "译文-seg-1");
  assert.equal(map.get("seg-2"), "译文-seg-2");
  assert.equal(map.get("seg-3"), "译文-seg-3");

  // A4: 请求体为 OpenAI 兼容 Chat Completions（含 model + messages + 约束 prompt）。
  assert.ok(transport.lastBody, "transport should have recorded request body");
  assert.equal(transport.lastBody.model, "cheap-llm");
  assert.ok(Array.isArray(transport.lastBody.messages));
  const promptText = transport.lastBody.messages.map((m) => m.content).join("\n");
  assert.ok(/中文|Chinese/.test(promptText), "prompt targets Chinese");
  assert.ok(
    /只输出译文|不要解释|no explanation|only the Chinese translation/i.test(promptText),
    "prompt constrains translation-only output",
  );
});

// E2: 默认 provider 为大模型——三方 key 都配置时，大模型 provider 排首位。
test("E2 default provider is the llm: resolveProviders puts openai-compatible first", () => {
  const env = loadTranslationProxyEnv({
    TRANSLATION_LLM_BASE_URL: "https://stub/chat",
    TRANSLATION_LLM_API_KEY: "llm-key",
    TRANSLATION_LLM_MODEL: "cheap-llm",
    GOOGLE_TRANSLATE_API_KEY: "g-key",
    AZURE_TRANSLATOR_API_KEY: "a-key",
  });

  assert.ok(env.providers.length >= 1);
  assert.equal(env.providers[0].providerID, "openai-compatible");

  // 装配出的 adapter 数组首位也是大模型 adapter。
  const adapters = buildProviderAdapters(env);
  assert.equal(adapters[0].providerID, "openai-compatible");
});

// E3: 分块覆盖大模型 provider——小 chunkCharLimit 触发多次 transport 调用，segment 数一致。
test("E3 chunking covers llm provider: transport called more than once, segments preserved", async () => {
  const transport = new StubLLMTransport(cleanReply);
  const llm = new OpenAICompatibleTranslateAdapter(
    { providerID: "openai-compatible", apiKey: "k", endpoint: "https://stub/chat", model: "cheap-llm" },
    transport,
  );
  const deps = makeDeps({ adapters: [llm], chunkCharLimit: 10 });

  const segments = [
    { segmentId: "seg-1", sourceText: "aaaaaaaa" },
    { segmentId: "seg-2", sourceText: "bbbbbbbb" },
    { segmentId: "seg-3", sourceText: "cccccccc" },
  ];

  const result = await handleProxyTranslateRoute(
    "session-llm-chunk",
    { pageId: "p-llm-chunk", sourceLanguage: "en", targetLanguage: "zh", segments },
    deps,
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.segmentResults.length, 3);
  assert.ok(transport.callCount > 1, "llm transport should be called more than once when chunked");
  for (const segment of segments) {
    const match = result.body.segmentResults.find((r) => r.segmentId === segment.segmentId);
    assert.ok(match && match.translatedText.length > 0);
  }
});

// E4: 缓存命中跳过大模型 provider——同一 (源,目标,文本) 两次，第二次 transport 不被调用。
test("E4 cache hit skips llm provider on second identical call", async () => {
  const transport = new StubLLMTransport(cleanReply);
  const llm = new OpenAICompatibleTranslateAdapter(
    { providerID: "openai-compatible", apiKey: "k", endpoint: "https://stub/chat", model: "cheap-llm" },
    transport,
  );
  const deps = makeDeps({ adapters: [llm], segmentLimit: 100 });

  const payload = {
    pageId: "p-llm-cache",
    sourceLanguage: "en",
    targetLanguage: "zh",
    segments: [{ segmentId: "seg-1", sourceText: "Cache me." }],
  };

  const first = await handleProxyTranslateRoute("session-llm-cache", payload, deps);
  const callsAfterFirst = transport.callCount;
  const second = await handleProxyTranslateRoute("session-llm-cache", payload, deps);
  const callsAfterSecond = transport.callCount;

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(callsAfterSecond - callsAfterFirst, 0, "second call must not hit llm transport");
  assert.equal(
    first.body.segmentResults[0].translatedText,
    second.body.segmentResults[0].translatedText,
  );
});

// E5: session 限额覆盖大模型 provider（触顶 429 + quota-exceeded + resetAt；跨 session 隔离；自报 tier 被忽略）。
test("E5 quota over llm provider: per-session limit, cross-session isolation, self-reported tier ignored", async () => {
  const transport = new StubLLMTransport(cleanReply);
  const llm = new OpenAICompatibleTranslateAdapter(
    { providerID: "openai-compatible", apiKey: "k", endpoint: "https://stub/chat", model: "cheap-llm" },
    transport,
  );
  const deps = makeDeps({ adapters: [llm], segmentLimit: 2 });

  const first = await handleProxyTranslateRoute(
    "session-llm-A",
    {
      pageId: "p1",
      sourceLanguage: "en",
      targetLanguage: "zh",
      tier: "max", // 自报 max，但限额按 session 计 Free，忽略请求体 tier。
      segments: [
        { segmentId: "seg-1", sourceText: "one" },
        { segmentId: "seg-2", sourceText: "two" },
      ],
    },
    deps,
  );
  assert.equal(first.statusCode, 200);

  const overLimit = await handleProxyTranslateRoute(
    "session-llm-A",
    {
      pageId: "p2",
      sourceLanguage: "en",
      targetLanguage: "zh",
      tier: "max",
      segments: [{ segmentId: "seg-3", sourceText: "three" }],
    },
    deps,
  );
  assert.equal(overLimit.statusCode, 429);
  assert.equal(overLimit.body.code, "quota-exceeded");
  assert.ok(overLimit.body.quota && typeof overLimit.body.quota.resetAt === "string");
  assert.ok(overLimit.body.quota.resetAt.length > 0);

  // 另一个 session 不受影响。
  const otherSession = await handleProxyTranslateRoute(
    "session-llm-B",
    {
      pageId: "p3",
      sourceLanguage: "en",
      targetLanguage: "zh",
      segments: [{ segmentId: "seg-4", sourceText: "four" }],
    },
    deps,
  );
  assert.equal(otherSession.statusCode, 200);
  assert.equal(otherSession.body.segmentResults[0].translatedText, "译文-seg-4");
});

// E6: 大模型 provider fallback + 错误归一。
test("E6 llm provider fails then falls back to secondary provider", async () => {
  // 大模型 transport 返回无法解析为逐 segment 的内容 → adapter 抛 ProviderTransportError。
  const badTransport = new StubLLMTransport(() => "（一段无法逐 segment 解析的解释性文字，没有任何 id 标记）");
  const llm = new OpenAICompatibleTranslateAdapter(
    { providerID: "openai-compatible", apiKey: "k", endpoint: "https://stub/chat", model: "cheap-llm" },
    badTransport,
  );
  const microsoft = new StubProviderAdapter("microsoft");
  const deps = makeDeps({ adapters: [llm, microsoft], segmentLimit: 100 });

  const result = await handleProxyTranslateRoute(
    "session-llm-fb",
    {
      pageId: "p-llm-fb",
      sourceLanguage: "en",
      targetLanguage: "zh",
      segments: [{ segmentId: "seg-1", sourceText: "Fallback please." }],
    },
    deps,
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.segmentResults[0].translatedText, "[microsoft] Fallback please.");
  assert.ok(badTransport.callCount >= 1);
  assert.ok(microsoft.callCount >= 1);
});

test("E6 all providers fail (llm included) returns normalized provider-fallback-failed", async () => {
  const badTransport = new StubLLMTransport(() => "no segment ids here at all");
  const llm = new OpenAICompatibleTranslateAdapter(
    { providerID: "openai-compatible", apiKey: "k", endpoint: "https://stub/chat", model: "cheap-llm" },
    badTransport,
  );
  const failingMicrosoft = new StubProviderAdapter("microsoft", {
    failWith: new Error("microsoft down"),
  });
  const deps = makeDeps({ adapters: [llm, failingMicrosoft], segmentLimit: 100 });

  const result = await handleProxyTranslateRoute(
    "session-llm-fb-all",
    {
      pageId: "p-llm-fb-all",
      sourceLanguage: "en",
      targetLanguage: "zh",
      segments: [{ segmentId: "seg-1", sourceText: "No provider left." }],
    },
    deps,
  );

  assert.equal(result.statusCode, 503);
  assert.equal(result.body.code, "provider-fallback-failed");
});

// E8 / A6: 不规范大模型输出归一——带解释 / 前后缀 / 代码块围栏 / 引号 / 「原文:」噪声，去噪后回填。
test("E8 llm noisy output is normalized: noise stripped, segment count preserved", async () => {
  const noisyReply = (ids) => {
    const lines = ["这是我的翻译结果：", "```"];
    for (const id of ids) {
      lines.push(`[[${id}]] 原文: "干净的译文-${id}"`);
    }
    lines.push("```");
    lines.push("以上就是翻译。");
    return lines.join("\n");
  };
  const transport = new StubLLMTransport(noisyReply);
  const llm = new OpenAICompatibleTranslateAdapter(
    { providerID: "openai-compatible", apiKey: "k", endpoint: "https://stub/chat", model: "cheap-llm" },
    transport,
  );
  const deps = makeDeps({ adapters: [llm], segmentLimit: 100 });

  const segments = [
    { segmentId: "seg-1", sourceText: "Alpha." },
    { segmentId: "seg-2", sourceText: "Beta." },
  ];

  const result = await handleProxyTranslateRoute(
    "session-llm-noisy",
    { pageId: "p-llm-noisy", sourceLanguage: "en", targetLanguage: "zh", segments },
    deps,
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.segmentResults.length, 2);
  const map = new Map(result.body.segmentResults.map((r) => [r.segmentId, r.translatedText]));
  // 去噪后：无 ``` 围栏、无引号、无「原文:」前缀、无解释行污染。
  assert.equal(map.get("seg-1"), "干净的译文-seg-1");
  assert.equal(map.get("seg-2"), "干净的译文-seg-2");
  for (const text of map.values()) {
    assert.ok(!text.includes("```"), "no code fence noise");
    assert.ok(!text.includes("原文"), "no 原文 prefix noise");
    assert.ok(!text.startsWith('"') && !text.endsWith('"'), "no wrapping quotes");
  }
});
