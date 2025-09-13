import { ipcMain, dialog, nativeTheme } from 'electron';
import { writeFile } from 'fs/promises';
import { getLocalIPAddress } from './utils.js';

export function registerIpcHandlers({ getMainWindow, openInAppBrowser, updateDarkModeMenu }) {
  // Dark mode query and update hooks
  ipcMain.handle('get-dark-mode', () => {
    return false;
  });

  ipcMain.handle('set-dark-mode', (_event, _isDark) => {
    try { updateDarkModeMenu(); } catch {}
    return true;
  });

  // File operations
  ipcMain.handle('show-save-dialog', async (_event, options) => {
    const win = getMainWindow?.();
    const result = await dialog.showSaveDialog(win || undefined, options);
    return result;
  });

  ipcMain.handle('write-file', async (_event, filePath, content) => {
    await writeFile(filePath, content, 'utf8');
    return { success: true };
  });

  ipcMain.handle('load-lyrics-file', async () => {
    try {
      const win = getMainWindow?.();
      const result = await dialog.showOpenDialog(win || undefined, { properties: ['openFile'], filters: [{ name: 'Text Files', extensions: ['txt'] }] });
      if (!result.canceled && result.filePaths.length > 0) {
        const fs = await import('fs/promises');
        const content = await fs.readFile(result.filePaths[0], 'utf8');
        const fileName = result.filePaths[0].split(/[\\/]/).pop();
        return { success: true, content, fileName };
      }
      return { success: false, canceled: true };
    } catch (error) {
      console.error('Error loading lyrics file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('new-lyrics-file', () => {
    const win = getMainWindow?.();
    if (win && !win.isDestroyed()) {
      win.webContents.send('navigate-to-new-song');
    }
  });

  ipcMain.handle('sync-native-dark-mode', (_event, isDark) => {
    try { nativeTheme.themeSource = isDark ? 'dark' : 'light'; return { success: true }; }
    catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('get-local-ip', () => getLocalIPAddress());

  ipcMain.handle('open-in-app-browser', (_event, url) => {
    openInAppBrowser?.(url || 'https://www.google.com');
  });
}

