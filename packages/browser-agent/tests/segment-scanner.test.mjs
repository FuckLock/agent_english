import test from "node:test";
import assert from "node:assert/strict";

import {
  createPageContext,
  deriveStableSegmentId,
  scanPageSegments,
} from "../dist/index.js";

function createElement(tagName, options = {}) {
  const element = {
    tagName,
    textContent: options.textContent ?? "",
    parentElement: options.parentElement ?? null,
    children: [],
    styleState: options.styleState ?? {
      display: "block",
      visibility: "visible",
      opacity: "1",
    },
    getBoundingClientRect() {
      return options.rect ?? { width: 320, height: 24 };
    },
  };

  if (element.parentElement) {
    element.parentElement.children.push(element);
  }

  return element;
}

function createTextNode(textContent, parentElement) {
  return {
    nodeType: 3,
    textContent,
    parentElement,
  };
}

function createDocument({ nodes, title = "Example", url = "https://example.com" }) {
  return {
    title,
    location: { href: url },
    body: nodes[0]?.parentElement ?? null,
    defaultView: {
      getComputedStyle(element) {
        return element.styleState;
      },
    },
    createTreeWalker() {
      let index = 0;
      return {
        nextNode() {
          const node = nodes[index] ?? null;
          index += 1;
          return node;
        },
      };
    },
  };
}

test("deriveStableSegmentId stays stable across rescans", () => {
  const firstPass = deriveStableSegmentId(
    "page-1",
    "body>article:nth-of-type(1)>p:nth-of-type(1)",
    "Hello world.",
  );
  const secondPass = deriveStableSegmentId(
    "page-1",
    "body>article:nth-of-type(1)>p:nth-of-type(1)",
    "Hello world.",
  );

  assert.equal(firstPass, secondPass);
});

test("scanPageSegments merges visible paragraph text and ignores hidden nodes", () => {
  const body = createElement("BODY");
  const article = createElement("ARTICLE", { parentElement: body });
  const paragraph = createElement("P", { parentElement: article });
  const hiddenParagraph = createElement("P", {
    parentElement: article,
    styleState: {
      display: "none",
      visibility: "visible",
      opacity: "1",
    },
  });

  const documentLike = createDocument({
    nodes: [
      createTextNode("Hello", paragraph),
      createTextNode("world.", paragraph),
      createTextNode("Ignore me", hiddenParagraph),
    ],
  });

  const result = scanPageSegments(documentLike, {
    pageId: "page-1",
    sourceLanguage: "English",
    targetLanguage: "简体中文",
    displayMode: "bilingual",
  });

  assert.equal(result.pageContext.pageId, "page-1");
  assert.deepEqual(result.pageContext.capabilities, [
    "readable-page",
    "inline-translation",
    "selection-fallback",
  ]);
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].sourceText, "Hello world.");
  assert.equal(result.segments[0].sourceLanguage, "English");
  assert.equal(result.segments[0].isVisible, true);
});

test("createPageContext preserves capabilities and language fields", () => {
  const pageContext = createPageContext(
    createDocument({
      nodes: [],
      title: "Capabilities",
      url: "https://example.com/capabilities",
    }),
    {
      pageId: "page-2",
      sourceLanguage: "English",
      targetLanguage: "简体中文",
      displayMode: "learning",
      capabilities: ["readable-page", "selection-fallback"],
    },
  );

  assert.equal(pageContext.pageId, "page-2");
  assert.equal(pageContext.displayMode, "learning");
  assert.deepEqual(pageContext.capabilities, [
    "readable-page",
    "selection-fallback",
  ]);
});
