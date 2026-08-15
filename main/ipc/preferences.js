import { app, BrowserWindow, ipcMain } from 'electron';
import * as userPreferences from '../userPreferences.js';
import { recordSuccessfulAppLaunch } from '../telemetry.js';
import { setUpdateSessionActive } from '../updater.js';

/**
 * Register user preferences IPC handlers
 * Handles getting, setting, and resetting user preferences
 */
export function registerPreferencesHandlers({ syncBackendParsingConfig }) {
  const broadcastPreferencesUpdated = (category) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win || win.isDestroyed()) continue;
      try { win.webContents.send('preferences:updated', { category }); } catch { }
    }
  };

  const syncParsingConfig = () => {
    if (typeof syncBackendParsingConfig !== 'function') return;
    syncBackendParsingConfig(userPreferences.getParsingConfig());
  };
  
  ipcMain.handle('preferences:get-all', async () => {
    try {
      const preferences = userPreferences.getAllPreferences();
      return { success: true, preferences };
    } catch (error) {
      console.error('[UserPreferences] Error getting all preferences:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:get-category', async (_event, { category }) => {
    try {
      const data = userPreferences.getPreferenceCategory(category);
      return { success: true, data };
    } catch (error) {
      console.error('[UserPreferences] Error getting category:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:get', async (_event, { path }) => {
    try {
      const value = userPreferences.getPreference(path);
      return { success: true, value };
    } catch (error) {
      console.error('[UserPreferences] Error getting preference:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:set', async (_event, { path, value }) => {
    try {
      const usageSharingWasEnabled = path === 'advanced.shareAnonymousUsageData'
        ? userPreferences.getPreference(path) === true
        : false;
      const result = userPreferences.setPreference(path, value);
      if (!result.success) return result;
      if (path === 'general.liveSafetyMode') {
        setUpdateSessionActive(Boolean(value));
      }
      if (typeof path === 'string' && (path.startsWith('parsing.') || path.startsWith('lineSplitting.'))) {
        syncParsingConfig();
      }
      if (typeof path === 'string') {
        broadcastPreferencesUpdated(path.split('.')[0] || null);
      }
      if (app.isPackaged && path === 'advanced.shareAnonymousUsageData' && value === true && !usageSharingWasEnabled) {
        void recordSuccessfulAppLaunch({ enabled: true });
      }
      return result;
    } catch (error) {
      console.error('[UserPreferences] Error setting preference:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:save-all', async (_event, { preferences }) => {
    try {
      const usageSharingWasEnabled = userPreferences.getPreference('advanced.shareAnonymousUsageData') === true;
      const result = userPreferences.saveAllPreferences(preferences);
      if (result.success && typeof preferences?.general?.liveSafetyMode === 'boolean') {
        setUpdateSessionActive(preferences.general.liveSafetyMode);
      }
      if (result.success) {
        syncParsingConfig();
        broadcastPreferencesUpdated(null);
      }
      if (app.isPackaged && result.success && preferences?.advanced?.shareAnonymousUsageData === true && !usageSharingWasEnabled) {
        void recordSuccessfulAppLaunch({ enabled: true });
      }
      return result;
    } catch (error) {
      console.error('[UserPreferences] Error saving preferences:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:reset-category', async (_event, { category }) => {
    try {
      const result = userPreferences.resetCategoryToDefaults(category);
      if (!result.success) return result;
      if (category === 'advanced') {
        const decisionResult = userPreferences.setPreference('advanced.telemetryConsentDecided', true);
        if (!decisionResult.success) return decisionResult;
      }
      if (category === 'general') {
        setUpdateSessionActive(false);
      }
      if (category === 'parsing' || category === 'lineSplitting') {
        syncParsingConfig();
      }
      broadcastPreferencesUpdated(category);
      return result;
    } catch (error) {
      console.error('[UserPreferences] Error resetting category:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:reset-all', async () => {
    try {
      const result = userPreferences.resetAllToDefaults();
      if (result.success) {
        const decisionResult = userPreferences.setPreference('advanced.telemetryConsentDecided', true);
        if (!decisionResult.success) return decisionResult;
        setUpdateSessionActive(false);
        syncParsingConfig();
        broadcastPreferencesUpdated(null);
      }
      return result;
    } catch (error) {
      console.error('[UserPreferences] Error resetting all preferences:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:get-parsing-config', async () => {
    try {
      const config = userPreferences.getParsingConfig();
      return { success: true, config };
    } catch (error) {
      console.error('[UserPreferences] Error getting parsing config:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:get-autoplay-defaults', async () => {
    try {
      const defaults = userPreferences.getAutoplayDefaults();
      return { success: true, defaults };
    } catch (error) {
      console.error('[UserPreferences] Error getting autoplay defaults:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:get-advanced-settings', async () => {
    try {
      const settings = userPreferences.getAdvancedSettings();
      return { success: true, settings };
    } catch (error) {
      console.error('[UserPreferences] Error getting advanced settings:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:get-file-handling', async () => {
    try {
      const settings = userPreferences.getFileHandlingSettings();
      return { success: true, settings };
    } catch (error) {
      console.error('[UserPreferences] Error getting file handling settings:', error);
      return { success: false, error: error.message };
    }
  });
}
