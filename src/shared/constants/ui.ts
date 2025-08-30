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

// Status messages
export const STATUS_MESSAGES = {
  ENABLED: '拡張機能は有効です',
  DISABLED: '拡張機能は無効です'
} as const;

// Timing constants
export const TIMING = {
  OBSERVER_INTERVAL: 500,
  UPDATE_DEBOUNCE: 100,
  OBSERVER_TIMEOUT: 10000,
  RETRY_DELAY: 250,
  MAX_RETRIES: 20,
  SPA_NAVIGATION_DELAY: 100,
  REGULAR_NAVIGATION_DELAY: 200,
  MESSAGE_RETRY_BASE_DELAY: 100,
  MESSAGE_MAX_RETRIES: 3
} as const;

export type SortOrder = typeof SORT_ORDERS[keyof typeof SORT_ORDERS];