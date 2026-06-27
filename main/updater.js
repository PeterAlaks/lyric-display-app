import { app, dialog, BrowserWindow } from 'electron';
import { requestRendererModal } from './modalBridge.js';
import updaterPkg from 'electron-updater';
import {
  createProgressWindow,
  closeProgressWindow,
  hideProgressWindow,
  updateProgressWindowState
} from './progressWindow.js';

const { autoUpdater } = updaterPkg;

const RETRYABLE_ERROR_RE = /(network|timeout|timed out|econnreset|etimedout|enotfound|eai_again|socket|download|sha512|checksum)/i;

const INITIAL_STATE = {
  status: 'idle',
  updateInfo: null,
  progress: null,
  error: null,
  downloadedAt: null
};

let updaterConfigured = false;
let showNoUpdateDialogForCurrentCheck = false;
let downloadPromise = null;
let state = { ...INITIAL_STATE };

const normalizeVersionText = (value = '') => String(value).trim().replace(/^v/i, '');

const toUpdateInfo = (info = {}) => ({
  version: info?.version ? normalizeVersionText(info.version) : null,
  releaseNotes: info?.releaseNotes ?? null,
  releaseName: info?.releaseName ?? null,
  releaseDate: info?.releaseDate ?? null
});

const toErrorPayload = (err, phase = state.status, source = 'event') => {
  const message = err == null ? 'Unknown error' : String(err?.message || err);
  const details = err == null ? '' : String(err?.stack || err?.message || err);

  return {
    message,
    details,
    phase,
    source,
    retryable: RETRYABLE_ERROR_RE.test(`${message}\n${details}`)
  };
};

const getStateSnapshot = () => ({
  ...state,
  updateInfo: state.updateInfo ? { ...state.updateInfo } : null,
  progress: state.progress ? { ...state.progress } : null,
  error: state.error ? { ...state.error } : null
});

const notifyAllWindows = (channel, payload) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win || win.isDestroyed()) return;
    try {
      win.webContents.send(channel, payload);
    } catch {
    }
  });
};

const setState = (patch) => {
  state = {
    ...state,
    ...patch
  };

  const snapshot = getStateSnapshot();
  notifyAllWindows('updater:state-changed', snapshot);
  updateProgressWindowState(snapshot);
  return snapshot;
};

const showNoUpdateDialog = () => {
  requestRendererModal({
    title: 'Up to date',
    description: "You're running the latest version of LyricDisplay.",
    variant: 'info',
    actions: [
      { label: 'OK', value: { response: 0 } },
    ],
  }, {
    fallback: () => dialog
      .showMessageBox({ type: 'info', buttons: ['OK'], message: "You're running the latest version of LyricDisplay." })
      .then((res) => ({ response: res.response })),
  }).catch(() => {
    dialog.showMessageBox({ type: 'info', buttons: ['OK'], message: "You're running the latest version of LyricDisplay." });
  });
};

const handleUpdateError = (err, phase = state.status, source = 'event') => {
  const error = toErrorPayload(err, phase, source);
  console.warn(`Updater ${phase} failed (${source}):`, error.details || error.message);
  showNoUpdateDialogForCurrentCheck = false;

  setState({
    status: 'error',
    error
  });

  notifyAllWindows('updater:update-error', error);
  return error;
};

