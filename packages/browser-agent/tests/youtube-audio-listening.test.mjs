import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import { BROWSER_AGENT_RUNTIME_SOURCE } from "../dist/index.js";

// ---------------------------------------------------------------------------
// Phase 8.13 — 听音前端集成 注入式单测（E1–E5）：captionTracks=0 自动切听音、
// 进度段桶去重、整句双语接 overlay、SPA 重判。
//
// 不真实出网（criteria C4）：stub InnerTube player response（captionTracks=0 / ≥1）
// + stub fetch + stub video.currentTime + window.__agentEnglishAudioPrivacyAccepted。
// 被测的是 BROWSER_AGENT_RUNTIME_SOURCE 拼接出的真实注入运行时（与 generated.swift
// 同一字符串），经 window.__agentEnglishYouTubeInjection 暴露纯函数入口。
// harness 模型沿用 youtube-caption-track.test.mjs（vm context + mock DOM + postedEvents）。
// ---------------------------------------------------------------------------

const HANDLER_NAME = "agentEnglishBridge";

function buildPlayerResponse(captionTracks) {
  if (captionTracks === undefined) {
    return {}; // 无 captions 字段 → captionTracks=0
  }
  return { captions: { playerCaptionsTracklistRenderer: { captionTracks } } };
}

function buildJson3Payload() {
  return {
    events: [
      { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: "hello world" }] },
      { tStartMs: 2000, dDurationMs: 2000, segs: [{ utf8: "second line" }] },
    ],
  };
}

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

// 听音 harness：captionTracks=0（默认无 captions）→ 无字幕轨自动切听音路径；
// setPrivacyAccepted 控制 window.__agentEnglishAudioPrivacyAccepted（隐私 flag 闭环）。
function createListeningHarness({
  url,
  playerResponse = null,
  json3Payload = null,
  privacyAccepted = false,
  currentTime = 0,
}) {
  const locationState = { href: url };
  const postedEvents = [];
  const counters = { fetch: 0 };
  let playerResponseRef = playerResponse;
  let json3PayloadRef = json3Payload;
  const videoListeners = {};
  const videoState = { currentTime };

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
  };

  const moviePlayer = createMockElement("div");
  moviePlayer.id = "movie_player";
  moviePlayer.getPlayerResponse = () => playerResponseRef;
  const body = createMockElement("body");

  const documentLike = {
    title: "Mock Video Page",
    body,
    get readyState() {
      return "complete";
    },
    createElement(tagName) {
      return createMockElement(tagName);
    },
    getElementById() {
      return null;
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
        return videoElement;
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
    __agentEnglishAudioPrivacyAccepted: privacyAccepted,
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
    fetch(requestUrl) {
      counters.fetch += 1;
      if (String(requestUrl).indexOf("/youtubei/v1/player") >= 0) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(playerResponseRef) });
      }
      return Promise.resolve({ ok: json3PayloadRef !== null, json: () => Promise.resolve(json3PayloadRef) });
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
  vm.runInContext(BROWSER_AGENT_RUNTIME_SOURCE.replace(/__HANDLER_NAME__/g, HANDLER_NAME), context);

  return {
    windowLike,
    locationState,
    postedEvents,
    counters,
    youtube: windowLike.__agentEnglishYouTubeInjection,
    setPlayerResponse(next) {
      playerResponseRef = next;
    },
    setJson3Payload(next) {
      json3PayloadRef = next;
    },
    setPrivacyAccepted(value) {
      windowLike.__agentEnglishAudioPrivacyAccepted = value;
    },
    setCurrentTime(value) {
      videoState.currentTime = value;
    },
    navigate(nextUrl) {
      locationState.href = new URL(nextUrl, locationState.href).href;
      windowLike.history.pushState({}, "", nextUrl);
    },
    fireTimeUpdate() {
      videoListeners.timeupdate?.();
    },
    audioEvents() {
      return postedEvents.filter((event) => event.eventType === "video.audio.state.changed");
    },
    lastAudio() {
      const list = this.audioEvents();
      return list.length ? list[list.length - 1] : undefined;
    },
  };
}

const SHORTS_URL = "https://www.youtube.com/shorts/noCaptionShort";
const WATCH_WITH_CAPTION = "https://www.youtube.com/watch?v=hasCaption";

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ===========================================================================
// E1 — 测试文件存在 + 听音注入入口可用
// ===========================================================================
test("E1: listening injection surface is exposed", () => {
  const { youtube: yt } = createListeningHarness({ url: SHORTS_URL });
  assert.equal(typeof yt?.buildYouTubeVideoAudioState, "function");
  assert.equal(typeof yt?.postVideoAudioState, "function");
  assert.equal(typeof yt?.reportVideoAudioProgress, "function");
  assert.equal(typeof yt?.requestVideoAudioTranslation, "function");
});

// ===========================================================================
// E2 — captionTracks=0 自动切：隐私已接受→recognizing；未接受→privacy-required；有字幕轨→caption
// ===========================================================================
test("E2: captionTracks=0 + privacy accepted -> auto recognizing (not stuck on privacy-required)", async () => {
  const harness = createListeningHarness({
    url: SHORTS_URL,
    playerResponse: buildPlayerResponse(undefined), // 无 captions → captionTracks=0
    privacyAccepted: true,
  });
  await flushMicrotasks(); // boot 的 ensureVideoCaptionTrackLoaded settle → videoCaptionTrackUnavailable=true
  harness.postedEvents.length = 0;
  harness.youtube.reportVideoAudioProgress(true);
  const last = harness.lastAudio();
  assert.ok(last, "should post an audio state event when caption track is unavailable");
  assert.equal(last.payload.source, "audio");
  assert.equal(last.payload.status, "recognizing", "privacy accepted → auto recognizing, not privacy-required");
});

