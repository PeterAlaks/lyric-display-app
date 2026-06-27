import { app, BrowserWindow, dialog, Menu } from 'electron';
import './main/appIdentity.js';
import { registerLyricVideoMediaScheme } from './main/lyricVideoMediaProtocol.js';
import { initModalBridge, requestRendererModal } from './main/modalBridge.js';
import { appRoot, isDev } from './main/paths.js';
import { createWindow } from './main/windows.js';
import { checkForUpdates } from './main/updater.js';
import { registerIpcHandlers } from './main/ipc.js';
import { openInAppBrowser, registerInAppBrowserIpc } from './main/inAppBrowser.js';
import { makeMenuAPI } from './main/menuBridge.js';
import { setupSingleInstanceLock } from './main/singleInstance.js';
import { handleFileOpen, extractFilePathFromArgs, setPendingFile } from './main/fileHandler.js';
import { handleDisplayChange } from './main/displayDetection.js';
import { performStartupSequence } from './main/startup.js';
import { performCleanup } from './main/cleanup.js';
import { createLoadingWindow } from './main/loadingWindow.js';
import { registerObsDockPairingToken, setBackendMessageHandler } from './main/backend.js';
import { relaunchInDesktopMode, relaunchInObsDockHeadlessMode } from './main/obsDockStartup.js';
import * as userPreferences from './main/userPreferences.js';
import { initFileLogging } from './main/logging.js';
import { createAppTray, destroyAppTray } from './main/tray.js';

const APP_PROTOCOL = 'lyricdisplay';
const DEV_APP_PROTOCOL = 'lyricdisplay-dev';
const APP_PROTOCOLS = [APP_PROTOCOL, DEV_APP_PROTOCOL];

if (!isDev && process.env.FORCE_COMPATIBILITY) {
  app.commandLine.appendSwitch('--disable-gpu-sandbox');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
}

const disableHwAccel = userPreferences.getPreference('advanced.disableHardwareAcceleration') ?? false;
if (disableHwAccel) {
  app.disableHardwareAcceleration();
}

let mainWindow = null;
let menuAPI = null;
let headlessProtocolRelaunchInProgress = false;
const closeConfirmationAttached = new WeakSet();

const extractProtocolUrlFromArgs = (args = []) => (
  args.find((arg) => (
    typeof arg === 'string' &&
    APP_PROTOCOLS.some((protocol) => arg.toLowerCase().startsWith(`${protocol}://`))
  )) || null
);

const getProtocolAction = (protocolUrl) => {
  if (!protocolUrl) return null;
  try {
    const url = new URL(protocolUrl);
    return (url.hostname || url.pathname || '').replace(/^\/+/, '').toLowerCase() || null;
  } catch {
    return null;
  }
};

const getProtocolSearchParam = (protocolUrl, name) => {
  if (!protocolUrl) return null;
  try {
    const url = new URL(protocolUrl);
    return url.searchParams.get(name);
  } catch {
    return null;
  }
};

const initialProtocolUrl = extractProtocolUrlFromArgs(process.argv);
const initialObsDockPairingToken = getProtocolSearchParam(initialProtocolUrl, 'obsPairingToken');
const isHeadlessMode = process.env.LYRICDISPLAY_HEADLESS === '1' ||
  process.argv.includes('--headless') ||
  process.argv.includes('--obs-dock') ||
  getProtocolAction(initialProtocolUrl) === 'start-headless';

const registerProtocolClient = (protocol) => {
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(protocol, process.execPath, [appRoot]);
    } else {
      app.setAsDefaultProtocolClient(protocol);
    }
  } catch (error) {
    console.warn(`[Main] Failed to register ${protocol} protocol:`, error);
  }
};

if (isDev) {
  registerProtocolClient(DEV_APP_PROTOCOL);
} else {
  registerProtocolClient(APP_PROTOCOL);
}

