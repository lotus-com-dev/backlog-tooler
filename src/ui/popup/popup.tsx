import React, { useState, useEffect } from 'react';
import {
  STORAGE_KEYS,
  MESSAGE_ACTIONS,
  URL_PATTERNS,
  STATUS_MESSAGES
} from '@/shared';
import type { StorageData } from '@/shared';

async function getStorageData(): Promise<StorageData> {
  const result = await chrome.storage.sync.get([STORAGE_KEYS.ENABLED]);
  return {
    enabled: result.enabled !== undefined ? result.enabled : true
  };
}

async function setEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.ENABLED]: enabled });
  
  const tabs = await chrome.tabs.query({});
  
  const backlogTabs = tabs.filter(tab => {
    if (!tab.url) return false;
    return tab.url.includes(URL_PATTERNS.BACKLOG_COM) || tab.url.includes(URL_PATTERNS.BACKLOG_JP);
  });
  
  for (const tab of backlogTabs) {
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          action: MESSAGE_ACTIONS.TOGGLE_EXTENSION, 
          enabled 
        });
      } catch {
        // Ignore errors for inactive tabs
      }
    }
  }
}

export const PopupComponent: React.FC = () => {
  const [enabled, setEnabledState] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initializePopup = async () => {
      try {
        const data = await getStorageData();
        setEnabledState(data.enabled);
      } catch {
        // Use default value on error
      } finally {
        setLoading(false);
      }
    };

    initializePopup();
  }, []);

  const handleToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newEnabled = event.target.checked;
    setEnabledState(newEnabled);
    
    try {
      await setEnabled(newEnabled);
    } catch {
      setEnabledState(!newEnabled);
    }
  };

  if (loading) {
    return <div className="popup-container">読み込み中...</div>;
  }

  return (
    <div className="popup-container">
      <div className="header">
        <h2>Backlog Tools</h2>
      </div>
      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            className="toggle-input"
          />
          <span className="toggle-slider"></span>
        </label>
        <p className={`status-text ${enabled ? 'status-enabled' : 'status-disabled'}`}>
          {enabled ? STATUS_MESSAGES.ENABLED : STATUS_MESSAGES.DISABLED}
        </p>
      </div>
    </div>
  );
};