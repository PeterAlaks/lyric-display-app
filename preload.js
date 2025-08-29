const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  toggleDarkMode: () => ipcRenderer.invoke('toggle-dark-mode'),
  getDarkMode: () => ipcRenderer.invoke('get-dark-mode'),
  setDarkMode: (isDark) => ipcRenderer.invoke('set-dark-mode', isDark),
  
  // Listen for dark mode toggle from menu
  onDarkModeToggle: (callback) => {
    ipcRenderer.on('toggle-dark-mode', callback);
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Store API for menu to access current state
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