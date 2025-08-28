// Storage keys
export const STORAGE_KEYS = {
  ENABLED: 'enabled'
} as const;

// Message actions
export const MESSAGE_ACTIONS = {
  GET_ENABLED: 'getEnabled',
  TOGGLE_EXTENSION: 'toggleExtension'
} as const;

// Default settings
export const DEFAULT_SETTINGS = {
  ENABLED: true
} as const;

// Status messages
export const STATUS_MESSAGES = {
  ENABLED: '拡張機能は有効です',
  DISABLED: '拡張機能は無効です'
} as const;

// URL patterns
export const URL_PATTERNS = {
  BACKLOG_COM: '.backlog.com/view/',
  BACKLOG_JP: '.backlog.jp/view/'
} as const;

// DOM selectors
export const DOM_SELECTORS = {
  FILTER_NAV: 'dl.filter-nav',
  COMMENT_LIST: 'ul.comment-list__items',
  COMMENT_ITEM: 'li.comment-item',
  TIME_ELEMENT: '.user-icon-set__sub-line a',
  BUTTON_TEXT: '.filter-nav__text',
  COLLAPSE_ICON: '.comment-item__collapse-icon',
  VIEW_OPTIONS_BUTTON: '.comment-list-heading__view-options-button'
} as const;

// DOM IDs
export const DOM_IDS = {
  SORT_TOGGLE_BUTTON: 'sort-toggle-button'
} as const;

// DOM classes
export const DOM_CLASSES = {
  FILTER_NAV_ITEM: 'filter-nav__item',
  FILTER_NAV_LINK: 'filter-nav__link',
  FILTER_NAV_TEXT: 'filter-nav__text'
} as const;

// Button labels
export const BUTTON_LABELS = {
  ASC: '古い順で表示',
  DESC: '新しい順で表示'
} as const;

// Sort orders
export const SORT_ORDERS = {
  ASC: 'asc',
  DESC: 'desc'
} as const;

// Types
export interface StorageData {
  enabled: boolean;
}

export type SortOrder = typeof SORT_ORDERS[keyof typeof SORT_ORDERS];