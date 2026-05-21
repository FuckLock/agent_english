import test from "node:test";
import assert from "node:assert/strict";

import {
  OVERLAY_STATUS_LABELS,
  applyOverlayState,
  applyTranslationResult,
  messageForFailure,
} from "../dist/index.js";

function createElement() {
  return {
    textContent: null,
    className: "",
    hidden: false,
    title: "",
    dataset: {},
    style: {},
    parentElement: null,
    children: [],
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
    },
    insertAdjacentElement(position, child) {
      assert.equal(position, "afterend");
      child.parentElement = this.parentElement;
      this.parentElement.children.push(child);
    },
  };
}

function createDocument() {
  return {
    createElement() {
      return createElement();
    },
  };
}

test("applyOverlayState renders loading state next to the segment anchor", () => {
  const documentLike = createDocument();
  const parent = createElement();
  const anchor = createElement();
  anchor.parentElement = parent;
  parent.children.push(anchor);

  const overlay = applyOverlayState(documentLike, anchor, {
    segmentId: "seg-1",
    status: "loading",
    displayMode: "bilingual",
  });

  assert.equal(overlay.dataset.agentEnglishSegmentId, "seg-1");
  assert.equal(overlay.textContent, OVERLAY_STATUS_LABELS.loading);
  assert.equal(overlay.hidden, false);
});

test("applyOverlayState hides learning overlays until expanded", () => {
  const documentLike = createDocument();
  const parent = createElement();
  const anchor = createElement();
  anchor.parentElement = parent;
  parent.children.push(anchor);

  const overlay = applyOverlayState(documentLike, anchor, {
    segmentId: "seg-1",
    status: "translated",
    translatedText: "你好，世界。",
    displayMode: "learning",
    isExpanded: false,
  });

  assert.equal(overlay.hidden, true);
});

test("applyTranslationResult renders translated and failed segment overlays", () => {
  const documentLike = createDocument();
  const parent = createElement();
  const firstAnchor = createElement();
  const secondAnchor = createElement();
  firstAnchor.parentElement = parent;
  secondAnchor.parentElement = parent;
  parent.children.push(firstAnchor, secondAnchor);

  const overlays = applyTranslationResult(
    documentLike,
    {
      "seg-1": firstAnchor,
      "seg-2": secondAnchor,
    },
    {
      pageId: "page-1",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      displayMode: "bilingual",
      capabilities: ["readable-page", "selection-fallback"],
      segmentResults: [
        {
          segmentId: "seg-1",
          translatedText: "第一段。",
        },
        {
          segmentId: "seg-2",
          failureReason: "translation-failed",
        },
      ],
      resultsBySegmentId: {
        "seg-1": {
          segmentId: "seg-1",
          translatedText: "第一段。",
        },
        "seg-2": {
          segmentId: "seg-2",
          failureReason: "translation-failed",
        },
      },
      failureReason: "translation-failed",
    },
  );

  assert.equal(overlays.length, 2);
  assert.equal(overlays[0].textContent, "第一段。");
  assert.equal(
    overlays[1].textContent,
    messageForFailure("translation-failed"),
  );
});
