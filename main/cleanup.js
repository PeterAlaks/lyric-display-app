import { BrowserWindow } from 'electron';
import { stopBackend } from './backend.js';
import { cleanupDisplayManager } from './displayManager.js';
import { getLoadingWindow } from './loadingWindow.js';
import { destroyExternalControl } from './externalControl.js';
import { cleanupNdiManager } from './ndiManager.js';

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

let isCleaningUp = false;

export function performCleanup() {
  if (isCleaningUp) {
    console.log('[Cleanup] Already cleaning up, skipping duplicate call');
    return;
  }

  isCleaningUp = true;
  console.log('[Cleanup] Starting cleanup process');

  try {
    const loadingWindow = getLoadingWindow();
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      console.log('[Cleanup] Closing loading window');
      loadingWindow.destroy();
    }
  } catch (error) {
    console.error('[Cleanup] Error closing loading window:', error);
  }

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

  try {
    destroyExternalControl();
  } catch (error) {
    console.error('[Cleanup] Error destroying external control:', error);
  }

  try {
    cleanupNdiManager();
  } catch (error) {
    console.error('[Cleanup] Error cleaning up NDI manager:', error);
  }

  closeOutputWindows();

  console.log('[Cleanup] Cleanup process completed');
}