import { BrowserWindow } from 'electron';
import { stopBackend } from './backend.js';
import { cleanupDisplayManager } from './displayManager.js';
import { getLoadingWindow } from './loadingWindow.js';
import { destroyExternalControl } from './externalControl.js';
import { cleanupNdiManager } from './ndiManager.js';
import { stopObsDockDevServer } from './devServer.js';
import { cleanupFileNavigator } from './fileNavigator.js';

const isOutputRoute = (url) => /(?:#\/|\/)(stage|time|output\d+)(?:\?|$)/i.test(String(url || ''));

export function closeOutputWindows() {
  try {
    const windows = BrowserWindow.getAllWindows();

    windows.forEach(win => {
      if (!win || win.isDestroyed()) return;
      try {
        const url = win.webContents.getURL();
        const isOutputWindow = isOutputRoute(url);
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
let cleanupPromise = null;

export function performCleanup() {
  if (isCleaningUp) {
    return cleanupPromise || Promise.resolve();
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

  let ndiCleanupPromise = Promise.resolve();
  try {
    ndiCleanupPromise = Promise.resolve(cleanupNdiManager());
  } catch (error) {
    console.error('[Cleanup] Error cleaning up NDI manager:', error);
  }

  try {
    stopObsDockDevServer();
  } catch (error) {
    console.error('[Cleanup] Error stopping LyricDisplay Dock dev server:', error);
  }

  try {
    cleanupFileNavigator();
  } catch (error) {
    console.error('[Cleanup] Error cleaning up file navigator:', error);
  }

  closeOutputWindows();

  cleanupPromise = ndiCleanupPromise
    .catch((error) => {
      console.error('[Cleanup] Error waiting for NDI manager cleanup:', error);
    })
    .finally(() => {
      console.log('[Cleanup] Cleanup process completed');
    });
  return cleanupPromise;
}
