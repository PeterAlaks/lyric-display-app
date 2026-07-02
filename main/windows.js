import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { isDev, resolveProductionPath, appRoot } from './paths.js';
import { getLogPaths, writeLog } from './logging.js';

const MEMORY_LOG_INTERVAL_MS = 60_000;
const RENDERER_SNAPSHOT_TIMEOUT_MS = 1_500;
const MEMORY_PRESSURE_PRIVATE_KB = 1.5 * 1024 * 1024;
const RECOVERY_WINDOW_MS = 5 * 60_000;
const MAX_RECOVERY_ATTEMPTS = 3;
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

function withTimeout(promise, timeoutMs, fallback) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), timeoutMs);
      timer.unref?.();
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function getRendererRuntimeSnapshot(webContents) {
  if (!webContents || webContents.isDestroyed()) return null;

  try {
    return await withTimeout(
      webContents.executeJavaScript(`(() => {
        const storageSize = (storage) => {
          try {
            let total = 0;
            for (let index = 0; index < storage.length; index += 1) {
              const key = storage.key(index);
              const value = storage.getItem(key);
              total += String(key || '').length + String(value || '').length;
            }
            return total;
          } catch {
            return null;
          }
        };

        const memory = performance && performance.memory ? {
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          usedJSHeapSize: performance.memory.usedJSHeapSize,
        } : null;

        return {
          url: location.href,
          visibilityState: document.visibilityState,
          hidden: document.hidden,
          memory,
          localStorageBytes: storageSize(localStorage),
          sessionStorageBytes: storageSize(sessionStorage),
        };
      })()`, true),
      RENDERER_SNAPSHOT_TIMEOUT_MS,
      { timedOut: true }
    );
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

function shouldRecoverRenderer(route, projection, details) {
  if (projection) return false;
  const isControlRoute = route === '/' || route.startsWith('/new-song') || route.startsWith('/timer-control') || route.startsWith('/obs-setup');
  return isControlRoute && RECOVERABLE_RENDERER_REASONS.has(details?.reason);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function recordRendererRecoveryAttempt(win) {
  const now = Date.now();
  const attempts = Array.isArray(win.__rendererRecoveryAttempts)
    ? win.__rendererRecoveryAttempts.filter((timestamp) => now - timestamp < RECOVERY_WINDOW_MS)
    : [];

  if (attempts.length >= MAX_RECOVERY_ATTEMPTS) {
    win.__rendererRecoveryAttempts = attempts;
    return { allowed: false, attempts };
  }

  attempts.push(now);
  win.__rendererRecoveryAttempts = attempts;
  return { allowed: true, attempts };
}

function showRendererRecoveryFallback(parent, route, details, attemptCount) {
  if (parent.__rendererRecoveryFallback && !parent.__rendererRecoveryFallback.isDestroyed()) {
    try {
      parent.__rendererRecoveryFallback.focus();
    } catch {
    }
    return;
  }

  const { logFilePath, logDir } = getLogPaths();
  const fallback = new BrowserWindow({
    width: 560,
    height: 360,
    minWidth: 460,
    minHeight: 300,
    title: 'LyricDisplay Recovery',
    parent: parent && !parent.isDestroyed() ? parent : undefined,
    modal: false,
    autoHideMenuBar: true,
    backgroundColor: '#111827',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  parent.__rendererRecoveryFallback = fallback;
  fallback.on('closed', () => {
    if (parent && !parent.isDestroyed()) {
      parent.__rendererRecoveryFallback = null;
    }
  });

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>LyricDisplay Recovery</title>
  <style>
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #111827;
      color: #f9fafb;
      line-height: 1.5;
    }
    main {
      padding: 28px;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 20px;
      font-weight: 700;
    }
    p {
      margin: 0 0 12px;
      color: #d1d5db;
      font-size: 14px;
    }
    .meta {
      margin-top: 18px;
      padding: 12px;
      border: 1px solid #374151;
      background: #1f2937;
      border-radius: 8px;
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      color: #e5e7eb;
      overflow-wrap: anywhere;
    }
    strong {
      color: #ffffff;
    }
  </style>
</head>
<body>
  <main>
    <h1>LyricDisplay stopped auto-reloading this window</h1>
    <p>The <strong>${escapeHtml(route || 'unknown')}</strong> window renderer crashed repeatedly, so LyricDisplay stopped automatic reloads to avoid a crash loop.</p>
    <p>This can happen under severe memory or GPU pressure. If OBS, capture devices, or recording are active, reduce the load or restart LyricDisplay before continuing the workflow.</p>
    <p>The timer/projection windows may still be running if their renderer processes are healthy.</p>
    <div class="meta">
      Reason: ${escapeHtml(details?.reason || 'unknown')}<br>
      Exit code: ${escapeHtml(details?.exitCode ?? 'unknown')}<br>
      Reload attempts: ${escapeHtml(attemptCount)} in ${Math.round(RECOVERY_WINDOW_MS / 60000)} minutes<br>
      Log: ${escapeHtml(logFilePath || logDir || 'Log path unavailable')}
    </div>
  </main>
</body>
</html>`;

  fallback.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
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

    const recovery = recordRendererRecoveryAttempt(win);
    if (!recovery.allowed) {
      writeLog('WINDOW_RECOVERY_LIMIT', describeWindow(), {
        route,
        details,
        attempts: recovery.attempts.length,
        windowMs: RECOVERY_WINDOW_MS,
      });
      showRendererRecoveryFallback(win, route, details, recovery.attempts.length);
      return;
    }

    win.__rendererRecoveryPending = true;
    const timer = setTimeout(() => {
      win.__rendererRecoveryPending = false;
      if (!win || win.isDestroyed()) return;
      try {
        console.warn('[Window] Reloading renderer after process exit:', describeWindow(), {
          ...details,
          attempt: recovery.attempts.length,
          maxAttempts: MAX_RECOVERY_ATTEMPTS,
          windowMs: RECOVERY_WINDOW_MS,
        });
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
  const memoryPressureLoggedPids = new Set();
  const logMemory = async (reason) => {
    if (memoryCapturePending) return;
    const webContents = getUsableWebContents(win);
    if (!webContents || typeof webContents.getOSProcessId !== 'function') return;
    memoryCapturePending = true;
    try {
      const pid = webContents.getOSProcessId();
      const metric = app.getAppMetrics().find((item) => item.pid === pid);
      const renderer = await getRendererRuntimeSnapshot(webContents);
      const privateBytes = metric?.memory?.privateBytes;
      if (
        Number.isFinite(privateBytes) &&
        privateBytes >= MEMORY_PRESSURE_PRIVATE_KB &&
        !memoryPressureLoggedPids.has(pid)
      ) {
        memoryPressureLoggedPids.add(pid);
        writeLog('WINDOW_MEMORY_PRESSURE', describeWindow(), {
          pid,
          privateBytes,
          thresholdPrivateBytes: MEMORY_PRESSURE_PRIVATE_KB,
          route,
          reason,
          renderer,
        });
      }
      writeLog('WINDOW_MEMORY', describeWindow(), reason, {
        pid,
        type: metric?.type || null,
        cpuPercent: metric?.cpu?.percentCPUUsage ?? null,
        memory: metric?.memory || null,
        renderer,
      });
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
    projectionFocusable = false,
    deferShow = false,
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
      preload: resolveProductionPath('preload.js'),
      backgroundThrottling: projection ? false : true,
      spellcheck: projection ? false : true,
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
    focusable: projection ? Boolean(projectionFocusable) : true,
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
      if (projectionFocusable) {
        win.setIgnoreMouseEvents(false);
      } else {
        win.setIgnoreMouseEvents(true, { forward: true });
      }
      win.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: true });
      win.setFullScreenable(true);
      win.setFocusable(Boolean(projectionFocusable));
    } catch { }
  }

  win.once('ready-to-show', () => {
    if (deferShow) return;

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
