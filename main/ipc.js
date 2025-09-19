import { ipcMain, dialog, nativeTheme } from 'electron';
import { addRecent } from './recents.js';
import { writeFile } from 'fs/promises';
import { getLocalIPAddress } from './utils.js';
import updaterPkg from 'electron-updater';
import { createProgressWindow } from './progressWindow.js';
import { getAdminKey } from './adminKey.js';
const { autoUpdater } = updaterPkg;

let cachedJoinCode = null;

export function registerIpcHandlers({ getMainWindow, openInAppBrowser, updateDarkModeMenu }) {
  // Dark mode query and update hooks
  ipcMain.handle('get-dark-mode', () => {
    return false;
  });

  ipcMain.handle('set-dark-mode', (_event, _isDark) => {
    try { updateDarkModeMenu(); } catch { }
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
      const result = await dialog.showOpenDialog(win || undefined, { properties: ['openFile'], filters: [{ name: 'Text Files', extensions: ['txt', 'lrc'] }] });
      if (!result.canceled && result.filePaths.length > 0) {
        const fs = await import('fs/promises');
        const filePath = result.filePaths[0];
        const content = await fs.readFile(filePath, 'utf8');
        const fileName = filePath.split(/[\\/]/).pop();
        try { await addRecent(filePath); } catch { }
        return { success: true, content, fileName, filePath };
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

  // Recent files management
  ipcMain.handle('add-recent-file', async (_event, filePath) => {
    try { await addRecent(filePath); return { success: true }; }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });

  ipcMain.handle('get-admin-key', async () => {
    try {
      const adminKey = getAdminKey();
      if (!adminKey) {
        console.warn('Admin key not available for renderer process');
      }
      return adminKey;
    } catch (error) {
      console.error('Error getting admin key for renderer:', error);
      return null;
    }
  });


  ipcMain.handle('get-desktop-jwt', async (_event, { deviceId, sessionId }) => {
    try {
      const adminKey = getAdminKey();
      const resp = await fetch('http://127.0.0.1:4000/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientType: 'desktop',
          deviceId,
          sessionId,
          adminKey
        })
      });
      if (!resp.ok) throw new Error('Failed to mint desktop JWT');
      const { token } = await resp.json();
      return token;
    } catch (err) {
      console.error('Error minting desktop JWT:', err);
      return null;
    }
  });


  ipcMain.handle('get-join-code', async () => {
    try {
      const response = await fetch('http://127.0.0.1:4000/api/auth/join-code');
      if (!response.ok) {
        throw new Error(`Join code request failed: ${response.status}`);
      }
      const payload = await response.json();
      const code = payload?.joinCode || null;
      if (code) {
        cachedJoinCode = code;
      }
      return code ?? cachedJoinCode ?? null;
    } catch (error) {
      console.error('Error retrieving join code:', error);
      return cachedJoinCode || null;
    }
  });


  // Updater controls
  ipcMain.handle('updater:download', async () => {
    try {
      const parent = getMainWindow?.();
      const progress = createProgressWindow({ parent });
      if (progress && !progress.isDestroyed()) {
        if (parent && typeof parent.isMinimized === 'function' && parent.isMinimized()) {
          try { progress.minimize(); } catch {}
        } else {
          try { progress.show(); } catch {}
        }
      }
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (e) { return { success: false, error: e?.message || String(e) }; }
  });
  ipcMain.handle('updater:install', async () => {
    try { autoUpdater.quitAndInstall(); return { success: true }; }
    catch (e) { return { success: false, error: e?.message || String(e) }; }
  });
}
