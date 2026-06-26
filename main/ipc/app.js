import { BrowserWindow, ipcMain, nativeTheme, app } from 'electron';
import { saveDarkModePreference } from '../themePreferences.js';
import { getLogPaths } from '../logging.js';
import {
  getObsDockSetupInfo,
  getObsDockStartupStatus,
  relaunchInObsDockHeadlessMode,
  setObsDockStartupEnabled,
} from '../obsDockStartup.js';

/**
 * Register app-level IPC handlers
 * Handles app version, dark mode, and general app settings
 */
export function registerAppHandlers({ updateDarkModeMenu }) {

  ipcMain.handle('get-dark-mode', () => {
    return false;
  });

  ipcMain.handle('set-dark-mode', (event, isDark) => {
    try {
      updateDarkModeMenu();
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win || win.isDestroyed()) continue;
        if (event?.sender && win.webContents === event.sender) continue;
        try {
          win.webContents.send('theme-updated', { darkMode: Boolean(isDark) });
        } catch { }
      }
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

  ipcMain.handle('sync-native-theme-source', (_event, themeSource) => {
    try {
      nativeTheme.themeSource = themeSource;
      const shouldUseDark = nativeTheme.shouldUseDarkColors;
      return { success: true, shouldUseDarkColors: shouldUseDark };
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

  ipcMain.handle('app:get-log-paths', () => {
    try {
      return { success: true, ...getLogPaths() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app:obs-dock-startup:get', () => getObsDockStartupStatus());

  ipcMain.handle('app:obs-dock-startup:set', (_event, { enabled } = {}) => (
    setObsDockStartupEnabled(Boolean(enabled))
  ));

  ipcMain.handle('app:obs-dock:get-info', () => getObsDockSetupInfo());

  ipcMain.handle('app:obs-dock:start-headless-now', () => relaunchInObsDockHeadlessMode());

  ipcMain.handle('app:relaunch', () => {
    try {
      app.relaunch();
      app.exit(0);
      return { success: true };
    } catch (error) {
      console.error('[App IPC] Failed to relaunch app:', error);
      return { success: false, error: error.message };
    }
  });
}
