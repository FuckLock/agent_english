import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import {
  BROWSER_AGENT_RUNTIME_SOURCE,
  youtubePageCapabilities,
  detectYouTubePage,
  isYouTubeSiteUrl,
} from "../dist/index.js";

const HANDLER_NAME = "agentEnglishBridge";

// ---------------------------------------------------------------------------
// Minimal DOM / window harness to execute the injected runtime IIFE.
// The runtime reads window.location.href dynamically, so route changes are
// simulated by mutating locationState.href (pushState/popstate do this too).
// ---------------------------------------------------------------------------
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

function createHarness({ url, readyState = "complete" }) {
  const locationState = { href: url };
  const postedEvents = [];
  const documentListenerCounts = {};
  const windowListenerCounts = {};
  const treeWalkerCalls = { count: 0 };
  const body = createMockElement("body");
  const registry = new Map();

  const documentLike = {
    title: "Mock Page",
    body,
    get readyState() {
      return readyState;
    },
    createElement(tagName) {
      return createMockElement(tagName);
    },
    getElementById(id) {
      return registry.get(id) ?? null;
    },
    querySelector() {
      // No YouTube player / caption nodes in the mock DOM.
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createTreeWalker() {
      treeWalkerCalls.count += 1;
      return { nextNode: () => null };
    },
    addEventListener(type) {
      documentListenerCounts[type] = (documentListenerCounts[type] ?? 0) + 1;
    },
    removeEventListener() {},
  };

  // getElementById must observe appended children that set an id afterwards.
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
    addEventListener(type, handler) {
      windowListenerCounts[type] = (windowListenerCounts[type] ?? 0) + 1;
      if (type === "popstate") {
        windowLike.__popstateHandler = handler;
      }
    },
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
    // 字幕轨 ensure 在视频页 boot/路由切换会发起 InnerTube/timedtext fetch；本 SPA 测试只关心
    // 路由识别 / 全局监听 / overlay 清理，不关心字幕内容。stub 返回空体即可（InnerTube null →
    // 回退页面 player response；无轨 → unavailable，不影响路由/监听/overlay 断言）。
    fetch() {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
    },
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
    console,
  };
  windowLike.window = windowLike;

  // pushState / popstate simulate SPA navigation by mutating location.href
  // before the runtime's wrapped handler re-detects the page type.
  windowLike.history.pushState = (_state, _title, nextUrl) => {
    if (nextUrl) {
      locationState.href = new URL(nextUrl, locationState.href).href;
    }
  };
  windowLike.history.replaceState = (_state, _title, nextUrl) => {
    if (nextUrl) {
      locationState.href = new URL(nextUrl, locationState.href).href;
    }
  };

  const context = vm.createContext(windowLike);
  const source = BROWSER_AGENT_RUNTIME_SOURCE.replace(
    /__HANDLER_NAME__/g,
    HANDLER_NAME,
  );
  vm.runInContext(source, context);

  return {
    windowLike,
    locationState,
    postedEvents,
    documentListenerCounts,
    windowListenerCounts,
    treeWalkerCalls,
    bridge: windowLike.__agentEnglishBridge,
    youtube: windowLike.__agentEnglishYouTubeInjection,
    navigate(nextUrl) {
      // Simulate SPA pushState navigation then fire the wrapped handler.
      windowLike.history.pushState({}, "", nextUrl);
    },
    popTo(nextUrl) {
      locationState.href = new URL(nextUrl, locationState.href).href;
      windowLike.__popstateHandler?.();
    },
  };
}

// ---------------------------------------------------------------------------
// E2 — capability declarations (youtube-adapter)
// ---------------------------------------------------------------------------
test("E2: YouTube non-video pages do not declare inline-translation", () => {
  const nonVideoUrls = [
    "https://www.youtube.com/",
    "https://www.youtube.com/feed/subscriptions",
    "https://www.youtube.com/results?search_query=english",
    "https://m.youtube.com/",
    "https://music.youtube.com/",
  ];
  for (const url of nonVideoUrls) {
    const capabilities = youtubePageCapabilities(url);
    assert.equal(
      capabilities.includes("inline-translation"),
      false,
      `${url} must not declare inline-translation`,
    );
  }
});

