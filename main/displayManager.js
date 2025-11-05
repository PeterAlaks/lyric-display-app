import { screen, BrowserWindow, app } from 'electron';
import Store from 'electron-store';

let store = null;
let displayChangeCallback = null;
let lastDisplayCount = 0;
let detectionTimeout = null;
let isInitialized = false;

function initStore() {
  if (!store) {
    store = new Store({
      name: 'display-assignments',
      defaults: {
        assignments: {},
        lastKnownDisplays: []
      }
    });
  }
  return store;
}

export function initDisplayManager(onDisplayChange) {

  if (!app.isReady()) {
    console.warn('[DisplayManager] Cannot initialize before app is ready');
    app.once('ready', () => {
      initDisplayManager(onDisplayChange);
    });
    return;
  }

  if (isInitialized) {
    console.warn('[DisplayManager] Already initialized');
    return;
  }

  try {
    initStore();
    displayChangeCallback = onDisplayChange;
    lastDisplayCount = screen.getAllDisplays().length;

    screen.on('display-added', handleDisplayAdded);
    screen.on('display-removed', handleDisplayRemoved);

    isInitialized = true;
    console.log('[DisplayManager] Initialized with', lastDisplayCount, 'displays');
  } catch (error) {
    console.error('[DisplayManager] Initialization error:', error);
  }
}

export function cleanupDisplayManager() {
  if (!isInitialized) {
    return;
  }

  try {
    screen.removeListener('display-added', handleDisplayAdded);
    screen.removeListener('display-removed', handleDisplayRemoved);

    if (detectionTimeout) {
      clearTimeout(detectionTimeout);
      detectionTimeout = null;
    }

    isInitialized = false;
    console.log('[DisplayManager] Cleaned up');
  } catch (error) {
    console.error('[DisplayManager] Cleanup error:', error);
  }
}

function handleDisplayAdded(event, newDisplay) {
  console.log('[DisplayManager] Display added:', newDisplay.id);

  if (detectionTimeout) {
    clearTimeout(detectionTimeout);
  }

  detectionTimeout = setTimeout(() => {
    const currentDisplays = screen.getAllDisplays();
    const currentCount = currentDisplays.length;

    if (currentCount > lastDisplayCount) {
      lastDisplayCount = currentCount;

      const primaryDisplay = screen.getPrimaryDisplay();
      if (newDisplay.id !== primaryDisplay.id) {
        notifyDisplayChange('added', newDisplay);
      }
    }
  }, 500);
}

function handleDisplayRemoved(event, oldDisplay) {
  console.log('[DisplayManager] Display removed:', oldDisplay.id);

  const currentDisplays = screen.getAllDisplays();
  lastDisplayCount = currentDisplays.length;

  removeDisplayAssignment(oldDisplay.id);

  notifyDisplayChange('removed', oldDisplay);
}

function notifyDisplayChange(changeType, display) {
  if (typeof displayChangeCallback === 'function') {
    try {
      displayChangeCallback(changeType, display);
    } catch (error) {
      console.error('[DisplayManager] Error in display change callback:', error);
    }
  }
}

export function getAllDisplays() {
  if (!app.isReady()) {
    console.warn('[DisplayManager] Cannot get displays before app is ready');
    return [];
  }

  try {
    return screen.getAllDisplays().map(display => ({
      id: display.id,
      name: getDisplayName(display),
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      internal: display.internal,
      primary: display.id === screen.getPrimaryDisplay().id
    }));
  } catch (error) {
    console.error('[DisplayManager] Error getting displays:', error);
    return [];
  }
}

export function getPrimaryDisplay() {
  if (!app.isReady()) {
    console.warn('[DisplayManager] Cannot get primary display before app is ready');
    return null;
  }

  try {
    const primary = screen.getPrimaryDisplay();
    return {
      id: primary.id,
      name: getDisplayName(primary),
      bounds: primary.bounds,
      workArea: primary.workArea,
      scaleFactor: primary.scaleFactor,
      rotation: primary.rotation,
      internal: primary.internal,
      primary: true
    };
  } catch (error) {
    console.error('[DisplayManager] Error getting primary display:', error);
    return null;
  }
}

