import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onProgressUpdate: (callback) => {
    // Remove any existing listeners first
    ipcRenderer.removeAllListeners('progress-update');
    // Add the new listener
    ipcRenderer.on('progress-update', (event, progress) => {
      console.log('Progress received in preload:', progress);
      callback(progress);
    });
  }
});

// Debug: Log when preload script loads
console.log('Progress preload script loaded');