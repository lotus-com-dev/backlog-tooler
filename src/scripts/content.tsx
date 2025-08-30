import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  MESSAGE_ACTIONS,
  POST_MESSAGE_TYPES,
  DOM_SELECTORS,
  DOM_IDS,
  DOM_CLASSES,
  URL_PATTERNS,
  OBSERVER_NAMES,
  SORT_ORDERS,
  TIMING
} from '@/shared';
import type { SortOrder } from '@/shared';
import { SortToggleButton } from '@/ui/components';
import type { SortToggleButtonRef } from '@/ui/components';

interface CommentItem extends HTMLLIElement {
  querySelector(selector: typeof DOM_SELECTORS.TIME_ELEMENT): HTMLAnchorElement | null;
}

interface SortButtonElementWithObservers extends HTMLElement {
  [OBSERVER_NAMES.COMMENT_LIST]?: MutationObserver;
  [OBSERVER_NAMES.COLLAPSE]?: MutationObserver;
}

let sortButtonElement: SortButtonElementWithObservers | null = null;
let initializationObserver: MutationObserver | null = null;
let reactRoot: ReturnType<typeof createRoot> | null = null;
let sortButtonRef: React.RefObject<SortToggleButtonRef | null> = React.createRef<SortToggleButtonRef>();
let abortController: AbortController | null = null;
let boardObserver: MutationObserver | null = null;
let iframeLoadTimeoutId: NodeJS.Timeout | null = null;

// WeakMap to manage observers without circular references
const observerMap = new WeakMap<HTMLElement, MutationObserver[]>();

