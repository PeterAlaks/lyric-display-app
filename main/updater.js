import { app, dialog, BrowserWindow, shell } from 'electron';
import https from 'node:https';
import { requestRendererModal } from './modalBridge.js';
import updaterPkg from 'electron-updater';
import {
  createProgressWindow,
  closeProgressWindow,
  hideProgressWindow,
  updateProgressWindowState
} from './progressWindow.js';
import { createUpdateSessionPolicy } from './updateSessionPolicy.js';

const { autoUpdater } = updaterPkg;

const RETRYABLE_ERROR_RE = /(network|timeout|timed out|econnreset|etimedout|enotfound|eai_again|socket|download|sha512|checksum)/i;
const GITHUB_OWNER = 'PeterAlaks';
const GITHUB_REPO = 'lyric-display-app';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
const GITHUB_LATEST_RELEASE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

const INITIAL_STATE = {
  status: 'idle',
  updateMode: process.platform === 'darwin' ? 'manual' : 'auto',
  updateInfo: null,
  progress: null,
  error: null,
  downloadedAt: null
};

let updaterConfigured = false;
let showNoUpdateDialogForCurrentCheck = false;
let downloadPromise = null;
let state = { ...INITIAL_STATE };
let currentCheckIsInteractive = false;
const sessionPolicy = createUpdateSessionPolicy();

const normalizeVersionText = (value = '') => String(value).trim().replace(/^v/i, '');
const isManualMacUpdater = () => process.platform === 'darwin';

const compareVersions = (a, b) => {
  const pa = normalizeVersionText(a).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const pb = normalizeVersionText(b).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const max = Math.max(pa.length, pb.length, 3);

  for (let i = 0; i < max; i += 1) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }

  return 0;
};

const toUpdateInfo = (info = {}) => ({
  version: info?.version ? normalizeVersionText(info.version) : null,
  releaseNotes: info?.releaseNotes ?? null,
  releaseName: info?.releaseName ?? null,
  releaseDate: info?.releaseDate ?? null,
  manualDownload: Boolean(info?.manualDownload),
  downloadUrl: info?.downloadUrl ?? null,
  htmlUrl: info?.htmlUrl ?? null,
  assetName: info?.assetName ?? null,
  assetSize: Number(info?.assetSize) || 0,
  platform: info?.platform ?? process.platform,
  arch: info?.arch ?? process.arch
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
  sessionPolicy: sessionPolicy.getSnapshot(),
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

const githubApiRequest = (urlPath) => new Promise((resolve, reject) => {
  const url = urlPath.startsWith('http') ? urlPath : `${GITHUB_API_BASE}${urlPath}`;

  https.get(url, {
    headers: {
      'User-Agent': 'LyricDisplay-App',
      Accept: 'application/vnd.github.v3+json',
    },
    timeout: 10000,
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON response from GitHub releases'));
        }
        return;
      }

      if (res.statusCode === 404) {
        resolve(null);
        return;
      }

      reject(new Error(`GitHub releases returned ${res.statusCode}`));
    });
  }).on('error', reject)
    .on('timeout', function () {
      this.destroy();
      reject(new Error('GitHub releases request timed out'));
    });
});

const findMacDmgAsset = (release, version) => {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const expectedName = `LyricDisplay-${normalizeVersionText(version)}-macOS-${arch}.dmg`;

  return assets.find((asset) => asset?.name === expectedName)
    || assets.find((asset) => (
      typeof asset?.name === 'string'
      && asset.name.toLowerCase().endsWith('.dmg')
      && asset.name.toLowerCase().includes('macos')
      && asset.name.toLowerCase().includes(arch)
    ))
    || assets.find((asset) => (
      typeof asset?.name === 'string'
      && asset.name.toLowerCase().endsWith('.dmg')
      && asset.name.toLowerCase().includes('macos')
    ))
    || null;
};

const checkForManualMacUpdate = async (showNoUpdateDialogForResult = false) => {
  const interactive = Boolean(showNoUpdateDialogForResult);
  if (!interactive && sessionPolicy.deferAutomaticCheck()) {
    return getStateSnapshot();
  }

  if (state.status === 'checking') {
    return getStateSnapshot();
  }

  setState({
    status: 'checking',
    progress: null,
    error: null
  });

  try {
    const release = await githubApiRequest('/releases/latest');
    if (!release || !release.tag_name) {
      setState({
        status: 'idle',
        updateInfo: null,
        progress: null,
        error: null,
        downloadedAt: null
      });
      if (showNoUpdateDialogForResult) showNoUpdateDialog();
      return getStateSnapshot();
    }

    const latestVersion = normalizeVersionText(release.tag_name);
    const currentVersion = normalizeVersionText(app.getVersion());

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      setState({
        status: 'idle',
        updateInfo: null,
        progress: null,
        error: null,
        downloadedAt: null
      });
      if (showNoUpdateDialogForResult) showNoUpdateDialog();
      return getStateSnapshot();
    }

    const asset = findMacDmgAsset(release, latestVersion);
    const updateInfo = toUpdateInfo({
      version: latestVersion,
      releaseNotes: release.body || '',
      releaseName: release.name || '',
      releaseDate: release.published_at || '',
      manualDownload: true,
      downloadUrl: asset?.browser_download_url || release.html_url || GITHUB_LATEST_RELEASE_URL,
      htmlUrl: release.html_url || GITHUB_LATEST_RELEASE_URL,
      assetName: asset?.name || '',
      assetSize: asset?.size || 0,
      platform: 'darwin',
      arch: process.arch
    });

    const notificationDeferred = !interactive && sessionPolicy.deferNotification('available');
    setState({
      status: 'available',
      updateInfo,
      progress: null,
      error: null,
      downloadedAt: null
    });

    if (!notificationDeferred) {
      notifyAllWindows('updater:update-available', updateInfo);
    }
    return getStateSnapshot();
  } catch (err) {
    if (!interactive && sessionPolicy.deferAutomaticCheck()) {
      console.warn('Automatic macOS update check failed during Live Safety; retry deferred until the session closes.');
      setState({ status: 'idle', error: null });
      return getStateSnapshot();
    }
    handleUpdateError(err, 'check', 'manual');
    return getStateSnapshot();
  }
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

