// Content script constants
const CS_MESSAGE_ACTIONS = {
  GET_ENABLED: 'getEnabled',
  TOGGLE_EXTENSION: 'toggleExtension'
} as const;

const DOM_SELECTORS = {
  FILTER_NAV: 'dl.filter-nav',
  COMMENT_LIST: 'ul.comment-list__items',
  COMMENT_ITEM: 'li.comment-item',
  EXPAND_BUTTON: 'button[aria-label="過去のコメントを展開"]',
  TIME_ELEMENT: '.user-icon-set__sub-line a',
  BUTTON_TEXT: '.filter-nav__text'
} as const;

const DOM_IDS = {
  SORT_TOGGLE_BUTTON: 'sort-toggle-button'
} as const;

const DOM_CLASSES = {
  FILTER_NAV_ITEM: 'filter-nav__item',
  FILTER_NAV_LINK: 'filter-nav__link',
  FILTER_NAV_TEXT: 'filter-nav__text'
} as const;

const BUTTON_LABELS = {
  ASC: '古い順で表示',
  DESC: '新しい順で表示'
} as const;

const SORT_ORDERS = {
  ASC: 'asc',
  DESC: 'desc'
} as const;

interface CommentItem extends HTMLLIElement {
  querySelector(selector: typeof DOM_SELECTORS.TIME_ELEMENT): HTMLAnchorElement | null;
}

type SortOrder = typeof SORT_ORDERS[keyof typeof SORT_ORDERS];

let sortButtonElement: HTMLElement | null = null;

async function isExtensionEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: CS_MESSAGE_ACTIONS.GET_ENABLED }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(true);
      } else {
        resolve(response?.enabled ?? true);
      }
    });
  });
}

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
  newDd.innerHTML = `
    <button type="button" class="${DOM_CLASSES.FILTER_NAV_LINK}" id="${DOM_IDS.SORT_TOGGLE_BUTTON}" aria-pressed="false">
      <span class="${DOM_CLASSES.FILTER_NAV_TEXT}">${BUTTON_LABELS.ASC}</span>
    </button>
  `;
  filterNav.appendChild(newDd);
  sortButtonElement = newDd;
  
  const sortToggleButton = document.getElementById(DOM_IDS.SORT_TOGGLE_BUTTON) as HTMLButtonElement;
  
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
  
  console.log(`現在のコメントの並び順を「${currentSortOrder}」と判断しました。`);
  
  sortToggleButton.addEventListener('click', () => {
    const commentItems = Array.from(commentList.querySelectorAll<CommentItem>(DOM_SELECTORS.COMMENT_ITEM));
    currentSortOrder = currentSortOrder === SORT_ORDERS.DESC ? SORT_ORDERS.ASC : SORT_ORDERS.DESC;
    
    commentItems.sort((a, b) => {
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);
      return currentSortOrder === SORT_ORDERS.ASC ? timeA - timeB : timeB - timeA;
    });
    
    commentItems.forEach(item => commentList.appendChild(item));
    
    const buttonText = sortToggleButton.querySelector<HTMLSpanElement>(DOM_SELECTORS.BUTTON_TEXT);
    if (buttonText) {
      if (currentSortOrder === SORT_ORDERS.ASC) {
        buttonText.textContent = BUTTON_LABELS.ASC;
        sortToggleButton.setAttribute('aria-pressed', 'true');
      } else {
        buttonText.textContent = BUTTON_LABELS.DESC;
        sortToggleButton.setAttribute('aria-pressed', 'false');
      }
    }
  });
}

// Listen for toggle messages
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.action === CS_MESSAGE_ACTIONS.TOGGLE_EXTENSION) {
    if (request.enabled) {
      console.log('Enabling extension - adding sort button');
      initializeSortButton();
    } else {
      console.log('Disabling extension - removing sort button');
      if (sortButtonElement) {
        sortButtonElement.remove();
        sortButtonElement = null;
      }
    }
    sendResponse({ success: true });
    return true; // Keep the message channel open for async response
  }
  return false;
});

// Initialize on page load
initializeSortButton();