test("E2: YouTube video pages keep caption and audio capabilities", () => {
  const watch = youtubePageCapabilities("https://www.youtube.com/watch?v=abc");
  for (const capability of [
    "captions-unavailable",
    "video-caption-fallback",
    "audio-translation-beta",
    "video-audio-translation",
  ]) {
    assert.equal(watch.includes(capability), true, `watch must include ${capability}`);
  }
  assert.equal(watch.includes("inline-translation"), false);
});

test("E2: detectYouTubePage covers all five YouTube hosts", () => {
  const hosts = [
    "https://youtube.com/",
    "https://www.youtube.com/",
    "https://m.youtube.com/",
    "https://music.youtube.com/",
    "https://youtu.be/dQw4w9WgXcQ",
  ];
  for (const url of hosts) {
    assert.equal(detectYouTubePage(url).isYouTube, true, `${url} must be YouTube`);
  }
  assert.equal(detectYouTubePage("https://www.reddit.com/").isYouTube, false);
  assert.equal(detectYouTubePage("https://en.wikipedia.org/").isYouTube, false);
});

test("E2: isYouTubeSiteUrl distinguishes site vs non-YouTube", () => {
  assert.equal(isYouTubeSiteUrl("https://www.youtube.com/feed/subscriptions"), true);
  assert.equal(isYouTubeSiteUrl("https://youtu.be/dQw4w9WgXcQ"), true);
  assert.equal(isYouTubeSiteUrl("https://www.reddit.com/"), false);
});

// ---------------------------------------------------------------------------
// Harness smoke test — confirms the injected runtime IIFE executes and
// exposes its bridge / YouTube injection surface in the mock context.
// ---------------------------------------------------------------------------
test("harness boots the runtime bridge in a YouTube context", () => {
  const harness = createHarness({ url: "https://www.youtube.com/" });
  assert.equal(typeof harness.bridge?.requestTranslation, "function");
  assert.equal(typeof harness.youtube?.detectYouTubePage, "function");
  // boot + ping + page.ready posted regardless of site.
  assert.ok(harness.postedEvents.some((event) => event.eventType === "bridge.boot"));
  assert.ok(harness.postedEvents.some((event) => event.eventType === "page.ready"));
});

// ---------------------------------------------------------------------------
// E3 — SPA route re-detection (A4.2)
// ---------------------------------------------------------------------------
test("E3: pushState from home to /watch re-detects video page, then back", () => {
  const harness = createHarness({ url: "https://www.youtube.com/" });

  assert.equal(harness.youtube.detectYouTubePage().isVideoPage, false);

  harness.navigate("https://www.youtube.com/watch?v=abc123");
  assert.equal(harness.youtube.detectYouTubePage().isVideoPage, true);
  assert.equal(harness.youtube.detectYouTubePage().pageKind, "youtube-watch");

  harness.navigate("https://www.youtube.com/feed/subscriptions");
  assert.equal(harness.youtube.detectYouTubePage().isVideoPage, false);
});

test("E3: popstate route change re-detects page type", () => {
  const harness = createHarness({ url: "https://www.youtube.com/watch?v=abc123" });
  assert.equal(harness.youtube.detectYouTubePage().isVideoPage, true);

  harness.popTo("https://www.youtube.com/");
  assert.equal(harness.youtube.detectYouTubePage().isVideoPage, false);
});

test("E3: runtime wraps history.pushState/replaceState and listens to popstate", () => {
  const harness = createHarness({ url: "https://www.youtube.com/" });
  // popstate listener registered on window.
  assert.equal(harness.windowListenerCounts.popstate >= 1, true);
  // pushState/replaceState are wrapped (route hook flag set).
  assert.equal(harness.windowLike.__agentEnglishYouTubeRouteHooked, true);
});

