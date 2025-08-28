import {
  STORAGE_KEYS,
  MESSAGE_ACTIONS,
  DEFAULT_SETTINGS
} from '../constants';

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
        enabled: result[STORAGE_KEYS.ENABLED] !== undefined 
          ? result[STORAGE_KEYS.ENABLED] 
          : DEFAULT_SETTINGS.ENABLED 
      });
    });
    return true;
  }
  return false;
});