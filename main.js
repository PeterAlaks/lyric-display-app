import { app, BrowserWindow, dialog, Menu } from 'electron';
import { initModalBridge, requestRendererModal } from './main/modalBridge.js';
import { isDev } from './main/paths.js';
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
import * as userPreferences from './main/userPreferences.js';

if (!isDev && process.env.FORCE_COMPATIBILITY) {
  app.commandLine.appendSwitch('--disable-gpu-sandbox');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
}

let mainWindow = null;

const hasLock = setupSingleInstanceLock((commandLine) => {

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

if (process.platform === 'win32' && process.argv.length >= 2) {
  const filePath = extractFilePathFromArgs(process.argv);
  if (filePath) {
    setPendingFile(filePath);
    console.log('[Main] App launched with file (Windows):', filePath);
  }
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

registerIpcHandlers({
  getMainWindow,
  openInAppBrowser,
  updateDarkModeMenu: menuAPI.updateDarkModeMenu,
  updateUndoRedoState: menuAPI.updateUndoRedoState,
  checkForUpdates,
  requestRendererModal
});
registerInAppBrowserIpc();

app.whenReady().then(async () => {
  try { Menu.setApplicationMenu(null); } catch { }
  createLoadingWindow();

  mainWindow = await performStartupSequence({
    menuAPI,
    requestRendererModal,
    handleDisplayChange: (changeType, display) =>
      handleDisplayChange(changeType, display, requestRendererModal)
  });

  if (mainWindow) {
    let isShowingCloseConfirmation = false;

    mainWindow.on('close', async (event) => {

      if (app.isQuitting) {
        return;
      }

      if (isShowingCloseConfirmation) {
        event.preventDefault();
        return;
      }

      // Check if confirmOnClose is enabled in user preferences
      const confirmOnClose = userPreferences.getPreference('general.confirmOnClose') ?? true;
      
      if (!confirmOnClose) {
        // Skip confirmation, just close
        app.isQuitting = true;
        try {
          const windows = BrowserWindow.getAllWindows();
          windows.forEach(win => {
            if (!win || win.isDestroyed() || win.id === mainWindow.id) return;
            try { win.destroy(); } catch { }
          });
        } catch { }
        mainWindow.destroy();
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
            fallback: async () => {
              const fallbackChoice = await dialog.showMessageBox(mainWindow, {
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

            windows.forEach(win => {
              if (!win || win.isDestroyed() || win.id === mainWindow.id) return;

              try {
                console.log('[Main] Closing window:', win.getTitle());
                win.destroy();
              } catch (err) {
                console.warn('[Main] Error closing window:', err);
              }
            });
          } catch (error) {
            console.error('[Main] Error closing windows:', error);
          }

          mainWindow.destroy();
        } else {
          isShowingCloseConfirmation = false;
        }
      } catch (error) {
        console.error('Error showing close confirmation:', error);
        isShowingCloseConfirmation = false;
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow('/');
    }
  });
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
  if (process.platform !== 'darwin') {
    performCleanup();
    app.quit();
  }
});

app.on('before-quit', (event) => {
  app.isQuitting = true;
  performCleanup();
});

app.on('will-quit', () => {
  performCleanup();
});