import { ipcMain, BrowserWindow } from 'electron';
import * as displayManager from '../displayManager.js';

const resolveOutputRoute = (outputKey) => {
  if (outputKey === 'lyric-video-studio') return '/lyric-video-live-output';
  if (outputKey === 'stage') return '/stage';
  if (outputKey === 'time') return '/time';
  if (typeof outputKey === 'string' && /^output\d+$/.test(outputKey)) return `/${outputKey}`;
  return null;
};

const resolveOutputKeyFromUrl = (url) => {
  if (!url) return null;
  const match = String(url).match(/(?:#\/|\/)(lyric-video-live-output|stage|time|output\d+)(?:\?|$)/i);
  if (!match) return null;
  if (match[1].toLowerCase() === 'lyric-video-live-output') return 'lyric-video-studio';
  return match[1].toLowerCase();
};

const isProjectionUrl = (url) => /[?&]projection=(1|true)\b/i.test(String(url || ''));

const normalizeOutputKey = (value) => (typeof value === 'string' ? value.toLowerCase() : '');

const shouldMakeDesktopProjectionFocusable = (targetType) => (
  targetType === 'desktop' && process.platform !== 'win32'
);

const shouldMakeProjectionFocusable = (targetType) => (
  targetType === 'display' || shouldMakeDesktopProjectionFocusable(targetType)
);

const buildProjectionRoute = (route, { escapeHint = false } = {}) => (
  `${route}?projection=1${escapeHint ? '&escapeHint=1' : ''}`
);

const isPlainEscapeKeyDown = (input) => (
  input?.type === 'keyDown' &&
  input.key === 'Escape' &&
  !input.control &&
  !input.meta &&
  !input.alt &&
  !input.shift
);

const normalizeDisplayId = (value) => {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? value : numeric;
};

const getProjectionLocationKey = (projection) => {
  if (!projection) return null;
  if (projection.targetType === 'desktop') return 'desktop';
  if (projection.displayId === null || typeof projection.displayId === 'undefined') return null;
  return `display:${String(projection.displayId)}`;
};

const waitForProjectionWindowClosed = async (win) => {
  if (!win || win.isDestroyed()) return;

  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const timeout = setTimeout(() => {
      try {
        if (!win.isDestroyed()) win.destroy();
      } catch { }
      finish();
    }, 1200);
    win.once('closed', () => {
      clearTimeout(timeout);
      finish();
    });

    try {
      win.close();
    } catch (error) {
      clearTimeout(timeout);
      console.warn('[IPC] Failed to close projection window:', error);
      finish();
    }
  });
};

const stopProjectionForWindow = async (win, reason = 'unknown') => {
  if (!win || win.isDestroyed() || win.__projectionClosePending) return false;

  win.__projectionClosePending = true;

  try {
    const outputKey = resolveOutputKeyFromUrl(win.webContents.getURL());
    if (outputKey) {
      displayManager.removeAssignmentsByOutput(outputKey);
    }

    await waitForProjectionWindowClosed(win);
    console.log('[IPC] Projection window closed:', { outputKey, reason });
    return true;
  } catch (error) {
    console.warn('[IPC] Failed to stop projection window:', error);
    return false;
  } finally {
    if (win && !win.isDestroyed()) {
      win.__projectionClosePending = false;
    }
  }
};

const attachProjectionEscapeHandler = (win) => {
  if (!win || win.isDestroyed() || win.__projectionEscapeHandlerAttached) return;
  win.__projectionEscapeHandlerAttached = true;

  win.webContents.on('before-input-event', (event, input) => {
    if (!isPlainEscapeKeyDown(input)) return;

    event.preventDefault();
    stopProjectionForWindow(win, 'escape-key');
  });
};

const closeProjectionWindowsByOutput = async (outputKey) => {
  const normalizedOutputKey = normalizeOutputKey(outputKey);
  if (!normalizedOutputKey) return 0;

  let closedCount = 0;
  const closeTasks = [];
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win || win.isDestroyed()) continue;
    try {
      const url = win.webContents.getURL();
      const winOutputKey = resolveOutputKeyFromUrl(url);
      if (winOutputKey !== normalizedOutputKey || !isProjectionUrl(url)) continue;
      closeTasks.push(waitForProjectionWindowClosed(win));
      closedCount += 1;
    } catch (error) {
      console.warn('[IPC] Failed to close projection window:', error);
    }
  }

  await Promise.all(closeTasks);
  return closedCount;
};