export function getDisplayById(displayId) {
  if (!app.isReady()) {
    console.warn('[DisplayManager] Cannot get display before app is ready');
    return null;
  }

  try {
    const displays = screen.getAllDisplays();
    const display = displays.find(d => d.id === displayId);

    if (!display) {
      return null;
    }

    return {
      id: display.id,
      name: getDisplayName(display),
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      internal: display.internal,
      primary: display.id === screen.getPrimaryDisplay().id
    };
  } catch (error) {
    console.error('[DisplayManager] Error getting display by ID:', error);
    return null;
  }
}

function getDisplayName(display) {
  if (!app.isReady()) {
    return 'Display';
  }

  try {
    const primary = screen.getPrimaryDisplay();

    if (display.id === primary.id) {
      return 'Primary Display';
    }

    if (display.internal) {
      return 'Built-in Display';
    }

    return 'External Display';
  } catch (error) {
    console.error('[DisplayManager] Error getting display name:', error);
    return 'Display';
  }
}

export function saveDisplayAssignment(displayId, outputKey) {
  const storeInstance = initStore();
  const assignments = storeInstance.get('assignments', {});
  assignments[displayId] = {
    outputKey,
    assignedAt: Date.now()
  };
  storeInstance.set('assignments', assignments);
  console.log('[DisplayManager] Saved assignment:', displayId, '->', outputKey);
}

export function getDisplayAssignment(displayId) {
  const storeInstance = initStore();
  const assignments = storeInstance.get('assignments', {});
  return assignments[displayId] || null;
}

export function removeDisplayAssignment(displayId) {
  const storeInstance = initStore();
  const assignments = storeInstance.get('assignments', {});
  delete assignments[displayId];
  storeInstance.set('assignments', assignments);
  console.log('[DisplayManager] Removed assignment for display:', displayId);
}

export function getAllDisplayAssignments() {
  const storeInstance = initStore();
  return storeInstance.get('assignments', {});
}

export function clearAllDisplayAssignments() {
  const storeInstance = initStore();
  storeInstance.set('assignments', {});
  console.log('[DisplayManager] Cleared all display assignments');
}

export function moveWindowToDisplay(window, displayId, fullscreen = true) {
  if (!window || window.isDestroyed()) {
    console.warn('[DisplayManager] Cannot move destroyed window');
    return false;
  }

  const display = getDisplayById(displayId);
  if (!display) {
    console.warn('[DisplayManager] Display not found:', displayId);
    return false;
  }

  try {
    const { x, y, width, height } = display.bounds;

    window.setBounds({
      x: x,
      y: y,
      width: width,
      height: height
    });

    if (fullscreen) {
      window.setFullScreen(true);
    }

    console.log('[DisplayManager] Moved window to display:', displayId, 'fullscreen:', fullscreen);
    return true;
  } catch (error) {
    console.error('[DisplayManager] Error moving window to display:', error);
    return false;
  }
}

export function getWindowDisplay(window) {
  if (!window || window.isDestroyed()) {
    return null;
  }

  if (!app.isReady()) {
    console.warn('[DisplayManager] Cannot get window display before app is ready');
    return null;
  }

  try {
    const bounds = window.getBounds();
    const displays = screen.getAllDisplays();

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    for (const display of displays) {
      const { x, y, width, height } = display.bounds;
      if (centerX >= x && centerX < x + width && centerY >= y && centerY < y + height) {
        return {
          id: display.id,
          name: getDisplayName(display),
          bounds: display.bounds,
          workArea: display.workArea,
          scaleFactor: display.scaleFactor,
          rotation: display.rotation,
          internal: display.internal,
          primary: display.id === screen.getPrimaryDisplay().id
        };
      }
    }

    return getPrimaryDisplay();
  } catch (error) {
    console.error('[DisplayManager] Error getting window display:', error);
    return null;
  }
}

export function isDisplayConnected(displayId) {
  if (!app.isReady()) {
    return false;
  }

  try {
    const displays = screen.getAllDisplays();
    return displays.some(d => d.id === displayId);
  } catch (error) {
    console.error('[DisplayManager] Error checking display connection:', error);
    return false;
  }
}