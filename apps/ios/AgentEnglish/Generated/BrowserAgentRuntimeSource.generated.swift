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
  const expandedSegmentIds = new Set();
  const overlaysBySegmentId = new Map();
  const anchorsBySegmentId = new Map();
  const sessionId = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : "session-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  const pageId = "page-" + sessionId;
  let currentDisplayMode = displayModes.original;
  let lastSelectionFingerprint = "";
  let pendingSelectionTimer = null;

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
      element.classList?.contains(overlayClassName) === true ||
      element.closest?.("." + overlayClassName) != null
    );
  };

  const scanPage = (config) => {
    const pageCapabilities = [...genericCapabilities];
    const groups = new Map();
    anchorsBySegmentId.clear();
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
        siteKind: "generic",
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
    currentDisplayMode = mode || displayModes.original;
    syncDisplayMode();
    return currentDisplayMode;
  };

  window.__agentEnglishBridge = {
    requestTranslation,
    applyTranslationResult,
    applyTranslationFailure,
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
})();
"""#
}
