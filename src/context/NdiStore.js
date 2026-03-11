/**
 * Global Zustand store for NDI companion state.
 * Survives modal open/close cycles so download progress, update status,
 * and companion running state are never lost.
 */
import { create } from 'zustand';

const useNdiStore = create((set, get) => ({
  // Installation status
  installed: false,
  version: '',
  installPath: '',
  companionPath: '',

  // Companion process
  companionRunning: false,
  autoLaunch: false,

  // Download / update progress
  isDownloading: false,
  isUpdating: false,
  downloadProgress: null, // { percent, downloaded, total, status }

  // Update info
  updateInfo: null, // { updateAvailable, latestVersion, currentVersion, ... }
  checkingUpdate: false,

  // Telemetry
  telemetry: { stats: null, health: null, updatedAt: 0 },

  // Whether initial load from main process has completed
  initialized: false,

  // Error state
  lastError: null,

  // ---- Actions ----

  setInstallStatus: (status) => set({
    installed: status.installed ?? false,
    version: status.version ?? '',
    installPath: status.installPath ?? '',
    companionPath: status.companionPath ?? '',
  }),

  setCompanionRunning: (running) => set({ companionRunning: running }),
  setAutoLaunch: (enabled) => set({ autoLaunch: enabled }),

  setDownloading: (downloading) => set({ isDownloading: downloading }),
  setUpdating: (updating) => set({ isUpdating: updating }),
  setDownloadProgress: (progress) => set({ downloadProgress: progress }),

  setUpdateInfo: (info) => set({ updateInfo: info }),
  setCheckingUpdate: (checking) => set({ checkingUpdate: checking }),

  setTelemetry: (telemetry) => set({
    telemetry: {
      stats: telemetry?.stats || null,
      health: telemetry?.health || null,
      updatedAt: Date.now(),
    },
  }),

  setInitialized: (initialized) => set({ initialized }),
  setLastError: (error) => set({ lastError: error }),

  /**
   * Reset download/update state (e.g. after completion or failure)
   */
  resetOperationState: () => set({
    isDownloading: false,
    isUpdating: false,
    downloadProgress: null,
  }),

  /**
   * Full reset after uninstall
   */
  resetAll: () => set({
    installed: false,
    version: '',
    installPath: '',
    companionPath: '',
    companionRunning: false,
    updateInfo: null,
    isDownloading: false,
    isUpdating: false,
    downloadProgress: null,
    telemetry: { stats: null, health: null, updatedAt: 0 },
    lastError: null,
  }),

  /**
   * Load initial state from the main process.
   * Called once on app startup from a bridge component.
   */
  initialize: async () => {
    if (get().initialized) return;
    try {
      const api = window.electronAPI?.ndi;
      if (!api) return;

      const [installResult, statusResult, pendingUpdate] = await Promise.all([
        api.checkInstalled?.() || Promise.resolve(null),
        api.getCompanionStatus?.() || Promise.resolve(null),
        api.getPendingUpdateInfo?.() || Promise.resolve(null),
      ]);

      const updates = {};

      if (installResult) {
        updates.installed = installResult.installed ?? false;
        updates.version = installResult.version ?? '';
        updates.installPath = installResult.installPath ?? '';
        updates.companionPath = installResult.companionPath ?? '';
      }

      if (statusResult) {
        updates.companionRunning = statusResult.running ?? false;
        updates.autoLaunch = statusResult.autoLaunch ?? false;
      }

      if (pendingUpdate?.updateAvailable) {
        updates.updateInfo = pendingUpdate;
      }

      updates.initialized = true;
      set(updates);
    } catch (error) {
      console.warn('[NdiStore] Failed to initialize:', error);
      set({ initialized: true });
    }
  },

  /**
   * Refresh install status from main process
   */
  refreshInstallStatus: async () => {
    try {
      const result = await window.electronAPI?.ndi?.checkInstalled?.();
      if (result) {
        set({
          installed: result.installed ?? false,
          version: result.version ?? '',
          installPath: result.installPath ?? '',
          companionPath: result.companionPath ?? '',
        });
      }
      return result;
    } catch (error) {
      console.warn('[NdiStore] Failed to refresh install status:', error);
      return null;
    }
  },
}));

export default useNdiStore;
