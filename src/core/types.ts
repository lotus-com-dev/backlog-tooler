import { createLogger, LogLevel } from '../shared/utils/logger';

export interface FeatureConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version: string;
}

export interface FeatureContext {
  abortController: AbortController;
  isExtensionEnabled: () => Promise<boolean>;
  resourceTracker: ResourceTracker;
}

export interface ResourceTracker {
  activeObservers: Set<MutationObserver>;
  activeTimeouts: Set<NodeJS.Timeout>;
  activeElements: Set<HTMLElement>;
  
  trackObserver(observer: MutationObserver): void;
  untrackObserver(observer: MutationObserver): void;
  trackTimeout(timeoutId: NodeJS.Timeout): void;
  clearTimeout(timeoutId: NodeJS.Timeout): void;
  trackElement(element: HTMLElement): void;
  untrackElement(element: HTMLElement): void;
  getActiveResourcesCount(): {
    observers: number;
    timeouts: number;
    elements: number;
  };
  clearAllTimeouts(): void;
}

export interface PageContext {
  isViewPage(): boolean;
  isBoardPage(): boolean;
  isIframeContext(): boolean;
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export abstract class BaseFeature {
  protected config: FeatureConfig;
  protected context: FeatureContext;
  protected pageContext: PageContext;
  protected logger: Logger;
  protected isInitialized = false;

  constructor(
    config: FeatureConfig,
    context: FeatureContext,
    pageContext: PageContext
  ) {
    this.config = config;
    this.context = context;
    this.pageContext = pageContext;
    this.logger = createLogger(`[${config.name.replace(/\s+/g, '')}]`, LogLevel.DEBUG);
  }

  abstract initialize(): Promise<void>;
  abstract cleanup(): void;
  abstract shouldActivate(): boolean;

  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  protected setInitialized(initialized: boolean): void {
    this.isInitialized = initialized;
  }
}