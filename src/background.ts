// Background script constants
const BG_STORAGE_KEYS = {
  ENABLED: 'enabled'
} as const;

const BG_MESSAGE_ACTIONS = {
  GET_ENABLED: 'getEnabled'
} as const;

const DEFAULT_SETTINGS = {
  ENABLED: true
} as const;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get([BG_STORAGE_KEYS.ENABLED], (result) => {
    if (result[BG_STORAGE_KEYS.ENABLED] === undefined) {
      chrome.storage.sync.set({ [BG_STORAGE_KEYS.ENABLED]: DEFAULT_SETTINGS.ENABLED });
    }
  });
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === BG_MESSAGE_ACTIONS.GET_ENABLED) {
    chrome.storage.sync.get([BG_STORAGE_KEYS.ENABLED], (result) => {
      sendResponse({ 
        enabled: result[BG_STORAGE_KEYS.ENABLED] !== undefined 
          ? result[BG_STORAGE_KEYS.ENABLED] 
          : DEFAULT_SETTINGS.ENABLED 
      });
    });
    return true;
  }
  return false;
});