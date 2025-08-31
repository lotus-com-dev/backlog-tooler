// System-level constants

// Frame handling
export const FRAME_IDS = {
  MAIN_FRAME: 0
} as const;

// Feature versions
export const FEATURE_VERSIONS = {
  COMMENT_SORTER: '1.0.0'
} as const;

// Environment
export const NODE_ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production'
} as const;

// Logger prefix constants
export const LOG_PREFIXES = {
  CONTENT_SCRIPT: '[ContentScript]',
  BACKGROUND: '[Background]',
  FEATURE_REGISTRY: '[FeatureRegistry]',
  FEATURE_MANAGER: '[FeatureManager]',
} as const;