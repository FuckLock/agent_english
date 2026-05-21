export const SAVED_ITEM_KINDS = [
  "word",
  "phrase",
  "sentence",
] as const;

export type SavedItemKind = (typeof SAVED_ITEM_KINDS)[number];

export interface SavedItem {
  sourceUrl: string;
  sourceTitle: string;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  translation: string;
  explanation: string;
  kind: SavedItemKind;
  createdAt: string;
}
