import React, { useState, useCallback, useRef, useImperativeHandle } from 'react';
import { createRoot } from 'react-dom/client';
import {
  MESSAGE_ACTIONS,
  DOM_SELECTORS,
  DOM_IDS,
  DOM_CLASSES,
  BUTTON_LABELS,
  SORT_ORDERS,
  URL_PATTERNS,
  TIMING,
  RESPONSE_KEYS,
  OBSERVER_NAMES,
  ARIA_VALUES
} from '@/constants';
import type { SortOrder } from '@/constants';

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
let sortButtonRef: React.RefObject<SortButtonRef | null> = React.createRef<SortButtonRef>();
let abortController: AbortController | null = null;

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
        resolve(response?.[RESPONSE_KEYS.ENABLED] ?? true);
      }
    });
  });
}

interface SortButtonRef {
  updateSortOrder: (isAscending: boolean) => void;
}

const SortButtonComponent = React.forwardRef<SortButtonRef, {
  onToggle: () => void;
  initialSortOrder: boolean;
}>((props, ref) => {
  const [isAscending, setIsAscending] = useState(props.initialSortOrder);
  const onToggleRef = useRef(props.onToggle);
  
  // Update the ref when onToggle changes
  onToggleRef.current = props.onToggle;
  
  const handleToggle = useCallback(() => {
    onToggleRef.current();
  }, []);
  
  useImperativeHandle(ref, () => ({
    updateSortOrder: (newIsAscending: boolean) => {
      setIsAscending(newIsAscending);
    }
  }), []);
  
  return (
    <button
      type="button"
      className={DOM_CLASSES.FILTER_NAV_LINK}
      id={DOM_IDS.SORT_TOGGLE_BUTTON}
      aria-pressed={isAscending ? ARIA_VALUES.TRUE : ARIA_VALUES.FALSE}
      onClick={handleToggle}
    >
      <span className={DOM_CLASSES.FILTER_NAV_TEXT}>
        {isAscending ? BUTTON_LABELS.ASC : BUTTON_LABELS.DESC}
      </span>
    </button>
  );
});

SortButtonComponent.displayName = 'SortButtonComponent';

export const SortButton: React.FC<{
  onToggle: () => void;
  isAscending: boolean;
}> = ({ onToggle, isAscending }) => {
  return (
    <button
      type="button"
      className={DOM_CLASSES.FILTER_NAV_LINK}
      id={DOM_IDS.SORT_TOGGLE_BUTTON}
      aria-pressed={isAscending ? ARIA_VALUES.TRUE : ARIA_VALUES.FALSE}
      onClick={onToggle}
    >
      <span className={DOM_CLASSES.FILTER_NAV_TEXT}>
        {isAscending ? BUTTON_LABELS.ASC : BUTTON_LABELS.DESC}
      </span>
    </button>
  );
};

function cleanupSortButton(): void {
  console.debug('[BacklogCommentSorter] Starting cleanup, active resources:', resourceTracker.getActiveResourcesCount());
  
  // Abort all ongoing operations
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  
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
  sortButtonRef = React.createRef<SortButtonRef>();
  
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
  
  // Don't reinitialize if button already exists
  if (document.getElementById(DOM_IDS.SORT_TOGGLE_BUTTON)) {
    return;
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
  if (document.getElementById(DOM_IDS.SORT_TOGGLE_BUTTON)) {
    return;
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
    const commentItems = Array.from(commentList.querySelectorAll<CommentItem>(DOM_SELECTORS.COMMENT_ITEM));
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
  
  // Create React root and render the optimized button
  if (!abortController?.signal.aborted) {
    reactRoot = createRoot(newDd);
    reactRoot.render(
      <SortButtonComponent
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
    sendResponse({ [RESPONSE_KEYS.SUCCESS]: true });
    return true;
  }
  
  if (request.action === MESSAGE_ACTIONS.NAVIGATION_TO_VIEW) {
    // Navigated to a view page, initialize the button
    initializeSortButton();
    sendResponse({ [RESPONSE_KEYS.SUCCESS]: true });
    return true;
  }
  
  if (request.action === MESSAGE_ACTIONS.NAVIGATION_FROM_VIEW) {
    // Navigated away from a view page, clean up
    cleanupSortButton();
    sendResponse({ [RESPONSE_KEYS.SUCCESS]: true });
    return true;
  }
  
  if (request.action === MESSAGE_ACTIONS.NAVIGATION_VIEW_TO_VIEW) {
    // Navigated from one view page to another view page
    // Clean up the old button and initialize for the new page
    cleanupSortButton();
    initializeSortButton();
    sendResponse({ [RESPONSE_KEYS.SUCCESS]: true });
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

// Initialize AbortController and setup on page load only if we're on a view page
abortController = new AbortController();
if (isViewPage()) {
  initializeSortButton();
}