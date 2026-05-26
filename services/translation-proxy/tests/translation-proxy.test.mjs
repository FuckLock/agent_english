import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import {
  createTranslationProxyServer,
  resolveProxyDependencies,
} from "../dist/index.js";
import { handleProxyTranslateRoute } from "../dist/routes/translate.js";
import { SessionQuotaTracker } from "../dist/quota/session-quota.js";
import { TranslationCache } from "../dist/cache/translation-cache.js";

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