// Resource tracking for debugging (only in development)
const resourceTracker = {
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

// Global handlers for event delegation
let handleCollapseClick: (() => void) | null = null;
let handleViewOptionsClick: (() => void) | null = null;

// Event delegation handler for collapse and view options clicks
const handleDelegatedClick = (event: Event) => {
  const target = event.target as HTMLElement;
  
  // Check if clicked element matches collapse icon selector
  if (target.matches(DOM_SELECTORS.COLLAPSE_ICON) || target.closest(DOM_SELECTORS.COLLAPSE_ICON)) {
    if (handleCollapseClick) {
      handleCollapseClick();
    }
  }
  // Check if clicked element matches view options button selector
  else if (target.matches(DOM_SELECTORS.VIEW_OPTIONS_BUTTON) || target.closest(DOM_SELECTORS.VIEW_OPTIONS_BUTTON)) {
    if (handleViewOptionsClick) {
      handleViewOptionsClick();
    }
  }
};

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

function cleanupSortButton(): void {
  console.debug('[BacklogCommentSorter] Starting cleanup, active resources:', resourceTracker.getActiveResourcesCount());
  
  // Abort all ongoing operations
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  
  // Clean up board-specific resources
  cleanupBoardObserver();
  
  // Clear all tracked timeouts
  resourceTracker.clearAllTimeouts();
  
  // Clean up React root first to prevent memory leaks
  if (reactRoot) {
    try {
      reactRoot.unmount();
      console.debug('[BacklogCommentSorter] React root unmounted successfully');
    } catch (error) {
      console.warn('[BacklogCommentSorter] Failed to unmount React root:', error);
    }
    reactRoot = null;
  }
  
  // Reset sort button ref
  sortButtonRef = React.createRef<SortToggleButtonRef>();
  
  // Clean up initialization observer
  if (initializationObserver) {
    try {
      initializationObserver.disconnect();
      resourceTracker.untrackObserver(initializationObserver);
    } catch (error) {
      console.warn('[BacklogCommentSorter] Failed to disconnect initialization observer:', error);
    }
    initializationObserver = null;
  }
  
  if (sortButtonElement) {
    // Clean up observers using WeakMap
    const observers = observerMap.get(sortButtonElement);
    if (observers) {
      observers.forEach(observer => {
        try {
          observer.disconnect();
          resourceTracker.untrackObserver(observer);
        } catch (error) {
          console.warn('[BacklogCommentSorter] Failed to disconnect observer:', error);
        }
      });
      observerMap.delete(sortButtonElement);
    }
    
    // Clean up legacy observers if they exist (for backward compatibility)
    if (sortButtonElement[OBSERVER_NAMES.COMMENT_LIST]) {
      try {
        sortButtonElement[OBSERVER_NAMES.COMMENT_LIST]?.disconnect();
        resourceTracker.untrackObserver(sortButtonElement[OBSERVER_NAMES.COMMENT_LIST]!);
        delete sortButtonElement[OBSERVER_NAMES.COMMENT_LIST];
      } catch (error) {
        console.warn('[BacklogCommentSorter] Failed to disconnect legacy observer:', error);
      }
    }
    
    // Remove event delegation listener from comment list
    const commentList = document.querySelector<HTMLUListElement>(DOM_SELECTORS.COMMENT_LIST);
    if (commentList) {
      try {
        commentList.removeEventListener('click', handleDelegatedClick);
      } catch (error) {
        console.warn('[BacklogCommentSorter] Failed to remove event listener:', error);
      }
    }
    
    // Reset global handlers
    handleCollapseClick = null;
    handleViewOptionsClick = null;
    
    // Remove DOM element
    try {
      sortButtonElement.remove();
      resourceTracker.untrackElement(sortButtonElement);
      console.debug('[BacklogCommentSorter] Sort button element removed successfully');
    } catch (error) {
      console.warn('[BacklogCommentSorter] Failed to remove sort button element:', error);
    }
    sortButtonElement = null;
  }
  
  // Final resource check
  const finalResourceCount = resourceTracker.getActiveResourcesCount();
  if (finalResourceCount.observers > 0 || finalResourceCount.timeouts > 0) {
    console.warn('[BacklogCommentSorter] Cleanup incomplete, remaining resources:', finalResourceCount);
  } else {
    console.debug('[BacklogCommentSorter] Cleanup completed successfully');
  }
  
  // Create new AbortController for next initialization
  abortController = new AbortController();
}

function isViewPage(): boolean {
  return window.location.pathname.includes(URL_PATTERNS.VIEW_PATH);
}

function isBoardPage(): boolean {
  return window.location.pathname.includes(URL_PATTERNS.BOARD_PATH);
}

function isIframeContext(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function cleanupBoardObserver(): void {
  if (boardObserver) {
    try {
      boardObserver.disconnect();
      resourceTracker.untrackObserver(boardObserver);
    } catch (error) {
      console.warn('[BacklogCommentSorter] Failed to disconnect board observer:', error);
    }
    boardObserver = null;
  }
  
  if (iframeLoadTimeoutId) {
    resourceTracker.clearTimeout(iframeLoadTimeoutId);
    iframeLoadTimeoutId = null;
  }
}

function observeBoardIframe(): void {
  // If we're already inside an iframe (view page in modal), initialize normally
  if (isIframeContext() && isViewPage()) {
    initializeSortButton();
    return;
  }
  
  // If we're on the board page (parent window), watch for iframe changes
  if (!isIframeContext() && isBoardPage()) {
    // Clean up any existing board observer first
    cleanupBoardObserver();
    
    const observeIframeLoad = () => {
      const iframe = document.querySelector<HTMLIFrameElement>(DOM_SELECTORS.ISSUE_DIALOG_IFRAME);
      if (!iframe) return;

      let lastProcessedSrc = '';
      
      const handleIframeChange = () => {
        // Debounce rapid changes
        if (iframeLoadTimeoutId) {
          resourceTracker.clearTimeout(iframeLoadTimeoutId);
        }
        
        iframeLoadTimeoutId = setTimeout(() => {
          // Check if src actually changed to avoid duplicate processing
          if (iframe.src === lastProcessedSrc) return;
          lastProcessedSrc = iframe.src;
          
          if (iframe.src && iframe.src.includes(URL_PATTERNS.VIEW_PATH)) {
            // Create a single-use load handler to avoid memory leaks
            const handleLoad = () => {
              iframe.removeEventListener('load', handleLoad);
              // Double-check iframe still has the same src
              if (iframe.src === lastProcessedSrc) {
                iframe.contentWindow?.postMessage(
                  { type: POST_MESSAGE_TYPES.INIT_SORT_BUTTON },
                  '*'
                );
              }
            };
            
            // Check if iframe is already loaded
            if (iframe.contentDocument?.readyState === 'complete') {
              handleLoad();
            } else {
              iframe.addEventListener('load', handleLoad, { once: true });
            }
          }
          iframeLoadTimeoutId = null;
        }, TIMING.UPDATE_DEBOUNCE);
        
        resourceTracker.trackTimeout(iframeLoadTimeoutId);
      };

      // Listen for iframe src changes
      boardObserver = new MutationObserver(handleIframeChange);
      
      boardObserver.observe(iframe, {
        attributes: true,
        attributeFilter: ['src']
      });
      
      // Track observer for cleanup
      resourceTracker.trackObserver(boardObserver);
      
      // Initial check if iframe already has a src
      handleIframeChange();
    };
    
    // Wait for DOM to be ready then observe
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observeIframeLoad, { once: true });
    } else {
      observeIframeLoad();
    }
  }
}