const waitForWindowLoad = async (win) => {
  if (!win || win.isDestroyed()) return;
  if (!win.webContents?.isLoadingMainFrame?.()) return;

  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const timeout = setTimeout(finish, 2500);
    win.webContents.once('did-finish-load', () => {
      clearTimeout(timeout);
      setTimeout(finish, 180);
    });
  });
};

const applyProjectionWindowBehavior = (win, { keyboardFocusable = false, coverShell = false } = {}) => {
  if (!win || win.isDestroyed()) return;

  try { win.setMenuBarVisibility(false); } catch { }
  try { win.setBackgroundColor('#000000'); } catch { }
  try { win.setAlwaysOnTop(Boolean(coverShell), 'screen-saver'); } catch { }
  try { win.setSkipTaskbar(true); } catch { }
  try { win.setFocusable(Boolean(keyboardFocusable)); } catch { }
  try {
    if (keyboardFocusable) {
      win.setIgnoreMouseEvents(false);
    } else {
      win.setIgnoreMouseEvents(true, { forward: true });
    }
  } catch { }
  try { win.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: true }); } catch { }
  try { win.setFullScreenable(true); } catch { }
  try { win.setResizable(false); } catch { }
  attachProjectionEscapeHandler(win);
};

const focusProjectionForEscape = (win) => {
  if (!win || win.isDestroyed()) return;

  setTimeout(() => {
    if (!win || win.isDestroyed()) return;
    try {
      win.setFocusable(true);
      win.focus();
    } catch { }
  }, 100);
};

const moveProjectionToPrimaryDisplay = (win) => {
  const primary = displayManager.getPrimaryDisplay();
  if (!primary) return false;

  const { x, y, width, height } = primary.bounds;

  try {
    win.setFullScreen(false);
    win.setBounds({ x, y, width, height });
    win.setFullScreen(true);
    return true;
  } catch (error) {
    console.error('[IPC] Failed to move projection to primary display:', error);
    return false;
  }
};

const collectProjectionState = () => {
  const projections = [];
  const windows = BrowserWindow.getAllWindows();

  windows.forEach((win) => {
    if (!win || win.isDestroyed()) return;
    try {
      const url = win.webContents.getURL();
      const outputKey = resolveOutputKeyFromUrl(url);
      if (!outputKey || !isProjectionUrl(url)) return;

      const display = displayManager.getWindowDisplay(win);
      projections.push({
        outputKey,
        windowId: win.id,
        displayId: display?.id ?? null,
        displayName: display?.name ?? null,
        targetType: display?.primary ? 'desktop' : 'display',
      });
    } catch (error) {
      console.warn('[IPC] Failed to inspect projection window:', error);
    }
  });

  return projections;
};

const openRegularOutputWindow = async (outputKey) => {
  const normalizedOutputKey = normalizeOutputKey(outputKey);
  const route = resolveOutputRoute(normalizedOutputKey);
  if (!route) {
    return { success: false, error: 'Invalid output key' };
  }

  const { createWindow } = await import('../windows.js');
  const windows = BrowserWindow.getAllWindows();
  let existingWindow = null;

  for (const win of windows) {
    if (!win || win.isDestroyed()) continue;
    try {
      const url = win.webContents.getURL();
      const winOutputKey = resolveOutputKeyFromUrl(url);
      if (winOutputKey !== normalizedOutputKey || isProjectionUrl(url)) continue;
      existingWindow = win;
      break;
    } catch (error) {
      console.warn('[IPC] Error checking output window URL:', error);
    }
  }

  if (existingWindow && !existingWindow.isDestroyed()) {
    try {
      if (existingWindow.isMinimized?.()) existingWindow.restore?.();
      existingWindow.focus?.();
    } catch { }
    return { success: true, route, reused: true };
  }

  if (normalizedOutputKey === 'time') {
    createWindow(route, {
      width: 1600,
      height: 900,
      minWidth: 1100,
      minHeight: 620,
      title: 'LyricDisplay Time',
    });
    return { success: true, route, reused: false };
  }

  createWindow(route);
  return { success: true, route, reused: false };
};

