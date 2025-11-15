import { app, BrowserWindow } from 'electron';
import { initModalBridge, requestRendererModal } from './main/modalBridge.js';
import { isDev } from './main/paths.js';
import { createWindow } from './main/windows.js';
import { checkForUpdates } from './main/updater.js';
import { registerIpcHandlers } from './main/ipc.js';
import { openInAppBrowser, registerInAppBrowserIpc } from './main/inAppBrowser.js';
import { makeMenuAPI } from './main/menu.js';
import { setupSingleInstanceLock } from './main/singleInstance.js';
import { handleFileOpen, extractFilePathFromArgs, setPendingFile } from './main/fileHandler.js';
import { handleDisplayChange } from './main/displayDetection.js';
import { performStartupSequence } from './main/startup.js';
import { performCleanup } from './main/cleanup.js';

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
      handleFileOpen(filePath, mainWindow);
    }
  }

  if (mainWindow) {
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
  updateDarkModeMenu: menuAPI.updateDarkModeMenu
});
registerInAppBrowserIpc();

app.whenReady().then(async () => {
  mainWindow = await performStartupSequence({
    menuAPI,
    requestRendererModal,
    handleDisplayChange: (changeType, display) =>
      handleDisplayChange(changeType, display, requestRendererModal)
  });

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
    app.quit();
  }
});

app.on('before-quit', () => {
  performCleanup();
});