import { ipcMain, nativeTheme, app } from 'electron';
import { saveDarkModePreference } from '../themePreferences.js';

/**
 * Register app-level IPC handlers
 * Handles app version, dark mode, and general app settings
 */
export function registerAppHandlers({ updateDarkModeMenu }) {
  
  ipcMain.handle('get-dark-mode', () => {
    return false;
  });

  ipcMain.handle('set-dark-mode', (_event, _isDark) => {
    try { 
      updateDarkModeMenu(); 
    } catch { }
    return true;
  });

  ipcMain.handle('sync-native-dark-mode', (_event, isDark) => {
    try {
      nativeTheme.themeSource = isDark ? 'dark' : 'light';
      saveDarkModePreference(isDark);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app:get-version', () => {
    try {
      return { success: true, version: app.getVersion() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}
