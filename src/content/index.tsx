import React from 'react';
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
  if (sortButtonElement) {
    // Clean up observers if they exist
    if (sortButtonElement[OBSERVER_NAMES.COMMENT_LIST]) {
      sortButtonElement[OBSERVER_NAMES.COMMENT_LIST]?.disconnect();
    }
    if (sortButtonElement[OBSERVER_NAMES.COLLAPSE]) {
      sortButtonElement[OBSERVER_NAMES.COLLAPSE]?.disconnect();
    }
    
    // Remove all event listeners from collapse icons and view options buttons
    const collapseIcons = document.querySelectorAll(DOM_SELECTORS.COLLAPSE_ICON);
    collapseIcons.forEach(icon => {
      // Create a clone to remove all event listeners
      const newIcon = icon.cloneNode(true);
      icon.parentNode?.replaceChild(newIcon, icon);
    });
    
    const viewOptionsButtons = document.querySelectorAll(DOM_SELECTORS.VIEW_OPTIONS_BUTTON);
    viewOptionsButtons.forEach(button => {
      // Create a clone to remove all event listeners
      const newButton = button.cloneNode(true);
      button.parentNode?.replaceChild(newButton, button);
    });
    
    sortButtonElement.remove();
    sortButtonElement = null;
  }
}

function isViewPage(): boolean {
  return window.location.pathname.includes(URL_PATTERNS.VIEW_PATH);
}

async function initializeSortButton(): Promise<void> {
  const enabled = await isExtensionEnabled();
  if (!enabled) {
    cleanupSortButton();
    return;
  }
  
  // Don't reinitialize if button already exists
  if (document.getElementById(DOM_IDS.SORT_TOGGLE_BUTTON)) {
    return;
  }
  
  const observer = setInterval(() => {
    const targetElement = document.querySelector<HTMLDListElement>(DOM_SELECTORS.FILTER_NAV);
    
    if (targetElement) {
      clearInterval(observer);
      addSortToggleButtonAndExpand(targetElement);
    }
  }, TIMING.OBSERVER_INTERVAL);
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
  
  const getTimestamp = (item: CommentItem): number => {
    const timeElement = item.querySelector(DOM_SELECTORS.TIME_ELEMENT);
    return timeElement ? new Date(timeElement.textContent?.trim() || '').getTime() : 0;
  };
  
  let currentSortOrder: SortOrder = SORT_ORDERS.DESC;
  const initialComments = Array.from(commentList.querySelectorAll<CommentItem>(DOM_SELECTORS.COMMENT_ITEM));
  
  if (initialComments.length >= 2) {
    const firstCommentTime = getTimestamp(initialComments[0]);
    const lastCommentTime = getTimestamp(initialComments[initialComments.length - 1]);
    
    if (firstCommentTime < lastCommentTime) {
      currentSortOrder = SORT_ORDERS.ASC;
    }
  }
  
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
    
    commentItems.sort((a, b) => {
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);
      return currentSortOrder === SORT_ORDERS.ASC ? timeA - timeB : timeB - timeA;
    });
    
    // Re-append sorted items to the comment list
    commentItems.forEach(item => commentList.appendChild(item));
    
    // Update is_first class
    updateIsFirstClass();
    
    // Re-render the React component
    root.render(
      <SortButton 
        onToggle={handleToggle} 
        isAscending={currentSortOrder === SORT_ORDERS.ASC} 
      />
    );
  };
  
  // Set up MutationObserver to detect changes in the comment list
  const commentListObserver = new MutationObserver((mutations) => {
    // Check if the mutations are relevant (not caused by our own sorting)
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Debounce the update to avoid multiple rapid calls
        setTimeout(() => {
          updateIsFirstClass();
        }, TIMING.UPDATE_DEBOUNCE);
        break;
      }
    }
  });
  
  // Start observing the comment list for changes
  commentListObserver.observe(commentList, {
    childList: true,
    subtree: false
  });
  
  // Add click listeners to collapse icons and view options buttons
  const addCollapseListeners = () => {
    // Individual collapse icons
    const collapseIcons = document.querySelectorAll(DOM_SELECTORS.COLLAPSE_ICON);
    collapseIcons.forEach(icon => {
      // Remove any existing listener to avoid duplicates
      icon.removeEventListener('click', handleCollapseClick);
      icon.addEventListener('click', handleCollapseClick);
    });
    
    // Expand all / Collapse all buttons
    const viewOptionsButtons = document.querySelectorAll(DOM_SELECTORS.VIEW_OPTIONS_BUTTON);
    viewOptionsButtons.forEach(button => {
      // Remove any existing listener to avoid duplicates
      button.removeEventListener('click', handleViewOptionsClick);
      button.addEventListener('click', handleViewOptionsClick);
    });
  };
  
  const handleCollapseClick = () => {
    // Wait for the DOM to update after collapse/expand
    setTimeout(() => {
      updateIsFirstClass();
    }, TIMING.UPDATE_DEBOUNCE);
  };
  
  const handleViewOptionsClick = () => {
    // Wait for the DOM to update after expand all/collapse all
    setTimeout(() => {
      updateIsFirstClass();
    }, TIMING.UPDATE_DEBOUNCE);
  };
  
  // Initial setup of collapse listeners
  addCollapseListeners();
  
  // Re-add listeners when new comments are added
  const collapseObserver = new MutationObserver(() => {
    addCollapseListeners();
  });
  
  collapseObserver.observe(commentList, {
    childList: true,
    subtree: true
  });
  
  // Create React root and render the button
  const root = createRoot(newDd);
  root.render(
    <SortButton 
      onToggle={handleToggle} 
      isAscending={currentSortOrder === SORT_ORDERS.ASC} 
    />
  );
  
  // Store observers for cleanup
  (newDd as SortButtonElementWithObservers)[OBSERVER_NAMES.COMMENT_LIST] = commentListObserver;
  (newDd as SortButtonElementWithObservers)[OBSERVER_NAMES.COLLAPSE] = collapseObserver;
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

// Initialize on page load only if we're on a view page
if (isViewPage()) {
  initializeSortButton();
}