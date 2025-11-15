import { BrowserWindow, nativeTheme, dialog, app } from 'electron';
import { prewarmCredentials } from './providerCredentials.js';
import { isDev } from './paths.js';
import { startBackend } from './backend.js';
import { createWindow } from './windows.js';
import { checkForUpdates } from './updater.js';
import { getAdminKeyWithRetry } from './adminKey.js';
import { initDisplayManager } from './displayManager.js';
import { performStartupDisplayCheck } from './displayDetection.js';
import { processPendingFile } from './fileHandler.js';

export async function handleMissingAdminKey() {
  const message = 'Lyric Display requires the administrative key to unlock local access.';
  console.error('[Startup] Admin key unavailable after retries; keeping renderer hidden.');

  try {
    dialog.showErrorBox('Admin Key Required', `${message}\n\nRestore the secure secrets store and restart the application.`);
  } catch (error) {
    console.error('[Startup] Failed to present admin key error dialog:', error);
  }

  try {
    if (typeof app.hide === 'function') {
      app.hide();
    }
    app.exitCode = 1;
    app.quit();
  } catch (error) {
    console.error('[Startup] Error during quit:', error);
  }
}

export function prewarmResources() {
  Promise.all([
    import('./lyricsProviders/providers/openHymnal.js').then(mod => mod.loadDataset()),
    prewarmCredentials()
  ]).then(() => {
    console.log('[Startup] Lyrics provider resources pre-warmed');
  }).catch(error => {
    console.warn('[Startup] Failed to pre-warm lyrics resources:', error);
  });
}

/**
 * Setup main window close handler to close output windows
 * @param {BrowserWindow} mainWindow - The main window instance
 */
export function setupMainWindowCloseHandler(mainWindow) {
  mainWindow.on('close', () => {
    console.log('[Startup] Main window closing, shutting down output windows...');
    try {
      const windows = BrowserWindow.getAllWindows();
      const outputRoutes = ['/stage', '/output1', '/output2'];

      windows.forEach(win => {
        if (!win || win.isDestroyed() || win.id === mainWindow.id) return;

        try {
          const url = win.webContents.getURL();
          const isOutputWindow = outputRoutes.some(route => url.includes(route));
          if (isOutputWindow) {
            console.log('[Startup] Closing output window:', url);
            win.close();
          }
        } catch (err) {
          console.warn('[Startup] Error closing output window on main close:', err);
        }
      });
    } catch (error) {
      console.error('[Startup] Error closing output windows on main close:', error);
    }
  });
}

/**
 * Setup native theme handling
 * @param {BrowserWindow} mainWindow - The main window instance
 * @param {Object} menuAPI - Menu API object
 */
export function setupNativeTheme(mainWindow, menuAPI) {
  nativeTheme.themeSource = 'system';
  nativeTheme.on('updated', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      menuAPI.updateDarkModeMenu();
    }
  });
}

/**
 * Handle backend startup error
 * @param {Error} error - The error that occurred
 * @param {Function} requestRendererModal - Modal request function
 * @returns {Promise<BrowserWindow|null>} - The created main window or null
 */
export async function handleBackendStartupError(error, requestRendererModal) {
  console.error('[Startup] Failed to start backend:', error);

  if (error.message === 'PORT_IN_USE') {
    dialog.showErrorBox(
      'Application Already Running',
      'LyricDisplay is already running. Only one instance can run at a time.\n\nPlease close the other instance or check your system tray.'
    );
    app.quit();
    return null;
  }

  const mainWindow = createWindow('/');

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

  return mainWindow;
}

/**
 * Main startup sequence
 * @param {Object} options - Startup options
 * @param {Object} options.menuAPI - Menu API object
 * @param {Function} options.requestRendererModal - Modal request function
 * @param {Function} options.handleDisplayChange - Display change handler
 * @returns {Promise<BrowserWindow>} - The main window instance
 */
export async function performStartupSequence({ menuAPI, requestRendererModal, handleDisplayChange }) {
  try {
    await startBackend();
    console.log('[Startup] Backend started successfully');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const adminKey = await getAdminKeyWithRetry();
    if (!adminKey) {
      await handleMissingAdminKey();
      return null;
    }
    console.log('[Startup] Admin key loaded and cached');

    prewarmResources();

    const mainWindow = createWindow('/');
    menuAPI.createMenu();

    setupMainWindowCloseHandler(mainWindow);

    initDisplayManager(handleDisplayChange);

    await new Promise(resolve => setTimeout(resolve, 1500));

    await performStartupDisplayCheck(requestRendererModal);

    setupNativeTheme(mainWindow, menuAPI);

    setTimeout(() => {
      if (!isDev) checkForUpdates(false);
    }, 2000);

    processPendingFile(mainWindow);

    return mainWindow;

  } catch (error) {
    return await handleBackendStartupError(error, requestRendererModal);
  }
}