// Listen for messages from parent window (board page)
if (isIframeContext()) {
  window.addEventListener('message', (event) => {
    if (event.data?.type === POST_MESSAGE_TYPES.INIT_SORT_BUTTON && isViewPage()) {
      // Delay initialization to ensure DOM is ready
      setTimeout(() => {
        initializeSortButton();
      }, TIMING.UPDATE_DEBOUNCE);
    }
  });
}

async function initializeSortButton(retryCount: number = 0): Promise<void> {
  // Create AbortController if it doesn't exist
  if (!abortController) {
    abortController = new AbortController();
  }
  
  // Check if operation was aborted
  if (abortController.signal.aborted) {
    return;
  }
  
  const enabled = await isExtensionEnabled();
  if (!enabled) {
    cleanupSortButton();
    return;
  }
  
  // Clean up any existing button before creating new one
  const existingButton = document.getElementById(DOM_IDS.SORT_TOGGLE_BUTTON);
  if (existingButton || sortButtonElement) {
    cleanupSortButton();
  }
  
  // Check if element already exists
  const existingElement = document.querySelector<HTMLDListElement>(DOM_SELECTORS.FILTER_NAV);
  if (existingElement) {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      addSortToggleButtonAndExpand(existingElement);
    });
    return;
  }
  
  // If we've exceeded max retries, give up
  if (retryCount >= TIMING.MAX_RETRIES) {
    return;
  }
  
  // For immediate retry attempts, use setTimeout
  if (retryCount > 0) {
    const timeoutId = setTimeout(() => {
      initializeSortButton(retryCount + 1);
      resourceTracker.clearTimeout(timeoutId);
    }, TIMING.RETRY_DELAY);
    resourceTracker.trackTimeout(timeoutId);
    return;
  }
  
  // Clean up any existing initialization observer
  if (initializationObserver) {
    initializationObserver.disconnect();
    resourceTracker.untrackObserver(initializationObserver);
  }
  
  // Use MutationObserver to efficiently wait for the element
  initializationObserver = new MutationObserver((mutations) => {
    // Check if operation was aborted
    if (abortController?.signal.aborted) {
      return;
    }
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        const targetElement = document.querySelector<HTMLDListElement>(DOM_SELECTORS.FILTER_NAV);
        if (targetElement) {
          if (initializationObserver) {
            initializationObserver.disconnect();
            resourceTracker.untrackObserver(initializationObserver);
            initializationObserver = null;
          }
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            // Check abort signal before proceeding
            if (!abortController?.signal.aborted) {
              addSortToggleButtonAndExpand(targetElement);
            }
          });
          break;
        }
      }
    }
  });
  
  // Track the observer for resource management
  resourceTracker.trackObserver(initializationObserver);
  
  // Start observing changes to the document body
  initializationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Set up timeout to prevent observer from running forever
  const timeoutId = setTimeout(() => {
    if (initializationObserver) {
      initializationObserver.disconnect();
      resourceTracker.untrackObserver(initializationObserver);
      initializationObserver = null;
      // Try again with retry mechanism
      initializeSortButton(1);
    }
    resourceTracker.clearTimeout(timeoutId);
  }, TIMING.OBSERVER_TIMEOUT);
  
  resourceTracker.trackTimeout(timeoutId);
}

