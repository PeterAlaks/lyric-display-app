import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';

let getWindow = () => null;
let handlersRegistered = false;
const pending = new Map();

function ensureHandlers() {
  if (handlersRegistered) return;
  ipcMain.handle('modal-bridge:resolve', (_event, payload) => {
    const { id, result } = payload || {};
    const entry = pending.get(id);
    if (!entry) {
      return { ok: false };
    }
    pending.delete(id);
    clearTimeout(entry.timeout);
    entry.resolve(result);
    return { ok: true };
  });

  ipcMain.handle('modal-bridge:reject', (_event, payload) => {
    const { id, error } = payload || {};
    const entry = pending.get(id);
    if (!entry) {
      return { ok: false };
    }
    pending.delete(id);
    clearTimeout(entry.timeout);
    entry.reject(error || new Error('Modal request rejected by renderer'));
    return { ok: true };
  });

  handlersRegistered = true;
}

export function initModalBridge(getMainWindow) {
  if (typeof getMainWindow === 'function') {
    getWindow = getMainWindow;
  }
  ensureHandlers();
}

export function requestRendererModal(config = {}, options = {}) {
  ensureHandlers();
  const win = getWindow?.();
  const fallback = options.fallback;

  if (!win || win.isDestroyed()) {
    if (typeof fallback === 'function') {
      return Promise.resolve()
        .then(() => fallback())
        .then((result) => normalizeModalResult(result));
    }
    return Promise.reject(new Error('No active window available for renderer modal'));
  }

  const requestId = config.id || randomUUID();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(requestId);
      if (typeof fallback === 'function') {
        Promise.resolve().then(() => fallback()).then(resolve).catch(reject);
      } else {
        reject(new Error('Timed out waiting for renderer modal response'));
      }
    }, options.timeout ?? 15000);

    pending.set(requestId, {
      resolve: (result) => {
        resolve(normalizeModalResult(result));
      },
      reject: (error) => {
        if (typeof fallback === 'function') {
          Promise.resolve().then(() => fallback()).then(resolve).catch(reject);
        } else {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
      timeout,
    });

    try {
      win.webContents.send('modal-bridge:request', { ...config, id: requestId });
    } catch (err) {
      clearTimeout(timeout);
      pending.delete(requestId);
      if (typeof fallback === 'function') {
        Promise.resolve().then(() => fallback()).then(resolve).catch(reject);
      } else {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  });
}

function normalizeModalResult(result) {

  if (typeof result === 'number') {
    return { response: result, data: result };
  }

  if (result && typeof result === 'object') {
    if (typeof result.response === 'number') {
      return { response: result.response, data: result };
    }
    if (result.dismissed) {
      return { response: -1, data: result };
    }
    if (typeof result === 'object' && 'value' in result && typeof result.value === 'number') {
      return { response: result.value, data: result };
    }
  }
  return { response: 0, data: result };
}
