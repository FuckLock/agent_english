import Foundation

enum BrowserAgentRuntimeSource {
    // Generated from packages/browser-agent/src/browser-runtime-source.ts.
    static let source = #"""
(() => {
  const bridge = window.webkit?.messageHandlers?.__HANDLER_NAME__;
  if (!bridge || window.__agentEnglishBridgeBootstrapped) {
    return;
  }

  window.__agentEnglishBridgeBootstrapped = true;

  const schemaVersion = 1;
  const genericCapabilities = [
    "readable-page",
    "inline-translation",
    "selection-fallback",
  ];
  const displayModes = {
    original: "original",
    bilingual: "bilingual",
    learning: "learning",
  };
  const blockTags = new Set([
    "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "FIGCAPTION", "FOOTER",
    "HEADER", "LI", "MAIN", "NAV", "P", "SECTION",
  ]);
  const pageNoticeId = "agent-english-page-notice";
  const overlayClassName = "agent-english-translation-overlay";
  const videoCaptionOverlayId = "agent-english-video-caption-overlay";
  const videoCaptionFallbackId = "agent-english-video-caption-fallback";
  const videoCaptionOverlayClassName = "agent-english-video-caption-overlay";
  const videoCaptionFallbackClassName = "agent-english-video-caption-fallback";
  const expandedSegmentIds = new Set();
  const overlaysBySegmentId = new Map();
  const anchorsBySegmentId = new Map();
  const sessionId = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : "session-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  const pageId = "page-" + sessionId;
  let currentDisplayMode = displayModes.original;
  let lastSelectionFingerprint = "";
  let lastVideoCaptionSignature = "";
  let lastVideoAudioSignature = "";
  let videoCaptionTimer = null;
  let pendingSelectionTimer = null;
  // Phase 8.9：视频自带字幕轨数据时间同步状态（IIFE 词法作用域共享）。
  let videoCaptionLines = [];        // 当前视频解析后的字幕句序列（仅内存，不缓存整轨 / 不持久化）
  let videoCaptionTrackVideoId = ""; // 已加载字幕轨对应的 videoId（防重复 fetch；SPA 切视频时重置）
  let videoCaptionTrackLoading = false;
  let videoCaptionTrackLanguage = "";
  let videoCaptionTrackIsAuto = false;
  let videoCaptionTrackUnavailable = false;
  let videoTimeUpdateBound = false;
  let lastVideoTimeUpdateAt = 0;

  const postBridgeEvent = (eventType, payload, metadata = {}) => {
    bridge.postMessage({
      schemaVersion,
      eventType,
      requestId: metadata.requestId,
      pageId,
      payload,
      result: metadata.result,
      error: metadata.error,
    });
  };

  const normalizeText = (text) => (text ?? "").replace(/\s+/g, " ").trim();
  const hashSeed = (prefix, seed) => {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return prefix + "-" + (hash >>> 0).toString(16);
  };

  const isVisible = (element) => {
    let currentElement = element;
    while (currentElement) {
      const style = getComputedStyle(currentElement);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
      }
      const rect = currentElement.getBoundingClientRect();
      if (rect.width <= 0 && rect.height <= 0) {
        return false;
      }
      currentElement = currentElement.parentElement;
    }
    return true;
  };
  const siblingIndex = (element) => {
    if (!element.parentElement) {
      return 1;
    }
    const siblings = Array.from(element.parentElement.children)
      .filter((sibling) => sibling.tagName === element.tagName);
    return Math.max(1, siblings.indexOf(element) + 1);
  };
  const elementPath = (element) => {
    if (!element.parentElement) {
      return element.tagName.toLowerCase();
    }
    return (
      elementPath(element.parentElement) +
      ">" +
      element.tagName.toLowerCase() +
      ":nth-of-type(" +
      siblingIndex(element) +
      ")"
    );
  };
  const blockContainer = (element) => {
    let currentElement = element;
    while (currentElement?.parentElement) {
      if (blockTags.has(currentElement.tagName)) {
        return currentElement;
      }
      const display = getComputedStyle(currentElement).display;
      if (display === "block" || display === "flex" || display === "grid" || display === "list-item") {
        return currentElement;
      }
      currentElement = currentElement.parentElement;
    }
    return currentElement ?? element;
  };
  const deriveSelectionKind = (selectedText) => {
    const normalizedText = normalizeText(selectedText);
    if (!normalizedText) {
      return "phrase";
    }
    const wordCount = normalizedText.split(/\s+/).filter(Boolean).length;
    if (/[.!?。！？]/u.test(normalizedText) || wordCount >= 6) {
      return "sentence";
    }
    if (wordCount > 1) {
      return "phrase";
    }
    return "word";
  };
  const isManagedAgentNode = (element) => {
    if (!element) {
      return false;
    }
    return (
      element.id === pageNoticeId ||
      element.id === videoCaptionOverlayId ||
      element.id === videoCaptionFallbackId ||
      element.classList?.contains(overlayClassName) === true ||
      element.classList?.contains(videoCaptionOverlayClassName) === true ||
      element.classList?.contains(videoCaptionFallbackClassName) === true ||
      element.closest?.("." + overlayClassName) != null ||
      element.closest?.("." + videoCaptionOverlayClassName) != null ||
      element.closest?.("." + videoCaptionFallbackClassName) != null
    );
  };
  const runtimeHostMatches = (url, hosts) => {
    const hostname = url.hostname.toLowerCase();
    return hosts.some((host) => hostname === host || hostname.endsWith("." + host));
  };
  const runtimeSiteProfile = (urlText) => {
    let url;
    try {
      url = new URL(urlText);
    } catch {
      return { siteKind: "generic", capabilities: [...genericCapabilities] };
    }
    const path = url.pathname;
    if (runtimeHostMatches(url, ["youtube.com", "youtu.be"])) {
      const isVideoPage =
        url.hostname === "youtu.be" ||
        path === "/watch" ||
        path.startsWith("/shorts/");
      const capabilities = [
        ...genericCapabilities,
        "comments",
        "search-results",
        "dynamic-content",
      ];
      if (isVideoPage) {
        capabilities.push(
          "captions-unavailable",
          "video-caption-fallback",
          "audio-translation-beta",
          "video-audio-translation",
        );
      }
      return { siteKind: "youtube", capabilities: Array.from(new Set(capabilities)) };
    }
    if (runtimeHostMatches(url, ["reddit.com"])) {
      return {
        siteKind: "reddit",
        capabilities: Array.from(new Set([...genericCapabilities, "comments", "dynamic-content"])),
      };
    }
    if (runtimeHostMatches(url, ["wikipedia.org"])) {
      return {
        siteKind: "wikipedia",
        capabilities: Array.from(new Set([...genericCapabilities, "longform-reading"])),
      };
    }
    if (runtimeHostMatches(url, ["archiveofourown.org"])) {
      return {
        siteKind: "ao3",
        capabilities: Array.from(new Set([...genericCapabilities, "longform-reading"])),
      };
    }
    if (runtimeHostMatches(url, ["x.com", "twitter.com"])) {
      return {
        siteKind: "x",
        capabilities: Array.from(new Set([...genericCapabilities, "dynamic-content"])),
      };
    }
    return { siteKind: "generic", capabilities: [...genericCapabilities] };
  };

  const scanPage = (config) => {
    const siteProfile = runtimeSiteProfile(window.location.href);
    const pageCapabilities = [...siteProfile.capabilities];
    const groups = new Map();
    anchorsBySegmentId.clear();
    // Phase 8.7 / A5.2：YouTube 整站不走 TreeWalker 全量遍历产出文本 segments
    // （视频页只产字幕句、非视频页不产 segments）；直接返回空 segments，与通用文本网页
    // 全量扫描路径隔离。其它站点行为不变。
    if (siteProfile.siteKind === "youtube") {
      return {
        pageContext: {
          pageId,
          url: window.location.href,
          title: document.title || "",
          sourceLanguage: config.sourceLanguage,
          targetLanguage: config.targetLanguage,
          displayMode: config.displayMode,
          capabilities: pageCapabilities,
          siteKind: siteProfile.siteKind,
        },
        segments: [],
      };
    }
    const walker = document.body ? document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT) : null;
    if (!walker) {
      return null;
    }

    let textNode = walker.nextNode();
    while (textNode) {
      const normalizedText = normalizeText(textNode.textContent);
      const parentElement = textNode.parentElement;
      if (normalizedText && parentElement && isVisible(parentElement)) {
        const anchorElement = blockContainer(parentElement);
        const containerPath = elementPath(anchorElement);
        const existingGroup = groups.get(containerPath) ?? {
          anchorElement,
          containerPath,
          sourceTextParts: [],
          capabilities: pageCapabilities,
        };
        existingGroup.sourceTextParts.push(normalizedText);
        groups.set(containerPath, existingGroup);
      }
      textNode = walker.nextNode();
    }

    const segments = Array.from(groups.values()).map((group) => {
      const sourceText = normalizeText(group.sourceTextParts.join(" "));
      const segmentId = hashSeed("seg", pageId + ":" + group.containerPath + ":" + sourceText);
      anchorsBySegmentId.set(segmentId, group.anchorElement);
      return {
        pageId,
        segmentId,
        sourceText,
        containerPath: group.containerPath,
        sourceLanguage: config.sourceLanguage,
        isVisible: true,
        capabilities: group.capabilities,
      };
    });

    return {
      pageContext: {
        pageId,
        url: window.location.href,
        title: document.title || "",
        sourceLanguage: config.sourceLanguage,
        targetLanguage: config.targetLanguage,
        displayMode: config.displayMode,
        capabilities: pageCapabilities,
        siteKind: siteProfile.siteKind,
      },
      segments,
    };
  };

