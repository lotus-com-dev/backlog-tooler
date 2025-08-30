// Centralized logging system

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

interface LoggerConfig {
  minLevel: LogLevel;
  prefix: string;
  enabledInProduction: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  private shouldLog(level: LogLevel): boolean {
    // Skip logging if below minimum level
    if (level < this.config.minLevel) {
      return false;
    }

    // Skip logging in production unless explicitly enabled
    if (process.env.NODE_ENV === 'production' && !this.config.enabledInProduction) {
      return level >= LogLevel.WARN; // Only warnings and errors in production
    }

    return true;
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): [string, ...unknown[]] {
    const timestamp = new Date().toISOString().substr(11, 12);
    const levelStr = Object.keys(LogLevel).find(key => LogLevel[key as keyof typeof LogLevel] === level) || 'UNKNOWN';
    return [`[${timestamp}] [${levelStr}] ${this.config.prefix} ${message}`, ...args];
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(...this.formatMessage(LogLevel.DEBUG, message, ...args));
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(...this.formatMessage(LogLevel.INFO, message, ...args));
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...this.formatMessage(LogLevel.WARN, message, ...args));
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(...this.formatMessage(LogLevel.ERROR, message, ...args));
    }
  }
}

// Pre-configured loggers for different components
export const createLogger = (prefix: string, minLevel: LogLevel = LogLevel.DEBUG): Logger => {
  return new Logger({
    prefix,
    minLevel,
    enabledInProduction: false
  });
};

// Core system loggers
export const contentLogger = createLogger('[ContentScript]');
export const backgroundLogger = createLogger('[Background]');
export const registryLogger = createLogger('[FeatureRegistry]');
export const managerLogger = createLogger('[FeatureManager]');