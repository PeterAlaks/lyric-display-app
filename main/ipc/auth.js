import { ipcMain, BrowserWindow } from 'electron';
import { getAdminKey, onAdminKeyAvailable } from '../adminKey.js';
import * as secureTokenStore from '../secureTokenStore.js';
import { isDev } from '../paths.js';
import {
  assertTrustedAppRenderer,
  isExpectedWindowSender,
  normalizeAuthIdentity,
  normalizeTokenStorePayload,
} from './senderValidation.js';

let cachedJoinCode = null;
const DESKTOP_JWT_REQUEST_TIMEOUT_MS = 5000;
const SLOW_AUTH_OPERATION_MS = 500;

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DESKTOP_JWT_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const logSlowAuthOperation = (operation, startedAt) => {
  const durationMs = Date.now() - startedAt;
  if (durationMs >= SLOW_AUTH_OPERATION_MS) {
    console.warn(`[AuthTiming] ${operation} took ${durationMs}ms`);
  }
};

/**
 * Register authentication IPC handlers
 * Handles admin key, JWT tokens, join codes, and secure token storage
 */
export function registerAuthHandlers({ getMainWindow }) {
  const backendPort = Number(process.env.PORT) || 4000;
  const senderOptions = {
    development: isDev,
    backendPort,
  };
  
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

  ipcMain.handle('get-connection-diagnostics', async (event) => {
    try {
      const win = getMainWindow?.();
      if (!win || win.isDestroyed() || !isExpectedWindowSender(event, win)) {
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

  ipcMain.handle('get-desktop-jwt', async (event, payload = {}) => {
    const startedAt = Date.now();
    try {
      assertTrustedAppRenderer(event, 'get-desktop-jwt', senderOptions);
      const { deviceId, sessionId } = normalizeAuthIdentity(payload);
      const adminKey = await getAdminKey();
      const resp = await fetchWithTimeout(`http://127.0.0.1:${backendPort}/api/auth/token`, {
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
    } finally {
      logSlowAuthOperation('desktop JWT request', startedAt);
    }
  });

  ipcMain.handle('get-join-code', async (event) => {
    try {
      assertTrustedAppRenderer(event, 'get-join-code', senderOptions);
      const response = await fetch(`http://127.0.0.1:${backendPort}/api/auth/join-code`);
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
  ipcMain.handle('token-store:get', async (event, payload) => {
    const startedAt = Date.now();
    try {
      assertTrustedAppRenderer(event, 'token-store:get', senderOptions);
      return await secureTokenStore.readToken(normalizeTokenStorePayload(payload));
    } catch (error) {
      console.error('Error retrieving token from secure store:', error);
      return null;
    } finally {
      logSlowAuthOperation('secure token read', startedAt);
    }
  });

  ipcMain.handle('token-store:set', async (event, payload) => {
    const startedAt = Date.now();
    try {
      assertTrustedAppRenderer(event, 'token-store:set', senderOptions);
      await secureTokenStore.writeToken(normalizeTokenStorePayload(payload, { requireToken: true }));
      return { success: true };
    } catch (error) {
      console.error('Error writing token to secure store:', error);
      return { success: false, error: error.message };
    } finally {
      logSlowAuthOperation('secure token write', startedAt);
    }
  });

  ipcMain.handle('token-store:clear', async (event, payload) => {
    try {
      assertTrustedAppRenderer(event, 'token-store:clear', senderOptions);
      await secureTokenStore.clearToken(normalizeTokenStorePayload(payload));
      return { success: true };
    } catch (error) {
      console.error('Error clearing token from secure store:', error);
      return { success: false, error: error.message };
    }
  });
}
