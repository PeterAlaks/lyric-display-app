import { app, BrowserWindow, nativeTheme } from 'electron';
import path from 'path';
import { initModalBridge, requestRendererModal } from './main/modalBridge.js';
import { isDev } from './main/paths.js';
import { startBackend, stopBackend } from './main/backend.js';
import { createWindow } from './main/windows.js';
import { checkForUpdates } from './main/updater.js';
import { registerIpcHandlers } from './main/ipc.js';
import { openInAppBrowser, registerInAppBrowserIpc } from './main/inAppBrowser.js';
import { makeMenuAPI } from './main/menu.js';
import { getAdminKeyWithRetry } from './main/adminKey.js';

let mainWindow = null;


async function handleMissingAdminKey() {
  const message = 'Lyric Display requires the administrative key to unlock local access.';
  console.error('[Main] Admin key unavailable after retries; keeping renderer hidden.');
  try {
    const { dialog } = await import('electron');
    dialog.showErrorBox('Admin Key Required', `${message}\n\nRestore the secure secrets store and restart the application.`);
  } catch (error) {
    console.error('Failed to present admin key error dialog:', error);
  }
  try {
    if (typeof app.hide === 'function') {
      app.hide();
    }
  } catch {}
  app.exitCode = 1;
  app.quit();
}

// Optional compatibility flags in production only when requested
if (!isDev && process.env.FORCE_COMPATIBILITY) {
  app.commandLine.appendSwitch('--disable-gpu-sandbox');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
}

const getMainWindow = () => mainWindow;
initModalBridge(getMainWindow);
const menuAPI = makeMenuAPI({
  getMainWindow,
  createWindow: (route) => {
    const win = createWindow(route);
    if (route === '/') mainWindow = win;
    return win;
  },
  checkForUpdates,
  showInAppModal: requestRendererModal,
});

registerIpcHandlers({ getMainWindow, openInAppBrowser, updateDarkModeMenu: menuAPI.updateDarkModeMenu });
registerInAppBrowserIpc();

app.whenReady().then(async () => {
  try {
    await startBackend();
    console.log('Backend started successfully');
    // Additional delay to ensure server is fully listening on port 4000
    await new Promise(resolve => setTimeout(resolve, 2000));
    const adminKey = await getAdminKeyWithRetry();
    if (!adminKey) {
      await handleMissingAdminKey();
      return;
    }

    console.log('Admin key loaded and cached');

    mainWindow = createWindow('/');
    menuAPI.createMenu();

    // Initialize native theme based on system preference
    nativeTheme.themeSource = 'system';
    nativeTheme.on('updated', () => { if (mainWindow && !mainWindow.isDestroyed()) menuAPI.updateDarkModeMenu(); });

    // Start update check after everything is ready
    setTimeout(() => { if (!isDev) checkForUpdates(false); }, 2000);
  } catch (error) {
    console.error('Failed to start backend:', error);
    // Create window anyway but with error handling
    mainWindow = createWindow('/');
    menuAPI.createMenu();
    const { dialog } = await import('electron');
    await requestRendererModal({
      title: 'Startup Error',
      description: 'There was an issue starting the backend server. Some features may not work properly.',
      variant: 'error',
      dismissible: true,
      actions: [
        { label: 'OK', value: { response: 0 }, variant: 'destructive' },
      ],
    }, {
      fallback: () => {
        dialog.showErrorBox('Startup Error', 'There was an issue starting the backend server. Some features may not work properly.');
        return { response: 0 };
      },
      timeout: 12000,
    }).catch(() => {
      dialog.showErrorBox('Startup Error', 'There was an issue starting the backend server. Some features may not work properly.');
    });
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow('/');
    }
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('before-quit', () => {
  try { stopBackend(); } catch { }
});
