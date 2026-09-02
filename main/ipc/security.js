import { ipcMain, app } from 'electron';
import * as secureTokenStore from '../secureTokenStore.js';
import { getBackendPort } from '../backend.js';

const sanitizeSecretsStatus = (status) => {
  if (!status || typeof status !== 'object') {
    return { exists: false, error: 'Security status unavailable' };
  }

  return {
    exists: !!status.exists,
    lastRotated: status.lastRotated || null,
    daysSinceRotation: Number.isFinite(status.daysSinceRotation) ? status.daysSinceRotation : null,
    needsRotation: !!status.needsRotation,
    rotationMaxAgeDays: Number.isFinite(status.rotationMaxAgeDays) ? status.rotationMaxAgeDays : 180,
    hasGraceSecret: !!status.hasGraceSecret,
    graceActive: !!status.graceActive,
    previousSecretExpiry: status.previousSecretExpiry || null,
    storageBackend: status.storageBackend || null,
    error: status.error || null,
  };
};

const fetchBackendJson = async (path, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`http://127.0.0.1:${getBackendPort()}${path}`, {
      ...options,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error || `Backend request failed with ${response.status}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

export function registerSecurityHandlers() {
  ipcMain.handle('security:get-jwt-status', async () => {
    try {
      const status = await fetchBackendJson('/api/admin/secrets/status');
      return { success: true, status: sanitizeSecretsStatus(status) };
    } catch (error) {
      console.error('[Security IPC] Failed to get JWT status:', error);
      return {
        success: false,
        error: error.message,
        status: sanitizeSecretsStatus({ error: error.message }),
      };
    }
  });

  ipcMain.handle('security:rotate-jwt-and-restart', async () => {
    try {
      const payload = await fetchBackendJson('/api/admin/secrets/rotate', { method: 'POST' });
      await secureTokenStore.clearAllTokens();

      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 300);

      return {
        success: true,
        restarting: true,
        lastRotated: payload?.lastRotated || null,
        status: sanitizeSecretsStatus(payload?.status),
      };
    } catch (error) {
      console.error('[Security IPC] Failed to rotate JWT secret:', error);
      return { success: false, error: error.message };
    }
  });
}
