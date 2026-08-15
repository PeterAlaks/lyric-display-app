const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getUpdaterState: () => ipcRenderer.invoke('updater:get-state'),
  onUpdaterState: (callback) => {
    const listener = (_event, state) => callback?.(state);
    ipcRenderer.on('updater:state-changed', listener);
    return () => ipcRenderer.removeListener('updater:state-changed', listener);
  },
  hideUpdateProgressWindow: () => ipcRenderer.invoke('updater:hide-progress'),
  requestUpdateDownload: () => ipcRenderer.invoke('updater:download'),
  requestInstallAndRestart: () => ipcRenderer.invoke('updater:install'),
});
