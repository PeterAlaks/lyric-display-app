import { ipcMain, dialog, nativeTheme, BrowserWindow, app } from 'electron';
import { addRecent, getRecents, clearRecents, subscribe as subscribeRecents } from './recents.js';
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
import { loadSystemFonts } from './systemFonts.js';
import { saveDarkModePreference } from './themePreferences.js';
import { handleFileOpen } from './fileHandler.js';
import { exportSetlistToPDF, exportSetlistToTXT } from './setlistExport.js';

const { autoUpdater } = updaterPkg;

let cachedJoinCode = null;

export function registerIpcHandlers({ getMainWindow, openInAppBrowser, updateDarkModeMenu, updateUndoRedoState, checkForUpdates, requestRendererModal }) {

  ipcMain.on('undo-redo-state', (_event, { canUndo, canRedo }) => {
    if (typeof updateUndoRedoState === 'function') {
      updateUndoRedoState({ canUndo, canRedo });
    }
  });

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

  ipcMain.handle('app:get-version', () => {
    try {
      return { success: true, version: app.getVersion() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('window:minimize', () => {
    const win = getMainWindow?.();
    if (win && !win.isDestroyed()) {
      try { win.minimize(); return { success: true }; } catch (error) { return { success: false, error: error.message }; }
    }
    return { success: false, error: 'No window' };
  });

  ipcMain.handle('window:toggle-maximize', () => {
    const win = getMainWindow?.();
    if (!win || win.isDestroyed()) return { success: false, error: 'No window' };
    try {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      const payload = {
        isMaximized: win.isMaximized(),
        isFullScreen: win.isFullScreen(),
        isFocused: win.isFocused()
      };
      try { win.webContents.send('window-state', payload); } catch { }
      return { success: true, ...payload };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('window:close', () => {
    const win = getMainWindow?.();
    if (!win || win.isDestroyed()) return { success: false, error: 'No window' };
    try { win.close(); return { success: true }; }
    catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('window:toggle-fullscreen', () => {
    const win = getMainWindow?.();
    if (!win || win.isDestroyed()) return { success: false, error: 'No window' };
    try {
      const next = !win.isFullScreen();
      win.setFullScreen(next);
      return { success: true, isFullScreen: next };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('window:reload', () => {
    const win = getMainWindow?.();
    if (!win || win.isDestroyed()) return { success: false, error: 'No window' };
    try { win.reload(); return { success: true }; }
    catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('window:devtools', () => {
    const win = getMainWindow?.();
    if (!win || win.isDestroyed()) return { success: false, error: 'No window' };
    try {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: 'detach' });
      }
      return { success: true, isOpen: win.webContents.isDevToolsOpened() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('window:zoom', (_event, direction) => {
    const win = getMainWindow?.();
    if (!win || win.isDestroyed()) return { success: false, error: 'No window' };
    try {
      const wc = win.webContents;
      const current = wc.getZoomFactor();
      let next = current;
      if (direction === 'in') next = Math.min(current + 0.1, 3);
      else if (direction === 'out') next = Math.max(current - 0.1, 0.3);
      else if (direction === 'reset') next = 1;
      wc.setZoomFactor(next);
      return { success: true, zoomFactor: next };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('window:get-state', () => {
    const win = getMainWindow?.();
    if (!win || win.isDestroyed()) return { success: false, error: 'No window' };
    try {
      return {
        success: true,
        state: {
          isMaximized: win.isMaximized(),
          isFullScreen: win.isFullScreen(),
          isFocused: win.isFocused()
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
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
    try {
      nativeTheme.themeSource = isDark ? 'dark' : 'light';
      saveDarkModePreference(isDark);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fonts:list', async () => {
    try {
      const fonts = await loadSystemFonts();
      return { success: true, fonts: fonts || [] };
    } catch (error) {
      console.error('Error listing system fonts:', error);
      return { success: false, error: error.message, fonts: [] };
    }
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

  ipcMain.handle('setlist:save', async (_event, { setlistData, defaultName }) => {
    try {
      const win = getMainWindow?.();
      const os = await import('os');
      const fs = await import('fs/promises');
      const path = await import('path');

      const userHome = os.homedir();
      const platform = process.platform;
      const separator = platform === 'win32' ? '\\' : '/';
      const defaultPath = `${userHome}${separator}Documents${separator}LyricDisplay${separator}Setlists`;

      try {
        await fs.mkdir(defaultPath, { recursive: true });
      } catch (err) {
        console.warn('Could not create setlist directory:', err);
      }

      const result = await dialog.showSaveDialog(win || undefined, {
        title: 'Save Setlist',
        defaultPath: path.join(defaultPath, defaultName || 'Setlist.ldset'),
        filters: [
          { name: 'LyricDisplay Setlist', extensions: ['ldset'] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      const jsonContent = JSON.stringify(setlistData, null, 2);
      await fs.writeFile(result.filePath, jsonContent, 'utf8');

      console.log('[Setlist] Saved setlist to:', result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (error) {
      console.error('[Setlist] Error saving setlist:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('setlist:load', async () => {
    try {
      const win = getMainWindow?.();
      const os = await import('os');
      const path = await import('path');

      const userHome = os.homedir();
      const platform = process.platform;
      const separator = platform === 'win32' ? '\\' : '/';
      const defaultPath = `${userHome}${separator}Documents${separator}LyricDisplay${separator}Setlists`;

      const result = await dialog.showOpenDialog(win || undefined, {
        title: 'Load Setlist',
        defaultPath: defaultPath,
        filters: [
          { name: 'LyricDisplay Setlist', extensions: ['ldset'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const filePath = result.filePaths[0];
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf8');
      const setlistData = JSON.parse(content);

      console.log('[Setlist] Loaded setlist from:', filePath);
      return { success: true, setlistData, filePath };
    } catch (error) {
      console.error('[Setlist] Error loading setlist:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('setlist:load-from-path', async (_event, { filePath }) => {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf8');
      const setlistData = JSON.parse(content);

      console.log('[Setlist] Loaded setlist from path:', filePath);
      return { success: true, setlistData, filePath };
    } catch (error) {
      console.error('[Setlist] Error loading setlist from path:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('setlist:get-user-home', async () => {
    try {
      const os = await import('os');
      return { success: true, homedir: os.homedir() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('setlist:browse-files', async () => {
    try {
      const win = getMainWindow?.();
      const result = await dialog.showOpenDialog(win || undefined, {
        title: 'Add Files to Setlist',
        filters: [
          { name: 'Lyric Files', extensions: ['txt', 'lrc'] }
        ],
        properties: ['openFile', 'multiSelections']
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const fs = await import('fs/promises');
      const files = await Promise.all(
        result.filePaths.map(async (filePath) => {
          const content = await fs.readFile(filePath, 'utf8');
          const fileName = filePath.split(/[\\/]/).pop();
          const stats = await fs.stat(filePath);
          return {
            name: fileName,
            content,
            lastModified: stats.mtimeMs
          };
        })
      );

      console.log('[Setlist] Browsed and loaded', files.length, 'files');
      return { success: true, files };
    } catch (error) {
      console.error('[Setlist] Error browsing files:', error);
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

  ipcMain.handle('display:open-settings-modal', async () => {
    try {
      if (typeof requestRendererModal !== 'function') {
        return { success: false, error: 'Modal bridge unavailable' };
      }
      const { showDisplayDetectionModal } = await import('./displayDetection.js');
      const displays = displayManager.getAllDisplays();
      const externalDisplays = displays.filter(d => !d.primary);

      if (!externalDisplays || externalDisplays.length === 0) {
        return { success: false, error: 'No external displays connected' };
      }

      await showDisplayDetectionModal(externalDisplays, false, requestRendererModal, true);
      return { success: true };
    } catch (error) {
      console.error('Error opening display settings modal:', error);
      return { success: false, error: error.message };
    }
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
      if (!outputKey) {
        displayManager.removeDisplayAssignment(displayId);
        return { success: true };
      }

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

  ipcMain.handle('display:close-output-window', async (_event, { outputKey }) => {
    try {
      const route = outputKey === 'stage' ? '/stage' : outputKey === 'output1' ? '/output1' : '/output2';
      const windows = BrowserWindow.getAllWindows();

      for (const win of windows) {
        if (!win || win.isDestroyed()) continue;
        try {
          const url = win.webContents.getURL();
          if (url.includes(route)) {
            console.log('[IPC] Closing output window for', route);
            win.close();
            return { success: true };
          }
        } catch (err) {
          console.warn('Error checking window URL:', err);
        }
      }

      return { success: false, error: 'Window not found' };
    } catch (error) {
      console.error('Error closing output window:', error);
      return { success: false, error: error.message };
    }
  });

  // Setlist export handlers
  ipcMain.handle('setlist:export', async (_event, { setlistData, options }) => {
    try {
      const win = getMainWindow?.();
      const os = await import('os');
      const path = await import('path');

      const { title = 'Setlist', includeLyrics = false, format = 'pdf' } = options || {};

      const userHome = os.homedir();
      const platform = process.platform;
      const separator = platform === 'win32' ? '\\' : '/';
      const defaultPath = `${userHome}${separator}Documents${separator}LyricDisplay${separator}Setlists`;

      try {
        const fs = await import('fs/promises');
        await fs.mkdir(defaultPath, { recursive: true });
      } catch (err) {
        console.warn('Could not create setlist directory:', err);
      }

      const extension = format === 'pdf' ? 'pdf' : 'txt';
      const filterName = format === 'pdf' ? 'PDF Document' : 'Text File';
      const defaultFileName = `${title}.${extension}`;

      const result = await dialog.showSaveDialog(win || undefined, {
        title: `Export Setlist as ${format.toUpperCase()}`,
        defaultPath: path.join(defaultPath, defaultFileName),
        filters: [
          { name: filterName, extensions: [extension] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      let exportResult;
      if (format === 'pdf') {
        exportResult = await exportSetlistToPDF(result.filePath, setlistData, { title, includeLyrics });
      } else {
        exportResult = await exportSetlistToTXT(result.filePath, setlistData, { title, includeLyrics });
      }

      console.log('[Setlist] Exported setlist to:', result.filePath);
      return exportResult;
    } catch (error) {
      console.error('[Setlist] Error exporting setlist:', error);
      return { success: false, error: error.message };
    }
  });

}