import { ipcMain, BrowserWindow } from 'electron';
import { addRecent, getRecents, clearRecents, subscribe as subscribeRecents } from '../recents.js';
import { handleFileOpen } from '../fileHandler.js';

/**
 * Register recent files IPC handlers
 * Handles recent file list, clearing, and opening recent files
 */
export function registerRecentsHandlers({ getMainWindow }) {
  
  // Subscribe to recents changes and broadcast to all windows
  try {
    subscribeRecents((recentsList) => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win || win.isDestroyed()) continue;
        try {
          win.webContents.send('recents:update', recentsList || []);
        } catch { }
      }
    });
  } catch { }

  ipcMain.handle('add-recent-file', async (_event, filePath) => {
    try { 
      await addRecent(filePath); 
      return { success: true }; 
    } catch (e) { 
      return { success: false, error: e?.message || String(e) }; 
    }
  });

  ipcMain.handle('recents:list', async () => {
    try {
      const recents = await getRecents();
      return { success: true, recents };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('recents:clear', async () => {
    try {
      await clearRecents();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('recents:open', async (_event, filePath) => {
    try {
      const win = getMainWindow?.();
      if (!win || win.isDestroyed()) {
        return { success: false, error: 'No window available' };
      }
      await handleFileOpen(filePath, win);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}
