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

export function createWindow(route = '/', options = {}) {
  const {
    projection = false,
    backgroundColor,
    width = 1280,
    height = 760,
    minWidth = 1000,
    minHeight = 650,
    title = null,
  } = options;
  const isTimerControlWindow = route.startsWith('/timer-control');
  const isObsSetupWindow = route.startsWith('/obs-setup');
  const isControlWindow = route === '/' || route.startsWith('/new-song') || isTimerControlWindow || isObsSetupWindow;
  const windowTitle = title || (isTimerControlWindow ? 'LyricDisplay Timer' : isObsSetupWindow ? 'LyricDisplay OBS Source Creator' : 'LyricDisplay');
  const defaultBackground = projection
    ? '#000000'
    : (backgroundColor || (isDev ? '#ffffff' : '#f9fafb'));

  const win = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolveProductionPath('preload.js')
    },
    show: false,
    icon: path.join(appRoot, 'public', 'favicon.ico'),
    frame: projection ? false : (isControlWindow ? false : true),
    transparent: false,
    backgroundColor: defaultBackground,
    titleBarStyle: isControlWindow && process.platform === 'darwin' ? 'hiddenInset' : 'default',
    thickFrame: true,
    autoHideMenuBar: true,
    skipTaskbar: projection,
    focusable: projection ? false : true,
    movable: projection ? false : true,
    resizable: projection ? false : true,
    title: windowTitle,
  });

  if (isControlWindow) {
    attachWindowStateEvents(win);
  }

  if (projection) {
    try {
      win.setMenuBarVisibility(false);
      win.setAlwaysOnTop(false);
      win.setIgnoreMouseEvents(true, { forward: true });
      win.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: true });
      win.setFullScreenable(true);
    } catch { }
  }

  win.once('ready-to-show', () => {
    setTimeout(() => {
      try {
        if (projection && typeof win.showInactive === 'function') {
          win.showInactive();
        } else {
          win.show();
        }
      } catch { }
    }, 100);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    try { shell.openExternal(url); } catch (e) { console.error('Failed to open external URL:', url, e); }
    return { action: 'deny' };
  });

  if (isDev && route === '/') {
    win.webContents.once('did-finish-load', () => {
      try { win.webContents.openDevTools({ mode: 'detach' }); } catch { }
    });
  }

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
