chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['enabled'], (result) => {
    if (result.enabled === undefined) {
      chrome.storage.sync.set({ enabled: true });
    }
  });
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'getEnabled') {
    chrome.storage.sync.get(['enabled'], (result) => {
      sendResponse({ enabled: result.enabled !== undefined ? result.enabled : true });
    });
    return true;
  }
  return false;
});