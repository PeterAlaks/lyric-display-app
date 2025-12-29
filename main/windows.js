import { BrowserWindow, shell } from 'electron';
import path from 'path';
import { isDev, resolveProductionPath, appRoot } from './paths.js';

function attachWindowStateEvents(win) {
  const sendState = () => {
    try {
      if (win && !win.isDestroyed()) {
        win.webContents.send('window-state', {
          isMaximized: win.isMaximized(),
          isFullScreen: win.isFullScreen(),
          isFocused: win.isFocused()
        });
      }
    } catch { }
  };

  ['ready-to-show', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'focus', 'blur', 'resized'].forEach(evt => {
    win.on(evt, sendState);
  });

  sendState();
}

export function createWindow(route = '/') {
  const isControlWindow = route === '/' || route.startsWith('/new-song');
  const defaultBackground = isDev ? '#ffffff' : '#f9fafb';

  const win = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 1000,
    minHeight: 650,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolveProductionPath('preload.js')
    },
    show: false,
    icon: path.join(appRoot, 'public', 'favicon.ico'),
    frame: isControlWindow ? false : true,
    transparent: false,
    backgroundColor: defaultBackground,
    titleBarStyle: isControlWindow && process.platform === 'darwin' ? 'hiddenInset' : 'default',
    thickFrame: true,
    autoHideMenuBar: true,
  });

  if (isControlWindow) {
    attachWindowStateEvents(win);
  }

  win.once('ready-to-show', () => {
    setTimeout(() => {
      try { win.show(); } catch { }
    }, 100);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    try { shell.openExternal(url); } catch (e) { console.error('Failed to open external URL:', url, e); }
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL(`http://localhost:5173${route}`);
  } else {
    const hashRoute = route === '/' ? '/' : `#${route}`;
    const baseUrl = 'http://127.0.0.1:4000';
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error('Failed to load:', errorCode, errorDescription, validatedURL);
      setTimeout(() => {
        console.log('Retrying load...');
        try { win.loadURL(`${baseUrl}${hashRoute}`); } catch { }
      }, 1000);
    });
    win.loadURL(`${baseUrl}${hashRoute}`);
  }

  return win;
}