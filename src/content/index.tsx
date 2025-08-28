import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  MESSAGE_ACTIONS,
  DOM_SELECTORS,
  DOM_IDS,
  DOM_CLASSES,
  BUTTON_LABELS,
  SORT_ORDERS
} from '../constants';
import type { SortOrder } from '../constants';

interface CommentItem extends HTMLLIElement {
  querySelector(selector: typeof DOM_SELECTORS.TIME_ELEMENT): HTMLAnchorElement | null;
}

let sortButtonElement: HTMLElement | null = null;

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

const SortButton: React.FC<{
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

async function initializeSortButton(): Promise<void> {
  const enabled = await isExtensionEnabled();
  if (!enabled) {
    if (sortButtonElement) {
      sortButtonElement.remove();
      sortButtonElement = null;
    }
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
    
    commentItems.sort((a, b) => {
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);
      return currentSortOrder === SORT_ORDERS.ASC ? timeA - timeB : timeB - timeA;
    });
    
    commentItems.forEach(item => commentList.appendChild(item));
    
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
      if (sortButtonElement) {
        sortButtonElement.remove();
        sortButtonElement = null;
      }
    }
    sendResponse({ success: true });
    return true;
  }
  return false;
});

// Initialize on page load
initializeSortButton();