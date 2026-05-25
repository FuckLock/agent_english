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
  id?: string;
  className?: string;
  getAttribute?: (name: string) => string | null;
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

export function createTextWalker(
  documentLike: ScannerDocument,
): ScannerTreeWalker | null {
  if (!documentLike.body || !documentLike.createTreeWalker) {
    return null;
  }

  return documentLike.createTreeWalker(documentLike.body, SHOW_TEXT);
}

export function isVisibleTextNode(
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

export function findBlockContainer(
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

export function describeElementPath(element: ScannerElement): string {
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