function attachMainWindowLifecycle(win) {
  if (!win || win.isDestroyed() || closeConfirmationAttached.has(win)) {
    return;
  }

  closeConfirmationAttached.add(win);
  let isShowingCloseConfirmation = false;

  if (!isHeadlessMode) {
    win.on('close', async (event) => {

      if (app.isQuitting) {
        return;
      }

      if (isShowingCloseConfirmation) {
        event.preventDefault();
        return;
      }

      const confirmOnClose = userPreferences.getPreference('general.confirmOnClose') ?? true;

      if (!confirmOnClose) {
        app.isQuitting = true;
        try {
          const windows = BrowserWindow.getAllWindows();
          windows.forEach(otherWin => {
            if (!otherWin || otherWin.isDestroyed() || otherWin.id === win.id) return;
            try { otherWin.destroy(); } catch { }
          });
        } catch { }
        win.destroy();
        return;
      }

      event.preventDefault();
      isShowingCloseConfirmation = true;

      try {
        const choice = await requestRendererModal(
          {
            variant: 'warning',
            title: 'Confirm Close',
            size: 'sm',
            actions: [
              { label: 'Cancel', value: 0, variant: 'outline', autoFocus: true },
              { label: 'Close', value: 1, variant: 'destructive' }
            ],
            body: 'Are you sure you want to close LyricDisplay? This will discard any ongoing lyric operations or unsaved changes.',
            dismissible: true,
            allowBackdropClose: false
          },
          {
            timeout: false,
            fallback: async () => {
              const fallbackChoice = await dialog.showMessageBox(win, {
                type: 'question',
                buttons: ['Cancel', 'Close'],
                defaultId: 0,
                cancelId: 0,
                title: 'Confirm Close',
                message: 'Are you sure you want to close LyricDisplay?',
                detail: 'We just want to be sure you mean this, as closing the app will discard any ongoing lyric operations or unsaved changes.'
              });
              return fallbackChoice;
            }
          }
        );

        if (choice.response === 1) {
          app.isQuitting = true;

          try {
            const windows = BrowserWindow.getAllWindows();

            windows.forEach(otherWin => {
              if (!otherWin || otherWin.isDestroyed() || otherWin.id === win.id) return;

              try {
                console.log('[Main] Closing window:', otherWin.getTitle());
                otherWin.destroy();
              } catch (err) {
                console.warn('[Main] Error closing window:', err);
              }
            });
          } catch (error) {
            console.error('[Main] Error closing windows:', error);
          }

          win.destroy();
        } else {
          isShowingCloseConfirmation = false;
        }
      } catch (error) {
        console.error('Error showing close confirmation:', error);
        isShowingCloseConfirmation = false;
      }
    });
  }

  win.on('closed', () => {
    if (mainWindow && mainWindow.id === win.id) {
      mainWindow = null;
    }
  });
}

const forceShowMainWindow = (win) => {
  if (!win || win.isDestroyed()) return false;

  try {
    if (win.isMinimized()) win.restore();
    win.setSkipTaskbar(false);
    win.show();
    if (typeof app.focus === 'function') {
      app.focus({ steal: true });
    }
    win.focus();

    if (process.platform === 'win32') {
      win.setAlwaysOnTop(true, 'screen-saver');
      win.show();
      win.focus();
      setTimeout(() => {
        try {
          if (!win.isDestroyed()) {
            win.setAlwaysOnTop(false);
            win.focus();
          }
        } catch {
        }
      }, 300);
    }

    return true;
  } catch (error) {
    console.warn('[Main] Failed to show main window:', error);
    return false;
  }
};

const openMainWindow = () => {
  if (isHeadlessMode) {
    console.warn('[Main] Refusing to create desktop window from headless Dock Mode; relaunch desktop mode instead');
    return null;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    forceShowMainWindow(mainWindow);
    return mainWindow;
  }

  const win = menuAPI?.createWindow ? menuAPI.createWindow('/') : createWindow('/');
  mainWindow = win;
  attachMainWindowLifecycle(win);
  win.once('ready-to-show', () => {
    forceShowMainWindow(win);
  });
  win.webContents.once('did-finish-load', () => {
    forceShowMainWindow(win);
  });
  return win;
};

const confirmHeadlessRelaunchFromProtocol = async () => {
  if (isHeadlessMode || headlessProtocolRelaunchInProgress) {
    return;
  }

  headlessProtocolRelaunchInProgress = true;

  try {
    const win = openMainWindow();
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }

    const choice = await requestRendererModal({
      title: 'Switch to Dock Mode?',
      description: 'LyricDisplay Dock requested control from OBS.',
      body: 'LyricDisplay will close the desktop window and continue running for the OBS dock. Save any unsaved work before continuing.',
      variant: 'warn',
      size: 'sm',
      actions: [
        { label: 'Cancel', value: 'cancel', variant: 'outline', autoFocus: true },
        { label: 'Switch to Dock Mode', value: 'start-headless', variant: 'destructive' },
      ],
    }, {
      timeout: false,
      fallback: async () => {
        const fallbackChoice = await dialog.showMessageBox({
          type: 'warning',
          buttons: ['Cancel', 'Switch to Dock Mode'],
          defaultId: 0,
          cancelId: 0,
          title: 'Switch to Dock Mode?',
          message: 'LyricDisplay Dock requested control from OBS.',
          detail: 'LyricDisplay will close the desktop window and continue running for the OBS dock. Save any unsaved work before continuing.',
        });
        return fallbackChoice.response === 1 ? 'start-headless' : 'cancel';
      },
    });

    if (choice?.data === 'start-headless') {
      relaunchInObsDockHeadlessMode();
      return;
    }
  } catch (error) {
    console.warn('[Main] Failed to handle LyricDisplay Dock headless protocol request:', error);
  } finally {
    headlessProtocolRelaunchInProgress = false;
  }
};

