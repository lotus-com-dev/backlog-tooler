import {
  STORAGE_KEYS,
  MESSAGE_ACTIONS,
  DEFAULT_SETTINGS,
  DOMAIN_PATTERNS,
  URL_PATTERNS,
  RESPONSE_KEYS
} from '@/constants';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get([STORAGE_KEYS.ENABLED], (result) => {
    if (result[STORAGE_KEYS.ENABLED] === undefined) {
      chrome.storage.sync.set({ [STORAGE_KEYS.ENABLED]: DEFAULT_SETTINGS.ENABLED });
    }
  });
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === MESSAGE_ACTIONS.GET_ENABLED) {
    chrome.storage.sync.get([STORAGE_KEYS.ENABLED], (result) => {
      sendResponse({ 
        [RESPONSE_KEYS.ENABLED]: result[STORAGE_KEYS.ENABLED] !== undefined 
          ? result[STORAGE_KEYS.ENABLED] 
          : DEFAULT_SETTINGS.ENABLED 
      });
    });
    return true;
  }
  return false;
});

// Track the previous URL for each tab
const tabUrls = new Map<number, string>();

// Listen for history state updates (SPA navigation)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  // Check if this is a Backlog domain
  const url = new URL(details.url);
  const isBacklogDomain = url.hostname.includes(DOMAIN_PATTERNS.BACKLOG_COM) || url.hostname.includes(DOMAIN_PATTERNS.BACKLOG_JP);
  
  if (!isBacklogDomain) {
    return;
  }
  
  const previousUrl = tabUrls.get(details.tabId);
  const currentPath = url.pathname;
  const isViewPage = currentPath.includes(URL_PATTERNS.VIEW_PATH);
  const wasViewPage = previousUrl ? new URL(previousUrl).pathname.includes(URL_PATTERNS.VIEW_PATH) : false;
  
  // Update stored URL for this tab
  tabUrls.set(details.tabId, details.url);
  
  // Send appropriate message to content script
  if (isViewPage && !wasViewPage) {
    // Navigated TO a view page from non-view page
    chrome.tabs.sendMessage(details.tabId, { 
      action: MESSAGE_ACTIONS.NAVIGATION_TO_VIEW 
    }).catch(() => {
      // Content script might not be ready yet, ignore errors
    });
  } else if (!isViewPage && wasViewPage) {
    // Navigated FROM a view page to non-view page
    chrome.tabs.sendMessage(details.tabId, { 
      action: MESSAGE_ACTIONS.NAVIGATION_FROM_VIEW 
    }).catch(() => {
      // Content script might not be ready yet, ignore errors
    });
  } else if (isViewPage && wasViewPage) {
    // Navigated from one view page to another view page
    // Need to cleanup and reinitialize the button for the new page
    chrome.tabs.sendMessage(details.tabId, { 
      action: MESSAGE_ACTIONS.NAVIGATION_VIEW_TO_VIEW 
    }).catch(() => {
      // Content script might not be ready yet, ignore errors
    });
  }
});

// Also listen for regular navigation
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return; // Only handle main frame
  
  const url = new URL(details.url);
  const isBacklogDomain = url.hostname.includes(DOMAIN_PATTERNS.BACKLOG_COM) || url.hostname.includes(DOMAIN_PATTERNS.BACKLOG_JP);
  
  if (!isBacklogDomain) {
    return;
  }
  
  const isViewPage = url.pathname.includes(URL_PATTERNS.VIEW_PATH);
  
  // Update stored URL for this tab
  tabUrls.set(details.tabId, details.url);
  
  // Send message if this is a view page
  if (isViewPage) {
    chrome.tabs.sendMessage(details.tabId, { 
      action: MESSAGE_ACTIONS.NAVIGATION_TO_VIEW 
    }).catch(() => {
      // Content script might not be ready yet, ignore errors
    });
  }
});

// Clean up stored URLs when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabUrls.delete(tabId);
});