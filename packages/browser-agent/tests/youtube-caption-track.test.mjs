import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import {
  BROWSER_AGENT_RUNTIME_SOURCE,
  buildInnerTubePlayerRequest,
} from "../dist/index.js";

// ---------------------------------------------------------------------------
// Phase 8.9 — 注入式单测：视频自带字幕轨数据读取 / 选轨 / json3 解析 / currentTime
// 时间同步 / SPA 重取 / 无轨降级 / 非视频页不注入。
//
// 不真实出网（criteria C4）：stub `#movie_player.getPlayerResponse()` + stub `fetch`
// 返回 json3 payload + stub `video.currentTime`。被测的是 BROWSER_AGENT_RUNTIME_SOURCE
// 拼接出的真实注入运行时（与生产 / generated.swift 同一字符串），经
// `window.__agentEnglishYouTubeInjection` 暴露纯函数入口。
// ---------------------------------------------------------------------------

const HANDLER_NAME = "agentEnglishBridge";

// 一条最小可用 captionTracks（en 人工轨）的 stub player response。
function buildPlayerResponse(captionTracks) {
  if (captionTracks === undefined) {
    // 无 captions 字段（A6 / E7 子项一）。
    return {};
  }
  return {
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks,
      },
    },
  };
}

// 一段带时间轴 + 噪声（空 segs / 纯换行）的 json3 payload（A3 / E4）。
function buildJson3Payload() {
  return {
    events: [
      { tStartMs: 2000, dDurationMs: 2000, segs: [{ utf8: "second line" }] },
      { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: "first " }, { utf8: "line" }] },
      { tStartMs: 4000, dDurationMs: 1000, segs: [] }, // 空 segs → 过滤
      { tStartMs: 5000, dDurationMs: 1000, segs: [{ utf8: "\n" }] }, // 纯换行 → 过滤
      { tStartMs: 6000, segs: [{ utf8: "no duration line" }] }, // 无 dDurationMs → end=start
    ],
  };
}

