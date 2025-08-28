import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  MESSAGE_ACTIONS,
  DOM_SELECTORS,
  DOM_IDS,
  DOM_CLASSES,
  BUTTON_LABELS,
  SORT_ORDERS
} from '@/constants';
import type { SortOrder } from '@/constants';

interface CommentItem extends HTMLLIElement {
  querySelector(selector: typeof DOM_SELECTORS.TIME_ELEMENT): HTMLAnchorElement | null;
}

let sortButtonElement: HTMLElement | null = null;
let currentUrl = window.location.href;
let navigationObserver: MutationObserver | null = null;

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

export const SortButton: React.FC<{
  onToggle: () => void;
  isAscending: boolean;
}> = ({ onToggle, isAscending }) => {
  return (
    <button
      type="button"
      className={DOM_CLASSES.FILTER_NAV_LINK}
      id={DOM_IDS.SORT_TOGGLE_BUTTON}
      aria-pressed={isAscending ? 'true' : 'false'}
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
    sortButtonElement.remove();
    sortButtonElement = null;
  }
}

function detectURLChange(): void {
  const newUrl = window.location.href;
  if (currentUrl !== newUrl) {
    currentUrl = newUrl;
    cleanupSortButton();
    initializeSortButton();
  }
}

function startNavigationDetection(): void {
  // Listen for popstate events (browser back/forward)
  window.addEventListener('popstate', detectURLChange);
  
  // Periodically check for URL changes (for programmatic navigation)
  setInterval(detectURLChange, 1000);
  
  // Use MutationObserver to detect DOM changes that indicate new page content
  navigationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const hasCommentList = document.querySelector(DOM_SELECTORS.COMMENT_LIST);
        const hasFilterNav = document.querySelector(DOM_SELECTORS.FILTER_NAV);
        const hasExistingButton = document.getElementById(DOM_IDS.SORT_TOGGLE_BUTTON);
        
        // If we have the required elements but no button, reinitialize
        if (hasCommentList && hasFilterNav && !hasExistingButton) {
          detectURLChange();
          break;
        }
      }
    }
  });
  
  // Observe changes to the document body
  navigationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
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
  }, 500);
}

function addSortToggleButtonAndExpand(filterNav: HTMLDListElement): void {
  if (document.getElementById(DOM_IDS.SORT_TOGGLE_BUTTON)) {
    return;
  }
  
  const commentList = document.querySelector<HTMLUListElement>(DOM_SELECTORS.COMMENT_LIST);
  if (!commentList) return;
  
  const expandButton = document.querySelector<HTMLButtonElement>(DOM_SELECTORS.EXPAND_BUTTON);
  if (expandButton) {
    expandButton.click();
  }
  
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
  
  
  const handleToggle = () => {
    const commentItems = Array.from(commentList.querySelectorAll<CommentItem>(DOM_SELECTORS.COMMENT_ITEM));
    currentSortOrder = currentSortOrder === SORT_ORDERS.DESC ? SORT_ORDERS.ASC : SORT_ORDERS.DESC;
    
    // Remove is_first class from all comments before sorting
    commentItems.forEach(item => {
      item.classList.remove('is_first');
    });
    
    commentItems.sort((a, b) => {
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);
      return currentSortOrder === SORT_ORDERS.ASC ? timeA - timeB : timeB - timeA;
    });
    
    // Re-append sorted items to the comment list
    commentItems.forEach(item => commentList.appendChild(item));
    
    // Add is_first class to the first actual comment (not the info item)
    if (commentItems.length > 0) {
      commentItems[0].classList.add('is_first');
    }
    
    // Re-render the React component
    root.render(
      <SortButton 
        onToggle={handleToggle} 
        isAscending={currentSortOrder === SORT_ORDERS.ASC} 
      />
    );
  };
  
  // Create React root and render the button
  const root = createRoot(newDd);
  root.render(
    <SortButton 
      onToggle={handleToggle} 
      isAscending={currentSortOrder === SORT_ORDERS.ASC} 
    />
  );
}

// Listen for toggle messages
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
  return false;
});

// Initialize on page load and start navigation detection
initializeSortButton();
startNavigationDetection();