// preload.js (CommonJS)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  tokenStore: {
    get: (payload) => ipcRenderer.invoke('token-store:get', payload),
    set: (payload) => ipcRenderer.invoke('token-store:set', payload),
    clear: (payload) => ipcRenderer.invoke('token-store:clear', payload)
  },
  toggleDarkMode: () => ipcRenderer.invoke('toggle-dark-mode'),
  getDarkMode: () => ipcRenderer.invoke('get-dark-mode'),
  setDarkMode: (isDark) => ipcRenderer.invoke('set-dark-mode', isDark),
  syncNativeDarkMode: (isDark) => ipcRenderer.invoke('sync-native-dark-mode', isDark),
  loadLyricsFile: () => ipcRenderer.invoke('load-lyrics-file'),
  parseLyricsFile: (payload) => ipcRenderer.invoke('parse-lyrics-file', payload),
  getAdminKey: () => ipcRenderer.invoke('get-admin-key'),
  getJoinCode: () => ipcRenderer.invoke('get-join-code'),
  getDesktopJWT: (payload) => ipcRenderer.invoke('get-desktop-jwt', payload),
  getConnectionDiagnostics: () => ipcRenderer.invoke('get-connection-diagnostics'),
  newLyricsFile: () => ipcRenderer.invoke('new-lyrics-file'),
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
  getPlatform: () => process.platform,
  onTriggerFileLoad: (callback) => {
    ipcRenderer.removeAllListeners('trigger-file-load');
    ipcRenderer.on('trigger-file-load', callback);
  },

  onNavigateToNewSong: (callback) => {
    ipcRenderer.removeAllListeners('navigate-to-new-song');
    ipcRenderer.on('navigate-to-new-song', callback);
  },

  onDarkModeToggle: (callback) => ipcRenderer.on('toggle-dark-mode', callback),

  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),

  onProgressUpdate: (callback) => {
    ipcRenderer.removeAllListeners('progress-update');
    ipcRenderer.on('progress-update', (event, progress) => callback(progress));
  },

  onLoadingStatus: (callback) => {
    ipcRenderer.removeAllListeners('loading-status');
    ipcRenderer.on('loading-status', (event, status) => callback(status));
  },


  onAdminKeyAvailable: (callback) => {
    const channel = 'admin-key:available';
    const handler = (_event, payload) => callback?.(payload);
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },

  openInAppBrowser: (url) => ipcRenderer.invoke('open-in-app-browser', url),
  addRecentFile: (filePath) => ipcRenderer.invoke('add-recent-file', filePath),
  openOutputWindow: (outputNumber) => ipcRenderer.invoke('open-output-window', outputNumber),
  onOpenLyricsFromPath: (callback) => {
    const channel = 'open-lyrics-from-path';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, payload) => callback(payload));
    return () => ipcRenderer.removeAllListeners(channel);
  },

  // Updater events and actions
  onUpdateAvailable: (callback) => {
    const channel = 'updater:update-available';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, info) => callback(info));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onUpdateDownloaded: (callback) => {
    const channel = 'updater:update-downloaded';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e) => callback());
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onUpdateError: (callback) => {
    const channel = 'updater:update-error';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, msg) => callback(msg));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  requestUpdateDownload: () => ipcRenderer.invoke('updater:download'),
  requestInstallAndRestart: () => ipcRenderer.invoke('updater:install'),

  // Menu-triggered shortcuts help
  onOpenShortcutsHelp: (callback) => {
    const channel = 'open-shortcuts-help';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onOpenQRCodeDialog: (callback) => {
    const channel = 'open-qr-dialog';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onOpenEasyWorshipImport: (callback) => {
    const channel = 'open-easyworship-import';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onOpenSupportDevModal: (callback) => {
    const channel = 'open-support-dev-modal';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onOpenLyricsFromPathError: (callback) => {
    const channel = 'open-lyrics-from-path-error';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, payload) => callback(payload));
    return () => ipcRenderer.removeAllListeners(channel);
  },

  // In-app browser controls
  browserBack: () => ipcRenderer.send('browser-nav', 'back'),
  browserForward: () => ipcRenderer.send('browser-nav', 'forward'),
  browserReload: () => ipcRenderer.send('browser-nav', 'reload'),
  browserNavigate: (url) => ipcRenderer.send('browser-nav', 'navigate', url),
  browserOpenExternal: () => ipcRenderer.send('browser-open-external'),
  onBrowserLocation: (callback) => {
    ipcRenderer.removeAllListeners('browser-location');
    ipcRenderer.on('browser-location', (_e, url) => callback(url));
  },

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  onModalRequest: (callback) => {
    const channel = 'modal-bridge:request';
    ipcRenderer.removeAllListeners(channel);
    const handler = (_event, payload) => callback?.(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  resolveModalRequest: (id, result) => ipcRenderer.invoke('modal-bridge:resolve', { id, result }),
  rejectModalRequest: (id, error) => ipcRenderer.invoke('modal-bridge:reject', { id, error: error?.message || error || 'cancelled' }),
  lyrics: {
    listProviders: () => ipcRenderer.invoke('lyrics:providers:list'),
    getProviderKey: (providerId) => ipcRenderer.invoke('lyrics:providers:key:get', { providerId }),
    saveProviderKey: (providerId, key) => ipcRenderer.invoke('lyrics:providers:key:set', { providerId, key }),
    deleteProviderKey: (providerId) => ipcRenderer.invoke('lyrics:providers:key:delete', { providerId }),
    search: (payload) => ipcRenderer.invoke('lyrics:search', payload),
    fetch: (payload) => ipcRenderer.invoke('lyrics:fetch', payload),
    onPartialResults: (callback) => {
      ipcRenderer.removeAllListeners('lyrics:search:partial');
      ipcRenderer.on('lyrics:search:partial', (_event, payload) => callback(payload));
      return () => ipcRenderer.removeAllListeners('lyrics:search:partial');
    }
  },
  easyWorship: {
    validatePath: (path) => ipcRenderer.invoke('easyworship:validate-path', { path }),
    browseForPath: () => ipcRenderer.invoke('easyworship:browse-path'),
    browseForDestination: () => ipcRenderer.invoke('easyworship:browse-destination'),
    importSong: (params) => ipcRenderer.invoke('easyworship:import-song', params),
    openFolder: (path) => ipcRenderer.invoke('easyworship:open-folder', { path }),
    getUserHome: () => ipcRenderer.invoke('easyworship:get-user-home')
  },
  display: {
    getAll: () => ipcRenderer.invoke('display:get-all'),
    getPrimary: () => ipcRenderer.invoke('display:get-primary'),
    getById: (displayId) => ipcRenderer.invoke('display:get-by-id', { displayId }),
    saveAssignment: (displayId, outputKey) => ipcRenderer.invoke('display:save-assignment', { displayId, outputKey }),
    getAssignment: (displayId) => ipcRenderer.invoke('display:get-assignment', { displayId }),
    getAllAssignments: () => ipcRenderer.invoke('display:get-all-assignments'),
    removeAssignment: (displayId) => ipcRenderer.invoke('display:remove-assignment', { displayId }),
    openOutputOnDisplay: (outputKey, displayId) => ipcRenderer.invoke('display:open-output-on-display', { outputKey, displayId }),
    closeOutputWindow: (outputKey) => ipcRenderer.invoke('display:close-output-window', { outputKey })
  }
});

contextBridge.exposeInMainWorld('electronStore', {
  getDarkMode: () => {
    try {
      const store = JSON.parse(localStorage.getItem('lyrics-store'));
      return store?.state?.darkMode || false;
    } catch {
      return false;
    }
  }
});