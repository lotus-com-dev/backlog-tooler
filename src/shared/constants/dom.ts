// URL patterns
export const URL_PATTERNS = {
  BACKLOG_COM: '.backlog.com/view/',
  BACKLOG_JP: '.backlog.jp/view/',
  VIEW_PATH: '/view/',
  BOARD_PATH: '/board',
  ADD_PATH: '/add/'
} as const;

// Domain patterns
export const DOMAIN_PATTERNS = {
  BACKLOG_COM: '.backlog.com',
  BACKLOG_JP: '.backlog.jp'
} as const;

// DOM selectors
export const DOM_SELECTORS = {
  FILTER_NAV: 'dl.filter-nav',
  COMMENT_LIST: 'ul.comment-list__items',
  COMMENT_ITEM: 'li.comment-item',
  TIME_ELEMENT: '.user-icon-set__sub-line a',
  BUTTON_TEXT: '.filter-nav__text',
  COLLAPSE_ICON: '.comment-item__collapse-icon',
  VIEW_OPTIONS_BUTTON: '.comment-list-heading__view-options-button',
  ISSUE_DIALOG_IFRAME: '#issue-dialog-iframe',
  COMMENT_EDITOR_WRAPPER: '.comment-editor__input-wrapper',
  COMMENT_EDITOR_PREVIEW_WRAPPER: '.comment-editor__preview-wrapper',
  COMMENT_EDITOR_PREVIEW_CONTENT: '.comment-editor__preview-content.js_previewArea',
  COMMENT_EDITOR_TEXTAREA: '.comment-editor__textarea.ProseMirror',
  COMMENT_EDITOR_ACTION_WRAPPER: '.comment-editor__action-wrapper'
} as const;

// DOM IDs
export const DOM_IDS = {
  SORT_TOGGLE_BUTTON: 'sort-toggle-button'
} as const;

// DOM classes
export const DOM_CLASSES = {
  FILTER_NAV_ITEM: 'filter-nav__item',
  FILTER_NAV_LINK: 'filter-nav__link',
  FILTER_NAV_TEXT: 'filter-nav__text',
  IS_FIRST: 'is_first',
  DAMMY: '-dammy'
} as const;

// Aria attributes
export const ARIA_VALUES = {
  TRUE: 'true',
  FALSE: 'false'
} as const;

// Observer names (for internal tracking)
export const OBSERVER_NAMES = {
  COMMENT_LIST: '_commentListObserver',
  COLLAPSE: '_collapseObserver'
} as const;