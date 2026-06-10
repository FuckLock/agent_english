export const RUNTIME_BOOTSTRAP_SOURCE = String.raw`(() => {
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
  // native 预埋的译文表（原文 → 译文，仅当前视频、内存态）：换句构造状态时直接查表带译文，
  // 首帧即双语——消除「先渲染占位、native 推回再换双语」的闪烁。SPA 切视频随轨重置。
  let videoCaptionTranslations = {};

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
`;
