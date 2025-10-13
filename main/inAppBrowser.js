import { BrowserWindow, BrowserView, ipcMain, shell, nativeTheme } from 'electron';
import { isDev, resolveProductionPath } from './paths.js';

let inAppBrowserWindow = null;
let inAppBrowserView = null;

export function openInAppBrowser(initialUrl) {
  try {
    if (inAppBrowserWindow && !inAppBrowserWindow.isDestroyed()) {
      inAppBrowserWindow.focus();
      if (inAppBrowserView && !inAppBrowserView.webContents.isDestroyed()) {
        inAppBrowserView.webContents.loadURL(initialUrl || 'https://www.google.com');
        return;
      }
    }

    inAppBrowserWindow = new BrowserWindow({
      width: 1100,
      height: 800,
      show: true,
      title: 'Lyrics Browser',
      webPreferences: { nodeIntegration: false, contextIsolation: true, preload: resolveProductionPath('preload.js') },
    });

    inAppBrowserView = new BrowserView({ webPreferences: { nodeIntegration: false, contextIsolation: true } });
    inAppBrowserWindow.setBrowserView(inAppBrowserView);
    const TOOLBAR_HEIGHT = 48;
    const [winW, winH] = inAppBrowserWindow.getSize();
    inAppBrowserView.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width: winW, height: winH - TOOLBAR_HEIGHT });
    inAppBrowserView.setAutoResize({ width: true, height: true });
    inAppBrowserView.webContents.setWindowOpenHandler(({ url }) => {
      try { inAppBrowserView.webContents.loadURL(url); } catch (e) { console.error(e); }
      return { action: 'deny' };
    });
    inAppBrowserView.webContents.loadURL(initialUrl || 'https://www.google.com');

    if (isDev) {
      try { inAppBrowserWindow.webContents.openDevTools({ mode: 'detach' }); } catch { }
      try { inAppBrowserView.webContents.openDevTools({ mode: 'detach' }); } catch { }
    }

    inAppBrowserWindow.webContents.on('before-input-event', (event, input) => {
      try {
        if (input.control && input.shift && (input.key?.toLowerCase?.() === 'i')) {
          inAppBrowserWindow.webContents.openDevTools({ mode: 'detach' });
          if (inAppBrowserView && !inAppBrowserView.webContents.isDestroyed()) {
            inAppBrowserView.webContents.openDevTools({ mode: 'detach' });
          }
          event.preventDefault();
        }
      } catch { }
    });

    const sendLocation = () => {
      if (!inAppBrowserWindow || inAppBrowserWindow.isDestroyed()) return;
      const current = inAppBrowserView?.webContents?.getURL() || '';
      inAppBrowserWindow.webContents.send('browser-location', current);
    };
    ['did-navigate', 'did-navigate-in-page', 'did-finish-load'].forEach((ev) => {
      inAppBrowserView.webContents.on(ev, sendLocation);
    });

    const { darkMode } = nativeTheme;

    const bgColor = darkMode ? '#111827' : '#ffffff';
    const textColor = darkMode ? '#f9fafb' : '#111827';
    const textColorMuted = darkMode ? '#9ca3af' : '#6b7280';
    const btnBg = darkMode ? '#1f2937' : '#f3f4f6';
    const btnBgHover = darkMode ? '#374151' : '#e5e7eb';
    const inputBg = darkMode ? '#1f2937' : '#ffffff';
    const inputBorder = darkMode ? '#374151' : '#e5e7eb';
    const inputBorderFocus = darkMode ? '#3b82f6' : '#3b82f6';
    const borderColor = darkMode ? '#1f2937' : '#e5e7eb';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Lyrics Browser</title>
  <style>
    * { box-sizing: border-box; }
    html, body { 
      height: 100%; 
      margin: 0; 
      padding: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
      background: ${bgColor};
    }
    .toolbar { 
      position: fixed; 
      top: 0; 
      left: 0; 
      right: 0; 
      height: ${TOOLBAR_HEIGHT}px; 
      display: flex; 
      gap: 8px; 
      align-items: center; 
      padding: 8px 12px; 
      background: ${bgColor}; 
      border-bottom: 1px solid ${borderColor}; 
      z-index: 1000;
    }
    .btn { 
      background: ${btnBg}; 
      border: none; 
      color: ${textColor}; 
      padding: 8px 12px; 
      border-radius: 6px; 
      cursor: pointer; 
      font-size: 16px; 
      font-weight: 500;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 36px;
    }
    .btn:hover { 
      background: ${btnBgHover}; 
    }
    .btn:active {
      transform: scale(0.97);
    }
    .addr { 
      flex: 1; 
      height: 36px; 
      border-radius: 6px; 
      border: 1px solid ${inputBorder}; 
      background: ${inputBg}; 
      color: ${textColor}; 
      padding: 0 12px; 
      font-size: 13px;
      transition: all 0.15s ease;
    }
    .addr::placeholder {
      color: ${textColorMuted};
    }
    .addr:focus { 
      outline: none; 
      border-color: ${inputBorderFocus}; 
      box-shadow: 0 0 0 3px ${darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)'};
    }
    .wrap { 
      height: 100%; 
      padding-top: ${TOOLBAR_HEIGHT}px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="back" class="btn" title="Back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
    <button id="fwd" class="btn" title="Forward">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </button>
    <button id="reload" class="btn" title="Reload">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
    </button>
    <input id="addr" class="addr" type="text" placeholder="Enter URL or search..." />
    <button id="openExt" class="btn" title="Open in external browser">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    </button>
  </div>
  <div class="wrap"></div>
  <script>
    const addr = document.getElementById('addr');
    const back = document.getElementById('back');
    const fwd = document.getElementById('fwd');
    const reload = document.getElementById('reload');
    const openExt = document.getElementById('openExt');
    back.addEventListener('click', function(){ try { window.electronAPI.browserBack(); } catch(_){} });
    fwd.addEventListener('click', function(){ try { window.electronAPI.browserForward(); } catch(_){} });
    reload.addEventListener('click', function(){ try { window.electronAPI.browserReload(); } catch(_){} });
    openExt.addEventListener('click', function(){ try { window.electronAPI.browserOpenExternal(); } catch(_){} });
    addr.addEventListener('keydown', function(e){
      if (e.key === 'Enter') {
        var val = (addr.value || '').trim();
        if (!(val.startsWith('http://') || val.startsWith('https://'))) {
          val = 'https://www.google.com/search?q=' + encodeURIComponent(val);
        }
        try { window.electronAPI.browserNavigate(val); } catch(_){ }
      }
    });
    if (window.electronAPI && window.electronAPI.onBrowserLocation) {
      window.electronAPI.onBrowserLocation(function(u){ addr.value = u || ''; });
    }
  </script>
</body>
</html>`;

    inAppBrowserWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    inAppBrowserWindow.on('closed', () => { inAppBrowserWindow = null; inAppBrowserView = null; });
  } catch (e) {
    console.error('Failed to open in-app browser:', e);
  }
}

export function registerInAppBrowserIpc() {
  ipcMain.on('browser-nav', (_event, action, value) => {
    if (!inAppBrowserView || !inAppBrowserView.webContents) return;
    try {
      switch (action) {
        case 'back':
          if (inAppBrowserView.webContents.canGoBack()) inAppBrowserView.webContents.goBack();
          break;
        case 'forward':
          if (inAppBrowserView.webContents.canGoForward()) inAppBrowserView.webContents.goForward();
          break;
        case 'reload':
          inAppBrowserView.webContents.reload();
          break;
        case 'navigate':
          if (value) inAppBrowserView.webContents.loadURL(value);
          break;
        default:
          break;
      }
    } catch (e) {
      console.error('browser-nav error:', e);
    }
  });

  ipcMain.on('browser-open-external', () => {
    if (!inAppBrowserView || !inAppBrowserView.webContents) return;
    try {
      const url = inAppBrowserView.webContents.getURL();
      if (url) shell.openExternal(url);
    } catch (e) {
      console.error('browser-open-external error:', e);
    }
  });
}
