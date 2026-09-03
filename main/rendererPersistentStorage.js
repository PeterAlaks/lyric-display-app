import { app, ipcMain } from 'electron';
import Store from 'electron-store';
import './appIdentity.js';
import {
  applyRendererStorageMutation,
  reconcileRendererStorageSnapshot,
} from '../shared/rendererPersistentStorage.js';

const PERSIST_DELAY_MS = 150;

const storageStore = new Store({
  name: 'renderer-persistent-storage',
  defaults: {
    snapshot: null,
  },
});

let snapshot = storageStore.get('snapshot');
let dirty = false;
let persistenceTimer = null;
let lastPersistenceError = null;
let lastMutationError = null;
let handlersRegistered = false;

const persistSnapshot = () => {
  if (!dirty) {
    return { success: true };
  }

  try {
    storageStore.set('snapshot', snapshot);
    dirty = false;
    lastPersistenceError = null;
    return { success: true };
  } catch (error) {
    lastPersistenceError = error?.message || 'Renderer state could not be saved.';
    console.error('[RendererStorage] Failed to persist native renderer state:', error);
    return { success: false, error: lastPersistenceError };
  }
};

const schedulePersistence = () => {
  if (persistenceTimer) clearTimeout(persistenceTimer);
  persistenceTimer = setTimeout(() => {
    persistenceTimer = null;
    persistSnapshot();
  }, PERSIST_DELAY_MS);
  persistenceTimer.unref?.();
};

const initializeStorage = ({ currentPort, legacyEntries } = {}) => {
  const result = reconcileRendererStorageSnapshot({
    currentPort,
    legacyEntries,
    storedSnapshot: snapshot,
  });
  if (!result.success) {
    lastMutationError = result.error;
    return result;
  }

  snapshot = result.snapshot;
  dirty = true;
  const persisted = persistSnapshot();
  if (!persisted.success) {
    return { ...persisted, snapshot: null };
  }
  lastMutationError = null;

  return {
    success: true,
    entries: snapshot.entries,
    source: result.source,
  };
};

const applyMutation = ({ currentPort, ...mutation } = {}) => {
  if (!snapshot || Number(currentPort) !== snapshot.lastPort) {
    return { success: false, error: 'Renderer storage mutation came from an inactive application port.' };
  }

  const result = applyRendererStorageMutation(snapshot, mutation);
  if (!result.success) {
    lastMutationError = result.error;
    return result;
  }

  snapshot = result.snapshot;
  dirty = true;
  lastMutationError = null;
  schedulePersistence();
  return { success: true };
};

export function flushRendererPersistentStorage() {
  if (persistenceTimer) {
    clearTimeout(persistenceTimer);
    persistenceTimer = null;
  }
  const result = persistSnapshot();
  if (!result.success) return result;
  if (lastMutationError) {
    return { success: false, error: lastMutationError };
  }
  return result;
}

export function prepareRendererPersistentStorageForPortChange() {
  if (!snapshot) {
    return {
      success: false,
      code: 'RENDERER_STORAGE_UNAVAILABLE',
      error: 'LyricDisplay could not secure your current workspace before changing ports. Restart the app and try again.',
    };
  }

  const result = flushRendererPersistentStorage();
  if (!result.success || lastPersistenceError || lastMutationError) {
    return {
      success: false,
      code: 'RENDERER_STORAGE_UNAVAILABLE',
      error: result.error || lastPersistenceError || lastMutationError || 'Renderer state could not be saved.',
    };
  }
  return { success: true };
}

export function registerRendererPersistentStorageHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.on('renderer-storage:initialize', (event, payload) => {
    event.returnValue = initializeStorage(payload);
  });

  ipcMain.on('renderer-storage:mutate', (_event, payload) => {
    applyMutation(payload);
  });

  app.on('before-quit', () => {
    flushRendererPersistentStorage();
  });
}
