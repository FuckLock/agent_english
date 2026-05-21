import {
  SITE_CAPABILITIES,
  type DisplayMode,
  type PageContext,
  type PageTextSegment,
  type SiteCapability,
} from "@agent-english/contracts";

const TEXT_NODE = 3;
const SHOW_TEXT = 4;
const BLOCK_TAGS = new Set([
  "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "FIGCAPTION", "FOOTER",
  "HEADER", "LI", "MAIN", "NAV", "P", "SECTION",
]);
const BLOCK_DISPLAYS = new Set(["block", "flex", "grid", "list-item"]);

interface ScannerStyle {
  display?: string;
  visibility?: string;
  opacity?: string;
}

interface ScannerRect {
  width: number;
  height: number;
}

export interface ScannerElement {
  tagName: string;
  textContent: string | null;
  parentElement: ScannerElement | null;
  getBoundingClientRect?: () => ScannerRect;
}

export interface ScannerTextNode {
  nodeType: number;
  textContent: string | null;
  parentElement: ScannerElement | null;
}

export interface ScannerTreeWalker {
  nextNode(): ScannerTextNode | null;
}

export interface ScannerDocument {
  title: string;
  body: ScannerElement | null;
  location?: {
    href: string;
  };
  defaultView?: {
    getComputedStyle?: (element: ScannerElement) => ScannerStyle;
  };
  createTreeWalker?: (root: object, whatToShow: number) => ScannerTreeWalker;
}

export interface ScanPageOptions {
  pageId?: string;
  sourceLanguage: string;
  targetLanguage: string;
  displayMode: DisplayMode;
  capabilities?: SiteCapability[];
}

interface SegmentAccumulator {
  containerPath: string;
  pageId: string;
  sourceLanguage: string;
  sourceTextParts: string[];
  capabilities: SiteCapability[];
}

export interface ScanPageResult {
  pageContext: PageContext;
  segments: PageTextSegment[];
}

export function normalizeSegmentText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function deriveStableSegmentId(
  pageId: string,
  containerPath: string,
  sourceText: string,
): string {
  const seed = `${pageId}:${containerPath}:${normalizeSegmentText(sourceText)}`;
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `seg-${(hash >>> 0).toString(16)}`;
}

export function createPageContext(
  documentLike: ScannerDocument,
  options: ScanPageOptions,
): PageContext {
  return {
    pageId: options.pageId ?? derivePageId(documentLike),
    url: documentLike.location?.href ?? "",
    title: documentLike.title,
    sourceLanguage: options.sourceLanguage,
    targetLanguage: options.targetLanguage,
    displayMode: options.displayMode,
    capabilities: [...(options.capabilities ?? SITE_CAPABILITIES)],
    siteKind: "generic",
  };
}

export function scanPageSegments(
  documentLike: ScannerDocument,
  options: ScanPageOptions,
): ScanPageResult {
  const pageContext = createPageContext(documentLike, options);
  const walker = createTextWalker(documentLike);

  if (!walker) {
    return { pageContext, segments: [] };
  }

  const groups = new Map<string, SegmentAccumulator>();
  let textNode = walker.nextNode();

  while (textNode) {
    const normalizedText = normalizeSegmentText(textNode.textContent ?? "");
    const parentElement = textNode.parentElement;

    if (
      textNode.nodeType === TEXT_NODE &&
      normalizedText &&
      parentElement &&
      isVisibleTextNode(parentElement, documentLike)
    ) {
      const container = findBlockContainer(parentElement, documentLike);
      const containerPath = describeElementPath(container);
      const existingGroup = groups.get(containerPath) ?? {
        containerPath,
        pageId: pageContext.pageId,
        sourceLanguage: options.sourceLanguage,
        sourceTextParts: [],
        capabilities: [...pageContext.capabilities],
      };

      existingGroup.sourceTextParts.push(normalizedText);
      groups.set(containerPath, existingGroup);
    }

    textNode = walker.nextNode();
  }

  const segments = Array.from(groups.values()).map((group) => {
    const sourceText = normalizeSegmentText(group.sourceTextParts.join(" "));

    return {
      pageId: group.pageId,
      segmentId: deriveStableSegmentId(
        group.pageId,
        group.containerPath,
        sourceText,
      ),
      sourceText,
      containerPath: group.containerPath,
      sourceLanguage: group.sourceLanguage,
      isVisible: true,
      capabilities: [...group.capabilities],
    };
  });

  return {
    pageContext,
    segments,
  };
}

function createTextWalker(
  documentLike: ScannerDocument,
): ScannerTreeWalker | null {
  if (!documentLike.body || !documentLike.createTreeWalker) {
    return null;
  }

  return documentLike.createTreeWalker(documentLike.body, SHOW_TEXT);
}

function derivePageId(documentLike: ScannerDocument): string {
  const seed = `${documentLike.location?.href ?? ""}:${documentLike.title}`;
  return deriveStableSegmentId("page", "context", seed).replace(/^seg-/, "page-");
}

function isVisibleTextNode(
  parentElement: ScannerElement,
  documentLike: ScannerDocument,
): boolean {
  let currentElement: ScannerElement | null = parentElement;

  while (currentElement) {
    const style = documentLike.defaultView?.getComputedStyle?.(currentElement);
    if (
      style?.display === "none" ||
      style?.visibility === "hidden" ||
      style?.opacity === "0"
    ) {
      return false;
    }

    const rect = currentElement.getBoundingClientRect?.();
    if (rect && rect.width <= 0 && rect.height <= 0) {
      return false;
    }

    currentElement = currentElement.parentElement;
  }

  return true;
}

function findBlockContainer(
  element: ScannerElement,
  documentLike: ScannerDocument,
): ScannerElement {
  let currentElement: ScannerElement | null = element;

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

function describeElementPath(element: ScannerElement): string {
  const parent = element.parentElement;
  const tagName = element.tagName.toLowerCase();

  if (!parent) {
    return tagName;
  }

  const siblingIndex = siblingPosition(element);
  return `${describeElementPath(parent)}>${tagName}:nth-of-type(${siblingIndex})`;
}

function siblingPosition(element: ScannerElement): number {
  const parent = element.parentElement;
  if (!parent) {
    return 1;
  }

  const siblings = getChildElements(parent).filter(
    (sibling) => sibling.tagName === element.tagName,
  );
  const foundIndex = siblings.findIndex((sibling) => sibling === element);
  return foundIndex >= 0 ? foundIndex + 1 : 1;
}

function getChildElements(parent: ScannerElement): ScannerElement[] {
  const children = Reflect.get(parent as object, "children");
  if (!children || typeof children !== "object") {
    return [];
  }

  if (Array.isArray(children)) {
    return children as ScannerElement[];
  }

  const childElements: ScannerElement[] = [];
  const length = Reflect.get(children, "length");

  if (typeof length !== "number") {
    return [];
  }

  for (let index = 0; index < length; index += 1) {
    const child = Reflect.get(children, index);
    if (child && typeof child === "object") {
      childElements.push(child as ScannerElement);
    }
  }

  return childElements;
}
