import { ipcMain, BrowserWindow } from 'electron';
import { getAdminKey, onAdminKeyAvailable } from '../adminKey.js';
import * as secureTokenStore from '../secureTokenStore.js';

let cachedJoinCode = null;

/**
 * Register authentication IPC handlers
 * Handles admin key, JWT tokens, join codes, and secure token storage
 */
export function registerAuthHandlers({ getMainWindow }) {
  
  // Broadcast admin key availability to all windows
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

  // Token store handlers
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
}