// 通用 mock 元素（沿用 youtube-spa-injection.test.mjs 的元素模型，支持 overlay
// surface 渲染：style / dataset / appendChild / remove / getBoundingClientRect）。
function createMockElement(tagName = "div") {
  const element = {
    tagName: tagName.toUpperCase(),
    id: "",
    className: "",
    textContent: "",
    hidden: false,
    title: "",
    dataset: {},
    style: {},
    parentElement: null,
    children: [],
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    insertAdjacentElement(_position, child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    remove() {
      if (this.parentElement) {
        this.parentElement.children = this.parentElement.children.filter(
          (node) => node !== this,
        );
      }
      this.removed = true;
    },
    getBoundingClientRect() {
      return { width: 320, height: 24 };
    },
    querySelector() {
      return null;
    },
  };
  return element;
}

// ---------------------------------------------------------------------------
// 扩展版 harness（在 8.7 harness 基础上补 #movie_player / video / fetch / json3 stub）。
// - playerResponse：getPlayerResponse() 返回值（可经 setPlayerResponse 切换，模拟 SPA 切视频）
// - json3Payload：stub fetch 的 .json() 返回值（null → 模拟 fetch 失败 / 空体）
// - fetchOk：stub fetch response.ok（false → 模拟 403）
// ---------------------------------------------------------------------------
function createCaptionHarness({
  url,
  playerResponse = null,
  json3Payload = null,
  fetchOk = true,
  innerTubeOk = true,
  hasVideoElement = true,
  currentTime = 0,
}) {
  const locationState = { href: url };
  const postedEvents = [];
  const counters = {
    fetch: 0,
    timeupdateListener: 0,
    fetchUrls: [],
    fetchBodies: [],
  };
  let playerResponseRef = playerResponse;
  let json3PayloadRef = json3Payload;
  const videoListeners = {};
  const videoState = { currentTime };
  const registry = new Map();

  const videoElement = createMockElement("video");
  Object.defineProperty(videoElement, "currentTime", {
    get() {
      return videoState.currentTime;
    },
    set(value) {
      videoState.currentTime = value;
    },
  });
  videoElement.addEventListener = (type, handler) => {
    videoListeners[type] = handler;
    if (type === "timeupdate") {
      counters.timeupdateListener += 1;
    }
  };

  const moviePlayer = createMockElement("div");
  moviePlayer.id = "movie_player";
  moviePlayer.getPlayerResponse = () => playerResponseRef;

  const body = createMockElement("body");
  const originalAppend = body.appendChild.bind(body);
  body.appendChild = (child) => {
    const appended = originalAppend(child);
    if (appended.id) {
      registry.set(appended.id, appended);
    }
    const childRemove = appended.remove.bind(appended);
    appended.remove = () => {
      registry.delete(appended.id);
      childRemove();
    };
    return appended;
  };
  // overlay surface 也可能挂到 player host（moviePlayer）上——同样登记进 registry。
  const originalPlayerAppend = moviePlayer.appendChild.bind(moviePlayer);
  moviePlayer.appendChild = (child) => {
    const appended = originalPlayerAppend(child);
    if (appended.id) {
      registry.set(appended.id, appended);
    }
    const childRemove = appended.remove.bind(appended);
    appended.remove = () => {
      registry.delete(appended.id);
      childRemove();
    };
    return appended;
  };

  const documentLike = {
    title: "Mock Video Page",
    body,
    get readyState() {
      return "complete";
    },
    createElement(tagName) {
      return createMockElement(tagName);
    },
    getElementById(id) {
      return registry.get(id) ?? null;
    },
    querySelector(selector) {
      if (typeof selector !== "string") {
        return null;
      }
      if (
        selector.includes("movie_player") ||
        selector.includes("html5-video-player") ||
        selector.includes("ytd-player")
      ) {
        return moviePlayer;
      }
      if (selector === "video") {
        return hasVideoElement ? videoElement : null;
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createTreeWalker() {
      return { nextNode: () => null };
    },
    addEventListener() {},
    removeEventListener() {},
  };

  const windowLike = {
    location: locationState,
    document: documentLike,
    webkit: {
      messageHandlers: {
        [HANDLER_NAME]: {
          postMessage(event) {
            postedEvents.push(event);
          },
        },
      },
    },
    history: {
      pushState() {},
      replaceState() {},
    },
    getSelection() {
      return { toString: () => "", rangeCount: 0 };
    },
    addEventListener() {},
    removeEventListener() {},
    setInterval() {
      return 1;
    },
    clearInterval() {},
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    getComputedStyle() {
      return { position: "static", display: "block", visibility: "visible", opacity: "1" };
    },
    // stub fetch：不出网；统计调用 + 记录 URL/body。区分两类请求：
    // - InnerTube（POST /youtubei/v1/player）→ 返回 player response（含 captionTracks），ok 受 innerTubeOk 控制；
    // - timedtext（其余）→ 返回 stub json3（可经 setJson3Payload 切换；null → 空体），ok 受 fetchOk 控制。
    fetch(requestUrl, init) {
      counters.fetch += 1;
      counters.fetchUrls.push(String(requestUrl));
      counters.fetchBodies.push(init && init.body ? String(init.body) : "");
      if (String(requestUrl).indexOf("/youtubei/v1/player") >= 0) {
        return Promise.resolve({
          ok: innerTubeOk,
          json: () => Promise.resolve(playerResponseRef),
        });
      }
      return Promise.resolve({
        ok: fetchOk,
        json: () => Promise.resolve(json3PayloadRef),
      });
    },
    ytInitialPlayerResponse: null,
    URL,
    Set,
    Map,
    crypto: globalThis.crypto,
    Node: { TEXT_NODE: 3 },
    NodeFilter: { SHOW_TEXT: 4 },
    Date,
    Math,
    Array,
    JSON,
    Promise,
    console,
  };
  windowLike.window = windowLike;

  const context = vm.createContext(windowLike);
  const source = BROWSER_AGENT_RUNTIME_SOURCE.replace(/__HANDLER_NAME__/g, HANDLER_NAME);
  vm.runInContext(source, context);

  return {
    windowLike,
    locationState,
    postedEvents,
    counters,
    videoListeners,
    videoState,
    youtube: windowLike.__agentEnglishYouTubeInjection,
    setPlayerResponse(next) {
      playerResponseRef = next;
    },
    setJson3Payload(next) {
      json3PayloadRef = next;
    },
    setCurrentTime(value) {
      videoState.currentTime = value;
    },
    navigate(nextUrl) {
      // 模拟 SPA 前端路由切换：先改 location.href（注入侧 detectYouTubePage 动态读 href），
      // 再调用（boot 时已被注入包裹的）history.pushState 触发 handleYouTubeRouteChange。
      locationState.href = new URL(nextUrl, locationState.href).href;
      windowLike.history.pushState({}, "", nextUrl);
    },
    fireTimeUpdate() {
      videoListeners.timeupdate?.();
    },
  };
}

const WATCH_URL = "https://www.youtube.com/watch?v=abc123";
const WATCH_URL_B = "https://www.youtube.com/watch?v=def456";
const HOME_URL = "https://www.youtube.com/";
const SHORTS_URL = "https://www.youtube.com/shorts/shortAbc";

// boot 时 syncVideoCaptionState 会发起 in-flight fetch（.then().then().catch() 多跳微任务）。
// 用真实定时器宏任务排空，确保 boot 的字幕轨加载在测试断言前完全 settle，避免竞态。
function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ===========================================================================
// E1 — 测试文件存在 + 注入入口可用（harness 冒烟）
// ===========================================================================
test("E1: caption-track injection surface is exposed in a video-page context", () => {
  const harness = createCaptionHarness({ url: WATCH_URL });
  const yt = harness.youtube;
  assert.equal(typeof yt?.parseCaptionTracks, "function");
  assert.equal(typeof yt?.selectCaptionTrack, "function");
  assert.equal(typeof yt?.buildJson3CaptionUrl, "function");
  assert.equal(typeof yt?.parseJson3Captions, "function");
  assert.equal(typeof yt?.findActiveCaptionLine, "function");
  assert.equal(typeof yt?.ensureVideoCaptionTrackLoaded, "function");
  assert.equal(typeof yt?.syncActiveCaptionLine, "function");
  assert.equal(typeof yt?.resetVideoCaptionTrack, "function");
  assert.equal(typeof yt?.getVideoCaptionLines, "function");
});

// ===========================================================================
// E2 — captionTracks 读取（取代 .ytp-caption-segment）
// ===========================================================================
test("E2: parseCaptionTracks reads captionTracks with language/kind preserved", () => {
  const { youtube: yt } = createCaptionHarness({ url: WATCH_URL });
  const playerResponse = buildPlayerResponse([
    { baseUrl: "https://www.youtube.com/api/timedtext?v=abc&lang=en", name: { simpleText: "English" }, languageCode: "en", kind: "" },
    { baseUrl: "https://www.youtube.com/api/timedtext?v=abc&lang=en&kind=asr", name: { simpleText: "English (auto)" }, languageCode: "en", kind: "asr" },
    { baseUrl: "", languageCode: "fr" }, // 无 baseUrl → 过滤
  ]);
  const tracks = yt.parseCaptionTracks(playerResponse);
  assert.equal(tracks.length, 2, "tracks without baseUrl are filtered out");
  assert.equal(tracks[0].languageCode, "en");
  assert.equal(tracks[0].kind, "");
  assert.equal(tracks[1].kind, "asr");
});

test("E2: parseCaptionTracks returns [] when player response has no captions", () => {
  const { youtube: yt } = createCaptionHarness({ url: WATCH_URL });
  // 注：vm 上下文内的数组与测试 realm 的 [] 非引用相等，故断言 length 而非 deepEqual。
  assert.equal(yt.parseCaptionTracks(buildPlayerResponse(undefined)).length, 0);
  assert.equal(yt.parseCaptionTracks(null).length, 0);
  assert.equal(yt.parseCaptionTracks(buildPlayerResponse([])).length, 0);
});

test("E2: readYouTubePlayerResponse reads getPlayerResponse() of #movie_player", () => {
  const playerResponse = buildPlayerResponse([
    { baseUrl: "https://www.youtube.com/api/timedtext?v=abc&lang=en", languageCode: "en" },
  ]);
  const { youtube: yt } = createCaptionHarness({ url: WATCH_URL, playerResponse });
  const response = yt.readYouTubePlayerResponse();
  assert.equal(yt.parseCaptionTracks(response).length, 1);
});

// ===========================================================================
// E3 — 选轨优先级（en 人工 > 目标 > ASR / 仅 ASR / en vs zh-Hans / 空轨）
// ===========================================================================
test("E3: prefers manual English over ASR", () => {
  const { youtube: yt } = createCaptionHarness({ url: WATCH_URL });
  const tracks = [
    { baseUrl: "u-asr", languageCode: "en", kind: "asr" },
    { baseUrl: "u-manual", languageCode: "en", kind: "" },
  ];
  const selected = yt.selectCaptionTrack(tracks, "");
  assert.equal(selected.baseUrl, "u-manual");
});

test("E3: falls back to ASR when only ASR English exists", () => {
  const { youtube: yt } = createCaptionHarness({ url: WATCH_URL });
  const tracks = [{ baseUrl: "u-asr", languageCode: "en", kind: "asr" }];
  const selected = yt.selectCaptionTrack(tracks, "");
  assert.equal(selected.baseUrl, "u-asr");
});

test("E3: prefers English over zh-Hans when no target-language context", () => {
  const { youtube: yt } = createCaptionHarness({ url: WATCH_URL });
  const tracks = [
    { baseUrl: "u-zh", languageCode: "zh-Hans", kind: "" },
    { baseUrl: "u-en", languageCode: "en", kind: "" },
  ];
  const selected = yt.selectCaptionTrack(tracks, "");
  assert.equal(selected.baseUrl, "u-en");
});

test("E3: returns null for empty track list (no throw / no hang)", () => {
  const { youtube: yt } = createCaptionHarness({ url: WATCH_URL });
  assert.equal(yt.selectCaptionTrack([], ""), null);
});

// ===========================================================================
// E4 — json3 解析为带时间轴序列（毫秒/1000、空 segs / 纯换行过滤、升序）
// ===========================================================================
test("E4: parseJson3Captions builds time-axis lines, filters noise, sorts asc", () => {
  const { youtube: yt } = createCaptionHarness({ url: WATCH_URL });
  const lines = yt.parseJson3Captions(buildJson3Payload());

  // 5 个 event 中：空 segs + 纯换行 被过滤 → 3 句有文本。
  assert.equal(lines.length, 3);

  // 升序：first(0) → second(2) → no-duration(6)。
  assert.equal(lines[0].sourceText, "first line");
  assert.equal(lines[1].sourceText, "second line");
  assert.equal(lines[2].sourceText, "no duration line");

  // tStartMs/1000、(tStartMs+dDurationMs)/1000，浮点误差 <= 0.001。
  assert.ok(Math.abs(lines[0].startTimeSeconds - 0) <= 0.001);
  assert.ok(Math.abs(lines[0].endTimeSeconds - 2) <= 0.001);
  assert.ok(Math.abs(lines[1].startTimeSeconds - 2) <= 0.001);
  assert.ok(Math.abs(lines[1].endTimeSeconds - 4) <= 0.001);

  // 无 dDurationMs → end = start（durationMs 缺省为 0）。
  assert.ok(Math.abs(lines[2].startTimeSeconds - 6) <= 0.001);
  assert.ok(Math.abs(lines[2].endTimeSeconds - 6) <= 0.001);
});

test("E4: parseJson3Captions returns empty for missing/empty events", () => {
  const { youtube: yt } = createCaptionHarness({ url: WATCH_URL });
  assert.equal(yt.parseJson3Captions(null).length, 0);
  assert.equal(yt.parseJson3Captions({}).length, 0);
  assert.equal(yt.parseJson3Captions({ events: [] }).length, 0);
});

test("E4: buildJson3CaptionUrl 规整为 fmt=json3（无 fmt 追加 / 清掉已有 fmt 再加）", () => {
  const { youtube: yt } = createCaptionHarness({ url: WATCH_URL });
  assert.equal(
    yt.buildJson3CaptionUrl("https://www.youtube.com/api/timedtext?v=abc&lang=en"),
    "https://www.youtube.com/api/timedtext?v=abc&lang=en&fmt=json3",
  );
  // 幂等：已含 fmt=json3 仍只有一个 fmt=json3。
  assert.equal(
    yt.buildJson3CaptionUrl("https://x/timedtext?v=abc&fmt=json3"),
    "https://x/timedtext?v=abc&fmt=json3",
  );
  // 关键修复：baseUrl 已带其他 fmt（如 srv3）→ 清掉再加 json3，避免重复 fmt 被取第一个返回 XML。
  assert.equal(
    yt.buildJson3CaptionUrl("https://x/timedtext?v=abc&fmt=srv3&lang=en"),
    "https://x/timedtext?v=abc&lang=en&fmt=json3",
  );
  assert.equal(
    yt.buildJson3CaptionUrl("https://x/timedtext?fmt=vtt"),
    "https://x/timedtext?fmt=json3",
  );
});

// ===========================================================================
// E5 — currentTime 定位（区间左闭右开 / 边界）+ 去重（同句不重复 post / 跨句切换）
// ===========================================================================
test("E5: findActiveCaptionLine locates line at 1.5s and boundary 2.0s", () => {
  const { youtube: yt } = createCaptionHarness({ url: WATCH_URL });
  const lines = [
    { startTimeSeconds: 0, endTimeSeconds: 2, sourceText: "a" },
    { startTimeSeconds: 2, endTimeSeconds: 4, sourceText: "b" },
  ];
  // 区间内：1.5s 落在 [0,2) → "a"。
  assert.equal(yt.findActiveCaptionLine(lines, 1.5).sourceText, "a");
  // 边界：2.0s 左闭右开 [2,4) → "b"（不再属于 [0,2)）。
  assert.equal(yt.findActiveCaptionLine(lines, 2.0).sourceText, "b");
  // 区间外（尾后）：4.0s 不属于任何区间 → null。
  assert.equal(yt.findActiveCaptionLine(lines, 4.0), null);
});

function watchCaptionTracks() {
  return [
    { baseUrl: "https://www.youtube.com/api/timedtext?v=abc&lang=en", languageCode: "en", kind: "" },
  ];
}

test("E5: same-line repeated timeupdate posts once; cross-line posts again", async () => {
  const harness = createCaptionHarness({
    url: WATCH_URL,
    playerResponse: buildPlayerResponse(watchCaptionTracks()),
    json3Payload: buildJson3Payload(),
  });
  const yt = harness.youtube;

  // 先排空 boot 期间的 in-flight fetch，再重置到干净状态（含 lastVideoCaptionSignature=""），
  // 让本测试的 await 调用执行完整的「读 player response → 选轨 → fetch json3 → 解析」。
  await flushMicrotasks();
  yt.resetVideoCaptionTrack();
  // 异步同源 fetch + json3 解析 → 填充 videoCaptionLines。
  const hasLines = await yt.ensureVideoCaptionTrackLoaded();
  assert.equal(hasLines, true, "caption lines should load from stub json3");
  assert.equal(yt.getVideoCaptionLines().length, 3);

  const countCaptionEvents = () =>
    harness.postedEvents.filter((event) => event.eventType === "video.caption.state.changed").length;

  // 清空 boot 期间的 posted events，从干净基线计数。
  harness.postedEvents.length = 0;

  // 第一次进入 [0,2) "first line" → post 1 次。
  yt.syncActiveCaptionLine(0.5, false);
  assert.equal(countCaptionEvents(), 1, "first line posts once");

  // 同句区间内再次同步（1.0s 仍 [0,2)）→ 去重，不重复 post。
  yt.syncActiveCaptionLine(1.0, false);
  assert.equal(countCaptionEvents(), 1, "same line is deduped");

  // 跨句切换到 [2,4) "second line" → 再 post 1 次。
  yt.syncActiveCaptionLine(2.5, false);
  assert.equal(countCaptionEvents(), 2, "cross-line posts again");
});

test("E5: timeupdate listener throttle skips bursts within window", async () => {
  const harness = createCaptionHarness({
    url: WATCH_URL,
    playerResponse: buildPlayerResponse(watchCaptionTracks()),
    json3Payload: buildJson3Payload(),
  });
  const yt = harness.youtube;
  await flushMicrotasks();
  yt.resetVideoCaptionTrack();
  await yt.ensureVideoCaptionTrackLoaded();

  // 装配 timeupdate 监听（A4 / A8）。boot 已装一次（videoTimeUpdateBound=true），
  // 直接 fire 已注册的 handler 即可；installVideoTimeUpdateListener 已装则返回 false。
  yt.installVideoTimeUpdateListener();
  assert.ok(harness.counters.timeupdateListener >= 1, "timeupdate listener installed");
  assert.equal(harness.counters.timeupdateListener, 1);

  harness.postedEvents.length = 0;
  const countCaptionEvents = () =>
    harness.postedEvents.filter((event) => event.eventType === "video.caption.state.changed").length;

  // 同一 ms 内连发两次 timeupdate：节流（>=120ms）应跳过第二次（同 Date.now()）。
  harness.setCurrentTime(0.5);
  harness.fireTimeUpdate();
  harness.setCurrentTime(2.5); // 即便时间变了，节流窗口内也应被跳过
  harness.fireTimeUpdate();
  // 第一帧产出 "first line"；第二帧被节流跳过 → 只 1 次 caption post。
  assert.equal(countCaptionEvents(), 1, "burst within throttle window posts once");
});

// ===========================================================================
// E6 — SPA 切视频重取（A→B 切换、签名重置、非视频页不读）
// ===========================================================================
function videoBJson3Payload() {
  return {
    events: [
      { tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: "video B opening line" }] },
      { tStartMs: 3000, dDurationMs: 2000, segs: [{ utf8: "video B second line" }] },
    ],
  };
}

test("E6: SPA route change re-fetches caption track for video B (not A)", async () => {
  const harness = createCaptionHarness({
    url: WATCH_URL,
    playerResponse: buildPlayerResponse(watchCaptionTracks()),
    json3Payload: buildJson3Payload(),
  });
  const yt = harness.youtube;

  // 视频 A 加载完成。
  await flushMicrotasks();
  yt.resetVideoCaptionTrack();
  await yt.ensureVideoCaptionTrackLoaded();
  assert.equal(yt.getVideoCaptionLines()[0].sourceText, "first line");

  // SPA 切到视频 B：先换 player response + json3 payload，再触发路由切换钩子。
  harness.setPlayerResponse(buildPlayerResponse(watchCaptionTracks()));
  harness.setJson3Payload(videoBJson3Payload());
  harness.postedEvents.length = 0;

  // navigate 改 location.href + 调用注入包裹的 history.pushState
  // → handleYouTubeRouteChange → resetVideoCaptionTrack + 重新加载。
  harness.navigate(WATCH_URL_B);
  await flushMicrotasks();

  const lines = yt.getVideoCaptionLines();
  assert.equal(lines.length, 2, "lines come from video B payload");
  assert.equal(lines[0].sourceText, "video B opening line");
  assert.notEqual(lines[0].sourceText, "first line", "must not reuse video A lines");

  // 签名重置：B 的首句被作为新句 post（不被视为与 A 重复）。
  const captionEvents = harness.postedEvents.filter(
    (event) => event.eventType === "video.caption.state.changed",
  );
  assert.ok(captionEvents.length >= 1, "video B first line posts after signature reset");
});

test("E6: route change to a non-video page does not read caption track", async () => {
  const harness = createCaptionHarness({
    url: WATCH_URL,
    playerResponse: buildPlayerResponse(watchCaptionTracks()),
    json3Payload: buildJson3Payload(),
  });
  const yt = harness.youtube;
  await flushMicrotasks();

  // 切到非视频页（首页）→ 路由钩子触发，但非视频页早退（不读字幕轨 / 不 fetch）。
  harness.counters.fetch = 0;
  harness.navigate(HOME_URL);
  await flushMicrotasks();

  assert.equal(harness.counters.fetch, 0, "non-video route must not fetch timedtext");
  assert.equal(yt.getVideoCaptionLines().length, 0, "no caption lines on non-video page");
});

// ===========================================================================
// E7 — 无 captionTracks 降级（captionAvailability="unavailable" 无异常）
// ===========================================================================
test("E7: video with no captionTracks degrades to unavailable (no throw)", async () => {
  const harness = createCaptionHarness({
    url: WATCH_URL,
    playerResponse: buildPlayerResponse(undefined), // 无 captions 字段
  });
  const yt = harness.youtube;
  await flushMicrotasks();
  yt.resetVideoCaptionTrack();

  const hasLines = await yt.ensureVideoCaptionTrackLoaded();
  assert.equal(hasLines, false, "no captionTracks → no lines");
  assert.equal(yt.getVideoCaptionLines().length, 0);

  // 同步当前句 → captionAvailability=unavailable，activeSegment 缺省，无异常。
  harness.postedEvents.length = 0;
  yt.syncActiveCaptionLine(1.0, true);
  const lastCaption = harness.postedEvents
    .filter((event) => event.eventType === "video.caption.state.changed")
    .pop();
  assert.equal(lastCaption?.payload.captionAvailability, "unavailable");
  assert.equal(lastCaption?.payload.activeSegment, undefined);
});

test("E7: empty captionTracks array degrades to unavailable", async () => {
  const harness = createCaptionHarness({
    url: WATCH_URL,
    playerResponse: buildPlayerResponse([]), // 空轨
  });
  const yt = harness.youtube;
  await flushMicrotasks();
  yt.resetVideoCaptionTrack();

  const hasLines = await yt.ensureVideoCaptionTrackLoaded();
  assert.equal(hasLines, false);
  assert.equal(yt.getVideoCaptionLines().length, 0);
});

// ===========================================================================
// E8 — 非视频页不注入（fetch / timeupdate 计数 = 0；视频页 >= 1）
// ===========================================================================
test("E8: non-video page does not fetch timedtext nor bind timeupdate", async () => {
  const harness = createCaptionHarness({
    url: HOME_URL,
    playerResponse: buildPlayerResponse(watchCaptionTracks()),
    json3Payload: buildJson3Payload(),
  });
  const yt = harness.youtube;
  // boot 期间在非视频页 syncVideoCaptionState 早退；再排空确认无 in-flight。
  await flushMicrotasks();

  assert.equal(harness.counters.fetch, 0, "home page must not fetch");
  assert.equal(harness.counters.timeupdateListener, 0, "home page must not bind timeupdate");

  // 主动调用 ensure / install 在非视频页也应早退（不读、不装）。
  const hasLines = await yt.ensureVideoCaptionTrackLoaded();
  assert.equal(hasLines, false);
  assert.equal(yt.installVideoTimeUpdateListener(), false);
  assert.equal(harness.counters.fetch, 0);
  assert.equal(harness.counters.timeupdateListener, 0);
});

test("E8: video page fetches timedtext once and binds timeupdate", async () => {
  const harness = createCaptionHarness({
    url: WATCH_URL,
    playerResponse: buildPlayerResponse(watchCaptionTracks()),
    json3Payload: buildJson3Payload(),
  });
  // boot 在视频页装配：fetch 首取 + timeupdate 监听各 >= 1。
  await flushMicrotasks();
  assert.ok(harness.counters.fetch >= 1, "video page fetches timedtext on boot");
  assert.ok(harness.counters.timeupdateListener >= 1, "video page binds timeupdate on boot");
});

// ===========================================================================
// E9 — InnerTube ANDROID client 取字幕轨（移动版 / Shorts / SPA 修复核心）
//
// 真机根因：iOS WKWebView 加载移动版 m.youtube.com，其播放器无 getPlayerResponse()，
// Shorts/SPA 切换后 ytInitialPlayerResponse 不更新 → 读不到当前视频字幕轨。修复改为
// InnerTube /youtubei/v1/player（ANDROID client，按 URL videoId 重取）优先，DOM 兜底。
// ===========================================================================
test("E9: buildInnerTubePlayerRequest 纯函数构造 ANDROID client 请求（锁定 site-adapter ↔ 注入侧不漂移）", () => {
  // 带 key：endpoint 带 key，body 用 ANDROID client + clientVersion + videoId。
  const withKey = buildInnerTubePlayerRequest("vid123", "API_KEY_X");
  assert.equal(withKey.url, "/youtubei/v1/player?key=API_KEY_X");
  const parsed = JSON.parse(withKey.body);
  assert.equal(parsed.context.client.clientName, "ANDROID", "必须 ANDROID client（WEB client 取不到 captionTracks）");
  assert.equal(parsed.context.client.clientVersion, "20.10.38", "clientVersion 与注入侧 E9 断言一致");
  assert.equal(parsed.videoId, "vid123");
  // 无 key（key 非必需）：endpoint 不带 query。
  const noKey = buildInnerTubePlayerRequest("vid456");
  assert.equal(noKey.url, "/youtubei/v1/player");
  assert.equal(JSON.parse(noKey.body).videoId, "vid456");
  // 同源相对路径（不打外部域）。
  assert.ok(withKey.url.indexOf("http") < 0 && withKey.url.indexOf("//") < 0, "endpoint 为同源相对路径");
});

test("E9: ensure 先打 InnerTube /youtubei/v1/player（ANDROID client + videoId）再取 timedtext", async () => {
  const harness = createCaptionHarness({
    url: WATCH_URL,
    playerResponse: buildPlayerResponse(watchCaptionTracks()),
    json3Payload: buildJson3Payload(),
  });
  const yt = harness.youtube;
  await flushMicrotasks();
  yt.resetVideoCaptionTrack();
  harness.counters.fetchUrls.length = 0;
  harness.counters.fetchBodies.length = 0;

  const hasLines = await yt.ensureVideoCaptionTrackLoaded();
  assert.equal(hasLines, true, "InnerTube → player response → 选轨 → timedtext → 解析到字幕");
  assert.equal(yt.getVideoCaptionLines().length, 3);

  // 第一跳必须打到 InnerTube player endpoint。
  assert.ok(
    harness.counters.fetchUrls[0].indexOf("/youtubei/v1/player") >= 0,
    "first fetch hits InnerTube /youtubei/v1/player",
  );
  // 请求体用 ANDROID client + 当前 videoId（abc123）。
  const innerTubeBody = harness.counters.fetchBodies[0];
  assert.ok(innerTubeBody.indexOf("ANDROID") >= 0, "InnerTube body uses ANDROID client");
  assert.ok(innerTubeBody.indexOf("20.10.38") >= 0, "InnerTube body pins ANDROID clientVersion（与纯函数锁定一致）");
  assert.ok(innerTubeBody.indexOf("abc123") >= 0, "InnerTube body carries current videoId");
  // 随后取 timedtext（带 fmt=json3）。
  assert.ok(
    harness.counters.fetchUrls.some(
      (u) => u.indexOf("timedtext") >= 0 && u.indexOf("fmt=json3") >= 0,
    ),
    "timedtext fetched with fmt=json3",
  );
});

test("E9: InnerTube 不可用时回退 getPlayerResponse 兜底仍取到字幕", async () => {
  const harness = createCaptionHarness({
    url: WATCH_URL,
    playerResponse: buildPlayerResponse(watchCaptionTracks()),
    json3Payload: buildJson3Payload(),
    innerTubeOk: false, // InnerTube 请求失败（403/网络）→ 回退页面 player response
  });
  const yt = harness.youtube;
  await flushMicrotasks();
  yt.resetVideoCaptionTrack();

  const hasLines = await yt.ensureVideoCaptionTrackLoaded();
  assert.equal(hasLines, true, "InnerTube 失败 → 回退 getPlayerResponse → 仍取到字幕");
  assert.equal(yt.getVideoCaptionLines().length, 3);
});

test("E9: Shorts 视频页也走 InnerTube 取字幕（按 URL videoId，不依赖播放器 DOM）", async () => {
  const harness = createCaptionHarness({
    url: SHORTS_URL,
    playerResponse: buildPlayerResponse(watchCaptionTracks()),
    json3Payload: buildJson3Payload(),
  });
  const yt = harness.youtube;
  await flushMicrotasks();
  yt.resetVideoCaptionTrack();
  harness.counters.fetchBodies.length = 0;

  const hasLines = await yt.ensureVideoCaptionTrackLoaded();
  assert.equal(hasLines, true, "Shorts 页经 InnerTube 取到字幕");
  // InnerTube body 携带 Shorts 的 videoId（来自 /shorts/shortAbc）。
  assert.ok(
    harness.counters.fetchBodies.some((b) => b.indexOf("shortAbc") >= 0),
    "InnerTube body carries shorts videoId from URL",
  );
});

// ===========================================================================
// E10 — native 预埋译文（primeVideoCaptionTranslations）· 占位闪烁修复：
// 换句构造状态时直接查 JS 侧译文表，首帧即双语，不再「先渲染占位、native 推回再换」。
// ===========================================================================
async function createPrimedHarness() {
  const harness = createCaptionHarness({
    url: WATCH_URL,
    playerResponse: buildPlayerResponse(watchCaptionTracks()),
    json3Payload: buildJson3Payload(),
  });
  const yt = harness.youtube;
  await flushMicrotasks();
  yt.resetVideoCaptionTrack();
  const hasLines = await yt.ensureVideoCaptionTrackLoaded();
  assert.equal(hasLines, true, "caption lines should load from stub json3");
  return { harness, yt };
}

function captionOverlay(harness) {
  return harness.windowLike.document.getElementById("agent-english-video-caption-overlay");
}

test("E10: primed line renders bilingual on the first frame of line change", async () => {
  const { harness, yt } = await createPrimedHarness();

  const primed = yt.primeVideoCaptionTranslations({
    videoId: "abc123",
    entries: { "second line": "第二行" },
  });
  assert.equal(primed, true);

  harness.postedEvents.length = 0;
  yt.syncActiveCaptionLine(2.5, false);

  assert.equal(captionOverlay(harness).textContent, "second line\n第二行");
  const lastEvent = harness.postedEvents
    .filter((event) => event.eventType === "video.caption.state.changed")
    .pop();
  assert.equal(lastEvent.payload.status, "translated");
  assert.equal(lastEvent.payload.activeSegment.translatedText, "第二行");
});

test("E10: un-primed waiting line renders source only (no placeholder line)", async () => {
  const { harness, yt } = await createPrimedHarness();

  yt.syncActiveCaptionLine(0.5, false);

  assert.equal(captionOverlay(harness).textContent, "first line");
});

test("E10: priming the currently displayed line refreshes overlay immediately", async () => {
  const { harness, yt } = await createPrimedHarness();

  harness.setCurrentTime(2.5);
  yt.syncActiveCaptionLine(2.5, false);
  assert.equal(captionOverlay(harness).textContent, "second line");

  yt.primeVideoCaptionTranslations({
    videoId: "abc123",
    entries: { "second line": "第二行" },
  });

  assert.equal(captionOverlay(harness).textContent, "second line\n第二行");
});

test("E10: prime with mismatched videoId is dropped (stale after swipe)", async () => {
  const { yt } = await createPrimedHarness();

  const primed = yt.primeVideoCaptionTranslations({
    videoId: "someOtherVideo",
    entries: { "second line": "第二行" },
  });

  assert.equal(primed, false);
  // vm 跨上下文对象原型不同，deepStrictEqual 会报引用不等——用 JSON 序列化比较。
  assert.equal(JSON.stringify(yt.getVideoCaptionTranslations()), "{}");
});

test("E10: SPA route change clears primed translations with the track", async () => {
  const { harness, yt } = await createPrimedHarness();

  yt.primeVideoCaptionTranslations({
    videoId: "abc123",
    entries: { "second line": "第二行" },
  });
  assert.equal(
    JSON.stringify(yt.getVideoCaptionTranslations()),
    JSON.stringify({ "second line": "第二行" }),
  );

  harness.navigate(WATCH_URL_B);

  assert.equal(JSON.stringify(yt.getVideoCaptionTranslations()), "{}");
});

test("E10: late prime from previous video is dropped while next track is still loading", async () => {
  const { harness, yt } = await createPrimedHarness();

  // 切到视频 B：resetVideoCaptionTrack 已清 videoCaptionTrackVideoId（轨道加载空窗期），
  // 此时 A（abc123）的迟到预埋必须被 URL videoId（def456）兜底拦下。
  harness.navigate(WATCH_URL_B);
  const primed = yt.primeVideoCaptionTranslations({
    videoId: "abc123",
    entries: { "second line": "第二行" },
  });

  assert.equal(primed, false);
  assert.equal(JSON.stringify(yt.getVideoCaptionTranslations()), "{}");
});