const handleCheckError = (err, source) => {
  if (!currentCheckIsInteractive && sessionPolicy.deferAutomaticCheck()) {
    console.warn(`Automatic update check failed during Live Safety (${source}); retry deferred until the session closes.`);
    currentCheckIsInteractive = false;
    setState({ status: 'idle', error: null });
    return null;
  }
  return handleUpdateError(err, 'check', source);
};

const ensureUpdaterConfigured = () => {
  if (isManualMacUpdater()) return;

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
    const notificationDeferred = !currentCheckIsInteractive
      && sessionPolicy.deferNotification('available');
    setState({
      status: 'available',
      updateInfo,
      progress: null,
      error: null,
      downloadedAt: null
    });

    if (!notificationDeferred) {
      notifyAllWindows('updater:update-available', updateInfo);
    }
    currentCheckIsInteractive = false;
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
    currentCheckIsInteractive = false;
  });

  autoUpdater.on('error', (err) => {
    const phase = state.status === 'downloading' ? 'download' : state.status || 'update';
    if (phase === 'checking') handleCheckError(err, 'event');
    else handleUpdateError(err, phase, 'event');
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

    const notificationDeferred = sessionPolicy.deferNotification('downloaded');
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
    if (!notificationDeferred) {
      notifyAllWindows('updater:update-downloaded', getStateSnapshot());
    }
  });
};

export function getUpdaterState() {
  ensureUpdaterConfigured();
  return getStateSnapshot();
}

export function checkForUpdates(showNoUpdateDialogForResult = false) {
  if (isManualMacUpdater()) {
    return checkForManualMacUpdate(showNoUpdateDialogForResult);
  }

  ensureUpdaterConfigured();

  const interactive = Boolean(showNoUpdateDialogForResult);
  if (!interactive && sessionPolicy.deferAutomaticCheck()) {
    return Promise.resolve(getStateSnapshot());
  }

  if (state.status === 'downloading' || state.status === 'installing') {
    return Promise.resolve(getStateSnapshot());
  }

  showNoUpdateDialogForCurrentCheck = Boolean(showNoUpdateDialogForResult);
  currentCheckIsInteractive = interactive;

  let updateCheck;
  try {
    updateCheck = autoUpdater.checkForUpdates();
  } catch (err) {
    handleCheckError(err, 'sync');
    return Promise.resolve(null);
  }

  if (updateCheck && typeof updateCheck.catch === 'function') {
    updateCheck.catch((err) => {
      handleCheckError(err, 'promise');
    });
  }

  return updateCheck;
}

export async function downloadAvailableUpdate({ parent } = {}) {
  if (isManualMacUpdater()) {
    if (!state.updateInfo?.manualDownload) {
      const error = handleUpdateError(
        new Error('No macOS update is currently available to download. Check for updates first.'),
        'download',
        'guard'
      );
      return { success: false, error: error.message, state: getStateSnapshot() };
    }

    const url = state.updateInfo.downloadUrl || state.updateInfo.htmlUrl || GITHUB_LATEST_RELEASE_URL;

    try {
      await shell.openExternal(url);
      setState({
        status: 'manual-download-opened',
        progress: null,
        error: null
      });

      return {
        success: true,
        manualDownload: true,
        openedExternal: true,
        downloadUrl: url,
        state: getStateSnapshot()
      };
    } catch (err) {
      const error = handleUpdateError(err, 'download', 'manual');
      return { success: false, error: error.message, state: getStateSnapshot() };
    }
  }

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
  if (isManualMacUpdater()) {
    return {
      success: false,
      manualDownload: true,
      error: 'macOS updates are installed manually from the downloaded DMG.',
      state: getStateSnapshot()
    };
  }

  ensureUpdaterConfigured();

  if (sessionPolicy.getSnapshot().sessionActive) {
    return {
      success: false,
      deferred: true,
      error: 'Turn off Live Safety before installing an update. LyricDisplay will keep the downloaded update ready.',
      state: getStateSnapshot()
    };
  }

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

export function setUpdateSessionActive(active) {
  const transition = sessionPolicy.setSessionActive(active);
  const snapshot = getStateSnapshot();
  if (!transition.changed) return { success: true, state: snapshot };

  notifyAllWindows('updater:state-changed', snapshot);
  updateProgressWindowState(snapshot);

  if (transition.releaseNotification === 'downloaded') {
    notifyAllWindows('updater:update-downloaded', snapshot);
  } else if (transition.releaseNotification === 'available' && state.updateInfo) {
    notifyAllWindows('updater:update-available', { ...state.updateInfo });
  } else if (transition.runDeferredCheck) {
    void checkForUpdates(false);
  }

  return { success: true, state: getStateSnapshot() };
}

export function hideUpdaterProgressWindow() {
  hideProgressWindow();
  return { success: true, state: getStateSnapshot() };
}
