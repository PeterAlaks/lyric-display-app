import { ipcMain } from 'electron';
import updaterPkg from 'electron-updater';
import { createProgressWindow } from '../progressWindow.js';

const { autoUpdater } = updaterPkg;

/**
 * Register app updater IPC handlers
 * Handles checking for updates, downloading, and installing updates
 */
export function registerUpdaterHandlers({ getMainWindow, checkForUpdates }) {
  
  ipcMain.handle('updater:check', async (_event, showNoUpdateDialog = false) => {
    try {
      if (typeof checkForUpdates === 'function') {
        checkForUpdates(showNoUpdateDialog);
        return { success: true };
      }
      return { success: false, error: 'checkForUpdates function not available' };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  });

  ipcMain.handle('updater:download', async () => {
    try {
      const parent = getMainWindow?.();
      const progress = createProgressWindow({ parent });
      if (progress && !progress.isDestroyed()) {
        if (parent && typeof parent.isMinimized === 'function' && parent.isMinimized()) {
          try { 
            progress.minimize(); 
          } catch { }
        } else {
          try { 
            progress.show(); 
          } catch { }
        }
      }
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (e) { 
      return { success: false, error: e?.message || String(e) }; 
    }
  });

  ipcMain.handle('updater:install', async () => {
    try { 
      autoUpdater.quitAndInstall(); 
      return { success: true }; 
    } catch (e) { 
      return { success: false, error: e?.message || String(e) }; 
    }
  });
}
