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
import { updateLoadingStatus, closeLoadingWindow } from './loadingWindow.js';
import { preloadSystemFonts } from './systemFonts.js';
import { getSavedDarkMode } from './themePreferences.js';

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
    prewarmCredentials(),
    preloadSystemFonts()
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
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      return;
    }

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
    updateLoadingStatus('Starting backend server');
    await startBackend();
    console.log('[Startup] Backend started successfully');
    await new Promise(resolve => setTimeout(resolve, 1000));

    updateLoadingStatus('Loading security credentials');
    const adminKey = await getAdminKeyWithRetry();
    if (!adminKey) {
      closeLoadingWindow();
      await handleMissingAdminKey();
      return null;
    }
    console.log('[Startup] Admin key loaded and cached');

    updateLoadingStatus('Loading lyrics providers');
    prewarmResources();
    await new Promise(resolve => setTimeout(resolve, 800));

    updateLoadingStatus('Preparing control panel');

    const savedDarkMode = getSavedDarkMode();
    if (typeof savedDarkMode === 'boolean') {
      nativeTheme.themeSource = savedDarkMode ? 'dark' : 'light';
    }

    const mainWindow = createWindow('/');
    mainWindow.webContents.once('did-finish-load', () => {
      try {
        menuAPI.updateDarkModeMenu();
      } catch (error) {
        console.warn('[Startup] Failed to sync dark mode after load:', error);
      }
    });
    menuAPI.createMenu();

    setupMainWindowCloseHandler(mainWindow);

    updateLoadingStatus('Detecting displays');
    initDisplayManager(handleDisplayChange);
    await new Promise(resolve => setTimeout(resolve, 600));

    setupNativeTheme(mainWindow, menuAPI);

    updateLoadingStatus('Finalizing');
    await new Promise(resolve => setTimeout(resolve, 500));

    closeLoadingWindow();

    setTimeout(() => {
      if (!isDev) checkForUpdates(false);
    }, 2000);

    setTimeout(() => {
      performStartupDisplayCheck(requestRendererModal);
    }, 3000);

    processPendingFile(mainWindow);

    return mainWindow;

  } catch (error) {
    closeLoadingWindow();
    return await handleBackendStartupError(error, requestRendererModal);
  }
}