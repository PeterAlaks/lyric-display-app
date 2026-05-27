import { BrowserWindow, shell } from 'electron';
import path from 'path';
import { isDev, resolveProductionPath, appRoot } from './paths.js';
import { writeLog } from './logging.js';

const MEMORY_LOG_INTERVAL_MS = 60_000;
const RECOVERABLE_RENDERER_REASONS = new Set(['crashed', 'killed', 'oom']);

function getUsableWebContents(win) {
  if (!win || win.isDestroyed()) return null;
  const webContents = win.webContents;
  if (!webContents || webContents.isDestroyed()) return null;
  if (typeof webContents.isCrashed === 'function' && webContents.isCrashed()) return null;
  return webContents;
}

function attachWindowStateEvents(win) {
  const sendState = () => {
    try {
      const webContents = getUsableWebContents(win);
      if (webContents) {
        webContents.send('window-state', {
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

function normalizeConsoleMessage(levelOrDetails, message, line, sourceId) {
  if (levelOrDetails && typeof levelOrDetails === 'object') {
    return {
      level: levelOrDetails.level,
      message: levelOrDetails.message,
      line: levelOrDetails.lineNumber ?? levelOrDetails.line ?? 0,
      sourceId: levelOrDetails.sourceId,
    };
  }

  return {
    level: levelOrDetails,
    message,
    line: line ?? 0,
    sourceId,
  };
}

function isWarnOrErrorLevel(level) {
  if (typeof level === 'number') return level >= 2;
  const normalized = String(level || '').toLowerCase();
  return normalized === 'warn' || normalized === 'warning' || normalized === 'error';
}

function getConsoleLevelName(level) {
  if (typeof level === 'number') {
    const levelNames = ['VERBOSE', 'INFO', 'WARN', 'ERROR'];
    return levelNames[level] || `LEVEL_${level}`;
  }
  return String(level || 'INFO').toUpperCase();
}

function shouldRecoverRenderer(route, projection, details) {
  if (projection) return false;
  const isControlRoute = route === '/' || route.startsWith('/new-song') || route.startsWith('/timer-control') || route.startsWith('/obs-setup');
  return isControlRoute && RECOVERABLE_RENDERER_REASONS.has(details?.reason);
}

function attachRendererDiagnostics(win, route, { projection = false } = {}) {
  const describeWindow = () => {
    try {
      return `${win.getTitle?.() || 'Untitled'} (${route || win.webContents.getURL?.() || 'unknown route'})`;
    } catch {
      return route || 'unknown route';
    }
  };

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Window] Renderer process gone:', describeWindow(), details);
    if (!shouldRecoverRenderer(route, projection, details) || win.__rendererRecoveryPending) {
      return;
    }

    win.__rendererRecoveryPending = true;
    const timer = setTimeout(() => {
      win.__rendererRecoveryPending = false;
      if (!win || win.isDestroyed()) return;
      try {
        console.warn('[Window] Reloading renderer after process exit:', describeWindow(), details);
        win.reload();
      } catch (err) {
        console.error('[Window] Failed to reload renderer after process exit:', describeWindow(), err);
      }
    }, 1000);
    timer.unref?.();
  });

  win.webContents.on('console-message', (event) => {
    const details = normalizeConsoleMessage(event);
    if (!isWarnOrErrorLevel(details.level) && !isDev) return;
    const levelName = getConsoleLevelName(details.level);
    writeLog(`RENDERER_${levelName}`, describeWindow(), `${details.sourceId || 'unknown'}:${details.line || 0}`, details.message);
  });

  win.on('unresponsive', () => {
    console.warn('[Window] Renderer became unresponsive:', describeWindow());
  });

  win.on('responsive', () => {
    console.log('[Window] Renderer became responsive:', describeWindow());
  });

  let memoryCapturePending = false;
  const logMemory = async (reason) => {
    if (memoryCapturePending) return;
    const webContents = getUsableWebContents(win);
    if (!webContents || typeof webContents.getProcessMemoryInfo !== 'function') return;
    memoryCapturePending = true;
    try {
      const memory = await webContents.getProcessMemoryInfo();
      writeLog('WINDOW_MEMORY', describeWindow(), reason, memory);
    } catch (err) {
      if (!win.isDestroyed()) {
        writeLog('WINDOW_MEMORY_ERROR', describeWindow(), reason, err);
      }
    } finally {
      memoryCapturePending = false;
    }
  };

  win.webContents.on('did-finish-load', () => {
    logMemory('did-finish-load');
  });

  const memoryTimer = setInterval(() => {
    logMemory('interval');
  }, MEMORY_LOG_INTERVAL_MS);
  memoryTimer.unref?.();

  win.on('closed', () => {
    clearInterval(memoryTimer);
  });
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
  attachRendererDiagnostics(win, route, { projection });

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