const handleProtocolLaunch = (protocolUrl) => {
  const action = getProtocolAction(protocolUrl);
  if (!action) return false;

  if (action === 'start-headless') {
    console.log('[Main] Headless start requested by protocol');
    const obsDockPairingToken = getProtocolSearchParam(protocolUrl, 'obsPairingToken');
    if (obsDockPairingToken) {
      registerObsDockPairingToken(obsDockPairingToken);
    }
    if (!isHeadlessMode) {
      confirmHeadlessRelaunchFromProtocol();
    }
    return true;
  }

  if (action === 'open' || action === 'app' || action === 'main' || action === 'obs-dock') {
    if (app.isReady()) {
      openMainWindow();
    } else {
      app.once('ready', openMainWindow);
    }
    return true;
  }

  return false;
};

const hasLock = setupSingleInstanceLock((commandLine) => {
  if (handleProtocolLaunch(extractProtocolUrlFromArgs(commandLine))) {
    return;
  }

  const secondInstanceRequestsDockMode = commandLine.includes('--headless') || commandLine.includes('--obs-dock');
  if (secondInstanceRequestsDockMode) {
    if (!isHeadlessMode) {
      confirmHeadlessRelaunchFromProtocol();
    }
    return;
  }

  if (commandLine.length >= 2) {
    const filePath = extractFilePathFromArgs(commandLine);
    if (filePath) {
      console.log('[Main] Second instance opened with file:', filePath);
      if (mainWindow && !mainWindow.isDestroyed()) {
        handleFileOpen(filePath, mainWindow);
      }
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

if (!hasLock) {
  process.exit(0);
}

initFileLogging();
registerLyricVideoMediaScheme();

if (process.platform === 'win32' && process.argv.length >= 2) {
  const filePath = extractFilePathFromArgs(process.argv);
  if (filePath) {
    setPendingFile(filePath);
    console.log('[Main] App launched with file (Windows):', filePath);
  }
}

const getMainWindow = () => mainWindow;
initModalBridge(getMainWindow);

menuAPI = makeMenuAPI({
  getMainWindow,
  createWindow: (route) => {
    const win = createWindow(route);
    if (route === '/') mainWindow = win;
    return win;
  },
  checkForUpdates,
  showInAppModal: requestRendererModal,
});

registerIpcHandlers({
  getMainWindow,
  openInAppBrowser,
  updateDarkModeMenu: menuAPI.updateDarkModeMenu,
  updateUndoRedoState: menuAPI.updateUndoRedoState,
  checkForUpdates,
  requestRendererModal
});
registerInAppBrowserIpc();

setBackendMessageHandler((message) => {
  if (message?.type === 'switch-to-desktop-mode') {
    if (isHeadlessMode) {
      console.log('[Main] Desktop mode relaunch requested from Dock Mode');
      setTimeout(() => {
        relaunchInDesktopMode();
      }, 1000);
      return { success: true };
    }

    const win = openMainWindow();
    forceShowMainWindow(win);
    return {
      success: Boolean(win && !win.isDestroyed()),
    };
  }

  if (message?.type === 'switch-to-dock-mode') {
    confirmHeadlessRelaunchFromProtocol();
  }

  if (message?.type === 'quit-app') {
    console.log('[Main] Quit requested from app control');
    setTimeout(() => {
      app.isQuitting = true;
      app.quit();
    }, 250);
    return { success: true };
  }
});

app.whenReady().then(async () => {
  try { Menu.setApplicationMenu(null); } catch { }
  if (!isHeadlessMode) {
    createLoadingWindow();
  }

  mainWindow = await performStartupSequence({
    menuAPI,
    requestRendererModal,
    handleDisplayChange: (changeType, display) =>
      handleDisplayChange(changeType, display, requestRendererModal),
    headless: isHeadlessMode,
    obsDockPairingToken: initialObsDockPairingToken
  });

  if (mainWindow) {
    attachMainWindowLifecycle(mainWindow);
  }

  if (isHeadlessMode || userPreferences.getPreference('general.minimizeToTray')) {
    createAppTray({
      isHeadlessMode,
      openMainWindow: isHeadlessMode ? () => relaunchInDesktopMode() : openMainWindow,
      quitApp: () => {
        app.isQuitting = true;
        app.quit();
      },
    });
  }

  if (initialProtocolUrl && getProtocolAction(initialProtocolUrl) !== 'start-headless') {
    handleProtocolLaunch(initialProtocolUrl);
  }

  app.on('activate', function () {
    if (!isHeadlessMode && BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
    }
  });
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolLaunch(url);
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  console.log('[Main] macOS open-file event:', filePath);

  if (mainWindow && !mainWindow.isDestroyed()) {
    handleFileOpen(filePath, mainWindow);
  } else {
    setPendingFile(filePath);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !isHeadlessMode) {
    performCleanup();
    app.quit();
  }
});

app.on('before-quit', (event) => {
  app.isQuitting = true;
  performCleanup();
});

app.on('will-quit', () => {
  destroyAppTray();
  performCleanup();
});
