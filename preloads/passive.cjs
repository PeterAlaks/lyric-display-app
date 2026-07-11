const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  tokenStore: {
    get: (payload) => ipcRenderer.invoke('token-store:get', payload),
    set: (payload) => ipcRenderer.invoke('token-store:set', payload),
    clear: (payload) => ipcRenderer.invoke('token-store:clear', payload),
  },
  windowControls: {
    reload: () => ipcRenderer.invoke('window:reload'),
  },
  preferences: {
    getAdvancedSettings: () => ipcRenderer.invoke('preferences:get-advanced-settings'),
  },
});
