export const RUNTIME_UI_BRIDGE_SOURCE = String.raw`  // YouTube 整站识别 / 字幕状态 / overlay 渲染 / SPA 路由监听由 youtube-overlay +
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
    // native 块预翻 / 单句翻完成后预埋译文到 JS 侧（youtube-caption-track-source 声明），
    // 换句首帧即双语、消除占位闪烁。
    primeVideoCaptionTranslations,
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
})();`;
