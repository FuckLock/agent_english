import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveSelectionKind,
  extractSelectionContext,
} from "../dist/index.js";

function createElement(tagName, options = {}) {
  const element = {
    tagName,
    textContent: options.textContent ?? "",
    parentElement: options.parentElement ?? null,
    children: [],
  };

  if (element.parentElement) {
    element.parentElement.children.push(element);
  }

  return element;
}

test("deriveSelectionKind classifies word phrase and sentence selections", () => {
  assert.equal(deriveSelectionKind("serendipity"), "word");
  assert.equal(deriveSelectionKind("gloss over"), "phrase");
  assert.equal(
    deriveSelectionKind("They tried to gloss over the policy change."),
    "sentence",
  );
});

test("extractSelectionContext derives page source and surrounding context", () => {
  const body = createElement("BODY");
  const article = createElement("ARTICLE", { parentElement: body });
  const paragraph = createElement("P", {
    parentElement: article,
    textContent: "They tried to gloss over the policy change yesterday.",
  });

  const selectionContext = extractSelectionContext(
    {
      title: "Example Article",
      location: {
        href: "https://example.com/article",
      },
      defaultView: {
        getSelection() {
          return {
            rangeCount: 1,
            toString() {
              return "gloss over";
            },
            getRangeAt() {
              return {
                commonAncestorContainer: {
                  nodeType: 3,
                  textContent: paragraph.textContent,
                  parentElement: paragraph,
                },
              };
            },
          };
        },
        getComputedStyle() {
          return { display: "block" };
        },
      },
    },
    {
      pageId: "page-1",
    },
  );

  assert.equal(selectionContext.pageId, "page-1");
  assert.equal(selectionContext.selectedText, "gloss over");
  assert.equal(selectionContext.kind, "phrase");
  assert.equal(selectionContext.sourceUrl, "https://example.com/article");
  assert.equal(selectionContext.sourceTitle, "Example Article");
  assert.match(selectionContext.selectionId, /^sel-/);
  assert.equal(selectionContext.contextBefore, "They tried to");
  assert.equal(selectionContext.contextAfter, "the policy change yesterday.");
  assert.equal(
    selectionContext.containerPath,
    "body>article:nth-of-type(1)>p:nth-of-type(1)",
  );
});
