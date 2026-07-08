import { ipcMain } from 'electron';
import {
  downloadAvailableUpdate,
  getUpdaterState,
  hideUpdaterProgressWindow,
  installDownloadedUpdate
} from '../updater.js';

/**
 * Register app updater IPC handlers.
 */
export function registerUpdaterHandlers({ getMainWindow, checkForUpdates }) {
  ipcMain.handle('updater:check', async (_event, showNoUpdateDialog = false) => {
    try {
      if (typeof checkForUpdates === 'function') {
        await checkForUpdates(showNoUpdateDialog);
        return { success: true, state: getUpdaterState() };
      }
      return { success: false, error: 'checkForUpdates function not available', state: getUpdaterState() };
    } catch (e) {
      return { success: false, error: e?.message || String(e), state: getUpdaterState() };
    }
  });

  ipcMain.handle('updater:get-state', async () => ({
    success: true,
    state: getUpdaterState()
  }));

  ipcMain.handle('updater:download', async () => {
    try {
      return await downloadAvailableUpdate({ parent: getMainWindow?.() });
    } catch (e) {
      return { success: false, error: e?.message || String(e), state: getUpdaterState() };
    }
  });

  ipcMain.handle('updater:install', async () => {
    try {
      return installDownloadedUpdate();
    } catch (e) {
      return { success: false, error: e?.message || String(e), state: getUpdaterState() };
    }
  });

  ipcMain.handle('updater:hide-progress', async () => hideUpdaterProgressWindow());
}
