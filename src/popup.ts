// Popup script constants
const POPUP_STORAGE_KEYS = {
  ENABLED: 'enabled'
} as const;

const POPUP_MESSAGE_ACTIONS = {
  TOGGLE_EXTENSION: 'toggleExtension'
} as const;

const POPUP_DOM_IDS = {
  ENABLE_TOGGLE: 'enable-toggle',
  STATUS_TEXT: 'status-text'
} as const;

const POPUP_CSS_CLASSES = {
  STATUS_TEXT: 'status-text',
  STATUS_ENABLED: 'status-enabled',
  STATUS_DISABLED: 'status-disabled'
} as const;

const STATUS_MESSAGES = {
  ENABLED: '拡張機能は有効です',
  DISABLED: '拡張機能は無効です'
} as const;

const URL_PATTERNS = {
  BACKLOG_COM: '.backlog.com/view/',
  BACKLOG_JP: '.backlog.jp/view/'
} as const;

interface StorageData {
  enabled: boolean;
}

async function getStorageData(): Promise<StorageData> {
  const result = await chrome.storage.sync.get([POPUP_STORAGE_KEYS.ENABLED]);
  return {
    enabled: result.enabled !== undefined ? result.enabled : true
  };
}

async function setEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({ [POPUP_STORAGE_KEYS.ENABLED]: enabled });
  
  // Get all tabs and filter manually since chrome.tabs.query doesn't always work with complex patterns
  const tabs = await chrome.tabs.query({});
  
  const backlogTabs = tabs.filter(tab => {
    if (!tab.url) return false;
    return tab.url.includes(URL_PATTERNS.BACKLOG_COM) || tab.url.includes(URL_PATTERNS.BACKLOG_JP);
  });
  
  // Send message to all matching tabs
  for (const tab of backlogTabs) {
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          action: POPUP_MESSAGE_ACTIONS.TOGGLE_EXTENSION, 
          enabled 
        });
        console.log(`Sent toggle message to tab ${tab.id}: ${enabled}`);
      } catch (error) {
        console.log(`Could not send message to tab ${tab.id}:`, error);
      }
    }
  }
}

function updateUI(enabled: boolean): void {
  const toggle = document.getElementById(POPUP_DOM_IDS.ENABLE_TOGGLE) as HTMLInputElement;
  const statusText = document.getElementById(POPUP_DOM_IDS.STATUS_TEXT) as HTMLParagraphElement;
  
  if (toggle) {
    toggle.checked = enabled;
  }
  
  if (statusText) {
    statusText.textContent = enabled ? STATUS_MESSAGES.ENABLED : STATUS_MESSAGES.DISABLED;
    statusText.className = enabled 
      ? `${POPUP_CSS_CLASSES.STATUS_TEXT} ${POPUP_CSS_CLASSES.STATUS_ENABLED}` 
      : `${POPUP_CSS_CLASSES.STATUS_TEXT} ${POPUP_CSS_CLASSES.STATUS_DISABLED}`;
  }
}

async function init(): Promise<void> {
  const data = await getStorageData();
  updateUI(data.enabled);
  
  const toggle = document.getElementById(POPUP_DOM_IDS.ENABLE_TOGGLE) as HTMLInputElement;
  if (toggle) {
    toggle.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      const enabled = target.checked;
      await setEnabled(enabled);
      updateUI(enabled);
    });
  }
}

document.addEventListener('DOMContentLoaded', init);