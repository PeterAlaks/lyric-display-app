import { app, BrowserWindow, nativeTheme } from 'electron';
import path from 'path';
import { prewarmCredentials } from './main/providerCredentials.js';
import { initModalBridge, requestRendererModal } from './main/modalBridge.js';
import { isDev } from './main/paths.js';
import { startBackend, stopBackend } from './main/backend.js';
import { createWindow } from './main/windows.js';
import { checkForUpdates } from './main/updater.js';
import { registerIpcHandlers } from './main/ipc.js';
import { openInAppBrowser, registerInAppBrowserIpc } from './main/inAppBrowser.js';
import { makeMenuAPI } from './main/menu.js';
import { getAdminKeyWithRetry } from './main/adminKey.js';
import { initDisplayManager, cleanupDisplayManager } from './main/displayManager.js';

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Main] Another instance is already running. Exiting...');
  app.quit();
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

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
  } catch { }
  app.exitCode = 1;
  app.quit();
}

if (!isDev && process.env.FORCE_COMPATIBILITY) {
  app.commandLine.appendSwitch('--disable-gpu-sandbox');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
}

const getMainWindow = () => mainWindow;
initModalBridge(getMainWindow);

async function showDisplayDetectionModal(display, isStartupCheck = false) {
  if (!display || !display.id) return;

  try {
    const { getDisplayAssignment } = await import('./main/displayManager.js');
    const assignment = getDisplayAssignment(display.id);

    if (assignment) {
      console.log(`[Main] Skipping modal for display ${display.id}, it already has assignment: ${assignment.outputKey}`);
      return;
    }

    const title = isStartupCheck ? 'External Display Detected' : 'New Display Detected';
    const headerDesc = isStartupCheck
      ? 'An external display is connected. Configure how to use it.'
      : 'Configure how to use the newly connected display';

    const displayInfo = {
      id: display.id,
      name: display.name || display.label || `Display ${display.id}`,
      bounds: display.bounds
    };

    console.log(`[Main] Showing display detection modal for ${display.id} (${displayInfo.name})`);

    await requestRendererModal(
      {
        title: title,
        headerDescription: headerDesc,
        component: 'DisplayDetection',
        variant: 'info',
        size: 'lg',
        dismissible: true,
        actions: [],
        displayInfo: displayInfo
      },
      {
        timeout: 60000,
        fallback: () => {
          console.log('[Main] Display detection modal fallback');
          return { dismissed: true };
        }
      }
    );
  } catch (error) {
    console.error('[Main] Error showing display detection modal:', error);
  }
}

const handleDisplayChange = async (changeType, display) => {
  if (changeType === 'added') {
    console.log('[Main] New display detected via listener:', display.id);

    await new Promise(resolve => setTimeout(resolve, 1000));

    await showDisplayDetectionModal(display, false);
  }
};

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
    await new Promise(resolve => setTimeout(resolve, 2000));
    const adminKey = await getAdminKeyWithRetry();
    if (!adminKey) {
      await handleMissingAdminKey();
      return;
    }

    console.log('Admin key loaded and cached');

    Promise.all([
      import('./main/lyricsProviders/providers/openHymnal.js').then(mod => mod.loadDataset()),
      prewarmCredentials()
    ]).then(() => {
      console.log('[Startup] Lyrics provider resources pre-warmed');
    }).catch(error => {
      console.warn('[Startup] Failed to pre-warm lyrics resources:', error);
    });

    mainWindow = createWindow('/');
    menuAPI.createMenu();

    mainWindow.on('close', () => {
      console.log('[Main] Main window closing, shutting down output windows...');
      try {
        const windows = BrowserWindow.getAllWindows();
        const outputRoutes = ['/stage', '/output1', '/output2'];

        windows.forEach(win => {
          if (!win || win.isDestroyed() || win.id === mainWindow.id) return;

          try {
            const url = win.webContents.getURL();
            const isOutputWindow = outputRoutes.some(route => url.includes(route));
            if (isOutputWindow) {
              console.log('[Main] Closing output window:', url);
              win.close();
            }
          } catch (err) {
            console.warn('Error closing output window on main close:', err);
          }
        });
      } catch (error) {
        console.error('Error closing output windows on main close:', error);
      }
    });

    initDisplayManager(handleDisplayChange);

    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const { getAllDisplays } = await import('./main/displayManager.js');
      const allDisplays = getAllDisplays();
      const externalDisplays = allDisplays.filter(d => !d.primary);

      if (externalDisplays.length > 0) {
        console.log(`[Main] Startup check: Found ${externalDisplays.length} external display(s).`);

        await showDisplayDetectionModal(externalDisplays[0], true);
      } else {
        console.log('[Main] Startup check: No external displays found.');
      }
    } catch (error) {
      console.error('[Main] Error during startup display check:', error);
    }

    nativeTheme.themeSource = 'system';
    nativeTheme.on('updated', () => { if (mainWindow && !mainWindow.isDestroyed()) menuAPI.updateDarkModeMenu(); });

    setTimeout(() => { if (!isDev) checkForUpdates(false); }, 2000);
  } catch (error) {
    console.error('Failed to start backend:', error);

    if (error.message === 'PORT_IN_USE') {
      const { dialog } = await import('electron');
      dialog.showErrorBox(
        'Application Already Running',
        'LyricDisplay is already running. Only one instance can run at a time.\n\nPlease close the other instance or check your system tray.'
      );
      app.quit();
      return;
    }

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
  try {
    stopBackend();
  } catch (error) {
    console.error('Error stopping backend:', error);
  }

  try {
    cleanupDisplayManager();
  } catch (error) {
    console.error('Error cleaning up display manager:', error);
  }

  try {
    const windows = BrowserWindow.getAllWindows();
    const outputRoutes = ['/stage', '/output1', '/output2'];

    windows.forEach(win => {
      if (!win || win.isDestroyed()) return;
      try {
        const url = win.webContents.getURL();
        const isOutputWindow = outputRoutes.some(route => url.includes(route));
        if (isOutputWindow) {
          console.log('[Main] Closing output window on quit');
          win.close();
        }
      } catch (err) {
        console.warn('Error closing window on quit:', err);
      }
    });
  } catch (error) {
    console.error('Error closing output windows:', error);
  }
});