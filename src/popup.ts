interface StorageData {
  enabled: boolean;
}

async function getStorageData(): Promise<StorageData> {
  const result = await chrome.storage.sync.get(['enabled']);
  return {
    enabled: result.enabled !== undefined ? result.enabled : true
  };
}

async function setEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({ enabled });
  
  // Get all tabs and filter manually since chrome.tabs.query doesn't always work with complex patterns
  const tabs = await chrome.tabs.query({});
  
  const backlogTabs = tabs.filter(tab => {
    if (!tab.url) return false;
    return tab.url.includes('.backlog.com/view/') || tab.url.includes('.backlog.jp/view/');
  });
  
  // Send message to all matching tabs
  for (const tab of backlogTabs) {
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'toggleExtension', 
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
  const toggle = document.getElementById('enable-toggle') as HTMLInputElement;
  const statusText = document.getElementById('status-text') as HTMLParagraphElement;
  
  if (toggle) {
    toggle.checked = enabled;
  }
  
  if (statusText) {
    statusText.textContent = enabled ? '拡張機能は有効です' : '拡張機能は無効です';
    statusText.className = enabled ? 'status-text status-enabled' : 'status-text status-disabled';
  }
}

async function init(): Promise<void> {
  const data = await getStorageData();
  updateUI(data.enabled);
  
  const toggle = document.getElementById('enable-toggle') as HTMLInputElement;
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