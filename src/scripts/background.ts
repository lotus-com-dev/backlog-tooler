import {
  STORAGE_KEYS,
  MESSAGE_ACTIONS,
  DEFAULT_SETTINGS,
  DOMAIN_PATTERNS,
  URL_PATTERNS,
  RESPONSE_KEYS,
  TIMING,
  FRAME_IDS
} from '@/shared';
import type { StorageData, FeatureSettings } from '@/shared';

// Initialize default storage data with feature support
function initializeDefaultStorage(): void {
  chrome.storage.sync.get([STORAGE_KEYS.ENABLED, 'features'], (result) => {
    const updates: Partial<StorageData> = {};

    // Initialize global enabled flag if not set
    if (result[STORAGE_KEYS.ENABLED] === undefined) {
      updates.enabled = DEFAULT_SETTINGS.ENABLED;
    }

    // Initialize features settings if not set
    if (result.features === undefined) {
      const defaultFeatures: FeatureSettings = {
        'comment-sorter': {
          enabled: true,
          config: {
            initialSortOrder: 'asc',
            enableTimestampCache: true,
            updateDebounceMs: TIMING.UPDATE_DEBOUNCE
          }
        }
      };
      updates.features = defaultFeatures;
    }

    // Save updates if any
    if (Object.keys(updates).length > 0) {
      chrome.storage.sync.set(updates);
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  initializeDefaultStorage();
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

  // Get all storage data (including features)
  if (request.action === 'GET_STORAGE_DATA') {
    chrome.storage.sync.get(null, (result) => {
      const storageData: StorageData = {
        enabled: result[STORAGE_KEYS.ENABLED] ?? DEFAULT_SETTINGS.ENABLED,
        features: result.features ?? {}
      };
      sendResponse({ data: storageData });
    });
    return true;
  }

  // Update feature settings
  if (request.action === 'UPDATE_FEATURE_SETTINGS') {
    const { featureId, settings } = request;
    if (!featureId || !settings) {
      sendResponse({ success: false, error: 'Invalid parameters' });
      return true;
    }

    chrome.storage.sync.get(['features'], (result) => {
      const currentFeatures = result.features || {};
      const updatedFeatures = {
        ...currentFeatures,
        [featureId]: settings
      };

      chrome.storage.sync.set({ features: updatedFeatures }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
    });
    return true;
  }

  // Get feature settings
  if (request.action === 'GET_FEATURE_SETTINGS') {
    const { featureId } = request;
    chrome.storage.sync.get(['features'], (result) => {
      const features = result.features || {};
      const featureSettings = features[featureId];
      sendResponse({ settings: featureSettings });
    });
    return true;
  }

  return false;
});

// Track the previous URL for each tab
const tabUrls = new Map<number, string>();

// Function to send message with retry logic
async function sendMessageWithRetry(tabId: number, message: object, maxRetries: number = TIMING.MESSAGE_MAX_RETRIES): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
      return; // Success, exit retry loop
    } catch {
      // If this is the last attempt, give up
      if (attempt === maxRetries - 1) {
        return;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, TIMING.MESSAGE_RETRY_BASE_DELAY * Math.pow(TIMING.EXPONENTIAL_BACKOFF_BASE, attempt)));
    }
  }
}

// Listen for history state updates (SPA navigation)
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
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
  
  // Add a small delay to ensure content script is ready after SPA navigation
  setTimeout(async () => {
    // Send appropriate message to content script
    if (isViewPage && !wasViewPage) {
      // Navigated TO a view page from non-view page
      await sendMessageWithRetry(details.tabId, { 
        action: MESSAGE_ACTIONS.NAVIGATION_TO_VIEW 
      });
    } else if (!isViewPage && wasViewPage) {
      // Navigated FROM a view page to non-view page
      await sendMessageWithRetry(details.tabId, { 
        action: MESSAGE_ACTIONS.NAVIGATION_FROM_VIEW 
      });
    } else if (isViewPage && wasViewPage) {
      // Navigated from one view page to another view page
      // Need to cleanup and reinitialize the button for the new page
      await sendMessageWithRetry(details.tabId, { 
        action: MESSAGE_ACTIONS.NAVIGATION_VIEW_TO_VIEW 
      });
    }
  }, TIMING.SPA_NAVIGATION_DELAY); // Small delay to allow DOM to settle
});

// Also listen for regular navigation
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== FRAME_IDS.MAIN_FRAME) return; // Only handle main frame
  
  const url = new URL(details.url);
  const isBacklogDomain = url.hostname.includes(DOMAIN_PATTERNS.BACKLOG_COM) || url.hostname.includes(DOMAIN_PATTERNS.BACKLOG_JP);
  
  if (!isBacklogDomain) {
    return;
  }
  
  const isViewPage = url.pathname.includes(URL_PATTERNS.VIEW_PATH);
  
  // Update stored URL for this tab
  tabUrls.set(details.tabId, details.url);
  
  // Send message if this is a view page (with small delay for content script initialization)
  if (isViewPage) {
    setTimeout(async () => {
      await sendMessageWithRetry(details.tabId, { 
        action: MESSAGE_ACTIONS.NAVIGATION_TO_VIEW 
      });
    }, TIMING.REGULAR_NAVIGATION_DELAY); // Slightly longer delay for full page navigation
  }
});

// Clean up stored URLs when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabUrls.delete(tabId);
});