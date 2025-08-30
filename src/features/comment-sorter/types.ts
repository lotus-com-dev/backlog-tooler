import type { SortOrder } from '@/shared';

export interface CommentItem extends HTMLLIElement {
  querySelector(selector: string): HTMLAnchorElement | null;
}

// Type alias for sort button element (no special properties needed)
export type SortButtonElementWithObservers = HTMLElement;

export interface CommentSorterConfig {
  initialSortOrder: SortOrder;
  enableTimestampCache: boolean;
  updateDebounceMs: number;
}