  const extractSelectionPayload = () => {
    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0) {
      lastSelectionFingerprint = "";
      return null;
    }
    const selectedText = normalizeText(selection.toString());
    if (!selectedText) {
      lastSelectionFingerprint = "";
      return null;
    }
    const range = selection.getRangeAt(0);
    const rawContainer = range.commonAncestorContainer;
    const anchorElement = rawContainer?.nodeType === Node.TEXT_NODE ? rawContainer.parentElement : rawContainer;
    if (!anchorElement || isManagedAgentNode(anchorElement)) {
      return null;
    }
    const containerElement = blockContainer(anchorElement);
    if (!containerElement || isManagedAgentNode(containerElement)) {
      return null;
    }
    const containerPath = elementPath(containerElement);
    const containerText = normalizeText(containerElement.textContent || "");
    const matchIndex = containerText.indexOf(selectedText);
    const contextBefore = matchIndex >= 0
      ? normalizeText(containerText.slice(Math.max(0, matchIndex - 120), matchIndex))
      : "";
    const afterStart = matchIndex >= 0 ? matchIndex + selectedText.length : 0;
    const contextAfter = matchIndex >= 0
      ? normalizeText(containerText.slice(afterStart, afterStart + 120))
      : "";
    const selectionId = hashSeed(
      "sel",
      pageId + ":" + containerPath + ":" + selectedText + ":" + contextBefore + ":" + contextAfter,
    );
    return {
      pageId,
      selectionId,
      selectedText,
      contextBefore,
      contextAfter,
      sourceUrl: window.location.href,
      sourceTitle: document.title || "",
      containerPath,
      kind: deriveSelectionKind(selectedText),
    };
  };
  const postSelectionRequested = () => {
    const payload = extractSelectionPayload();
    if (!payload) {
      return false;
    }
    const fingerprint = payload.selectionId + ":" + payload.selectedText;
    if (fingerprint === lastSelectionFingerprint) {
      return false;
    }
    lastSelectionFingerprint = fingerprint;
    postBridgeEvent("selection.requested", payload, {
      requestId: "selection-requested-" + payload.selectionId,
      pageId,
    });
    return true;
  };
  const scheduleSelectionRequested = () => {
    if (pendingSelectionTimer) {
      window.clearTimeout(pendingSelectionTimer);
    }
    pendingSelectionTimer = window.setTimeout(() => {
      pendingSelectionTimer = null;
      postSelectionRequested();
    }, 0);
  };
  const detectYouTubePage = () => {
    let url;
    try {
      url = new URL(window.location.href);
    } catch {
      return { isYouTube: false, isVideoPage: false };
    }
    const youtubeHosts = new Set([
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtu.be",
    ]);
    if (!youtubeHosts.has(url.hostname)) {
      return { isYouTube: false, isVideoPage: false };
    }
    if (url.hostname === "youtu.be") {
      const videoId = url.pathname.replace(/^\/+/, "").split(/[/?#]/)[0] || undefined;
      return { isYouTube: true, isVideoPage: Boolean(videoId), pageKind: "youtube-watch", videoId };
    }
    if (url.pathname === "/watch") {
      const videoId = url.searchParams.get("v") || undefined;
      return { isYouTube: true, isVideoPage: Boolean(videoId), pageKind: "youtube-watch", videoId };
    }
    if (url.pathname.startsWith("/shorts/")) {
      const videoId = url.pathname.replace(/^\/shorts\//, "").split(/[/?#]/)[0] || undefined;
      return { isYouTube: true, isVideoPage: Boolean(videoId), pageKind: "youtube-shorts", videoId };
    }
    return { isYouTube: true, isVideoPage: false };
  };
  const videoCaptionStatusMessage = (state) => {
    if (state.failureReason === "caption-unavailable") {
      return state.message || "当前视频没有检测到可用字幕";
    }
    if (state.failureReason === "quota-exceeded") {
      return "当前服务等级额度不足";
    }
    if (state.failureReason === "tier-unavailable") {
      return "当前模型需要更高服务等级";
    }
    if (state.failureReason === "content-too-long") {
      return "当前字幕过长，暂不能翻译";
    }
    if (state.failureReason) {
      return "字幕翻译暂不可用";
    }
    if (state.activeSegment?.sourceText && state.activeSegment?.translatedText) {
      return state.activeSegment.sourceText + "\n" + state.activeSegment.translatedText;
    }
    if (state.activeSegment?.sourceText) {
      const statusText = state.status === "translating" ? "字幕翻译中" : "等待字幕翻译";
      return state.activeSegment.sourceText + "\n" + statusText;
    }
    if (state.status === "detecting") {
      return "正在识别字幕";
    }
    return state.message || "字幕翻译暂不可用";
  };
  const videoAudioStatusMessage = (state) => {
    if (state.failureReason === "privacy-disclosure-required") {
      return state.message || "开启前请确认听音翻译隐私提示";
    }
    if (state.failureReason === "audio-quota-exceeded" || state.failureReason === "quota-exceeded") {
      return "今日听音分钟已用完";
    }
    if (state.failureReason) {
      return state.message || "听音翻译暂不可用";
    }
    if (state.activeSegment?.sourceText && state.activeSegment?.translatedText) {
      return state.activeSegment.sourceText + "\n" + state.activeSegment.translatedText;
    }
    if (state.activeSegment?.sourceText) {
      return state.activeSegment.sourceText + "\n" + (state.status === "translating" ? "听音翻译中" : "正在听音识别");
    }
    if (state.status === "privacy-required") {
      return state.message || "开启前请确认听音翻译隐私提示";
    }
    if (state.status === "recognizing") {
      return "正在听音识别";
    }
    if (state.status === "quota-exhausted") {
      return "今日听音分钟已用完";
    }
    return state.message || "听音翻译 Beta";
  };
  const videoCaptionPlayerHost = () => {
    const player = document.querySelector("#movie_player, .html5-video-player, ytd-player, .ytp-iv-video-content");
    if (!player) {
      return null;
    }
    const hostStyle = getComputedStyle(player);
    if (hostStyle.position === "static") {
      player.style.position = "relative";
    }
    return player;
  };
  const ensureVideoCaptionSurface = (id) => {
    let surface = document.getElementById(id);
    if (surface) {
      return surface;
    }
    surface = document.createElement("div");
    surface.id = id;
    const playerHost = videoCaptionPlayerHost();
    if (playerHost) {
      playerHost.appendChild(surface);
    } else {
      document.body?.appendChild(surface);
    }
    return surface;
  };
  const styleVideoCaptionSurface = (surface, mode) => {
    // Phase 8.7 / A7：字幕叠层不再用 fixed 覆盖整个滚动容器，改为 absolute 相对视频
    // 播放器局部容器定位（host 见 videoCaptionPlayerHost）；播放器不可达时降级为不拦截
    // 滚动的局部条。pointerEvents:none 确保不拦截 YouTube 原生点击 / 滚动手势。
    surface.style.position = "absolute";
    surface.style.zIndex = "2147483000";
    surface.style.whiteSpace = "pre-line";
    surface.style.pointerEvents = "none";
    surface.style.color = "#ffffff";
    surface.style.background = "rgba(0, 0, 0, 0.72)";
    surface.style.lineHeight = "1.32";
    if (mode === "fallback-bar") {
      surface.className = videoCaptionFallbackClassName;
      surface.style.left = "12px";
      surface.style.right = "12px";
      // 降级字幕条也放顶部（与 inline-overlay 一致，对齐竞品）。
      surface.style.top = "8%";
      surface.style.bottom = "";
      surface.style.transform = "";
      surface.style.maxWidth = "";
      surface.style.padding = "9px 12px";
      surface.style.borderRadius = "12px";
      surface.style.fontSize = "14px";
      surface.style.textAlign = "left";
      return;
    }
    surface.className = videoCaptionOverlayClassName;
    surface.style.left = "50%";
    surface.style.right = "";
    // 双语字幕放视频顶部（对齐竞品沉浸翻译）；避开底部频道信息 / 描述 / 进度条。
    surface.style.top = "8%";
    surface.style.bottom = "";
    surface.style.transform = "translateX(-50%)";
    surface.style.maxWidth = "82%";
    surface.style.padding = "6px 10px";
    surface.style.borderRadius = "4px";
    surface.style.fontSize = "15px";
    surface.style.textAlign = "center";
  };
  const removeVideoCaptionSurfaces = () => {
    document.getElementById(videoCaptionOverlayId)?.remove();
    document.getElementById(videoCaptionFallbackId)?.remove();
  };
  const applyVideoCaptionOverlayState = (state) => {
    // A7.2：非视频页绝不渲染字幕 surface；切换前清除任何残留。
    if (!detectYouTubePage().isVideoPage) {
      removeVideoCaptionSurfaces();
      return true;
    }
    // 无字幕轨「当前视频没有检测到可用字幕」提示不显示（影响体感、用户只关心能不能翻译）：
    // 该场景走听音翻译，overlay 由听音 state（recognizing → 双语）接管；字幕降级提示静默清除。
    // 只过滤 caption 路径的 caption-unavailable；听音失败 / 额度等 audio failureReason 不受影响、仍提示。
    if (state.failureReason === "caption-unavailable") {
      removeVideoCaptionSurfaces();
      return true;
    }
    const inactiveId = state.overlayMode === "fallback-bar"
      ? videoCaptionOverlayId
      : videoCaptionFallbackId;
    document.getElementById(inactiveId)?.remove();
    if (state.overlayMode === "hidden") {
      removeVideoCaptionSurfaces();
      return true;
    }
    const surfaceId = state.overlayMode === "fallback-bar"
      ? videoCaptionFallbackId
      : videoCaptionOverlayId;
    const surface = ensureVideoCaptionSurface(surfaceId);
    styleVideoCaptionSurface(surface, state.overlayMode);
    surface.dataset.agentEnglishStatus = state.status;
    surface.dataset.agentEnglishPageKind = state.pageKind;
    surface.textContent = state.source === "audio"
      ? videoAudioStatusMessage(state)
      : videoCaptionStatusMessage(state);
    return true;
  };

  const CAPTION_TIMEUPDATE_THROTTLE_MS = 120;
  const readYouTubePlayerResponse = () => {
    const player = document.querySelector("#movie_player, .html5-video-player, ytd-player");
    if (player && typeof player.getPlayerResponse === "function") {
      try {
        const response = player.getPlayerResponse();
        if (response) {
          return response;
        }
      } catch (error) {
        // getPlayerResponse 在切视频瞬间可能抛错 / 返回旧值；回退到 ytInitialPlayerResponse。
      }
    }
    return window.ytInitialPlayerResponse || null;
  };
  const readInnerTubeApiKey = () => {
    try {
      if (window.ytcfg && typeof window.ytcfg.get === "function") {
        const key = window.ytcfg.get("INNERTUBE_API_KEY");
        if (typeof key === "string" && key.length > 0) {
          return key;
        }
      }
    } catch (error) {
      // ytcfg 不可用 -> 无 key（InnerTube 无 key 也能取 caption metadata）。
    }
    return "";
  };
  const fetchPlayerResponseViaInnerTube = (videoId) => {
    // 用 ANDROID client 按 videoId 重取 player response —— 不依赖播放器 DOM / ytInitialPlayerResponse，
    // 天然覆盖移动版 m.youtube.com + Shorts + SPA（WEB client 反爬返回空轨，ANDROID client 可取）。
    if (!videoId) {
      return Promise.resolve(null);
    }
    const apiKey = readInnerTubeApiKey();
    const endpoint = apiKey ? "/youtubei/v1/player?key=" + encodeURIComponent(apiKey) : "/youtubei/v1/player";
    const body = JSON.stringify({
      context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 31, hl: "en", gl: "US" } },
      videoId: videoId,
    });
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      credentials: "same-origin",
    })
      .then((response) => (response && response.ok ? response.json() : null))
      .catch(() => null);
  };
  const parseCaptionTracks = (playerResponse) => {
    const tracks = playerResponse
      && playerResponse.captions
      && playerResponse.captions.playerCaptionsTracklistRenderer
      && playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
    if (!Array.isArray(tracks)) {
      return [];
    }
    return tracks.filter((track) => track && typeof track.baseUrl === "string" && track.baseUrl.length > 0);
  };
  const captionTrackIsAuto = (track) => {
    if (track.kind === "asr") {
      return true;
    }
    return typeof track.vssId === "string" && track.vssId.indexOf("a.") === 0;
  };
  const captionLanguageMatches = (track, prefix) => {
    const code = (track.languageCode || "").toLowerCase();
    return code === prefix || code.indexOf(prefix + "-") === 0;
  };
  const selectCaptionTrack = (tracks, targetLanguageCode) => {
    if (!tracks.length) {
      return null;
    }
    const manual = tracks.filter((track) => !captionTrackIsAuto(track));
    const target = (targetLanguageCode || "").toLowerCase();
    const englishManual = manual.find((track) => captionLanguageMatches(track, "en"));
    if (englishManual) {
      return englishManual;
    }
    if (target && target !== "en") {
      const targetManual = manual.find((track) => captionLanguageMatches(track, target));
      if (targetManual) {
        return targetManual;
      }
    }
    const englishAuto = tracks.find((track) => captionTrackIsAuto(track) && captionLanguageMatches(track, "en"));
    if (englishAuto) {
      return englishAuto;
    }
    if (target && target !== "en") {
      const targetAuto = tracks.find((track) => captionTrackIsAuto(track) && captionLanguageMatches(track, target));
      if (targetAuto) {
        return targetAuto;
      }
    }
    return manual[0] || tracks[0] || null;
  };
  const buildJson3CaptionUrl = (baseUrl) => {
    // 先清掉 baseUrl 已有的 fmt（部分来源带 &fmt=srv3），再加 &fmt=json3；
    // 重复 fmt 参数会被 YouTube 取第一个 -> 返回 XML 而非 json3（真机踩坑）。
    const withoutFmt = baseUrl.replace(/([?&])fmt=[^&]*&?/g, "$1").replace(/[?&]$/, "");
    return withoutFmt + (withoutFmt.indexOf("?") >= 0 ? "&" : "?") + "fmt=json3";
  };
  const parseJson3Captions = (payload) => {
    const events = payload && payload.events;
    if (!Array.isArray(events)) {
      return [];
    }
    const lines = [];
    for (const event of events) {
      if (!event || typeof event.tStartMs !== "number") {
        continue;
      }
      const segs = Array.isArray(event.segs) ? event.segs : [];
      const joined = segs.map((seg) => (seg && seg.utf8) || "").join("");
      const sourceText = normalizeText(joined);
      if (!sourceText.length) {
        continue;
      }
      const durationMs = typeof event.dDurationMs === "number" ? event.dDurationMs : 0;
      lines.push({
        startTimeSeconds: event.tStartMs / 1000,
        endTimeSeconds: (event.tStartMs + durationMs) / 1000,
        sourceText,
      });
    }
    lines.sort((left, right) => left.startTimeSeconds - right.startTimeSeconds);
    return lines;
  };
  const findActiveCaptionLine = (lines, currentTime) => {
    let active = null;
    for (const line of lines) {
      if (currentTime < line.startTimeSeconds || currentTime >= line.endTimeSeconds) {
        continue;
      }
      if (!active || line.startTimeSeconds > active.startTimeSeconds) {
        active = line;
      }
    }
    return active;
  };
  const captionLineSignature = (line) => (line ? line.startTimeSeconds.toFixed(3) + ":" + line.sourceText : "");
  const resetVideoCaptionTrack = () => {
    // SPA 切视频：丢弃上一个视频字幕序列（合规：不缓存整轨）+ 重置去重签名。
    videoCaptionLines = [];
    videoCaptionTrackVideoId = "";
    videoCaptionTrackLoading = false;
    videoCaptionTrackLanguage = "";
    videoCaptionTrackIsAuto = false;
    videoCaptionTrackUnavailable = false;
    lastVideoCaptionSignature = "";
    lastVideoTimeUpdateAt = 0;
  };
  const captionTrackTargetLanguageCode = () => (
    typeof window.__agentEnglishTargetLanguageCode === "string"
      ? window.__agentEnglishTargetLanguageCode
      : ""
  );
  const ensureVideoCaptionTrackLoaded = () => {
    const detection = detectYouTubePage();
    if (!detection.isVideoPage) {
      return Promise.resolve(false);
    }
    const videoId = detection.videoId || "";
    if (videoId && videoId === videoCaptionTrackVideoId) {
      return Promise.resolve(videoCaptionLines.length > 0);
    }
    if (videoCaptionTrackLoading) {
      return Promise.resolve(false);
    }
    videoCaptionTrackLoading = true;
    videoCaptionTrackUnavailable = false;
    // 优先 InnerTube ANDROID client 按 videoId 重取（覆盖移动版 / Shorts / SPA）；
    // 失败回退页面 player response（getPlayerResponse / ytInitialPlayerResponse，桌面场景兜底）。
    return fetchPlayerResponseViaInnerTube(videoId)
      .then((innerTubeResponse) => {
        const playerResponse = innerTubeResponse || readYouTubePlayerResponse();
        const tracks = parseCaptionTracks(playerResponse);
        const track = selectCaptionTrack(tracks, captionTrackTargetLanguageCode());
        if (!track) {
          // A6：无 captionTracks / 空轨 / 仅损坏轨 -> 标记不可用，不抛错 / 不重试空转。
          videoCaptionTrackLoading = false;
          videoCaptionLines = [];
          videoCaptionTrackVideoId = videoId;
          videoCaptionTrackUnavailable = true;
          videoCaptionTrackLanguage = "";
          videoCaptionTrackIsAuto = false;
          return false;
        }
        videoCaptionTrackLanguage = track.languageCode || "";
        videoCaptionTrackIsAuto = captionTrackIsAuto(track);
        // 同源 fetch（页面上下文，带 cookie / visitor data）；不经 native、不外部请求。
        return fetch(buildJson3CaptionUrl(track.baseUrl), { credentials: "same-origin" })
          .then((response) => (response && response.ok ? response.json() : null))
          .then((payload) => {
            videoCaptionTrackLoading = false;
            const lines = parseJson3Captions(payload);
            videoCaptionLines = lines;
            videoCaptionTrackVideoId = videoId;
            if (!lines.length) {
              videoCaptionTrackUnavailable = true;
            }
            return lines.length > 0;
          });
      })
      .catch((error) => {
        // InnerTube / timedtext fetch 失败（403 / 网络）-> 降级不可用；不持续重试空转。
        videoCaptionTrackLoading = false;
        videoCaptionLines = [];
        videoCaptionTrackVideoId = videoId;
        videoCaptionTrackUnavailable = true;
        return false;
      });
  };
  const buildCaptionLineOverrides = (line) => {
    if (!line) {
      return videoCaptionTrackUnavailable
        ? { sourceText: "", failureReason: "caption-unavailable" }
        : { sourceText: "" };
    }
    return {
      sourceText: line.sourceText,
      startTimeSeconds: line.startTimeSeconds,
      endTimeSeconds: line.endTimeSeconds,
      selectedTrackLanguage: videoCaptionTrackLanguage || undefined,
      selectedTrackIsAutoGenerated: videoCaptionTrackIsAuto,
      containerPath: "caption-track",
    };
  };
  const syncActiveCaptionLine = (currentTime, force = false) => {
    if (!detectYouTubePage().isVideoPage) {
      return false;
    }
    const line = findActiveCaptionLine(videoCaptionLines, currentTime);
    const state = buildYouTubeVideoCaptionState(buildCaptionLineOverrides(line));
    return postVideoCaptionState(state, force);
  };
  const installVideoTimeUpdateListener = () => {
    // A4 / A8：仅在视频播放页装配 timeupdate 监听；节流 >=120ms；只装一次（videoTimeUpdateBound）。
    if (videoTimeUpdateBound || !detectYouTubePage().isVideoPage) {
      return false;
    }
    const video = document.querySelector("video");
    if (!video || typeof video.addEventListener !== "function") {
      return false;
    }
    videoTimeUpdateBound = true;
    video.addEventListener("timeupdate", () => {
      const nowMs = Date.now();
      if (nowMs - lastVideoTimeUpdateAt < CAPTION_TIMEUPDATE_THROTTLE_MS) {
        return;
      }
      lastVideoTimeUpdateAt = nowMs;
      // Phase 8.13 / A3：无字幕轨自动切听音时，timeupdate 按播放进度驱动听音段上报
      // （reportVideoAudioProgress 内按段桶去重 + privacy 门控、仅前台播放触发）；
      // 有字幕轨仍走字幕时间同步（Phase 8.9 不变）。
      if (videoCaptionTrackUnavailable) {
        reportVideoAudioProgress(false);
        return;
      }
      syncActiveCaptionLine(typeof video.currentTime === "number" ? video.currentTime : 0, false);
    });
    return true;
  };

  // A3：听音段时长（秒）——按播放进度把当前句 / 段分桶，同段内 timeupdate 复用同一 audioSegmentId
  // （去重为 1 次后端请求），跨段推进换桶触发下一段；与后端 Phase 8.12 单段识别粒度对齐。
  const VIDEO_AUDIO_SEGMENT_SECONDS = 6;
  const audioPrivacyAccepted = () => Boolean(window.__agentEnglishAudioPrivacyAccepted);
  const buildYouTubeVideoAudioState = (overrides = {}) => {
    const detection = detectYouTubePage();
    if (!detection.isVideoPage || !detection.pageKind) {
      return null;
    }
    const updatedAt = new Date().toISOString();
    const captionText = normalizeText(overrides.captionText || readActiveYouTubeCaptionText());
    const captionQuality = overrides.captionQuality || (captionText ? "available" : "unavailable");
    const captionAvailable = captionQuality === "available" || captionQuality === "low";
    // A1 自动切：无字幕轨（videoCaptionTrackUnavailable）/ 低质量字幕 / 无字幕文本 → 听音 source；
    // 有字幕轨且非手动选择 → 字幕 source（Phase 8.9 字幕优先不被破坏）。
    const source = overrides.source || (
      overrides.manualAudioSelection
        || captionQuality === "low"
        || (!captionText && videoCaptionTrackUnavailable)
        || (!captionText && captionQuality === "unavailable")
        ? "audio"
        : "caption"
    );
    // A1 自动切：听音 source 下隐私已接受即自动进入识别态（recognizing，开始进度上报），
    // 不再恒为 privacy-required；隐私未接受时先 privacy-required（确认后自动转 recognizing）。
    const autoStatus = source === "audio"
      ? (audioPrivacyAccepted() ? "recognizing" : "privacy-required")
      : "caption-primary";
    const status = overrides.status || autoStatus;
    const audioSegmentId = overrides.audioSegmentId || hashSeed("vaud", pageId + ":audio:" + updatedAt.slice(0, 19));
    return {
      pageId,
      siteKind: "youtube",
      pageKind: detection.pageKind,
      url: window.location.href,
      title: document.title || "",
      videoId: detection.videoId,
      captionAvailability: captionAvailable ? "available" : "unavailable",
      source,
      overlayMode: overrides.overlayMode || (source === "audio" ? "inline-overlay" : "hidden"),
      status,
      capabilities: source === "audio"
        ? [
            captionAvailable ? "captions-available" : "captions-unavailable",
            "audio-translation-beta",
            "video-audio-translation",
            "selection-fallback",
          ]
        : ["captions-available", "video-caption-overlay", "audio-translation-beta", "selection-fallback"],
      activeSegment: source === "audio"
        ? {
            pageId,
            audioSegmentId,
            videoId: detection.videoId,
            source: "audio",
            sourceText: overrides.sourceText || "",
            translatedText: overrides.translatedText,
            sourceLanguage: overrides.sourceLanguage || "English",
            targetLanguage: overrides.targetLanguage || "简体中文",
            startTimeSeconds: typeof overrides.startTimeSeconds === "number" ? overrides.startTimeSeconds : undefined,
            endTimeSeconds: typeof overrides.endTimeSeconds === "number" ? overrides.endTimeSeconds : undefined,
            capturedAt: updatedAt,
          }
        : undefined,
      failureReason: overrides.failureReason || (source === "caption" ? "caption-primary" : undefined),
      message: overrides.message || (source === "audio"
        ? (status === "recognizing" ? "正在听音识别 · Beta" : "听音翻译 Beta 会在你确认后由后端按播放进度拉取音频流识别。")
        : "字幕可用，优先使用字幕翻译。"),
      updatedAt,
    };
  };
  const postVideoAudioState = (state, force = false) => {
    if (!state) {
      return false;
    }
    const signature = [
      state.pageKind,
      state.videoId || "",
      state.source,
      state.status,
      state.activeSegment?.audioSegmentId || "",
      state.activeSegment?.sourceText || "",
      state.activeSegment?.translatedText || "",
      state.failureReason || "",
    ].join(":");
    if (!force && signature === lastVideoAudioSignature) {
      return false;
    }
    lastVideoAudioSignature = signature;
    // 识别态 / 已识别出双语句即渲染听音 overlay（与字幕共用 applyVideoCaptionOverlayState）；
    // privacy-required / caption-primary 不渲染（等隐私确认 / 字幕主路径）。
    if (state.source === "audio" && state.status !== "privacy-required" && state.status !== "caption-primary") {
      applyVideoCaptionOverlayState(state);
    }
    postBridgeEvent("video.audio.state.changed", state, {
      requestId: "video-audio-state-" + (state.activeSegment?.audioSegmentId || sessionId),
      pageId,
    });
    if (state.quota) {
      postBridgeEvent("video.audio.quota.changed", state.quota, {
        requestId: "video-audio-quota-" + sessionId,
        pageId,
      });
    }
    return true;
  };
  const requestVideoAudioTranslation = (config = {}) => {
    const state = buildYouTubeVideoAudioState({
      source: "audio",
      status: config.status,
      sourceLanguage: config.sourceLanguage,
      targetLanguage: config.targetLanguage,
      manualAudioSelection: true,
      captionQuality: config.captionQuality,
      captionText: config.captionText,
      message: config.message,
    });
    return postVideoAudioState(state, true);
  };

  const readActiveYouTubeCaptionText = () => {
    // Phase 8.9：字幕轨来源优先——视频自带字幕轨已解析出当前句时直接用（不读渲染 DOM）；
    // 字幕轨不可用时回退 .ytp-caption-segment DOM 兜底（保留以做降级 / 旧路径兼容）。
    if (Array.isArray(videoCaptionLines) && videoCaptionLines.length) {
      const video = document.querySelector("video");
      const currentTime = video && typeof video.currentTime === "number" ? video.currentTime : 0;
      const line = findActiveCaptionLine(videoCaptionLines, currentTime);
      if (line) {
        return line.sourceText;
      }
    }
    const primaryNodes = Array.from(document.querySelectorAll(".ytp-caption-segment"));
    const fallbackNodes = primaryNodes.length
      ? primaryNodes
      : Array.from(document.querySelectorAll(".caption-window, .ytp-caption-window-container"));
    return normalizeText(fallbackNodes.map((node) => node.textContent || "").join(" "));
  };
  const buildYouTubeVideoCaptionState = (overrides = {}) => {
    const detection = detectYouTubePage();
    if (!detection.isVideoPage || !detection.pageKind) {
      return null;
    }
    const updatedAt = new Date().toISOString();
    const sourceText = normalizeText(
      typeof overrides.sourceText === "string" ? overrides.sourceText : readActiveYouTubeCaptionText(),
    );
    const hasCaption = sourceText.length > 0;
    const fromTrack = typeof overrides.containerPath === "string" && overrides.containerPath === "caption-track";
    const segment = hasCaption ? {
      pageId,
      segmentId: hashSeed("vcap", pageId + ":" + sourceText + ":" + updatedAt.slice(0, 19)),
      videoId: detection.videoId,
      sourceText,
      translatedText: overrides.translatedText,
      sourceLanguage: overrides.sourceLanguage || "English",
      targetLanguage: overrides.targetLanguage || "简体中文",
      startTimeSeconds: typeof overrides.startTimeSeconds === "number" ? overrides.startTimeSeconds : undefined,
      endTimeSeconds: typeof overrides.endTimeSeconds === "number" ? overrides.endTimeSeconds : undefined,
      selectedTrackLanguage: fromTrack ? overrides.selectedTrackLanguage : undefined,
      selectedTrackIsAutoGenerated: fromTrack ? Boolean(overrides.selectedTrackIsAutoGenerated) : undefined,
      containerPath: overrides.containerPath || ".ytp-caption-segment",
      capturedAt: updatedAt,
    } : undefined;
    return {
      pageId,
      siteKind: "youtube",
      pageKind: detection.pageKind,
      url: window.location.href,
      title: document.title || "",
      videoId: detection.videoId,
      captionAvailability: hasCaption ? "available" : "unavailable",
      overlayMode: overrides.overlayMode || (hasCaption ? "inline-overlay" : "fallback-bar"),
      status: overrides.status || (hasCaption ? "caption-available" : "caption-unavailable"),
      capabilities: hasCaption
        ? ["captions-available", "video-caption-overlay", "audio-translation-beta", "selection-fallback"]
        : ["captions-unavailable", "video-caption-fallback", "audio-translation-beta", "video-audio-translation", "selection-fallback"],
      activeSegment: segment,
      failureReason: overrides.failureReason || (hasCaption ? undefined : "caption-unavailable"),
      message: overrides.message || (hasCaption ? undefined : "当前视频没有检测到可用字幕。"),
      updatedAt,
    };
  };
  const postVideoCaptionState = (state, force = false) => {
    if (!state) {
      return false;
    }
    const signature = [
      state.pageKind,
      state.videoId || "",
      state.status,
      state.activeSegment?.sourceText || "",
      state.activeSegment?.translatedText || "",
      state.failureReason || "",
    ].join(":");
    if (!force && signature === lastVideoCaptionSignature) {
      return false;
    }
    lastVideoCaptionSignature = signature;
    applyVideoCaptionOverlayState(state);
    postBridgeEvent("video.caption.state.changed", state, {
      requestId: "video-caption-state-" + (state.activeSegment?.segmentId || sessionId),
      pageId,
    });
    return true;
  };
  // Phase 8.13 / A2 / A3：按播放进度周期上报听音 videoId + 当前进度（无音频载荷）触发后端听音。
  // 节流（复用 CAPTION_TIMEUPDATE_THROTTLE_MS 量级，由 timeupdate 监听门控）+ 当前段去重
  // （lastVideoAudioSignature 经 postVideoAudioState 比对）+ 单段失败不阻断（postVideoAudioState
  // 不抛错、不停后续）。仅在无字幕轨自动切听音 + 隐私已接受时上报；非视频页 / 有字幕轨不触发。
  const reportVideoAudioProgress = (force = false) => {
    if (!detectYouTubePage().isVideoPage || !videoCaptionTrackUnavailable) {
      return false;
    }
    if (!audioPrivacyAccepted()) {
      // 隐私未接受：发一次 privacy-required 听音 state（复用 6.7 弹窗入口），不上报进度。
      return postVideoAudioState(buildYouTubeVideoAudioState({ source: "audio" }), force);
    }
    const video = document.querySelector("video");
    const currentTime = video && typeof video.currentTime === "number" ? video.currentTime : 0;
    // 听音段签名按播放进度分桶（每段时长 CAPTION_TIMEUPDATE_THROTTLE_MS 无关，用 audioSegmentId
    // 绑定段桶）：同段内多次 timeupdate → 同一 audioSegmentId → postVideoAudioState 去重为 1 次；
    // 跨段推进 → 新桶 → 新 audioSegmentId → 触发下一段请求 1 次。
    const detection = detectYouTubePage();
    const segmentBucket = Math.floor(currentTime / VIDEO_AUDIO_SEGMENT_SECONDS);
    const audioSegmentId = hashSeed("vaud", (detection.videoId || pageId) + ":audio:" + segmentBucket);
    const state = buildYouTubeVideoAudioState({
      source: "audio",
      status: "recognizing",
      audioSegmentId,
      startTimeSeconds: segmentBucket * VIDEO_AUDIO_SEGMENT_SECONDS,
      endTimeSeconds: (segmentBucket + 1) * VIDEO_AUDIO_SEGMENT_SECONDS,
    });
    return postVideoAudioState(state, force);
  };
  const syncVideoCaptionState = (force = false) => {
    // A5 / A7.2：非视频页（含 YouTube 整站非视频页与非 YouTube 页面）不产字幕状态、
    // 不渲染 overlay；切换到非视频页时清除任何残留 surface 并重置字幕轨状态。
    if (!detectYouTubePage().isVideoPage) {
      removeVideoCaptionSurfaces();
      resetVideoCaptionTrack();
      lastVideoAudioSignature = "";
      return false;
    }
    // A1 / A3 / A4：视频页——确保已读取并解析视频自带字幕轨（异步同源 fetch json3），
    // 并装配 timeupdate 监听（按 currentTime 时间同步当前句）。
    installVideoTimeUpdateListener();
    ensureVideoCaptionTrackLoaded().then((hasLines) => {
      if (hasLines) {
        const loadedVideo = document.querySelector("video");
        const loadedTime = loadedVideo && typeof loadedVideo.currentTime === "number" ? loadedVideo.currentTime : 0;
        // 用 syncVideoCaptionState 的 force（boot / SPA 切视频=true 首取补发；1.2s 周期同步=false 去重）。
        // 修字幕闪烁：原 hardcode true 让每次 1.2s 周期同步都强制重渲染当前句「英文+等待」，
        // 与 native 缓存命中渲染的双语交替 → 暂停时字幕来回闪。改 force 后内容不变即去重、不重渲染。
        syncActiveCaptionLine(loadedTime, force);
      } else if (videoCaptionTrackUnavailable) {
        // A1 / A6：无字幕轨（captionTracks=0 / 解析 0 句）→ 字幕降级（caption-unavailable）+
        // **自动**切听音——隐私已接受时进识别态并按播放进度上报（reportVideoAudioProgress），
        // 隐私未接受时发 privacy-required（复用 6.7 弹窗，确认后自动进入），不再仅等手动开。
        const fallbackState = buildYouTubeVideoCaptionState({ sourceText: "", failureReason: "caption-unavailable" });
        postVideoCaptionState(fallbackState, true);
        reportVideoAudioProgress(true);
      }
    });
    // 立即按当前已有字幕序列同步一次当前句（首取尚未就绪时回退 DOM 兜底，等 fetch 回调补发）。
    const video = document.querySelector("video");
    const currentTime = video && typeof video.currentTime === "number" ? video.currentTime : 0;
    const state = videoCaptionLines.length
      ? buildYouTubeVideoCaptionState(buildCaptionLineOverrides(findActiveCaptionLine(videoCaptionLines, currentTime)))
      : buildYouTubeVideoCaptionState();
    const postedCaption = postVideoCaptionState(state, force);
    if (state && state.captionAvailability === "unavailable" && videoCaptionTrackUnavailable) {
      // A1：已确认无字幕轨 → 自动切听音进度上报（隐私已接受）/ privacy-required（未接受）。
      reportVideoAudioProgress(force);
    }
    return postedCaption;
  };
  const handleYouTubeRouteChange = () => {
    // A4.2 / A5：SPA 前端路由切换后重判页面类型；切视频时丢弃上一个视频字幕轨序列并重置
    // 去重签名 + 解绑旧 timeupdate（视频元素会被 SPA 替换），再重新同步当前视频字幕。
    resetVideoCaptionTrack();
    videoTimeUpdateBound = false;
    syncVideoCaptionState(true);
  };
  const installYouTubeRouteListeners = () => {
    // A4.1：仅在 YouTube 整站注入路径包裹 History API + 监听 popstate；A4.3：不改变
    // 非 YouTube 通用文本网页行为（非 YouTube 直接返回，不安装监听）。
    if (!detectYouTubePage().isYouTube || window.__agentEnglishYouTubeRouteHooked) {
      return;
    }
    window.__agentEnglishYouTubeRouteHooked = true;
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);
    history.pushState = function (...args) {
      const result = originalPushState(...args);
      handleYouTubeRouteChange();
      return result;
    };
    history.replaceState = function (...args) {
      const result = originalReplaceState(...args);
      handleYouTubeRouteChange();
      return result;
    };
    window.addEventListener("popstate", handleYouTubeRouteChange);
  };

  window.__agentEnglishYouTubeInjection = {
    detectYouTubePage,
    readActiveYouTubeCaptionText,
    applyVideoCaptionOverlayState,
    buildYouTubeVideoCaptionState,
    postVideoCaptionState,
    buildYouTubeVideoAudioState,
    postVideoAudioState,
    requestVideoAudioTranslation,
    reportVideoAudioProgress,
    syncVideoCaptionState,
    installYouTubeRouteListeners,
    // Phase 8.9：视频自带字幕轨数据读取 / 解析 / 时间同步（注入式单测入口；不出网）。
    readYouTubePlayerResponse,
    parseCaptionTracks,
    selectCaptionTrack,
    buildJson3CaptionUrl,
    parseJson3Captions,
    findActiveCaptionLine,
    captionLineSignature,
    ensureVideoCaptionTrackLoaded,
    installVideoTimeUpdateListener,
    syncActiveCaptionLine,
    resetVideoCaptionTrack,
    getVideoCaptionLines: () => videoCaptionLines,
  };

  // YouTube 整站识别 / 字幕状态 / overlay 渲染 / SPA 路由监听由 youtube-overlay +
  // youtube-injection 子模块在同一 IIFE 词法作用域内声明（detectYouTubePage /
  // applyVideoCaptionOverlayState / buildYouTubeVideoCaptionState / postVideoCaptionState /
  // postVideoAudioState / requestVideoAudioTranslation / syncVideoCaptionState /
  // installYouTubeRouteListeners），此处直接引用，不重复声明。
  const failureMessage = (failureReason) => {
    switch (failureReason) {
      case "page-unrecognized":
        return "Select text to translate on this page.";
      case "quota-exceeded":
        return "Daily quota is exhausted for this tier.";
      case "tier-unavailable":
        return "Upgrade your service tier to use this model.";
      case "content-too-long":
        return "Selected text is too long to process.";
      case "provider-fallback-failed":
        return "Model service is unavailable right now.";
      default:
        return "Model service is unavailable right now.";
    }
  };
  const selectionFailureMessage = (failureReason) => {
    switch (failureReason) {
      case "quota-exceeded":
        return "Daily quota is exhausted for this tier.";
      case "tier-unavailable":
        return "Upgrade your service tier before asking for explanations.";
      case "content-too-long":
        return "Selected text is too long to explain.";
      case "provider-fallback-failed":
        return "Model service is unavailable right now.";
      default:
        return "Model service is unavailable right now.";
    }
  };
  const clearPageNotice = () => {
    const notice = document.getElementById(pageNoticeId);
    if (notice) {
      notice.remove();
    }
  };
  const ensurePageNotice = () => {
    let notice = document.getElementById(pageNoticeId);
    if (!notice) {
      notice = document.createElement("div");
      notice.id = pageNoticeId;
      notice.style.margin = "12px";
      notice.style.padding = "10px 12px";
      notice.style.borderRadius = "12px";
      notice.style.background = "rgba(245, 158, 11, 0.12)";
      notice.style.color = "#92400e";
      document.body?.insertAdjacentElement("afterbegin", notice);
    }
    return notice;
  };
  const overlayHidden = (segmentId) => {
    if (currentDisplayMode === displayModes.original) {
      return true;
    }
    if (currentDisplayMode === displayModes.learning) {
      return !expandedSegmentIds.has(segmentId);
    }
    return false;
  };
  const ensureOverlay = (segmentId) => {
    const anchorElement = anchorsBySegmentId.get(segmentId);
    if (!anchorElement) {
      return null;
    }
    let overlay = overlaysBySegmentId.get(segmentId);
    if (overlay?.parentElement) {
      return overlay;
    }
    overlay = document.createElement("div");
    overlay.dataset.agentEnglishSegmentId = segmentId;
    overlay.className = overlayClassName;
    overlay.style.marginTop = "8px";
    overlay.style.fontSize = "0.92em";
    overlay.style.lineHeight = "1.5";
    overlay.style.color = "#475569";
    overlay.addEventListener("click", () => {
      if (currentDisplayMode !== displayModes.learning) {
        return;
      }
      if (expandedSegmentIds.has(segmentId)) {
        expandedSegmentIds.delete(segmentId);
      } else {
        expandedSegmentIds.add(segmentId);
      }
      syncDisplayMode();
    });
    anchorElement.insertAdjacentElement("afterend", overlay);
    overlaysBySegmentId.set(segmentId, overlay);
    return overlay;
  };
  const renderFailure = (failurePayload) => {
    clearPageNotice();
    if (failurePayload.segmentId) {
      const overlay = ensureOverlay(failurePayload.segmentId);
      if (overlay) {
        overlay.textContent = failureMessage(failurePayload.failureReason);
        overlay.hidden = false;
        overlay.title = overlay.textContent;
        overlay.style.color = "#92400e";
        return;
      }
    }
    const notice = ensurePageNotice();
    notice.textContent = failureMessage(failurePayload.failureReason);
  };
  const syncDisplayMode = () => {
    overlaysBySegmentId.forEach((overlay, segmentId) => {
      overlay.hidden = overlayHidden(segmentId);
    });
  };
  const requestTranslation = (config = {}) => {
    const detection = detectYouTubePage();
    // Phase 8.7 / A5 / A8：YouTube 整站短路守卫——视频页走字幕路径，非视频页直接返回，
    // 绝不调用 scanPage 全量扫描、不产生 translation.requested 整页扫描事件。
    if (detection.isYouTube) {
      if (detection.isVideoPage) {
        const state = buildYouTubeVideoCaptionState({
          sourceLanguage: config.sourceLanguage,
          targetLanguage: config.targetLanguage,
          status: "translating",
        });
        return postVideoCaptionState(state, true);
      }
      return false;
    }
    const displayMode = config.displayMode === displayModes.original
      ? displayModes.bilingual
      : (config.displayMode || currentDisplayMode || displayModes.bilingual);
    currentDisplayMode = displayMode;
    clearPageNotice();
    expandedSegmentIds.clear();
    const sourceLanguage = config.sourceLanguage || "English";
    const targetLanguage = config.targetLanguage || "简体中文";
    const scanResult = scanPage({ sourceLanguage, targetLanguage, displayMode });
    if (!scanResult || !scanResult.segments.length) {
      const failurePayload = {
        pageId,
        sourceLanguage,
        targetLanguage,
        displayMode,
        capabilities: [...genericCapabilities],
        failureReason: "page-unrecognized",
      };
      renderFailure(failurePayload);
      postBridgeEvent("translation.failed", failurePayload, {
        requestId: "translation-failed-" + sessionId,
        pageId,
        error: { code: "page.unrecognized", message: "No readable text segments found." },
      });
      return false;
    }
    const requestPayload = {
      pageId,
      pageContext: scanResult.pageContext,
      sourceLanguage: scanResult.pageContext.sourceLanguage,
      targetLanguage: scanResult.pageContext.targetLanguage,
      displayMode,
      capabilities: scanResult.pageContext.capabilities,
      segments: scanResult.segments,
    };
    postBridgeEvent("translation.requested", requestPayload, {
      requestId: "translation-requested-" + sessionId,
      pageId,
    });
    return true;
  };
  const applyTranslationResult = (translationResult) => {
    currentDisplayMode = translationResult.displayMode || currentDisplayMode;
    clearPageNotice();
    for (const segmentResult of translationResult.segmentResults || []) {
      const overlay = ensureOverlay(segmentResult.segmentId);
      if (!overlay) {
        continue;
      }
      overlay.textContent = segmentResult.failureReason
        ? failureMessage(segmentResult.failureReason)
        : (segmentResult.translatedText || "Translation ready");
      overlay.title = segmentResult.failureReason ? overlay.textContent : "";
      overlay.style.color = segmentResult.failureReason ? "#92400e" : "#475569";
    }
    syncDisplayMode();
    postBridgeEvent("translation.completed", translationResult, {
      requestId: "translation-completed-" + sessionId,
      pageId: translationResult.pageId,
    });
    return true;
  };
  const applyTranslationFailure = (failurePayload) => {
    renderFailure(failurePayload);
    postBridgeEvent("translation.failed", failurePayload, {
      requestId: "translation-failed-" + sessionId,
      pageId: failurePayload.pageId,
      error: { code: failurePayload.failureReason, message: failureMessage(failurePayload.failureReason) },
    });
    return true;
  };
  const applySelectionExplanationFailure = (failurePayload) => {
    const notice = ensurePageNotice();
    notice.textContent = selectionFailureMessage(failurePayload.failureReason);
    return true;
  };
  const setDisplayMode = (mode) => {
    if (detectYouTubePage().isVideoPage) {
      currentDisplayMode = displayModes.original;
      return currentDisplayMode;
    }
    currentDisplayMode = mode || displayModes.original;
    syncDisplayMode();
    return currentDisplayMode;
  };

  window.__agentEnglishBridge = {
    requestTranslation,
    applyTranslationResult,
    applyTranslationFailure,
    applyVideoCaptionOverlayState,
    requestVideoAudioTranslation,
    postVideoAudioState,
    applySelectionExplanationFailure,
    setDisplayMode,
    // Phase 8.13 / A1：native 隐私确认后置位听音许可 flag，让「无字幕轨自动切听音」生效
    //（youtube-audio-source 的 audioPrivacyAccepted 读此 flag）；并立即重判当前视频——
    // 确认前停在 privacy-required，确认后 syncVideoCaptionState 触发自动进 recognizing + 按进度上报。
    acknowledgeAudioPrivacy: () => {
      window.__agentEnglishAudioPrivacyAccepted = true;
      syncVideoCaptionState(true);
    },
  };

  // Phase 8.7 / A6：选词 / 翻译触发用的全局指针 / 触摸 / 键盘监听仅在非 YouTube
  // 通用文本网页路径注册；YouTube 整站走轻注入，不挂这些会干扰原生滚动 / 点击 / 手势
  // 的全局监听。selectionchange 仅清理指纹、不触发翻译，对原生交互无干扰，可保留。
  document.addEventListener("selectionchange", () => {
    if (!window.getSelection?.()?.toString().trim()) {
      lastSelectionFingerprint = "";
    }
  });
  if (!detectYouTubePage().isYouTube) {
    document.addEventListener("mouseup", scheduleSelectionRequested);
    document.addEventListener("touchend", scheduleSelectionRequested, { passive: true });
    document.addEventListener("keyup", scheduleSelectionRequested);
  }

  postBridgeEvent("bridge.boot", { sessionId, bridgeScope: "bootstrap" }, {
    requestId: "boot-" + sessionId,
  });
  postBridgeEvent("bridge.ping", { sessionId, sentAt: new Date().toISOString() }, {
    requestId: "ping-" + sessionId,
    result: { acknowledged: false },
  });

  const postPageReady = () => {
    postBridgeEvent("page.ready", {
      sessionId,
      url: window.location.href,
      title: document.title || "",
      loadedAt: new Date().toISOString(),
    }, {
      requestId: "page-ready-" + sessionId,
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", postPageReady, { once: true });
  } else {
    postPageReady();
  }
  installYouTubeRouteListeners();
  syncVideoCaptionState(true);
  if (detectYouTubePage().isYouTube && !videoCaptionTimer) {
    videoCaptionTimer = window.setInterval(() => {
      syncVideoCaptionState(false);
    }, 1200);
  }
})();
"""#
}
