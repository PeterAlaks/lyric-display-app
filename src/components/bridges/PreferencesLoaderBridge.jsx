import { useEffect } from 'react';
import useLyricsStore, { loadPreferencesIntoStore } from '../../context/LyricsStore';
import { loadAdvancedSettings } from '../../utils/connectionManager';
import { loadDebugLoggingPreference } from '../../utils/logger';

// Bridge to load user preferences into the store on startup
export default function PreferencesLoaderBridge() {
  useEffect(() => {
    if (!window.electronAPI) return;

    // Load preferences into the store and connection manager
    loadPreferencesIntoStore(useLyricsStore);
    loadAdvancedSettings();
    loadDebugLoggingPreference();
  }, []);

  return null;
}
