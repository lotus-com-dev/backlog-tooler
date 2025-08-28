import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';
import {
  STORAGE_KEYS,
  MESSAGE_ACTIONS,
  STATUS_MESSAGES,
  URL_PATTERNS
} from '../constants';
import type { StorageData } from '../constants';

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
        console.log(`Sent toggle message to tab ${tab.id}: ${enabled}`);
      } catch (error) {
        console.log(`Could not send message to tab ${tab.id}:`, error);
      }
    }
  }
}

const PopupComponent: React.FC = () => {
  const [enabled, setEnabledState] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initializePopup = async () => {
      try {
        const data = await getStorageData();
        setEnabledState(data.enabled);
      } catch (error) {
        console.error('Failed to load settings:', error);
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
    } catch (error) {
      console.error('Failed to save settings:', error);
      setEnabledState(!newEnabled);
    }
  };

  if (loading) {
    return <div className="popup-container">読み込み中...</div>;
  }

  return (
    <div className="popup-container">
      <div className="header">
        <h2>Backlog Comment Sorter</h2>
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

const root = ReactDOM.createRoot(document.getElementById('popup-root') as HTMLElement);
root.render(<PopupComponent />);