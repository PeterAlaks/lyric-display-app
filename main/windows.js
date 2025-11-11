import { BrowserWindow, shell } from 'electron';
import path from 'path';
import { isDev, resolveProductionPath, appRoot } from './paths.js';

export function createWindow(route = '/') {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolveProductionPath('preload.js')
    },
    show: false,
    icon: path.join(appRoot, 'public', 'favicon.ico'),
    backgroundColor: isDev ? '#ffffff' : '#f9fafb',
  });

  win.once('ready-to-show', () => {
    setTimeout(() => {
      try { win.show(); } catch { }
      // if (isDev) {
      //   try { win.webContents.openDevTools({ mode: 'detach' }); } catch { }
      // }
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
