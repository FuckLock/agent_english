export const RUNTIME_UI_BRIDGE_SOURCE = String.raw`  const failureMessage = (failureReason) => {
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
  const readActiveYouTubeCaptionText = () => {
    const primaryNodes = Array.from(document.querySelectorAll(".ytp-caption-segment"));
    const fallbackNodes = primaryNodes.length
      ? primaryNodes
      : Array.from(document.querySelectorAll(".caption-window, .ytp-caption-window-container"));
    return normalizeText(fallbackNodes.map((node) => node.textContent || "").join(" "));
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
  const ensureVideoCaptionSurface = (id) => {
    let surface = document.getElementById(id);
    if (surface) {
      return surface;
    }
    surface = document.createElement("div");
    surface.id = id;
    document.body?.appendChild(surface);
    return surface;
  };
  const styleVideoCaptionSurface = (surface, mode) => {
    surface.style.position = "fixed";
    surface.style.zIndex = "2147483647";
    surface.style.whiteSpace = "pre-line";
    surface.style.pointerEvents = "none";
    surface.style.color = "#ffffff";
    surface.style.background = "rgba(0, 0, 0, 0.72)";
    surface.style.lineHeight = "1.32";
    if (mode === "fallback-bar") {
      surface.className = videoCaptionFallbackClassName;
      surface.style.left = "12px";
      surface.style.right = "12px";
      surface.style.bottom = "72px";
      surface.style.top = "";
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
    surface.style.top = "34%";
    surface.style.bottom = "";
    surface.style.transform = "translateX(-50%)";
    surface.style.maxWidth = "82%";
    surface.style.padding = "6px 10px";
    surface.style.borderRadius = "4px";
    surface.style.fontSize = "15px";
    surface.style.textAlign = "center";
  };
  const applyVideoCaptionOverlayState = (state) => {
    const inactiveId = state.overlayMode === "fallback-bar"
      ? videoCaptionOverlayId
      : videoCaptionFallbackId;
    document.getElementById(inactiveId)?.remove();
    if (state.overlayMode === "hidden") {
      document.getElementById(videoCaptionOverlayId)?.remove();
      document.getElementById(videoCaptionFallbackId)?.remove();
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
  const buildYouTubeVideoCaptionState = (overrides = {}) => {
    const detection = detectYouTubePage();
    if (!detection.isVideoPage || !detection.pageKind) {
      return null;
    }
    const updatedAt = new Date().toISOString();
    const sourceText = normalizeText(overrides.sourceText || readActiveYouTubeCaptionText());
    const hasCaption = sourceText.length > 0;
    const segment = hasCaption ? {
      pageId,
      segmentId: hashSeed("vcap", pageId + ":" + sourceText + ":" + updatedAt.slice(0, 19)),
      videoId: detection.videoId,
      sourceText,
      translatedText: overrides.translatedText,
      sourceLanguage: overrides.sourceLanguage || "English",
      targetLanguage: overrides.targetLanguage || "简体中文",
      containerPath: ".ytp-caption-segment",
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
  const buildYouTubeVideoAudioState = (overrides = {}) => {
    const detection = detectYouTubePage();
    if (!detection.isVideoPage || !detection.pageKind) {
      return null;
    }
    const updatedAt = new Date().toISOString();
    const captionText = normalizeText(overrides.captionText || readActiveYouTubeCaptionText());
    const captionQuality = overrides.captionQuality || (captionText ? "available" : "unavailable");
    const captionAvailable = captionQuality === "available" || captionQuality === "low";
    const source = overrides.source || (
      overrides.manualAudioSelection || captionQuality === "low" || !captionText
        ? "audio"
        : "caption"
    );
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
      status: overrides.status || (source === "audio" ? "privacy-required" : "caption-primary"),
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
            capturedAt: updatedAt,
          }
        : undefined,
      failureReason: overrides.failureReason || (source === "caption" ? "caption-primary" : undefined),
      message: overrides.message || (source === "audio"
        ? "听音翻译 Beta 会在你确认后识别当前视频音频。"
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
      status: config.status || "privacy-required",
      sourceLanguage: config.sourceLanguage,
      targetLanguage: config.targetLanguage,
      manualAudioSelection: true,
      captionQuality: config.captionQuality,
      captionText: config.captionText,
      message: config.message,
    });
    return postVideoAudioState(state, true);
  };
  const syncVideoCaptionState = (force = false) => {
    const state = buildYouTubeVideoCaptionState();
    const postedCaption = postVideoCaptionState(state, force);
    if (state?.captionAvailability === "unavailable") {
      postVideoAudioState(buildYouTubeVideoAudioState(), force);
    }
    return postedCaption;
  };
  const requestTranslation = (config = {}) => {
    if (detectYouTubePage().isVideoPage) {
      const state = buildYouTubeVideoCaptionState({
        sourceLanguage: config.sourceLanguage,
        targetLanguage: config.targetLanguage,
        status: "translating",
      });
      return postVideoCaptionState(state, true);
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
  };

  document.addEventListener("selectionchange", () => {
    if (!window.getSelection?.()?.toString().trim()) {
      lastSelectionFingerprint = "";
    }
  });
  document.addEventListener("mouseup", scheduleSelectionRequested);
  document.addEventListener("touchend", scheduleSelectionRequested, { passive: true });
  document.addEventListener("keyup", scheduleSelectionRequested);

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
  syncVideoCaptionState(true);
  if (!videoCaptionTimer) {
    videoCaptionTimer = window.setInterval(() => {
      syncVideoCaptionState(false);
    }, 1200);
  }
})();`;
