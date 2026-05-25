import {
  GENERIC_SITE_CAPABILITIES,
  type DisplayMode,
  type PageContext,
  type PageTextSegment,
  type SiteCapability,
} from "@agent-english/contracts";
import {
  createTextWalker,
  describeElementPath,
  findBlockContainer,
  isVisibleTextNode,
  type ScannerDocument,
  type ScannerElement,
} from "./scanner-dom";

const TEXT_NODE = 3;

export type {
  ScannerDocument,
  ScannerElement,
  ScannerTextNode,
  ScannerTreeWalker,
} from "./scanner-dom";

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
    capabilities: [...(options.capabilities ?? GENERIC_SITE_CAPABILITIES)],
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

function derivePageId(documentLike: ScannerDocument): string {
  const seed = `${documentLike.location?.href ?? ""}:${documentLike.title}`;
  return deriveStableSegmentId("page", "context", seed).replace(/^seg-/, "page-");
}