test("E2: captionTracks=0 + privacy NOT accepted -> privacy-required (no progress upload)", async () => {
  const harness = createListeningHarness({
    url: SHORTS_URL,
    playerResponse: buildPlayerResponse(undefined),
    privacyAccepted: false,
  });
  await flushMicrotasks();
  harness.postedEvents.length = 0;
  harness.youtube.reportVideoAudioProgress(true);
  const last = harness.lastAudio();
  assert.ok(last, "should post a privacy-required audio state");
  assert.equal(last.payload.source, "audio");
  assert.equal(last.payload.status, "privacy-required");
});

test("E2: caption track available -> stays caption source (not switched to audio)", async () => {
  const harness = createListeningHarness({
    url: WATCH_WITH_CAPTION,
    playerResponse: buildPlayerResponse([
      { baseUrl: "https://www.youtube.com/api/timedtext?v=hasCaption&lang=en", languageCode: "en", kind: "" },
    ]),
    json3Payload: buildJson3Payload(),
    privacyAccepted: true,
  });
  await flushMicrotasks();
  const state = harness.youtube.buildYouTubeVideoAudioState();
  assert.equal(state?.source, "caption", "with caption track present, audio source must not auto-switch");
});

// ===========================================================================
// E3 — 进度段桶去重：同段多次 timeupdate 只 1 次；跨段换桶触发新段
// ===========================================================================
test("E3: segment-bucket dedupe — same bucket no new event, crossing bucket triggers one more", async () => {
  const harness = createListeningHarness({
    url: SHORTS_URL,
    playerResponse: buildPlayerResponse(undefined),
    privacyAccepted: true,
    currentTime: 0,
  });
  await flushMicrotasks(); // boot 自动切已 post 段 0（currentTime=0）recognizing，signature 记录在案
  const baseline = harness.audioEvents().length;
  assert.ok(baseline >= 1, "boot auto-switch posts the first segment");
  const seg0 = harness.lastAudio()?.payload.activeSegment?.audioSegmentId;

  // 段桶去重（signature 机制，独立于 timeupdate 节流）：同段（第 0 桶 [0,6)）多次上报 → 同一
  // audioSegmentId → postVideoAudioState 去重、不新增事件（这正是「不重复打后端 / 不耗额度」）。
  harness.setCurrentTime(1);
  harness.youtube.reportVideoAudioProgress(false);
  harness.setCurrentTime(2);
  harness.youtube.reportVideoAudioProgress(false);
  assert.equal(harness.audioEvents().length, baseline, "same segment bucket dedupes (no new event)");

  // 跨段（进入第 1 桶 [6,12)）→ 新 audioSegmentId → 触发 1 个新段事件。
  harness.setCurrentTime(7);
  harness.youtube.reportVideoAudioProgress(false);
  assert.equal(harness.audioEvents().length, baseline + 1, "crossing into a new segment bucket triggers one more event");
  assert.notEqual(harness.lastAudio()?.payload.activeSegment?.audioSegmentId, seg0, "new bucket yields a new audioSegmentId");

  // 单段稳健：reportVideoAudioProgress 不抛异常（单段失败不阻断后续 / 不阻塞播放）。
  assert.doesNotThrow(() => harness.youtube.reportVideoAudioProgress(false), "progress report does not throw");
});

// ===========================================================================
// E4 — 整句双语接 overlay：识别出的 sourceText + translatedText + 时间轴随听音 state 上报
// ===========================================================================
test("E4: recognized bilingual sentence is carried on the audio state (single overlay path)", async () => {
  const harness = createListeningHarness({
    url: SHORTS_URL,
    playerResponse: buildPlayerResponse(undefined),
    privacyAccepted: true,
  });
  await flushMicrotasks();
  harness.postedEvents.length = 0;

  const state = harness.youtube.buildYouTubeVideoAudioState({
    source: "audio",
    status: "recognizing",
    sourceText: "the last thing I want to do",
    translatedText: "我最不想做的事",
    startTimeSeconds: 6,
    endTimeSeconds: 12,
  });
  harness.youtube.postVideoAudioState(state, true);
  const last = harness.lastAudio();
  assert.ok(last, "audio state with bilingual sentence is posted");
  assert.equal(last.payload.activeSegment?.sourceText, "the last thing I want to do");
  assert.equal(last.payload.activeSegment?.translatedText, "我最不想做的事");
  assert.equal(last.payload.activeSegment?.startTimeSeconds, 6);
  assert.equal(last.payload.activeSegment?.endTimeSeconds, 12);
});

// ===========================================================================
// E5 — SPA 重判：无字幕轨视频 → 切到有字幕轨视频后不再处于听音 audio source
// ===========================================================================
test("E5: SPA navigation from no-caption to captioned video re-judges source", async () => {
  const harness = createListeningHarness({
    url: SHORTS_URL,
    playerResponse: buildPlayerResponse(undefined),
    json3Payload: buildJson3Payload(),
    privacyAccepted: true,
  });
  await flushMicrotasks();
  // 初始无字幕轨 → audio source。
  assert.equal(harness.youtube.buildYouTubeVideoAudioState()?.source, "audio");

  // SPA 切到有字幕轨视频：切 player response 为含 caption track，再触发路由变更重判。
  harness.setPlayerResponse(
    buildPlayerResponse([
      { baseUrl: "https://www.youtube.com/api/timedtext?v=def&lang=en", languageCode: "en", kind: "" },
    ]),
  );
  harness.navigate(WATCH_WITH_CAPTION);
  await flushMicrotasks();
  assert.equal(
    harness.youtube.buildYouTubeVideoAudioState()?.source,
    "caption",
    "after navigating to a captioned video, source must re-judge to caption",
  );
});