const ensureUpdaterConfigured = () => {
  autoUpdater.autoDownload = false;

  if (updaterConfigured) return;
  updaterConfigured = true;

  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
    setState({
      status: 'checking',
      progress: null,
      error: null
    });
  });

  autoUpdater.on('update-available', (info) => {
    const updateInfo = toUpdateInfo(info);
    setState({
      status: 'available',
      updateInfo,
      progress: null,
      error: null,
      downloadedAt: null
    });

    notifyAllWindows('updater:update-available', updateInfo);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available.');
    setState({
      status: 'idle',
      progress: null,
      error: null
    });

    if (showNoUpdateDialogForCurrentCheck) {
      showNoUpdateDialog();
    }
    showNoUpdateDialogForCurrentCheck = false;
  });

  autoUpdater.on('error', (err) => {
    const phase = state.status === 'downloading' ? 'download' : state.status || 'update';
    handleUpdateError(err, phase, 'event');
    if (state.status === 'error') {
      downloadPromise = null;
    }
  });

  autoUpdater.on('download-progress', (progress = {}) => {
    const normalizedProgress = {
      bytesPerSecond: Number(progress.bytesPerSecond) || 0,
      percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
      transferred: Number(progress.transferred) || 0,
      total: Number(progress.total) || 0
    };

    console.log(
      `Download speed: ${normalizedProgress.bytesPerSecond} - ` +
      `Downloaded ${Math.round(normalizedProgress.percent)}% ` +
      `(${normalizedProgress.transferred}/${normalizedProgress.total})`
    );

    setState({
      status: 'downloading',
      progress: normalizedProgress,
      error: null
    });

    notifyAllWindows('updater:download-progress', normalizedProgress);
    notifyAllWindows('progress-update', normalizedProgress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    const updateInfo = toUpdateInfo(info);
    const nextUpdateInfo = {
      ...(state.updateInfo || {}),
      ...Object.fromEntries(
        Object.entries(updateInfo).filter(([, value]) => value !== null && typeof value !== 'undefined')
      )
    };

    setState({
      status: 'downloaded',
      updateInfo: Object.keys(nextUpdateInfo).length > 0 ? nextUpdateInfo : state.updateInfo,
      progress: {
        ...(state.progress || {}),
        percent: 100
      },
      error: null,
      downloadedAt: new Date().toISOString()
    });

    downloadPromise = null;
    closeProgressWindow();
    notifyAllWindows('updater:update-downloaded', getStateSnapshot());
  });
};

export function getUpdaterState() {
  ensureUpdaterConfigured();
  return getStateSnapshot();
}

export function checkForUpdates(showNoUpdateDialogForResult = false) {
  ensureUpdaterConfigured();

  if (state.status === 'downloading' || state.status === 'installing') {
    return Promise.resolve(getStateSnapshot());
  }

  showNoUpdateDialogForCurrentCheck = Boolean(showNoUpdateDialogForResult);

  let updateCheck;
  try {
    updateCheck = autoUpdater.checkForUpdates();
  } catch (err) {
    handleUpdateError(err, 'check', 'sync');
    return Promise.resolve(null);
  }

  if (updateCheck && typeof updateCheck.catch === 'function') {
    updateCheck.catch((err) => {
      handleUpdateError(err, 'check', 'promise');
    });
  }

  return updateCheck;
}

export async function downloadAvailableUpdate({ parent } = {}) {
  ensureUpdaterConfigured();

  if (state.status === 'downloaded') {
    return { success: true, alreadyDownloaded: true, state: getStateSnapshot() };
  }

  if (downloadPromise) {
    const progress = createProgressWindow({ parent, initialState: getStateSnapshot() });
    if (progress && !progress.isDestroyed()) {
      try {
        progress.show();
        progress.focus();
      } catch {
      }
    }
    return { success: true, inProgress: true, state: getStateSnapshot() };
  }

  if (!state.updateInfo) {
    const error = handleUpdateError(
      new Error('No update is currently available to download. Check for updates first.'),
      'download',
      'guard'
    );
    return { success: false, error: error.message, state: getStateSnapshot() };
  }

  const progress = createProgressWindow({ parent, initialState: getStateSnapshot() });
  if (progress && !progress.isDestroyed()) {
    try {
      if (parent && typeof parent.isMinimized === 'function' && parent.isMinimized()) {
        progress.hide();
      } else {
        progress.show();
      }
    } catch {
    }
  }

  setState({
    status: 'downloading',
    progress: state.progress || {
      bytesPerSecond: 0,
      percent: 0,
      transferred: 0,
      total: 0
    },
    error: null
  });

  downloadPromise = autoUpdater.downloadUpdate()
    .then(() => ({ success: true, state: getStateSnapshot() }))
    .catch((err) => {
      const error = handleUpdateError(err, 'download', 'promise');
      return { success: false, error: error.message, state: getStateSnapshot() };
    })
    .finally(() => {
      downloadPromise = null;
    });

  return downloadPromise;
}

export function installDownloadedUpdate() {
  ensureUpdaterConfigured();

  if (state.status !== 'downloaded') {
    return {
      success: false,
      error: 'No downloaded update is ready to install.',
      state: getStateSnapshot()
    };
  }

  try {
    setState({ status: 'installing', error: null });
    app.isQuitting = true;
    autoUpdater.quitAndInstall(false, true);
    return { success: true, state: getStateSnapshot() };
  } catch (err) {
    const error = handleUpdateError(err, 'install', 'sync');
    return { success: false, error: error.message, state: getStateSnapshot() };
  }
}

export function hideUpdaterProgressWindow() {
  hideProgressWindow();
  return { success: true, state: getStateSnapshot() };
}
