import {
  MESSAGE_ACTIONS,
  URL_PATTERNS,
  TIMING,
  FEATURE_VERSIONS,
  contentLogger
} from '@/shared';
import { FeatureManager } from '@/core';
import type { FeatureContext, PageContext, ResourceTracker } from '@/core';
import { CommentSorterFeature, PreviewSplitterFeature } from '@/features';

// Resource tracking for debugging (only in development)
const resourceTracker: ResourceTracker = {
  activeObservers: new Set<MutationObserver>(),
  activeTimeouts: new Set<NodeJS.Timeout>(),
  activeElements: new Set<HTMLElement>(),
  
  trackObserver(observer: MutationObserver) {
    this.activeObservers.add(observer);
  },
  
  untrackObserver(observer: MutationObserver) {
    this.activeObservers.delete(observer);
  },
  
  trackTimeout(timeoutId: NodeJS.Timeout) {
    this.activeTimeouts.add(timeoutId);
  },
  
  clearTimeout(timeoutId: NodeJS.Timeout) {
    clearTimeout(timeoutId);
    this.activeTimeouts.delete(timeoutId);
  },
  
  trackElement(element: HTMLElement) {
    this.activeElements.add(element);
  },
  
  untrackElement(element: HTMLElement) {
    this.activeElements.delete(element);
  },
  
  getActiveResourcesCount() {
    return {
      observers: this.activeObservers.size,
      timeouts: this.activeTimeouts.size,
      elements: this.activeElements.size
    };
  },
  
  clearAllTimeouts() {
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts.clear();
  }
};

// Page context utilities
const pageContext: PageContext = {
  isViewPage(): boolean {
    return window.location.pathname.includes(URL_PATTERNS.VIEW_PATH);
  },

  isBoardPage(): boolean {
    return window.location.pathname.includes(URL_PATTERNS.BOARD_PATH);
  },

  isIframeContext(): boolean {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  },

  isAddPage(): boolean {
    return window.location.pathname.includes(URL_PATTERNS.ADD_PATH);
  }
};

// Extension enabled check
async function isExtensionEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: MESSAGE_ACTIONS.GET_ENABLED }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(true);
      } else {
        resolve(response?.enabled ?? true);
      }
    });
  });
}

// Global feature manager and AbortController
let featureManager: FeatureManager | null = null;
let abortController: AbortController | null = null;

// Initialize the new feature-based system
async function initializeFeatureSystem(): Promise<void> {
  contentLogger.debug('Initializing feature-based system');

  // Clean up existing feature manager to prevent duplicates
  if (featureManager) {
    contentLogger.debug('Re-initialization detected, cleaning up existing manager');
    cleanupFeatureSystem();
  }

  // Create new AbortController if needed
  if (!abortController) {
    abortController = new AbortController();
  }

  // Create feature context
  const context: FeatureContext = {
    abortController: abortController,
    isExtensionEnabled,
    resourceTracker
  };

  // Create feature manager
  featureManager = new FeatureManager(context, pageContext);

  // Register comment sorter feature
  const commentSorterFeature = new CommentSorterFeature(
    {
      id: 'comment-sorter',
      name: 'Comment Sorter',
      description: 'Sort Backlog comments by timestamp',
      enabled: true,
      version: FEATURE_VERSIONS.COMMENT_SORTER
    },
    context,
    pageContext
  );

  featureManager.registerFeature(commentSorterFeature);

  // Register preview splitter feature
  const previewSplitterFeature = new PreviewSplitterFeature(
    {
      id: 'preview-splitter',
      name: 'Preview Splitter',
      description: 'Split view for real-time preview on add page',
      enabled: true,
      version: '1.0.0'
    },
    context,
    pageContext
  );

  featureManager.registerFeature(previewSplitterFeature);

  // Initialize all features
  await featureManager.initializeAllFeatures();

  contentLogger.info('Feature system ready');
}

// Cleanup feature system
function cleanupFeatureSystem(): void {
  const resourceCount = resourceTracker.getActiveResourcesCount();
  contentLogger.debug('Cleaning up feature system', resourceCount);

  // Abort all ongoing operations
  if (abortController) {
    abortController.abort();
    abortController = null;
  }

  // Clean up feature manager
  if (featureManager) {
    featureManager.cleanupAllFeatures();
    featureManager = null;
  }

  // Clear all tracked timeouts
  resourceTracker.clearAllTimeouts();

  // Final resource check
  const finalResourceCount = resourceTracker.getActiveResourcesCount();
  if (finalResourceCount.observers > 0 || finalResourceCount.timeouts > 0) {
    contentLogger.warn('Cleanup incomplete, remaining resources:', finalResourceCount);
  } else {
    contentLogger.debug('Cleanup completed');
  }

  // Create new AbortController for next initialization
  abortController = new AbortController();
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === MESSAGE_ACTIONS.TOGGLE_EXTENSION) {
    if (request.enabled) {
      initializeFeatureSystem();
    } else {
      cleanupFeatureSystem();
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === MESSAGE_ACTIONS.NAVIGATION_TO_VIEW) {
    // Navigated to a view page, initialize the feature system
    initializeFeatureSystem();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === MESSAGE_ACTIONS.NAVIGATION_FROM_VIEW) {
    // Navigated away from a view page, clean up
    cleanupFeatureSystem();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === MESSAGE_ACTIONS.NAVIGATION_VIEW_TO_VIEW) {
    // Navigated from one view page to another view page
    // Clean up and reinitialize for the new page
    cleanupFeatureSystem();
    initializeFeatureSystem();
    sendResponse({ success: true });
    return true;
  }

  return false;
});

// Development mode resource monitoring
if (process.env.NODE_ENV === 'development') {
  // Monitor resources periodically
  const monitoringInterval = setInterval(() => {
    const resourceCount = resourceTracker.getActiveResourcesCount();
    
    // Only log when there are resources to track
    if (resourceCount.observers > 0 || resourceCount.timeouts > 0 || resourceCount.elements > 0) {
      contentLogger.debug('Resource monitoring', {
        ...resourceCount,
        url: window.location.href.split('?')[0], // Remove query params for cleaner logs
        features: featureManager?.getActiveFeatureIds().length || 0
      });
    }

    // Warn if resources are accumulating
    if (resourceCount.observers > TIMING.RESOURCE_OBSERVER_THRESHOLD || 
        resourceCount.timeouts > TIMING.RESOURCE_TIMEOUT_THRESHOLD) {
      contentLogger.warn('High resource usage detected, possible memory leak?', resourceCount);
    }
  }, TIMING.RESOURCE_MONITORING_INTERVAL);

  // Clean up monitoring on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(monitoringInterval);
  });
}

// Initialize AbortController and setup on page load
abortController = new AbortController();

// Initialize based on context
if (pageContext.isViewPage() && !pageContext.isIframeContext()) {
  // Regular view page (not in iframe)
  initializeFeatureSystem();
} else if (pageContext.isBoardPage() || (pageContext.isIframeContext() && pageContext.isViewPage())) {
  // Board page or view page inside iframe
  initializeFeatureSystem();
} else if (pageContext.isAddPage()) {
  // Issue creation page
  contentLogger.debug('Initializing for add page');
  initializeFeatureSystem();
}