const openTimerControlWindow = async () => {
  const { createWindow } = await import('../windows.js');
  const windows = BrowserWindow.getAllWindows();

  for (const win of windows) {
    if (!win || win.isDestroyed()) continue;
    try {
      const url = win.webContents.getURL();
      if (!/(?:#\/|\/)timer-control(?:\?|$)/i.test(String(url || ''))) continue;
      if (win.isMinimized?.()) win.restore?.();
      win.focus?.();
      return { success: true, route: '/timer-control', reused: true };
    } catch (error) {
      console.warn('[IPC] Error checking timer control window URL:', error);
    }
  }

  createWindow('/timer-control', {
    width: 1100,
    height: 700,
    minWidth: 1100,
    minHeight: 560,
    title: 'LyricDisplay Timer',
  });
  return { success: true, route: '/timer-control', reused: false };
};

const openObsSourceCreatorWindow = async () => {
  const { createWindow } = await import('../windows.js');
  const windows = BrowserWindow.getAllWindows();

  for (const win of windows) {
    if (!win || win.isDestroyed()) continue;
    try {
      const url = win.webContents.getURL();
      if (!/(?:#\/|\/)obs-setup(?:\?|$)/i.test(String(url || ''))) continue;
      if (win.isMinimized?.()) win.restore?.();
      win.focus?.();
      return { success: true, route: '/obs-setup', reused: true };
    } catch (error) {
      console.warn('[IPC] Error checking OBS source creator window URL:', error);
    }
  }

  createWindow('/obs-setup', {
    width: 1100,
    height: 700,
    minWidth: 1100,
    minHeight: 560,
    title: 'LyricDisplay OBS Source Creator',
  });
  return { success: true, route: '/obs-setup', reused: false };
};

/**
 * Register display management IPC handlers
 * Handles display detection, projection state, and output windows
 */
export function registerDisplayHandlers({ getMainWindow }) {

  ipcMain.handle('display:get-projection-state', async () => {
    try {
      const displays = displayManager.getAllDisplays();
      const projections = collectProjectionState();

      return {
        success: true,
        displays,
        externalDisplays: displays.filter((d) => !d.primary),
        projections,
      };
    } catch (error) {
      console.error('Error getting projection state:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:project-output', async (_event, payload = {}) => {
    try {
      const { createWindow } = await import('../windows.js');
      const outputKey = normalizeOutputKey(payload?.outputKey);
      const targetType = payload?.targetType === 'display' ? 'display' : 'desktop';
      const displayId = normalizeDisplayId(payload?.displayId);
      const keyboardFocusable = shouldMakeProjectionFocusable(targetType);
      const coverShell = targetType === 'display';

      const route = resolveOutputRoute(outputKey);
      if (!route) {
        return { success: false, error: 'Invalid output key' };
      }
      const projectionRoute = buildProjectionRoute(route, { escapeHint: keyboardFocusable });

      if (targetType === 'display' && (displayId === null || typeof displayId === 'undefined')) {
        return { success: false, error: 'Display ID is required for external projection' };
      }

      const targetLocationKey = targetType === 'desktop'
        ? 'desktop'
        : `display:${String(displayId)}`;
      const currentProjections = collectProjectionState();
      const conflictingProjection = currentProjections.find((entry) => (
        entry.outputKey !== outputKey && getProjectionLocationKey(entry) === targetLocationKey
      )) || null;

      if (conflictingProjection?.outputKey) {
        await closeProjectionWindowsByOutput(conflictingProjection.outputKey);
        displayManager.removeAssignmentsByOutput(conflictingProjection.outputKey);
      }

      const windows = BrowserWindow.getAllWindows();
      let projectionWindow = null;

      for (const win of windows) {
        if (!win || win.isDestroyed()) continue;
        try {
          const url = win.webContents.getURL();
          const winOutputKey = resolveOutputKeyFromUrl(url);
          if (winOutputKey !== outputKey) continue;

          if (isProjectionUrl(url)) {
            projectionWindow = win;
          } else {
            win.close();
          }
        } catch (err) {
          console.warn('[IPC] Error checking window URL:', err);
        }
      }

      if (!projectionWindow || projectionWindow.isDestroyed()) {
        projectionWindow = createWindow(projectionRoute, {
          projection: true,
          backgroundColor: '#000000',
          projectionFocusable: keyboardFocusable,
          deferShow: true,
        });
      } else if (!isProjectionUrl(projectionWindow.webContents.getURL())) {
        projectionWindow.loadURL(projectionWindow.webContents.getURL().replace(route, projectionRoute));
      }

      await waitForWindowLoad(projectionWindow);
      applyProjectionWindowBehavior(projectionWindow, { keyboardFocusable, coverShell });

      displayManager.removeAssignmentsByOutput(outputKey);

      if (targetType === 'display') {
        const moved = displayManager.moveWindowToDisplay(projectionWindow, displayId, true);
        if (!moved) {
          return { success: false, error: 'Failed to move projection window to selected display' };
        }
        displayManager.saveDisplayAssignment(displayId, outputKey);
      } else {
        const moved = moveProjectionToPrimaryDisplay(projectionWindow);
        if (!moved) {
          return { success: false, error: 'Failed to project to primary display' };
        }
      }

      applyProjectionWindowBehavior(projectionWindow, { keyboardFocusable, coverShell });

      try {
        if (typeof projectionWindow.showInactive === 'function') {
          projectionWindow.showInactive();
        } else {
          projectionWindow.show();
        }
      } catch { }

      if (keyboardFocusable) {
        focusProjectionForEscape(projectionWindow);
      } else if (targetType === 'desktop') {
        const mainWindow = getMainWindow?.();
        if (mainWindow && !mainWindow.isDestroyed()) {
          setTimeout(() => {
            try { mainWindow.focus(); } catch { }
          }, 100);
        }
      }

      const currentDisplay = displayManager.getWindowDisplay(projectionWindow);
      return {
        success: true,
        outputKey,
        targetType,
        displayId: currentDisplay?.id ?? null,
        displacedOutputKey: conflictingProjection?.outputKey || null,
      };
    } catch (error) {
      console.error('Error projecting output:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:stop-projection', async (_event, payload = {}) => {
    try {
      const outputKey = normalizeOutputKey(payload?.outputKey);
      const route = resolveOutputRoute(outputKey);
      if (!route) {
        return { success: false, error: 'Invalid output key' };
      }

      const removedAssignments = displayManager.removeAssignmentsByOutput(outputKey);
      const closedCount = await closeProjectionWindowsByOutput(outputKey);
      const closed = closedCount > 0;

      return { success: true, closed, closedCount, removedAssignments };
    } catch (error) {
      console.error('Error stopping projection:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:get-all', async () => {
    try {
      const displays = displayManager.getAllDisplays();
      return { success: true, displays };
    } catch (error) {
      console.error('Error getting displays:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:get-primary', async () => {
    try {
      const display = displayManager.getPrimaryDisplay();
      return { success: true, display };
    } catch (error) {
      console.error('Error getting primary display:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:get-by-id', async (_event, { displayId }) => {
    try {
      const display = displayManager.getDisplayById(displayId);
      if (!display) {
        return { success: false, error: 'Display not found' };
      }
      return { success: true, display };
    } catch (error) {
      console.error('Error getting display by ID:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:open-output-window', async (_event, { outputKey }) => {
    try {
      return await openRegularOutputWindow(outputKey);
    } catch (error) {
      console.error('Error opening output window:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:open-timer-control-window', async () => {
    try {
      return await openTimerControlWindow();
    } catch (error) {
      console.error('Error opening timer control window:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:open-obs-source-creator-window', async () => {
    try {
      return await openObsSourceCreatorWindow();
    } catch (error) {
      console.error('Error opening OBS source creator window:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-output-window', async (_event, outputNumber) => {
    try {
      const outputKey = Number(outputNumber) === 1 ? 'output1' : 'output2';
      return await openRegularOutputWindow(outputKey);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}
