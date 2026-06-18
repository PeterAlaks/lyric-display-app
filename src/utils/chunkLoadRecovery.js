const RECOVERY_KEY = 'lyricdisplay:chunk-load-recovery';
const RECOVERY_WINDOW_MS = 60_000;
const RELOAD_DELAY_MS = 750;

export function isChunkLoadError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  const name = String(error?.name || '').toLowerCase();

  return name.includes('chunkloaderror')
    || message.includes('failed to fetch dynamically imported module')
    || message.includes('error loading dynamically imported module')
    || message.includes('importing a module script failed')
    || message.includes('loading chunk')
    || message.includes('failed to import');
}

function readLastRecovery() {
  try {
    return Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
  } catch {
    return 0;
  }
}

function writeLastRecovery(timestamp) {
  try {
    sessionStorage.setItem(RECOVERY_KEY, String(timestamp));
  } catch {
  }
}

function reloadWindow() {
  try {
    const reload = window.electronAPI?.windowControls?.reload;
    if (typeof reload === 'function') {
      reload();
      return;
    }
  } catch {
  }

  window.location.reload();
}

export function scheduleChunkLoadRecovery(error, source = 'unknown') {
  if (typeof window === 'undefined' || !isChunkLoadError(error)) {
    return false;
  }

  const now = Date.now();
  const lastRecovery = readLastRecovery();
  if (lastRecovery && now - lastRecovery < RECOVERY_WINDOW_MS) {
    return false;
  }

  writeLastRecovery(now);
  try {
    console.warn('Recovering from chunk load failure by reloading window:', source, error);
  } catch {
  }

  setTimeout(reloadWindow, RELOAD_DELAY_MS);
  return true;
}

export function registerChunkLoadRecovery() {
  if (typeof window === 'undefined' || window.__lyricDisplayChunkLoadRecoveryRegistered) {
    return;
  }

  window.__lyricDisplayChunkLoadRecoveryRegistered = true;

  window.addEventListener('vite:preloadError', (event) => {
    if (scheduleChunkLoadRecovery(event?.payload, 'vite:preloadError')) {
      event.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (scheduleChunkLoadRecovery(event?.reason, 'unhandledrejection')) {
      event.preventDefault();
    }
  });
}
