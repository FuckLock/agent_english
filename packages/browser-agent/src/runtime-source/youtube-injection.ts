export const RUNTIME_YOUTUBE_INJECTION_SOURCE = String.raw`  const readActiveYouTubeCaptionText = () => {
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
    // A5 / A7.2：非视频页（含 YouTube 整站非视频页与非 YouTube 页面）不产字幕状态、
    // 不渲染 overlay；切换到非视频页时清除任何残留 surface。
    if (!detectYouTubePage().isVideoPage) {
      removeVideoCaptionSurfaces();
      lastVideoCaptionSignature = "";
      lastVideoAudioSignature = "";
      return false;
    }
    const state = buildYouTubeVideoCaptionState();
    const postedCaption = postVideoCaptionState(state, force);
    if (state?.captionAvailability === "unavailable") {
      postVideoAudioState(buildYouTubeVideoAudioState(), force);
    }
    return postedCaption;
  };
  const handleYouTubeRouteChange = () => {
    // A4.2：SPA 前端路由切换后重判页面类型；非视频页清残留、视频页重新同步字幕。
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
    syncVideoCaptionState,
    installYouTubeRouteListeners,
  };
`;
