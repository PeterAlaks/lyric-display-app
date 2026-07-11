const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onLoadingStatus: (callback) => {
    const listener = (_event, status) => callback?.(status);
    ipcRenderer.on('loading-status', listener);
    return () => ipcRenderer.removeListener('loading-status', listener);
  },
});
