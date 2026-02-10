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
  getSystemFonts: () => ipcRenderer.invoke('fonts:list'),
  getPlatform: () => process.platform,
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
    close: () => ipcRenderer.invoke('window:close'),
    reload: () => ipcRenderer.invoke('window:reload'),
    toggleDevTools: () => ipcRenderer.invoke('window:devtools'),
    setZoom: (direction) => ipcRenderer.invoke('window:zoom', direction),
    getState: () => ipcRenderer.invoke('window:get-state'),
  },
  onWindowState: (callback) => {
    const channel = 'window-state';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_event, state) => callback?.(state));
    return () => ipcRenderer.removeAllListeners(channel);
  },
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
  recents: {
    list: () => ipcRenderer.invoke('recents:list'),
    clear: () => ipcRenderer.invoke('recents:clear'),
    open: (filePath) => ipcRenderer.invoke('recents:open', filePath),
    onChange: (callback) => {
      const channel = 'recents:update';
      ipcRenderer.removeAllListeners(channel);
      ipcRenderer.on(channel, (_event, list) => callback?.(list));
      return () => ipcRenderer.removeAllListeners(channel);
    }
  },
  openOutputWindow: (outputNumber) => ipcRenderer.invoke('open-output-window', outputNumber),
  onOpenLyricsFromPath: (callback) => {
    const channel = 'open-lyrics-from-path';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, payload) => callback(payload));
    return () => ipcRenderer.removeAllListeners(channel);
  },

  checkForUpdates: (showNoUpdateDialog) => ipcRenderer.invoke('updater:check', showNoUpdateDialog),
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
  displaySettings: {
    openModal: () => ipcRenderer.invoke('display:open-settings-modal')
  },

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
  onMenuUndo: (callback) => {
    const channel = 'menu-undo';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onMenuRedo: (callback) => {
    const channel = 'menu-redo';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeAllListeners(channel);
  },
  notifyUndoRedoState: (canUndo, canRedo) => ipcRenderer.send('undo-redo-state', { canUndo, canRedo }),
  onOpenLyricsFromPathError: (callback) => {
    const channel = 'open-lyrics-from-path-error';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, payload) => callback(payload));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onOpenSetlistFromPath: (callback) => {
    const channel = 'open-setlist-from-path';
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, payload) => callback(payload));
    return () => ipcRenderer.removeAllListeners(channel);
  },

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
  },
  setlist: {
    save: (setlistData, defaultName) => ipcRenderer.invoke('setlist:save', { setlistData, defaultName }),
    load: () => ipcRenderer.invoke('setlist:load'),
    loadFromPath: (filePath) => ipcRenderer.invoke('setlist:load-from-path', { filePath }),
    getUserHome: () => ipcRenderer.invoke('setlist:get-user-home'),
    browseFiles: () => ipcRenderer.invoke('setlist:browse-files'),
    export: (setlistData, options) => ipcRenderer.invoke('setlist:export', { setlistData, options })
  },
  templates: {
    load: (type) => ipcRenderer.invoke('templates:load', { type }),
    save: (type, template) => ipcRenderer.invoke('templates:save', { type, template }),
    delete: (type, templateId) => ipcRenderer.invoke('templates:delete', { type, templateId }),
    update: (type, templateId, updates) => ipcRenderer.invoke('templates:update', { type, templateId, updates }),
    nameExists: (type, name, excludeId) => ipcRenderer.invoke('templates:name-exists', { type, name, excludeId })
  },
  
  // External Control (MIDI/OSC)
  externalControl: {
    getStatus: () => ipcRenderer.invoke('external-control:get-status'),
    onAction: (callback) => {
      const channel = 'external-control:action';
      ipcRenderer.removeAllListeners(channel);
      ipcRenderer.on(channel, (_event, action) => callback?.(action));
      return () => ipcRenderer.removeAllListeners(channel);
    }
  },
  
  midi: {
    initialize: () => ipcRenderer.invoke('midi:initialize'),
    getStatus: () => ipcRenderer.invoke('midi:get-status'),
    refreshPorts: () => ipcRenderer.invoke('midi:refresh-ports'),
    selectPort: (portIndex) => ipcRenderer.invoke('midi:select-port', { portIndex }),
    enable: () => ipcRenderer.invoke('midi:enable'),
    disable: () => ipcRenderer.invoke('midi:disable'),
    setMapping: (type, key, mapping) => ipcRenderer.invoke('midi:set-mapping', { type, key, mapping }),
    removeMapping: (type, key) => ipcRenderer.invoke('midi:remove-mapping', { type, key }),
    resetMappings: () => ipcRenderer.invoke('midi:reset-mappings'),
    startLearn: (timeout) => ipcRenderer.invoke('midi:start-learn', { timeout })
  },
  
  osc: {
    initialize: () => ipcRenderer.invoke('osc:initialize'),
    getStatus: () => ipcRenderer.invoke('osc:get-status'),
    enable: () => ipcRenderer.invoke('osc:enable'),
    disable: () => ipcRenderer.invoke('osc:disable'),
    setPort: (port) => ipcRenderer.invoke('osc:set-port', { port }),
    setFeedbackPort: (port) => ipcRenderer.invoke('osc:set-feedback-port', { port }),
    setAddressPrefix: (prefix) => ipcRenderer.invoke('osc:set-address-prefix', { prefix }),
    setFeedbackEnabled: (enabled) => ipcRenderer.invoke('osc:set-feedback-enabled', { enabled }),
    getSupportedAddresses: () => ipcRenderer.invoke('osc:get-supported-addresses'),
    sendFeedback: (address, args) => ipcRenderer.invoke('osc:send-feedback', { address, args })
  },

  // NDI Broadcasting
  ndi: {
    checkInstalled: () => ipcRenderer.invoke('ndi:check-installed'),
    download: () => ipcRenderer.invoke('ndi:download'),
    onDownloadProgress: (callback) => {
      const channel = 'ndi:download-progress';
      ipcRenderer.removeAllListeners(channel);
      ipcRenderer.on(channel, (_event, progress) => callback(progress));
      return () => ipcRenderer.removeAllListeners(channel);
    },
    uninstall: () => ipcRenderer.invoke('ndi:uninstall'),
    launchCompanion: () => ipcRenderer.invoke('ndi:launch-companion'),
    stopCompanion: () => ipcRenderer.invoke('ndi:stop-companion'),
    getCompanionStatus: () => ipcRenderer.invoke('ndi:get-companion-status'),
    setAutoLaunch: (enabled) => ipcRenderer.invoke('ndi:set-auto-launch', { enabled }),
    getOutputSettings: (outputKey) => ipcRenderer.invoke('ndi:get-output-settings', { outputKey }),
    setOutputEnabled: (outputKey, enabled) => ipcRenderer.invoke('ndi:set-output-enabled', { outputKey, enabled }),
    setSourceName: (outputKey, name) => ipcRenderer.invoke('ndi:set-source-name', { outputKey, name }),
    setResolution: (outputKey, resolution) => ipcRenderer.invoke('ndi:set-resolution', { outputKey, resolution }),
    setCustomResolution: (outputKey, width, height) => ipcRenderer.invoke('ndi:set-custom-resolution', { outputKey, width, height }),
    setFramerate: (outputKey, framerate) => ipcRenderer.invoke('ndi:set-framerate', { outputKey, framerate }),
    onCompanionStatus: (callback) => {
      const channel = 'ndi:companion-status';
      ipcRenderer.removeAllListeners(channel);
      ipcRenderer.on(channel, (_event, status) => callback(status));
      return () => ipcRenderer.removeAllListeners(channel);
    }
  },

  // User Preferences
  preferences: {
    getAll: () => ipcRenderer.invoke('preferences:get-all'),
    getCategory: (category) => ipcRenderer.invoke('preferences:get-category', { category }),
    get: (path) => ipcRenderer.invoke('preferences:get', { path }),
    set: (path, value) => ipcRenderer.invoke('preferences:set', { path, value }),
    saveAll: (preferences) => ipcRenderer.invoke('preferences:save-all', { preferences }),
    resetCategory: (category) => ipcRenderer.invoke('preferences:reset-category', { category }),
    resetAll: () => ipcRenderer.invoke('preferences:reset-all'),
    browseDefaultPath: () => ipcRenderer.invoke('preferences:browse-default-path'),
    getParsingConfig: () => ipcRenderer.invoke('preferences:get-parsing-config'),
    getAutoplayDefaults: () => ipcRenderer.invoke('preferences:get-autoplay-defaults'),
    getAdvancedSettings: () => ipcRenderer.invoke('preferences:get-advanced-settings'),
    getFileHandling: () => ipcRenderer.invoke('preferences:get-file-handling')
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