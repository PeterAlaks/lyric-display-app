import { BrowserWindow } from 'electron';
import { stopBackend } from './backend.js';
import { cleanupDisplayManager } from './displayManager.js';

export function closeOutputWindows() {
  try {
    const windows = BrowserWindow.getAllWindows();
    const outputRoutes = ['/stage', '/output1', '/output2'];

    windows.forEach(win => {
      if (!win || win.isDestroyed()) return;
      try {
        const url = win.webContents.getURL();
        const isOutputWindow = outputRoutes.some(route => url.includes(route));
        if (isOutputWindow) {
          console.log('[Cleanup] Closing output window on quit');
          win.close();
        }
      } catch (err) {
        console.warn('[Cleanup] Error closing window on quit:', err);
      }
    });
  } catch (error) {
    console.error('[Cleanup] Error closing output windows:', error);
  }
}

export function performCleanup() {
  try {
    stopBackend();
  } catch (error) {
    console.error('[Cleanup] Error stopping backend:', error);
  }

  try {
    cleanupDisplayManager();
  } catch (error) {
    console.error('[Cleanup] Error cleaning up display manager:', error);
  }

  closeOutputWindows();
}