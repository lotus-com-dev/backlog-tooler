import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  DOM_SELECTORS,
  DOM_IDS,
  DOM_CLASSES,
  SORT_ORDERS,
  TIMING,
  POST_MESSAGE_TYPES,
  URL_PATTERNS,
  featureLogger
} from '@/shared';
import type { SortOrder } from '@/shared';
import { SortToggleButton } from '@/ui/components';
import type { SortToggleButtonRef } from '@/ui/components';
import { BaseFeature } from '@/core';
import type { FeatureConfig, FeatureContext, PageContext } from '@/core';
import type { CommentItem, SortButtonElementWithObservers, CommentSorterConfig } from '@/features/comment-sorter/types';

export class CommentSorterFeature extends BaseFeature {
  private featureConfig: CommentSorterConfig;
  private sortButtonElement: SortButtonElementWithObservers | null = null;
  private initializationObserver: MutationObserver | null = null;
  private reactRoot: ReturnType<typeof createRoot> | null = null;
  private sortButtonRef: React.RefObject<SortToggleButtonRef | null> = React.createRef<SortToggleButtonRef>();
  private boardObserver: MutationObserver | null = null;
  private iframeLoadTimeoutId: NodeJS.Timeout | null = null;

  // WeakMap to manage observers without circular references
  private observerMap = new WeakMap<HTMLElement, MutationObserver[]>();

  // Global handlers for event delegation
  private handleCollapseClick: (() => void) | null = null;
  private handleViewOptionsClick: (() => void) | null = null;

  constructor(
    featureConfig: FeatureConfig,
    context: FeatureContext,
    pageContext: PageContext,
    config: CommentSorterConfig = {
      initialSortOrder: SORT_ORDERS.ASC,
      enableTimestampCache: true,
      updateDebounceMs: TIMING.UPDATE_DEBOUNCE
    }
  ) {
    super(featureConfig, context, pageContext);
    this.featureConfig = config;

    // Bind methods to preserve context
    this.handleDelegatedClick = this.handleDelegatedClick.bind(this);
  }

  shouldActivate(): boolean {
    return this.pageContext.isViewPage();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      featureLogger.debug('Already initialized');
      return;
    }

    featureLogger.info('Initializing comment sorter');

    // Initialize based on context
    if (this.pageContext.isViewPage() && !this.pageContext.isIframeContext()) {
      // Regular view page (not in iframe)
      await this.initializeSortButton();
    } else if (this.pageContext.isBoardPage() || 
               (this.pageContext.isIframeContext() && this.pageContext.isViewPage())) {
      // Board page or view page inside iframe
      this.observeBoardIframe();
    }

    // Listen for messages from parent window (board page)
    if (this.pageContext.isIframeContext()) {
      window.addEventListener('message', (event) => {
        if (event.data?.type === POST_MESSAGE_TYPES.INIT_SORT_BUTTON && this.pageContext.isViewPage()) {
          // Delay initialization to ensure DOM is ready
          const timeoutId = setTimeout(() => {
            this.initializeSortButton();
            this.context.resourceTracker.clearTimeout(timeoutId);
          }, this.featureConfig.updateDebounceMs);
          this.context.resourceTracker.trackTimeout(timeoutId);
        }
      });
    }

