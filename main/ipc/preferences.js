import { ipcMain, dialog } from 'electron';
import * as userPreferences from '../userPreferences.js';

/**
 * Register user preferences IPC handlers
 * Handles getting, setting, and resetting user preferences
 */
export function registerPreferencesHandlers({ getMainWindow }) {
  
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
      userPreferences.setPreference(path, value);
      return { success: true };
    } catch (error) {
      console.error('[UserPreferences] Error setting preference:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:save-all', async (_event, { preferences }) => {
    try {
      const result = userPreferences.saveAllPreferences(preferences);
      return result;
    } catch (error) {
      console.error('[UserPreferences] Error saving preferences:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:reset-category', async (_event, { category }) => {
    try {
      userPreferences.resetCategoryToDefaults(category);
      return { success: true };
    } catch (error) {
      console.error('[UserPreferences] Error resetting category:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:reset-all', async () => {
    try {
      const result = userPreferences.resetAllToDefaults();
      return result;
    } catch (error) {
      console.error('[UserPreferences] Error resetting all preferences:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:browse-default-path', async () => {
    try {
      const win = getMainWindow?.();
      const result = await dialog.showOpenDialog(win || undefined, {
        title: 'Select Default Lyrics Folder',
        properties: ['openDirectory', 'createDirectory']
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const selectedPath = result.filePaths[0];
      userPreferences.setPreference('general.defaultLyricsPath', selectedPath);
      return { success: true, path: selectedPath };
    } catch (error) {
      console.error('[UserPreferences] Error browsing for default path:', error);
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