function addSortToggleButtonAndExpand(filterNav: HTMLDListElement): void {
  // Double-check for existing button and clean up if found
  const existingButton = document.getElementById(DOM_IDS.SORT_TOGGLE_BUTTON);
  if (existingButton || sortButtonElement) {
    cleanupSortButton();
  }
  
  const commentList = document.querySelector<HTMLUListElement>(DOM_SELECTORS.COMMENT_LIST);
  if (!commentList) return;
  
  
  const newDd = document.createElement('dd');
  newDd.className = DOM_CLASSES.FILTER_NAV_ITEM;
  filterNav.appendChild(newDd);
  sortButtonElement = newDd;
  
  // Track the sort button element for resource management
  resourceTracker.trackElement(newDd);
  
  const getTimestamp = (item: CommentItem): number => {
    const timeElement = item.querySelector(DOM_SELECTORS.TIME_ELEMENT);
    return timeElement ? new Date(timeElement.textContent?.trim() || '').getTime() : 0;
  };
  
  // Cache for timestamp values to avoid repeated DOM queries and date parsing
  let timestampCache = new WeakMap<CommentItem, number>();
  
  const getCachedTimestamp = (item: CommentItem): number => {
    if (!timestampCache.has(item)) {
      timestampCache.set(item, getTimestamp(item));
    }
    return timestampCache.get(item)!;
  };

  let currentSortOrder: SortOrder = SORT_ORDERS.ASC;
  let sortedComments: CommentItem[] = [];
  const initialComments = Array.from(commentList.querySelectorAll<CommentItem>(DOM_SELECTORS.COMMENT_ITEM));
  
  if (initialComments.length >= 2) {
    const firstCommentTime = getCachedTimestamp(initialComments[0]);
    const lastCommentTime = getCachedTimestamp(initialComments[initialComments.length - 1]);
    
    if (firstCommentTime > lastCommentTime) {
      currentSortOrder = SORT_ORDERS.DESC;
    }
  }

  // Initialize sorted comments array with cached timestamps
  sortedComments = initialComments.slice().sort((a, b) => {
    const timeA = getCachedTimestamp(a);
    const timeB = getCachedTimestamp(b);
    return currentSortOrder === SORT_ORDERS.ASC ? timeA - timeB : timeB - timeA;
  });
  
  // Function to update is_first class on the first visible comment
  const updateIsFirstClass = () => {
    const commentItems = Array.from(commentList.querySelectorAll<CommentItem>(DOM_SELECTORS.COMMENT_ITEM));
    
    // Remove is_first class from all comments
    commentItems.forEach(item => {
      item.classList.remove(DOM_CLASSES.IS_FIRST);
    });
    
    // Add is_first class to the first comment
    if (commentItems.length > 0) {
      commentItems[0].classList.add(DOM_CLASSES.IS_FIRST);
    }
  };
  
  const handleToggle = () => {
    // Get all comment items but exclude dummy items (like load comments button)
    const commentItems = Array.from(commentList.querySelectorAll<CommentItem>(DOM_SELECTORS.COMMENT_ITEM))
      .filter(item => !item.classList.contains(DOM_CLASSES.DAMMY));
    currentSortOrder = currentSortOrder === SORT_ORDERS.DESC ? SORT_ORDERS.ASC : SORT_ORDERS.DESC;
    
    // Remove is_first class from all comments before sorting
    commentItems.forEach(item => {
      item.classList.remove(DOM_CLASSES.IS_FIRST);
    });
    
    // Check if comments are already sorted - if so, just reverse instead of full sort
    const currentCommentsMatch = commentItems.length === sortedComments.length && 
      commentItems.every((item, index) => item === sortedComments[index]);
    
    if (currentCommentsMatch) {
      // Comments haven't changed since last sort, just reverse the order
      sortedComments.reverse();
    } else {
      // New comments detected or first sort, cache new timestamps and perform full sort
      commentItems.forEach(item => {
        if (!timestampCache.has(item)) {
          timestampCache.set(item, getTimestamp(item));
        }
      });
      
      sortedComments = commentItems.slice().sort((a, b) => {
        const timeA = getCachedTimestamp(a);
        const timeB = getCachedTimestamp(b);
        return currentSortOrder === SORT_ORDERS.ASC ? timeA - timeB : timeB - timeA;
      });
    }
    
    // Re-append sorted items to the comment list
    sortedComments.forEach(item => commentList.appendChild(item));
    
    // Update is_first class
    updateIsFirstClass();
    
    // Update sort button state through ref (optimized - no re-render)
    if (sortButtonRef.current && !abortController?.signal.aborted) {
      sortButtonRef.current.updateSortOrder(currentSortOrder === SORT_ORDERS.ASC);
    }
  };
  
  // Set up MutationObserver to detect changes in the comment list
  const commentListObserver = new MutationObserver((mutations) => {
    // Check if operation was aborted
    if (abortController?.signal.aborted) {
      return;
    }
    
    // Check if the mutations are relevant (not caused by our own sorting)
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Clear timestamp cache when new comments are added
        timestampCache = new WeakMap<CommentItem, number>();
        
        // Debounce the update to avoid multiple rapid calls
        const timeoutId = setTimeout(() => {
          // Check abort signal again before updating
          if (!abortController?.signal.aborted) {
            updateIsFirstClass();
          }
          resourceTracker.clearTimeout(timeoutId);
        }, TIMING.UPDATE_DEBOUNCE);
        resourceTracker.trackTimeout(timeoutId);
        break;
      }
    }
  });
  
  // Track the comment list observer for resource management
  resourceTracker.trackObserver(commentListObserver);
  
  // Start observing the comment list for changes with abort signal support
  if (!abortController?.signal.aborted) {
    commentListObserver.observe(commentList, {
      childList: true,
      subtree: false
    });
  }
  
  
  // Set up global handlers for event delegation
  handleCollapseClick = () => {
    // Wait for the DOM to update after collapse/expand
    const timeoutId = setTimeout(() => {
      // Check abort signal again before updating
      if (!abortController?.signal.aborted) {
        updateIsFirstClass();
      }
      resourceTracker.clearTimeout(timeoutId);
    }, TIMING.UPDATE_DEBOUNCE);
    resourceTracker.trackTimeout(timeoutId);
  };
  
  handleViewOptionsClick = () => {
    // Wait for the DOM to update after expand all/collapse all
    const timeoutId = setTimeout(() => {
      updateIsFirstClass();
      resourceTracker.clearTimeout(timeoutId);
    }, TIMING.UPDATE_DEBOUNCE);
    resourceTracker.trackTimeout(timeoutId);
  };
  
  // Set up event delegation for collapse icons and view options buttons with abort signal support
  if (abortController && !abortController.signal.aborted) {
    commentList.addEventListener('click', handleDelegatedClick, { 
      signal: abortController.signal 
    });
  }
  
  // Create React root and render the toggle button
  if (!abortController?.signal.aborted) {
    reactRoot = createRoot(newDd);
    reactRoot.render(
      <SortToggleButton
        ref={sortButtonRef}
        onToggle={handleToggle} 
        initialSortOrder={currentSortOrder === SORT_ORDERS.ASC} 
      />
    );
  }
  
  // Store observers using WeakMap for memory safety
  if (newDd) {
    const existingObservers = observerMap.get(newDd) || [];
    observerMap.set(newDd, [...existingObservers, commentListObserver]);
  }
  
  // Legacy support: also store in element property for backward compatibility
  (newDd as SortButtonElementWithObservers)[OBSERVER_NAMES.COMMENT_LIST] = commentListObserver;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === MESSAGE_ACTIONS.TOGGLE_EXTENSION) {
    if (request.enabled) {
      initializeSortButton();
    } else {
      cleanupSortButton();
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === MESSAGE_ACTIONS.NAVIGATION_TO_VIEW) {
    // Navigated to a view page, initialize the button
    initializeSortButton();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === MESSAGE_ACTIONS.NAVIGATION_FROM_VIEW) {
    // Navigated away from a view page, clean up
    cleanupSortButton();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === MESSAGE_ACTIONS.NAVIGATION_VIEW_TO_VIEW) {
    // Navigated from one view page to another view page
    // Clean up the old button and initialize for the new page
    cleanupSortButton();
    initializeSortButton();
    sendResponse({ success: true });
    return true;
  }
  
  return false;
});

// Development mode resource monitoring
if (process.env.NODE_ENV === 'development') {
  // Monitor resources every 30 seconds
  const monitoringInterval = setInterval(() => {
    const resourceCount = resourceTracker.getActiveResourcesCount();
    console.debug('[BacklogCommentSorter] Resource monitoring:', {
      ...resourceCount,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
    
    // Warn if resources are accumulating
    if (resourceCount.observers > 5 || resourceCount.timeouts > 10) {
      console.warn('[BacklogCommentSorter] High resource usage detected. Possible memory leak?', resourceCount);
    }
  }, 30000);
  
  // Clean up monitoring on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(monitoringInterval);
  });
}

// Initialize AbortController and setup on page load
abortController = new AbortController();

// Initialize based on context
if (isViewPage() && !isIframeContext()) {
  // Regular view page (not in iframe)
  initializeSortButton();
} else if (isBoardPage() || (isIframeContext() && isViewPage())) {
  // Board page or view page inside iframe
  observeBoardIframe();
}