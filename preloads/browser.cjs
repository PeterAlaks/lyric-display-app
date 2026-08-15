const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  browserBack: () => ipcRenderer.send('browser-nav', 'back'),
  browserForward: () => ipcRenderer.send('browser-nav', 'forward'),
  browserReload: () => ipcRenderer.send('browser-nav', 'reload'),
  browserNavigate: (url) => ipcRenderer.send('browser-nav', 'navigate', url),
  browserOpenExternal: () => ipcRenderer.send('browser-open-external'),
  onBrowserLocation: (callback) => {
    const listener = (_event, url) => callback?.(url);
    ipcRenderer.on('browser-location', listener);
    return () => ipcRenderer.removeListener('browser-location', listener);
  },
});