    this.setInitialized(true);
  }

  cleanup(): void {
    featureLogger.debug('Starting cleanup');

    // Clean up board-specific resources
    this.cleanupBoardObserver();

    // Clean up React root first to prevent memory leaks
    if (this.reactRoot) {
      try {
        this.reactRoot.unmount();
        featureLogger.debug('React root unmounted');
      } catch (error) {
        featureLogger.warn('Failed to unmount React root:', error);
      }
      this.reactRoot = null;
    }

    // Reset sort button ref
    this.sortButtonRef = React.createRef<SortToggleButtonRef>();

    // Clean up initialization observer
    if (this.initializationObserver) {
      try {
        this.initializationObserver.disconnect();
        this.context.resourceTracker.untrackObserver(this.initializationObserver);
      } catch (error) {
        featureLogger.warn('Failed to disconnect initialization observer:', error);
      }
      this.initializationObserver = null;
    }

    if (this.sortButtonElement) {
      // Clean up observers using WeakMap
      const observers = this.observerMap.get(this.sortButtonElement);
      if (observers) {
        observers.forEach(observer => {
          try {
            observer.disconnect();
            this.context.resourceTracker.untrackObserver(observer);
          } catch (error) {
            featureLogger.warn('Failed to disconnect observer:', error);
          }
        });
        this.observerMap.delete(this.sortButtonElement);
      }


      // Remove event delegation listener from comment list
      const commentList = document.querySelector<HTMLUListElement>(DOM_SELECTORS.COMMENT_LIST);
      if (commentList) {
        try {
          commentList.removeEventListener('click', this.handleDelegatedClick);
        } catch (error) {
          featureLogger.warn('Failed to remove event listener:', error);
        }
      }

      // Reset global handlers
      this.handleCollapseClick = null;
      this.handleViewOptionsClick = null;

      // Remove DOM element
      try {
        this.sortButtonElement.remove();
        this.context.resourceTracker.untrackElement(this.sortButtonElement);
        featureLogger.debug('Sort button element removed');
      } catch (error) {
        featureLogger.warn('Failed to remove sort button element:', error);
      }
      this.sortButtonElement = null;
    }

    this.setInitialized(false);
    featureLogger.debug('Cleanup completed');
  }

  private cleanupBoardObserver(): void {
    if (this.boardObserver) {
      try {
        this.boardObserver.disconnect();
        this.context.resourceTracker.untrackObserver(this.boardObserver);
      } catch (error) {
        featureLogger.warn('Failed to disconnect board observer:', error);
      }
      this.boardObserver = null;
    }

    if (this.iframeLoadTimeoutId) {
      this.context.resourceTracker.clearTimeout(this.iframeLoadTimeoutId);
      this.iframeLoadTimeoutId = null;
    }
  }

  private observeBoardIframe(): void {
    // If we're already inside an iframe (view page in modal), initialize normally
    if (this.pageContext.isIframeContext() && this.pageContext.isViewPage()) {
      this.initializeSortButton();
      return;
    }

    // If we're on the board page (parent window), watch for iframe changes
    if (!this.pageContext.isIframeContext() && this.pageContext.isBoardPage()) {
      // Clean up any existing board observer first
      this.cleanupBoardObserver();

      const observeIframeLoad = () => {
        const iframe = document.querySelector<HTMLIFrameElement>(DOM_SELECTORS.ISSUE_DIALOG_IFRAME);
        if (!iframe) return;

        let lastProcessedSrc = '';

        const handleIframeChange = () => {
          // Debounce rapid changes
          if (this.iframeLoadTimeoutId) {
            this.context.resourceTracker.clearTimeout(this.iframeLoadTimeoutId);
          }

          this.iframeLoadTimeoutId = setTimeout(() => {
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
            this.iframeLoadTimeoutId = null;
          }, TIMING.UPDATE_DEBOUNCE);

          this.context.resourceTracker.trackTimeout(this.iframeLoadTimeoutId!);
        };

        // Listen for iframe src changes
        this.boardObserver = new MutationObserver(handleIframeChange);

        this.boardObserver.observe(iframe, {
          attributes: true,
          attributeFilter: ['src']
        });

        // Track observer for cleanup
        this.context.resourceTracker.trackObserver(this.boardObserver);

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

  // Event delegation handler for collapse and view options clicks
  private handleDelegatedClick(event: Event): void {
    const target = event.target as HTMLElement;

    // Check if clicked element matches collapse icon selector
    if (target.matches(DOM_SELECTORS.COLLAPSE_ICON) || target.closest(DOM_SELECTORS.COLLAPSE_ICON)) {
      if (this.handleCollapseClick) {
        this.handleCollapseClick();
      }
    }
    // Check if clicked element matches view options button selector
    else if (target.matches(DOM_SELECTORS.VIEW_OPTIONS_BUTTON) || target.closest(DOM_SELECTORS.VIEW_OPTIONS_BUTTON)) {
      if (this.handleViewOptionsClick) {
        this.handleViewOptionsClick();
      }
    }
  }

  private async initializeSortButton(retryCount: number = 0): Promise<void> {
    // Check if operation was aborted
    if (this.context.abortController.signal.aborted) {
      return;
    }

    const enabled = await this.context.isExtensionEnabled();
    if (!enabled) {
      this.cleanup();
      return;
    }

    // Enhanced cleanup: Remove all existing sort buttons to prevent duplicates
    const existingButtons = document.querySelectorAll(`#${DOM_IDS.SORT_TOGGLE_BUTTON}`);
    if (existingButtons.length > 0) {
      featureLogger.debug(`Found ${existingButtons.length} existing buttons, removing`);
      existingButtons.forEach(button => {
        // Remove the parent dd element if it exists
        const parentDd = button.closest('dd');
        if (parentDd) {
          parentDd.remove();
        } else {
          button.remove();
        }
      });
    }

    // Also cleanup if sortButtonElement exists
    if (this.sortButtonElement) {
      featureLogger.debug('Cleaning up existing sortButtonElement');
      this.cleanup();
    }

    // Check if element already exists
    const existingElement = document.querySelector<HTMLDListElement>(DOM_SELECTORS.FILTER_NAV);
    if (existingElement) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        this.addSortToggleButtonAndExpand(existingElement);
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
        this.initializeSortButton(retryCount + 1);
        this.context.resourceTracker.clearTimeout(timeoutId);
      }, TIMING.RETRY_DELAY);
      this.context.resourceTracker.trackTimeout(timeoutId);
      return;
    }

    // Clean up any existing initialization observer
    if (this.initializationObserver) {
      this.initializationObserver.disconnect();
      this.context.resourceTracker.untrackObserver(this.initializationObserver);
    }

    // Use MutationObserver to efficiently wait for the element
    this.initializationObserver = new MutationObserver((mutations) => {
      // Check if operation was aborted
      if (this.context.abortController.signal.aborted) {
        return;
      }

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          const targetElement = document.querySelector<HTMLDListElement>(DOM_SELECTORS.FILTER_NAV);
          if (targetElement) {
            if (this.initializationObserver) {
              this.initializationObserver.disconnect();
              this.context.resourceTracker.untrackObserver(this.initializationObserver);
              this.initializationObserver = null;
            }
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
              // Check abort signal before proceeding
              if (!this.context.abortController.signal.aborted) {
                this.addSortToggleButtonAndExpand(targetElement);
              }
            });
            break;
          }
        }
      }
    });

    // Track the observer for resource management
    this.context.resourceTracker.trackObserver(this.initializationObserver);

    // Start observing changes to the document body
    this.initializationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Set up timeout to prevent observer from running forever
    const timeoutId = setTimeout(() => {
      if (this.initializationObserver) {
        this.initializationObserver.disconnect();
        this.context.resourceTracker.untrackObserver(this.initializationObserver);
        this.initializationObserver = null;
        // Try again with retry mechanism
        this.initializeSortButton(1);
      }
      this.context.resourceTracker.clearTimeout(timeoutId);
    }, TIMING.OBSERVER_TIMEOUT);

    this.context.resourceTracker.trackTimeout(timeoutId);
  }

  private addSortToggleButtonAndExpand(filterNav: HTMLDListElement): void {
    // Enhanced double-check: Remove any existing sort button containers
    const existingContainers = filterNav.querySelectorAll('dd');
    existingContainers.forEach(dd => {
      if (dd.querySelector(`#${DOM_IDS.SORT_TOGGLE_BUTTON}`)) {
        featureLogger.debug('Removing existing sort button container');
        dd.remove();
      }
    });

    // Also check globally for any stray buttons
    const globalExistingButtons = document.querySelectorAll(`#${DOM_IDS.SORT_TOGGLE_BUTTON}`);
    if (globalExistingButtons.length > 0) {
      featureLogger.debug(`Found ${globalExistingButtons.length} stray buttons, removing`);
      globalExistingButtons.forEach(button => {
        const parentDd = button.closest('dd');
        if (parentDd) {
          parentDd.remove();
        } else {
          button.remove();
        }
      });
    }

    // Cleanup if sortButtonElement exists
    if (this.sortButtonElement) {
      featureLogger.debug('Cleaning up before creating new button');
      this.cleanup();
    }

    const commentList = document.querySelector<HTMLUListElement>(DOM_SELECTORS.COMMENT_LIST);
    if (!commentList) return;

    // Final check before creating new button
    if (document.getElementById(DOM_IDS.SORT_TOGGLE_BUTTON)) {
      featureLogger.warn('Sort button still exists after cleanup, aborting');
      return;
    }

    const newDd = document.createElement('dd');
    newDd.className = DOM_CLASSES.FILTER_NAV_ITEM;
    newDd.setAttribute('data-backlog-sorter', 'true'); // Mark as our element for easier identification
    filterNav.appendChild(newDd);
    this.sortButtonElement = newDd;

    // Track the sort button element for resource management
    this.context.resourceTracker.trackElement(newDd);

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

    let currentSortOrder: SortOrder = this.featureConfig.initialSortOrder;
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
      if (this.sortButtonRef.current && !this.context.abortController.signal.aborted) {
        this.sortButtonRef.current.updateSortOrder(currentSortOrder === SORT_ORDERS.ASC);
      }
    };

    // Set up MutationObserver to detect changes in the comment list
    const commentListObserver = new MutationObserver((mutations) => {
      // Check if operation was aborted
      if (this.context.abortController.signal.aborted) {
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
            if (!this.context.abortController.signal.aborted) {
              updateIsFirstClass();
            }
            this.context.resourceTracker.clearTimeout(timeoutId);
          }, this.featureConfig.updateDebounceMs);
          this.context.resourceTracker.trackTimeout(timeoutId);
          break;
        }
      }
    });

    // Track the comment list observer for resource management
    this.context.resourceTracker.trackObserver(commentListObserver);

    // Start observing the comment list for changes with abort signal support
    if (!this.context.abortController.signal.aborted) {
      commentListObserver.observe(commentList, {
        childList: true,
        subtree: false
      });
    }

    // Set up global handlers for event delegation
    this.handleCollapseClick = () => {
      // Wait for the DOM to update after collapse/expand
      const timeoutId = setTimeout(() => {
        // Check abort signal again before updating
        if (!this.context.abortController.signal.aborted) {
          updateIsFirstClass();
        }
        this.context.resourceTracker.clearTimeout(timeoutId);
      }, this.featureConfig.updateDebounceMs);
      this.context.resourceTracker.trackTimeout(timeoutId);
    };

    this.handleViewOptionsClick = () => {
      // Wait for the DOM to update after expand all/collapse all
      const timeoutId = setTimeout(() => {
        updateIsFirstClass();
        this.context.resourceTracker.clearTimeout(timeoutId);
      }, this.featureConfig.updateDebounceMs);
      this.context.resourceTracker.trackTimeout(timeoutId);
    };

    // Set up event delegation for collapse icons and view options buttons with abort signal support
    if (!this.context.abortController.signal.aborted) {
      commentList.addEventListener('click', this.handleDelegatedClick, {
        signal: this.context.abortController.signal
      });
    }

    // Create React root and render the toggle button
    if (!this.context.abortController.signal.aborted) {
      this.reactRoot = createRoot(newDd);
      this.reactRoot.render(
        <SortToggleButton
          ref={this.sortButtonRef}
          onToggle={handleToggle}
          initialSortOrder={currentSortOrder === SORT_ORDERS.ASC}
        />
      );
    }

    // Store observers using WeakMap for memory safety
    if (newDd) {
      const existingObservers = this.observerMap.get(newDd) || [];
      this.observerMap.set(newDd, [...existingObservers, commentListObserver]);
    }

  }
}