import { BrowserWindow, BrowserView, ipcMain, shell } from 'electron';
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

    // Devtools support
    if (isDev) {
      try { inAppBrowserWindow.webContents.openDevTools({ mode: 'detach' }); } catch {}
      try { inAppBrowserView.webContents.openDevTools({ mode: 'detach' }); } catch {}
    }

    // Allow Ctrl+Shift+I to open devtools for this window and its view
    inAppBrowserWindow.webContents.on('before-input-event', (event, input) => {
      try {
        if (input.control && input.shift && (input.key?.toLowerCase?.() === 'i')) {
          inAppBrowserWindow.webContents.openDevTools({ mode: 'detach' });
          if (inAppBrowserView && !inAppBrowserView.webContents.isDestroyed()) {
            inAppBrowserView.webContents.openDevTools({ mode: 'detach' });
          }
          event.preventDefault();
        }
      } catch {}
    });

    // Keep toolbar address up to date
    const sendLocation = () => {
      if (!inAppBrowserWindow || inAppBrowserWindow.isDestroyed()) return;
      const current = inAppBrowserView?.webContents?.getURL() || '';
      inAppBrowserWindow.webContents.send('browser-location', current);
    };
    ['did-navigate', 'did-navigate-in-page', 'did-finish-load'].forEach((ev) => {
      inAppBrowserView.webContents.on(ev, sendLocation);
    });

    const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Lyrics Browser</title>
      <style>
        html,body { height:100%; margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
        .toolbar { position:fixed; top:0; left:0; right:0; height:${TOOLBAR_HEIGHT}px; display:flex; gap:8px; align-items:center; padding:8px; background:#111827; color:#e5e7eb; box-sizing:border-box; }
        .btn { background:#374151; border:none; color:#e5e7eb; padding:6px 10px; border-radius:6px; cursor:pointer; }
        .btn:hover { background:#4b5563; }
        .addr { flex:1; height:32px; border-radius:6px; border:1px solid #4b5563; background:#1f2937; color:#e5e7eb; padding:0 10px; }
        .wrap { height:100%; }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <button id="back" class="btn" title="Back">&larr;</button>
        <button id="fwd" class="btn" title="Forward">&rarr;</button>
        <button id="reload" class="btn" title="Reload">&#8635;</button>
        <input id="addr" class="addr" type="text" placeholder="Enter URL or search..." />
        <button id="openExt" class="btn" title="Open in browser">&#8599;</button>
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
