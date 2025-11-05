import { ipcMain, dialog, nativeTheme, BrowserWindow } from 'electron';
import { addRecent } from './recents.js';
import { readFile, writeFile } from 'fs/promises';
import { getLocalIPAddress } from './utils.js';
import * as secureTokenStore from './secureTokenStore.js';
import updaterPkg from 'electron-updater';
import { createProgressWindow } from './progressWindow.js';
import { getAdminKey, onAdminKeyAvailable } from './adminKey.js';
import { parseTxtContent, parseLrcContent } from '../shared/lyricsParsing.js';
import { fetchLyricsByProvider, getProviderDefinitions, getProviderKeyState, removeProviderKey, saveProviderKey, searchAllProviders } from './lyricsProviders/index.js';
import * as easyWorship from './easyWorship.js';
import * as displayManager from './displayManager.js';

const { autoUpdater } = updaterPkg;

let cachedJoinCode = null;

export function registerIpcHandlers({ getMainWindow, openInAppBrowser, updateDarkModeMenu }) {
  const broadcastAdminKeyAvailable = (adminKey) => {
    const payload = { hasKey: Boolean(adminKey) };
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win || win.isDestroyed()) continue;
      try {
        win.webContents.send('admin-key:available', payload);
      } catch (error) {
        console.warn('Failed to notify renderer about admin key availability:', error);
      }
    }
  };

  onAdminKeyAvailable(broadcastAdminKeyAvailable);

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
        const filePath = result.filePaths[0];
        const content = await readFile(filePath, 'utf8');
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

  ipcMain.handle('parse-lyrics-file', async (_event, payload = {}) => {
    try {
      const { fileType = 'txt', path: filePath, rawText } = payload || {};
      let content = typeof rawText === 'string' ? rawText : null;

      if (!content && filePath) {
        content = await readFile(filePath, 'utf8');
      }

      if (typeof content !== 'string') {
        return { success: false, error: 'No lyric content available for parsing' };
      }

      const parser = fileType === 'lrc' ? parseLrcContent : parseTxtContent;
      const result = parser(content);

      return { success: true, payload: result };
    } catch (error) {
      console.error('Error parsing lyrics file via IPC:', error);
      return { success: false, error: error.message || 'Failed to parse lyrics' };
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
      const adminKey = await getAdminKey();
      if (!adminKey) {
        console.warn('Admin key not available for renderer process');
      }
      return adminKey;
    } catch (error) {
      console.error('Error getting admin key for renderer:', error);
      return null;
    }
  });

  ipcMain.handle('get-connection-diagnostics', async () => {
    try {
      const win = getMainWindow?.();
      if (!win || win.isDestroyed()) {
        return null;
      }

      const statsResult = await win.webContents.executeJavaScript(`
      (function () {
        try {
          const data = window.connectionManager?.getStats?.();
          return data ? JSON.parse(JSON.stringify(data)) : null;
        } catch (error) {
          return { __error: error?.message || String(error) };
        }
      })();
    `, true);

      if (statsResult?.__error) {
        console.error('Connection diagnostics error:', statsResult.__error);
        return null;
      }

      return statsResult;
    } catch (error) {
      console.error('Failed to get connection diagnostics:', error);
      return null;
    }
  });

  ipcMain.handle('get-desktop-jwt', async (_event, { deviceId, sessionId }) => {
    try {
      const adminKey = await getAdminKey();
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

  ipcMain.handle('token-store:get', async (_event, payload) => {
    try {
      return await secureTokenStore.readToken(payload || {});
    } catch (error) {
      console.error('Error retrieving token from secure store:', error);
      return null;
    }
  });

  ipcMain.handle('token-store:set', async (_event, payload) => {
    try {
      await secureTokenStore.writeToken(payload || {});
      return { success: true };
    } catch (error) {
      console.error('Error writing token to secure store:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('token-store:clear', async (_event, payload) => {
    try {
      await secureTokenStore.clearToken(payload || {});
      return { success: true };
    } catch (error) {
      console.error('Error clearing token from secure store:', error);
      return { success: false, error: error.message };
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

  ipcMain.handle('lyrics:providers:list', async () => {
    try {
      const providersList = await getProviderDefinitions();
      return { success: true, providers: providersList };
    } catch (error) {
      console.error('Failed to list lyrics providers:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lyrics:providers:key:get', async (_event, { providerId } = {}) => {
    try {
      const key = await getProviderKeyState(providerId);
      return { success: true, key };
    } catch (error) {
      console.error('Failed to read provider key:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lyrics:providers:key:set', async (_event, { providerId, key } = {}) => {
    try {
      if (!providerId) throw new Error('providerId is required');
      await saveProviderKey(providerId, key);
      return { success: true };
    } catch (error) {
      console.error('Failed to store provider key:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lyrics:providers:key:delete', async (_event, { providerId } = {}) => {
    try {
      await removeProviderKey(providerId);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete provider key:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lyrics:search', async (event, { query, limit, skipCache } = {}) => {
    try {
      const result = await searchAllProviders(query, {
        limit,
        skipCache,
        onPartialResults: (partialPayload) => {
          try {
            event.sender.send('lyrics:search:partial', partialPayload);
          } catch (error) {
            console.warn('Failed to send partial lyrics results:', error);
          }
        }
      });
      return { success: true, ...result };
    } catch (error) {
      console.error('Lyrics search failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lyrics:fetch', async (_event, { providerId, payload } = {}) => {
    try {
      if (!providerId) throw new Error('providerId is required');
      const lyric = await fetchLyricsByProvider(providerId, payload);
      return { success: true, lyric };
    } catch (error) {
      console.error('Lyrics fetch failed:', error);
      return { success: false, error: error.message };
    }
  });

  // EasyWorship Import handlers
  ipcMain.handle('easyworship:validate-path', async (_event, { path: dbPath }) => {
    try {
      return await easyWorship.validateDatabasePath(dbPath);
    } catch (error) {
      console.error('Error validating EasyWorship path:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('easyworship:browse-path', async () => {
    try {
      const win = getMainWindow?.();
      return await easyWorship.browseForDatabasePath(win);
    } catch (error) {
      console.error('Error browsing for database path:', error);
      return { canceled: true, error: error.message };
    }
  });

  ipcMain.handle('easyworship:browse-destination', async () => {
    try {
      const win = getMainWindow?.();
      return await easyWorship.browseForDestinationPath(win);
    } catch (error) {
      console.error('Error browsing for destination:', error);
      return { canceled: true, error: error.message };
    }
  });

  ipcMain.handle('easyworship:import-song', async (_event, params) => {
    try {
      return await easyWorship.importSong(params);
    } catch (error) {
      console.error('Error importing song:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('easyworship:open-folder', async (_event, { path: folderPath }) => {
    try {
      await easyWorship.openFolder(folderPath);
      return { success: true };
    } catch (error) {
      console.error('Error opening folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('easyworship:get-user-home', async () => {
    try {
      const os = await import('os');
      return { success: true, homedir: os.homedir() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Output preview window opener
  ipcMain.handle('open-output-window', async (_event, outputNumber) => {
    try {
      const route = outputNumber === 1 ? '/output1' : '/output2';
      const { createWindow } = await import('./windows.js');
      createWindow(route);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Updater controls
  ipcMain.handle('updater:download', async () => {
    try {
      const parent = getMainWindow?.();
      const progress = createProgressWindow({ parent });
      if (progress && !progress.isDestroyed()) {
        if (parent && typeof parent.isMinimized === 'function' && parent.isMinimized()) {
          try { progress.minimize(); } catch { }
        } else {
          try { progress.show(); } catch { }
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

  ipcMain.handle('display:get-all', async () => {
    try {
      const displays = displayManager.getAllDisplays();
      return { success: true, displays };
    } catch (error) {
      console.error('Error getting displays:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:get-primary', async () => {
    try {
      const display = displayManager.getPrimaryDisplay();
      return { success: true, display };
    } catch (error) {
      console.error('Error getting primary display:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:get-by-id', async (_event, { displayId }) => {
    try {
      const display = displayManager.getDisplayById(displayId);
      if (!display) {
        return { success: false, error: 'Display not found' };
      }
      return { success: true, display };
    } catch (error) {
      console.error('Error getting display by ID:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:save-assignment', async (_event, { displayId, outputKey }) => {
    try {
      displayManager.saveDisplayAssignment(displayId, outputKey);

      const windows = BrowserWindow.getAllWindows();
      const outputRoute = outputKey === 'stage' ? '/stage' : outputKey === 'output1' ? '/output1' : '/output2';

      for (const win of windows) {
        if (!win || win.isDestroyed()) continue;
        try {
          const url = win.webContents.getURL();
          if (url.includes(outputRoute)) {
            displayManager.moveWindowToDisplay(win, displayId, true);
            break;
          }
        } catch (err) {
          console.warn('Error checking window URL:', err);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving display assignment:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:get-assignment', async (_event, { displayId }) => {
    try {
      const assignment = displayManager.getDisplayAssignment(displayId);
      return { success: true, assignment };
    } catch (error) {
      console.error('Error getting display assignment:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:get-all-assignments', async () => {
    try {
      const assignments = displayManager.getAllDisplayAssignments();
      return { success: true, assignments };
    } catch (error) {
      console.error('Error getting all display assignments:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:remove-assignment', async (_event, { displayId }) => {
    try {
      displayManager.removeDisplayAssignment(displayId);
      return { success: true };
    } catch (error) {
      console.error('Error removing display assignment:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:open-output-on-display', async (_event, { outputKey, displayId }) => {
    try {
      const { createWindow } = await import('./windows.js');
      const route = outputKey === 'stage' ? '/stage' : outputKey === 'output1' ? '/output1' : '/output2';

      const windows = BrowserWindow.getAllWindows();
      let existingWindow = null;

      for (const win of windows) {
        if (!win || win.isDestroyed()) continue;
        try {
          const url = win.webContents.getURL();
          if (url.includes(route)) {
            existingWindow = win;
            break;
          }
        } catch (err) {
          console.warn('Error checking window URL:', err);
        }
      }

      let win;
      if (existingWindow) {

        win = existingWindow;
        console.log('[IPC] Using existing window for', route);
      } else {

        win = createWindow(route);
        console.log('[IPC] Created new window for', route);

        await new Promise(resolve => {
          win.webContents.once('did-finish-load', () => {
            setTimeout(resolve, 300);
          });
        });
      }

      if (displayId) {
        displayManager.moveWindowToDisplay(win, displayId, true);
      }

      return { success: true };
    } catch (error) {
      console.error('Error opening output on display:', error);
      return { success: false, error: error.message };
    }
  });
}