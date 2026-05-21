import type { SelectionRequestedPayload, SavedItemKind } from "@agent-english/contracts";

import { deriveStableSegmentId, normalizeSegmentText } from "./segment-scanner";

const BLOCK_TAGS = new Set([
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DIV",
  "FIGCAPTION",
  "FOOTER",
  "HEADER",
  "LI",
  "MAIN",
  "NAV",
  "P",
  "SECTION",
]);

const BLOCK_DISPLAYS = new Set(["block", "flex", "grid", "list-item"]);

export interface SelectionStyleLike {
  display?: string;
}

export interface SelectionElementLike {
  tagName: string;
  textContent: string | null;
  parentElement: SelectionElementLike | null;
  children?: SelectionElementLike[];
}

export interface SelectionNodeLike {
  nodeType?: number;
  textContent: string | null;
  parentElement: SelectionElementLike | null;
  tagName?: string;
}

export interface SelectionRangeLike {
  commonAncestorContainer: SelectionNodeLike | SelectionElementLike;
}

export interface SelectionLike {
  rangeCount: number;
  toString(): string;
  getRangeAt(index: number): SelectionRangeLike;
}

export interface SelectionDocumentLike {
  title: string;
  location?: {
    href: string;
  };
  defaultView?: {
    getComputedStyle?: (element: SelectionElementLike) => SelectionStyleLike;
    getSelection?: () => SelectionLike | null;
  };
}

export interface ExtractSelectionOptions {
  pageId: string;
  contextRadius?: number;
}

export function deriveSelectionKind(text: string): SavedItemKind {
  const normalizedText = normalizeSegmentText(text);
  const wordCount = normalizedText.split(/\s+/).filter(Boolean).length;

  if (!normalizedText) {
    return "phrase";
  }

  if (/[.!?。！？]/u.test(normalizedText) || wordCount >= 6) {
    return "sentence";
  }

  if (wordCount > 1) {
    return "phrase";
  }

  return "word";
}

export function extractSelectionContext(
  documentLike: SelectionDocumentLike,
  options: ExtractSelectionOptions,
): SelectionRequestedPayload | null {
  const selection = documentLike.defaultView?.getSelection?.();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const selectedText = normalizeSegmentText(selection.toString());
  if (!selectedText) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const anchorElement = resolveElement(range.commonAncestorContainer);
  if (!anchorElement) {
    return null;
  }

  const containerElement = findBlockContainer(anchorElement, documentLike);
  const containerPath = describeElementPath(containerElement);
  const containerText = normalizeSegmentText(containerElement.textContent ?? "");
  const matchIndex = containerText.indexOf(selectedText);
  const contextRadius = options.contextRadius ?? 96;
  const contextBefore = matchIndex >= 0
    ? normalizeSegmentText(
        containerText.slice(Math.max(0, matchIndex - contextRadius), matchIndex),
      )
    : "";
  const afterStart = matchIndex >= 0 ? matchIndex + selectedText.length : 0;
  const contextAfter = matchIndex >= 0
    ? normalizeSegmentText(
        containerText.slice(afterStart, afterStart + contextRadius),
      )
    : "";
  const selectionId = deriveStableSegmentId(
    options.pageId,
    containerPath,
    [selectedText, contextBefore, contextAfter].join("|"),
  ).replace(/^seg-/, "sel-");

  return {
    pageId: options.pageId,
    selectionId,
    selectedText,
    contextBefore,
    contextAfter,
    sourceUrl: documentLike.location?.href ?? "",
    sourceTitle: documentLike.title,
    containerPath,
    kind: deriveSelectionKind(selectedText),
  };
}

function resolveElement(
  node: SelectionNodeLike | SelectionElementLike,
): SelectionElementLike | null {
  if ("tagName" in node && typeof node.tagName === "string") {
    return node as SelectionElementLike;
  }

  return node.parentElement;
}

function findBlockContainer(
  element: SelectionElementLike,
  documentLike: SelectionDocumentLike,
): SelectionElementLike {
  let currentElement: SelectionElementLike | null = element;

  while (currentElement?.parentElement) {
    if (BLOCK_TAGS.has(currentElement.tagName)) {
      return currentElement;
    }

    const display = documentLike.defaultView?.getComputedStyle?.(currentElement)
      ?.display;
    if (display && BLOCK_DISPLAYS.has(display)) {
      return currentElement;
    }

    currentElement = currentElement.parentElement;
  }

  return currentElement ?? element;
}

function describeElementPath(element: SelectionElementLike): string {
  const parent = element.parentElement;
  const tagName = element.tagName.toLowerCase();

  if (!parent) {
    return tagName;
  }

  return `${describeElementPath(parent)}>${tagName}:nth-of-type(${siblingPosition(element)})`;
}

function siblingPosition(element: SelectionElementLike): number {
  const siblings = element.parentElement?.children ?? [];
  const similarSiblings = siblings.filter((sibling) => sibling.tagName === element.tagName);
  const index = similarSiblings.indexOf(element);

  return index >= 0 ? index + 1 : 1;
}