// ---------------------------------------------------------------------------
// E3 — YouTube whole-site skips full DOM scan (A5.1 / A8.1)
// ---------------------------------------------------------------------------
test("E3: YouTube home requestTranslation does not scan or emit segments", () => {
  const harness = createHarness({ url: "https://www.youtube.com/" });
  harness.postedEvents.length = 0;
  harness.treeWalkerCalls.count = 0;

  const result = harness.bridge.requestTranslation({});

  assert.equal(result, false, "non-video YouTube requestTranslation must short-circuit");
  assert.equal(harness.treeWalkerCalls.count, 0, "must not run TreeWalker full scan");
  const requested = harness.postedEvents.filter(
    (event) => event.eventType === "translation.requested",
  );
  assert.equal(requested.length, 0, "must not emit translation.requested with segments");
});

test("E3: YouTube search results page does not scan", () => {
  const harness = createHarness({
    url: "https://www.youtube.com/results?search_query=english",
  });
  harness.treeWalkerCalls.count = 0;
  harness.bridge.requestTranslation({});
  assert.equal(harness.treeWalkerCalls.count, 0);
});

// ---------------------------------------------------------------------------
// E3 — YouTube does not register interaction-breaking global listeners (A6)
// ---------------------------------------------------------------------------
test("E3: YouTube whole-site registers zero pointer/touch/key global listeners", () => {
  const harness = createHarness({ url: "https://www.youtube.com/" });
  for (const type of ["mouseup", "touchend", "touchstart", "touchmove", "keyup"]) {
    assert.equal(
      harness.documentListenerCounts[type] ?? 0,
      0,
      `YouTube must not register global ${type} listener`,
    );
  }
});

test("E3: YouTube video page also registers zero pointer/touch/key global listeners", () => {
  const harness = createHarness({ url: "https://www.youtube.com/watch?v=abc123" });
  for (const type of ["mouseup", "touchend", "touchstart", "touchmove", "keyup"]) {
    assert.equal(harness.documentListenerCounts[type] ?? 0, 0);
  }
});

test("E3: non-YouTube site still registers selection listeners (regression guard)", () => {
  const harness = createHarness({ url: "https://en.wikipedia.org/wiki/English_language" });
  assert.equal(harness.documentListenerCounts.mouseup ?? 0, 1);
  assert.equal(harness.documentListenerCounts.touchend ?? 0, 1);
  assert.equal(harness.documentListenerCounts.keyup ?? 0, 1);
});

// ---------------------------------------------------------------------------
// E3 — non-video page does not render overlay surface (A7.2)
// ---------------------------------------------------------------------------
test("E3: YouTube non-video page renders no caption surface", () => {
  const harness = createHarness({ url: "https://www.youtube.com/" });
  // syncVideoCaptionState ran on boot; ask injection to render directly.
  harness.youtube.syncVideoCaptionState(true);
  const overlay = harness.windowLike.document.getElementById(
    "agent-english-video-caption-overlay",
  );
  const fallback = harness.windowLike.document.getElementById(
    "agent-english-video-caption-fallback",
  );
  assert.equal(overlay, null, "non-video page must not render caption overlay surface");
  assert.equal(fallback, null, "non-video page must not render caption fallback surface");
});

test("E3: navigating away from video clears residual overlay", () => {
  const harness = createHarness({ url: "https://www.youtube.com/watch?v=abc123" });
  // Force a caption surface on the video page.
  harness.youtube.applyVideoCaptionOverlayState({
    pageId: "p",
    siteKind: "youtube",
    pageKind: "youtube-watch",
    url: "https://www.youtube.com/watch?v=abc123",
    overlayMode: "fallback-bar",
    status: "caption-unavailable",
    message: "no captions",
  });
  assert.notEqual(
    harness.windowLike.document.getElementById("agent-english-video-caption-fallback"),
    null,
  );

  // Route to a non-video page; injection must remove the residual surface.
  harness.navigate("https://www.youtube.com/feed/subscriptions");
  assert.equal(
    harness.windowLike.document.getElementById("agent-english-video-caption-overlay"),
    null,
  );
  assert.equal(
    harness.windowLike.document.getElementById("agent-english-video-caption-fallback"),
    null,
  );
});
