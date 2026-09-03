import { BrowserWindow, nativeTheme, dialog, app } from 'electron';
import { registerLyricVideoMediaProtocol } from './lyricVideoMediaProtocol.js';
import { prewarmCredentials } from './providerCredentials.js';
import { isDev } from './paths.js';
import { startBackend } from './backend.js';
import { createWindow } from './windows.js';
import { checkForUpdates, setUpdateSessionActive } from './updater.js';
import { getAdminKeyWithRetry } from './adminKey.js';
import { initDisplayManager } from './displayManager.js';
import { performStartupDisplayCheck } from './displayDetection.js';
import { processPendingFile } from './fileHandler.js';
import { updateLoadingStatus, closeLoadingWindow } from './loadingWindow.js';
import { preloadSystemFonts } from './systemFonts.js';
import { getSavedDarkMode } from './themePreferences.js';
import { initializeExternalControl, registerExternalControlIPC } from './externalControl.js';
import { initializeNdiManager, registerNdiIpcHandlers } from './ndiManager.js';
import * as userPreferences from './userPreferences.js';
import { waitForRendererStartup } from './startupReadiness.js';
import { DEFAULT_BACKEND_PORT, normalizeBackendPort } from '../shared/backendPort.js';
import { findAvailableBackendPort } from './portAvailability.js';

const isOutputRoute = (url) => /(?:#\/|\/)(stage|time|output\d+)(?:\?|$)/i.test(String(url || ''));

export async function handleMissingAdminKey() {
  const message = 'LyricDisplay requires the administrative key to unlock local access.';
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

      windows.forEach(win => {
        if (!win || win.isDestroyed() || win.id === mainWindow.id) return;

        try {
          const url = win.webContents.getURL();
          const isOutputWindow = isOutputRoute(url);
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
export async function handleBackendStartupError(error, requestRendererModal, { headless = false } = {}) {
  console.error('[Startup] Failed to start backend:', error);

  if (error?.code === 'PORT_IN_USE' || error?.message === 'PORT_IN_USE') {
    const occupiedPort = normalizeBackendPort(
      error?.port ?? userPreferences.getPreference('advanced.serverPort'),
      DEFAULT_BACKEND_PORT,
    );

    if (!app.isPackaged) {
      dialog.showErrorBox(
        'Server Port Unavailable',
        `LyricDisplay could not start because port ${occupiedPort} is already in use. Close the application or service using that port, then restart LyricDisplay.`,
      );
      app.quit();
      return null;
    }

    const recovery = await findAvailableBackendPort({
      preferredPort: DEFAULT_BACKEND_PORT,
      excludedPorts: [occupiedPort],
    });
    if (!recovery.success) {
      dialog.showErrorBox(
        'Server Port Unavailable',
        `LyricDisplay could not start because port ${occupiedPort} is already in use, and an available recovery port could not be found. Close the conflicting application or service, then restart LyricDisplay.`,
      );
      app.quit();
      return null;
    }

    const recoveryPort = recovery.port;
    const choice = await dialog.showMessageBox({
      type: 'warning',
      title: 'Configured Port Unavailable',
      message: `Port ${occupiedPort} is already in use.`,
      detail: `LyricDisplay has not removed any of your data. Close the other application or service and try again, or switch LyricDisplay to the available port ${recoveryPort}.`,
      buttons: ['Quit', `Switch to Port ${recoveryPort} and Restart`],
      defaultId: 1,
      cancelId: 0,
      noLink: true,
    });

    if (choice.response === 1) {
      const saveResult = userPreferences.setPreference('advanced.serverPort', recoveryPort);
      if (!saveResult.success) {
        dialog.showErrorBox(
          'Port Recovery Failed',
          saveResult.error || `LyricDisplay could not save recovery port ${recoveryPort}.`,
        );
        app.quit();
        return null;
      }
      app.relaunch();
    }
    app.quit();
    return null;
  }

  if (headless) {
    try {
      dialog.showErrorBox(
        'Startup Error',
        'LyricDisplay could not start its backend service in headless mode. Check the application logs and restart LyricDisplay.'
      );
    } catch {
    }
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
export async function performStartupSequence({ menuAPI, requestRendererModal, handleDisplayChange, headless = false, obsDockPairingToken = null }) {
  registerLyricVideoMediaProtocol();
  try {
    updateLoadingStatus('Starting backend server');
    await startBackend({
      obsDockPairingToken,
      allowLocalObsDockAuth: headless,
      parsingConfig: userPreferences.getParsingConfig(),
    });
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

    updateLoadingStatus('Initializing NDI manager');
    registerNdiIpcHandlers();
    registerExternalControlIPC();

    if (headless) {
      initDisplayManager(handleDisplayChange);
      initializeNdiManager();
      console.log('[Startup] Headless mode initialized without creating renderer windows');
      return null;
    }

    const mainWindow = createWindow('/', { deferShow: true });
    const rendererStartupPromise = waitForRendererStartup(mainWindow.webContents);

    setupMainWindowCloseHandler(mainWindow);

    updateLoadingStatus('Detecting displays');
    initDisplayManager(handleDisplayChange);
    await new Promise(resolve => setTimeout(resolve, 600));

    setupNativeTheme(mainWindow, menuAPI);

    // Initialize external control (MIDI/OSC)
    updateLoadingStatus('Initializing external control');
    initializeExternalControl({ getMainWindow: () => mainWindow }).catch(err => {
      console.warn('[Startup] External control initialization warning:', err.message);
    });
    await new Promise(resolve => setTimeout(resolve, 300));

    // Initialize NDI manager (handlers already registered above)
    initializeNdiManager();
    await new Promise(resolve => setTimeout(resolve, 200));

    updateLoadingStatus('Establishing secure session');
    await new Promise(resolve => setTimeout(resolve, 500));

    const rendererStartup = await rendererStartupPromise;
    if (rendererStartup.outcome === 'ready') {
      console.log('[Startup] Renderer readiness confirmed', {
        waitMs: rendererStartup.elapsedMs,
        ...rendererStartup.payload,
      });
    } else {
      console.warn('[Startup] Renderer readiness wait ended without confirmation', rendererStartup);
    }

    if (mainWindow.isDestroyed()) {
      closeLoadingWindow();
      return null;
    }

    updateLoadingStatus('Opening control panel');
    try {
      if (typeof mainWindow.showInactive === 'function') {
        mainWindow.showInactive();
      } else {
        mainWindow.show();
      }
    } catch (error) {
      console.warn('[Startup] Failed to reveal main window:', error);
    }
    closeLoadingWindow();

    const focusTimer = setTimeout(() => {
      try {
        if (!mainWindow.isDestroyed()) mainWindow.focus();
      } catch {
      }
    }, 350);
    focusTimer.unref?.();

    setTimeout(() => {
      const autoCheck = userPreferences.getPreference('general.autoCheckForUpdates') ?? true;
      const liveSession = userPreferences.getPreference('general.liveSafetyMode') ?? false;
      setUpdateSessionActive(liveSession);
      if (!isDev && autoCheck) checkForUpdates(false);
    }, 2000);

    setTimeout(() => {
      performStartupDisplayCheck(requestRendererModal);
    }, 3000);

    processPendingFile(mainWindow);

    return mainWindow;

  } catch (error) {
    closeLoadingWindow();
    return await handleBackendStartupError(error, requestRendererModal, { headless });
  }
}
