export const RUNTIME_SCANNER_SOURCE = String.raw`  const isVisible = (element) => {
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
  };`;
