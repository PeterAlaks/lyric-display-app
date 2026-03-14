/**
 * NDI Manager
 * Manages NDI companion app installation, lifecycle, settings, and version checking.
 * The companion is a headless Electron application packaged from the lyricdisplay-ndi repository.
 * It loads the output pages in offscreen BrowserWindows and pushes captured frames to NDI.
 *
 * NDI® is a registered trademark of Vizrt NDI AB. https://ndi.video
 */

import { app, ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { spawn } from 'child_process';
import https from 'https';
import http from 'http';

const isDev = !app.isPackaged;

const GITHUB_OWNER = 'PeterAlaks';
const GITHUB_REPO = 'lyricdisplay-ndi';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
const DEFAULT_IPC_HOST = '127.0.0.1';
const DEFAULT_IPC_PORT = 9137;

const ndiStore = new Store({
  name: 'ndi-settings',
  defaults: {
    installed: false,
    version: '',
    installPath: '',
    autoLaunch: false,
    pendingUpdateInfo: null,
    ipc: {
      host: DEFAULT_IPC_HOST,
      port: DEFAULT_IPC_PORT,
    },
    outputs: {
      output1: {
        enabled: false,
        resolution: '1080p',
        customWidth: 1920,
        customHeight: 1080,
        framerate: 30,
        sourceName: 'LyricDisplay Output 1',
      },
      output2: {
        enabled: false,
        resolution: '1080p',
        customWidth: 1920,
        customHeight: 1080,
        framerate: 30,
        sourceName: 'LyricDisplay Output 2',
      },
      stage: {
        enabled: false,
        resolution: '1080p',
        customWidth: 1920,
        customHeight: 1080,
        framerate: 30,
        sourceName: 'LyricDisplay Stage',
      },
    },
  },
});

let companionProcess = null;
let latestReleaseCache = null;
let lastReleaseCheck = 0;
const RELEASE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
let commandSeq = 0;
let statsInterval = null;
let companionProtocolVersion = null; // set from hello handshake

let activeDownloadOperation = null;
let activeDownloadAbortController = null;

// ============ Persistent Connection ============

/**
 * Maintains a single persistent TCP connection to the companion for
 * commands and telemetry polling.  Falls back to one-shot connections
 * if the persistent socket is unavailable or not yet established.
 */
let persistentSocket = null;
let persistentBuffer = '';
let persistentConnecting = false;
let persistentReady = false;
/** @type {Map<number, { resolve: Function, responses: object[], timer: ReturnType<typeof setTimeout>, idleTimer: ReturnType<typeof setTimeout>|null }>} */
const persistentPendingCallbacks = new Map();

function connectPersistentSocket() {
  if (persistentSocket && !persistentSocket.destroyed) return;
  if (persistentConnecting) return;

  const { host, port } = getIpcConfig();
  persistentConnecting = true;
  persistentReady = false;

  const socket = net.createConnection({ host, port });

  socket.on('connect', () => {
    persistentConnecting = false;
    persistentReady = true;
    persistentSocket = socket;
    persistentBuffer = '';
    console.log('[NDI] Persistent IPC connection established');
  });

  socket.on('data', (chunk) => {
    persistentBuffer += chunk.toString('utf8');
    let idx = persistentBuffer.indexOf('\n');
    while (idx >= 0) {
      const line = persistentBuffer.slice(0, idx).trim();
      persistentBuffer = persistentBuffer.slice(idx + 1);
      if (line) {
        try {
          const msg = JSON.parse(line);
          if (msg.seq != null) {
            const pending = persistentPendingCallbacks.get(msg.seq);
            if (pending) {
              pending.responses.push(msg);

              if (pending.idleTimer) clearTimeout(pending.idleTimer);
              pending.idleTimer = setTimeout(() => {
                clearTimeout(pending.timer);
                persistentPendingCallbacks.delete(msg.seq);
                pending.resolve({ success: true, responses: pending.responses, error: null });
              }, 60);
            }
          }
        } catch { /* ignore malformed lines */ }
      }
      idx = persistentBuffer.indexOf('\n');
    }
  });

  socket.on('error', () => {
    persistentConnecting = false;
    persistentReady = false;
    drainPendingCallbacks('connection error');
    persistentSocket = null;
  });

  socket.on('close', () => {
    persistentConnecting = false;
    persistentReady = false;
    drainPendingCallbacks('connection closed');
    persistentSocket = null;
  });
}

function drainPendingCallbacks(reason) {
  for (const [, pending] of persistentPendingCallbacks) {
    clearTimeout(pending.timer);
    if (pending.idleTimer) clearTimeout(pending.idleTimer);
    pending.resolve({
      success: pending.responses.length > 0,
      responses: pending.responses,
      error: pending.responses.length > 0 ? null : reason,
    });
  }
  persistentPendingCallbacks.clear();
}

function destroyPersistentSocket() {
  if (persistentSocket) {
    try { persistentSocket.destroy(); } catch { /* ignore */ }
    persistentSocket = null;
  }
  persistentConnecting = false;
  persistentReady = false;
  drainPendingCallbacks('socket destroyed');
}

// ============ IPC Helpers ============

function getIpcConfig() {
  const settings = ndiStore.get('ipc') || {};
  const host = String(settings.host || DEFAULT_IPC_HOST);
  const rawPort = Number(settings.port || DEFAULT_IPC_PORT);
  const port = Number.isFinite(rawPort) ? Math.max(1024, Math.min(65535, rawPort)) : DEFAULT_IPC_PORT;
  return { host, port };
}

function getNextSeq() {
  commandSeq += 1;
  return commandSeq;
}

/**
 * Send a JSON-line command to the companion over TCP and collect responses.
 * Prefers the persistent socket when available; falls back to a one-shot
 * connection otherwise (e.g. during the initial hello before the persistent
 * socket is established, or if the persistent socket dropped).
 */
function sendCommand(type, payload = {}, extra = {}) {
  const timeoutMs = 1500;

  const command = {
    type,
    seq: extra.seq ?? getNextSeq(),
    ts: Date.now(),
    output: extra.output,
    payload,
  };

  if (persistentReady && persistentSocket && !persistentSocket.destroyed) {
    return new Promise((resolve) => {
      const entry = {
        resolve,
        responses: [],
        idleTimer: null,
        timer: setTimeout(() => {
          persistentPendingCallbacks.delete(command.seq);
          if (entry.idleTimer) clearTimeout(entry.idleTimer);
          resolve({
            success: entry.responses.length > 0,
            responses: entry.responses,
            error: entry.responses.length > 0 ? null : `IPC timeout after ${timeoutMs}ms`,
          });
        }, timeoutMs),
      };
      persistentPendingCallbacks.set(command.seq, entry);

      try {
        persistentSocket.write(JSON.stringify(command) + '\n');
      } catch (error) {
        clearTimeout(entry.timer);
        persistentPendingCallbacks.delete(command.seq);
        resolve({ success: false, responses: [], error: error.message });
      }
    });
  }

  const { host, port } = getIpcConfig();

  return new Promise((resolve) => {
    let settled = false;
    let buffer = '';
    const responses = [];
    let idleTimer = null;

    const socket = net.createConnection({ host, port });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (idleTimer) clearTimeout(idleTimer);
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        success: responses.length > 0,
        responses,
        error: responses.length > 0 ? null : `IPC timeout after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    const scheduleIdleFinish = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        clearTimeout(timeout);
        finish({ success: true, responses, error: null });
      }, 60);
    };

    socket.on('connect', () => {
      try {
        socket.write(JSON.stringify(command) + '\n');
      } catch (error) {
        clearTimeout(timeout);
        finish({ success: false, responses, error: error.message });
      }
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx = buffer.indexOf('\n');
      while (idx >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line) {
          try { responses.push(JSON.parse(line)); } catch { responses.push({ type: 'error', payload: { message: 'invalid JSON' } }); }
        }
        idx = buffer.indexOf('\n');
      }
      scheduleIdleFinish();
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      finish({ success: false, responses, error: error.message });
    });

    socket.on('end', () => {
      clearTimeout(timeout);
      finish({ success: responses.length > 0, responses, error: responses.length > 0 ? null : 'connection closed' });
    });
  });
}

// ============ Path Helpers ============

function getInstallPath() {
  if (isDev) {
    return path.join(app.getAppPath(), 'lyricdisplay-ndi');
  }

  return path.join(app.getPath('userData'), 'lyricdisplay-ndi');
}

function getCompanionBinaryName() {
  if (process.platform === 'win32') return 'LyricDisplay NDI.exe';
  if (process.platform === 'darwin') return 'LyricDisplay NDI.app/Contents/MacOS/LyricDisplay NDI';
  return 'lyricdisplay-ndi';
}

function getCompanionEntryPath() {
  const binary = getCompanionBinaryName();
  const installPath = getInstallPath();

  if (isDev) {
    return path.join(installPath, 'src', 'main.js');
  }

  // electron-builder zip archives may extract with the binary at the
  // top level or inside a subfolder.  On macOS the .app bundle may also
  // sit at the top level.  Try several common layouts.
  const candidates = [
    path.join(installPath, binary),
    path.join(installPath, 'lyricdisplay-ndi', binary),
  ];

  // On macOS, also check for the .app bundle directly in the install dir.
  if (process.platform === 'darwin') {
    candidates.push(path.join(installPath, 'LyricDisplay NDI.app', 'Contents', 'MacOS', 'LyricDisplay NDI'));
  }

  // On Linux, electron-builder may name the binary after the productName.
  if (process.platform === 'linux') {
    candidates.push(path.join(installPath, 'LyricDisplay NDI'));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

// ============ Platform Helpers ============

function getPlatformAssetName() {
  if (process.platform === 'win32') return 'lyricdisplay-ndi-win.zip';
  if (process.platform === 'darwin') {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    return `lyricdisplay-ndi-mac-${arch}.zip`;
  }
  return 'lyricdisplay-ndi-linux.zip';
}

// ============ Installation Check ============

function checkInstalled() {
  const entryPath = getCompanionEntryPath();

  // In dev mode, check if the companion source exists.
  if (isDev) {
    const installed = fs.existsSync(entryPath);
    let version = ndiStore.get('version') || '';
    // In dev mode, read the version directly from the companion's package.json
    // so it always reflects the current source, not a stale store value.
    if (installed) {
      try {
        const companionPkg = JSON.parse(fs.readFileSync(path.join(getInstallPath(), 'package.json'), 'utf8'));
        if (companionPkg.version) version = companionPkg.version;
      } catch { /* fallback to store value */ }
    }
    return {
      installed,
      version,
      installPath: getInstallPath(),
      companionPath: entryPath,
    };
  }

  const installed = fs.existsSync(entryPath);

  if (installed) {
    return {
      installed: true,
      version: ndiStore.get('version') || '',
      installPath: getInstallPath(),
      companionPath: entryPath,
    };
  }

  if (ndiStore.get('installed')) {
    ndiStore.set('installed', false);
  }

  return {
    installed: false,
    version: ndiStore.get('version') || '',
    installPath: '',
    companionPath: entryPath,
  };
}

// ============ GitHub API Helpers ============

function githubApiRequest(urlPath) {
  return new Promise((resolve, reject) => {
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
          try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON response')); }
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}`));
        }
      });
    }).on('error', reject)
      .on('timeout', function () { this.destroy(); reject(new Error('Request timeout')); });
  });
}

// ============ Version Checking ============

function compareVersions(a, b) {
  if (!a || !b) return 0;
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

async function checkForCompanionUpdate() {
  // Skip GitHub checks in development mode
  if (isDev) {
    const status = checkInstalled();
    const currentVersion = status.version || '';
    return {
      updateAvailable: false,
      latestVersion: currentVersion,
      currentVersion,
      downloadUrl: null,
      downloadSize: 0,
      releaseNotes: '[Development Mode] Using local companion source',
      releaseName: '',
      releaseDate: '',
      htmlUrl: '',
    };
  }

  const now = Date.now();
  if (latestReleaseCache && (now - lastReleaseCheck) < RELEASE_CHECK_INTERVAL) {
    return latestReleaseCache;
  }

  try {
    const release = await githubApiRequest('/releases/latest');
    if (!release || !release.tag_name) {
      return { updateAvailable: false, latestVersion: '', currentVersion: ndiStore.get('version') || '' };
    }

    const latestVersion = release.tag_name.replace(/^v/, '');
    const currentVersion = ndiStore.get('version') || '';
    const installed = checkInstalled().installed;

    const expectedAssetName = getPlatformAssetName();
    const asset = release.assets?.find((a) => a.name === expectedAssetName)
      || release.assets?.find((a) => a.name.includes(process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'));

    const result = {
      updateAvailable: installed && currentVersion && compareVersions(latestVersion, currentVersion) > 0,
      latestVersion,
      currentVersion,
      downloadUrl: asset?.browser_download_url || null,
      downloadSize: asset?.size || 0,
      releaseNotes: release.body || '',
      releaseName: release.name || '',
      releaseDate: release.published_at || '',
      htmlUrl: release.html_url || '',
    };

    latestReleaseCache = result;
    lastReleaseCheck = now;
    return result;
  } catch (error) {
    console.warn('[NDI] Failed to check for companion updates:', error.message);
    return {
      updateAvailable: false,
      latestVersion: '',
      currentVersion: ndiStore.get('version') || '',
      error: error.message,
    };
  }
}

// ============ Download & Install ============

function followRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, {
      headers: { 'User-Agent': 'LyricDisplay-App' },
      timeout: 30000,
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        followRedirects(response.headers.location, maxRedirects - 1).then(resolve).catch(reject);
      } else if (response.statusCode === 200) {
        resolve(response);
      } else {
        reject(new Error(`Download failed with status ${response.statusCode}`));
      }
    }).on('error', reject)
      .on('timeout', function () { this.destroy(); reject(new Error('Download timeout')); });
  });
}

function streamToFile(response, filePath, abortController) {
  return new Promise((resolve, reject) => {
    const totalSize = parseInt(response.headers['content-length'], 10) || 0;
    let downloadedSize = 0;
    let cancelled = false;
    const file = fs.createWriteStream(filePath);

    const onAbort = () => {
      cancelled = true;
      response.destroy();
      file.destroy();
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      reject(new Error('Download cancelled by user'));
    };

    if (abortController) {
      abortController.signal.addEventListener('abort', onAbort, { once: true });
    }

    response.on('data', (chunk) => {
      if (cancelled) return;
      downloadedSize += chunk.length;
      const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;

      notifyAllWindows('ndi:download-progress', {
        percent,
        downloaded: downloadedSize,
        total: totalSize,
        status: 'downloading',
      });
    });

    response.pipe(file);

    file.on('finish', () => {
      if (cancelled) return;
      if (abortController) {
        abortController.signal.removeEventListener('abort', onAbort);
      }
      file.close(() => resolve());
    });

    file.on('error', (err) => {
      if (cancelled) return;
      if (abortController) {
        abortController.signal.removeEventListener('abort', onAbort);
      }
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      reject(err);
    });
  });
}

async function downloadCompanion(updateInfo = null) {

  if (activeDownloadOperation) {
    console.warn('[NDI] Download already in progress, returning existing operation');
    return activeDownloadOperation;
  }

  const abortController = new AbortController();
  activeDownloadAbortController = abortController;

  const operation = (async () => {
    let downloadUrl;
    let resolvedVersion = updateInfo?.latestVersion || '';

    if (updateInfo?.downloadUrl) {
      downloadUrl = updateInfo.downloadUrl;
    } else {

      try {
        const releaseInfo = await checkForCompanionUpdate();
        if (releaseInfo?.downloadUrl) {
          downloadUrl = releaseInfo.downloadUrl;
          resolvedVersion = releaseInfo.latestVersion || '';
        }
      } catch { /* fallback below */ }

      if (!downloadUrl) {
        const assetName = getPlatformAssetName();
        downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/${assetName}`;
      }
    }

    const installPath = getInstallPath();
    const zipPath = path.join(app.getPath('temp'), `ndi-companion-${Date.now()}.zip`);

    try {
      console.log(`[NDI] Downloading from: ${downloadUrl}`);
      const response = await followRedirects(downloadUrl);

      await streamToFile(response, zipPath, abortController);

      stopCompanion();


      await extractZip(zipPath, installPath);
      try { fs.unlinkSync(zipPath); } catch { /* ignore */ }


      if (!resolvedVersion) {
        try {

          const candidates = [
            path.join(installPath, 'package.json'),
            path.join(installPath, 'resources', 'app', 'package.json'),
          ];
          for (const pkgPath of candidates) {
            if (fs.existsSync(pkgPath)) {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
              if (pkg.version) { resolvedVersion = pkg.version; break; }
            }
          }
        } catch { /* ignore */ }
      }

      if (!resolvedVersion) {
        try {
          latestReleaseCache = null;
          lastReleaseCheck = 0;
          const latest = await checkForCompanionUpdate();
          if (latest?.latestVersion) resolvedVersion = latest.latestVersion;
        } catch { /* ignore */ }
      }

      ndiStore.set('installed', true);
      ndiStore.set('version', resolvedVersion);
      ndiStore.set('installPath', installPath);

      latestReleaseCache = null;
      lastReleaseCheck = 0;

      const result = { success: true, version: resolvedVersion, path: installPath };
      console.log(`[NDI] Companion installed: v${resolvedVersion} at ${installPath}`);

      notifyAllWindows('ndi:download-complete', result);

      return result;
    } catch (err) {
      try { fs.unlinkSync(zipPath); } catch { /* ignore */ }

      const isCancelled = err.message === 'Download cancelled by user';
      const errorResult = {
        success: false,
        error: isCancelled ? 'Download cancelled' : `Download/install failed: ${err.message}`,
        cancelled: isCancelled,
      };

      notifyAllWindows('ndi:download-failed', errorResult);
      return errorResult;
    }
  })();

  activeDownloadOperation = operation;
  try {
    return await operation;
  } finally {
    activeDownloadOperation = null;
    activeDownloadAbortController = null;
  }
}

function cancelDownload() {
  if (activeDownloadAbortController) {
    console.log('[NDI] Cancelling active download');
    activeDownloadAbortController.abort();
    return { success: true };
  }
  return { success: false, error: 'No active download to cancel' };
}


async function extractZip(zipPath, destPath) {
  const extract = (await import('extract-zip')).default;

  const tempExtractPath = destPath + '-extracting-' + Date.now();

  console.log('[NDI] Starting extraction to temp:', tempExtractPath);
  const start = Date.now();

  notifyAllWindows('ndi:download-progress', { percent: 0, status: 'extracting' });

  const previousNoAsar = process.noAsar;
  process.noAsar = true;

  try {
    fs.mkdirSync(tempExtractPath, { recursive: true });

    let entriesProcessed = 0;
    let totalEntries = 0;

    await extract(zipPath, {
      dir: tempExtractPath,
      onEntry(entry, zipfile) {

        if (!totalEntries && zipfile.entryCount) {
          totalEntries = zipfile.entryCount;
        }
        entriesProcessed += 1;
        if (totalEntries > 0) {
          const percent = Math.min(99, Math.round((entriesProcessed / totalEntries) * 100));
          notifyAllWindows('ndi:download-progress', { percent, status: 'extracting' });
        }
      },
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[NDI] Extraction completed in ${elapsed}s, moving to final location`);

    if (fs.existsSync(destPath)) {
      fs.rmSync(destPath, { recursive: true, force: true });
    }

    fs.renameSync(tempExtractPath, destPath);

    console.log('[NDI] Moved extracted files to:', destPath);
  } catch (err) {

    try { fs.rmSync(tempExtractPath, { recursive: true, force: true }); } catch { /* ignore */ }
    throw err;
  } finally {

    process.noAsar = previousNoAsar;
  }

  notifyAllWindows('ndi:download-progress', { percent: 100, status: 'extracting' });


  if (process.platform !== 'win32') {
    try {
      const entryPath = getCompanionEntryPath();
      if (entryPath && fs.existsSync(entryPath)) {
        fs.chmodSync(entryPath, 0o755);
      }
    } catch { /* non-critical */ }
  }
}

// ============ Uninstall ============

function uninstallCompanion() {
  stopCompanion();
  const installPath = getInstallPath();

  if (isDev) {
    console.warn('[NDI] Cannot uninstall in dev mode (source directory)');
    return { success: false, error: 'Cannot uninstall in dev mode' };
  }

  try {
    if (fs.existsSync(installPath)) {
      fs.rmSync(installPath, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('[NDI] Error removing companion files:', error);
  }

  ndiStore.set('installed', false);
  ndiStore.set('version', '');
  ndiStore.set('installPath', '');
  latestReleaseCache = null;
  lastReleaseCheck = 0;

  return { success: true };
}

// ============ Companion Process Management ============

function buildOutputsPayload() {
  const outputs = ndiStore.get('outputs');
  return {
    outputs: outputs && typeof outputs === 'object' ? outputs : {},
  };
}

/**
 * Send the full output configuration to the companion.
 * Used during the initial handshake after launch.
 */
async function syncOutputs() {
  if (!companionProcess) return;
  const result = await sendCommand('set_outputs', buildOutputsPayload());
  if (!result.success) {
    console.warn('[NDI] Failed to sync output settings:', result.error || 'Unknown error');
  }
}

/**
 * Send only a single output's configuration to the companion.
 * Used when the user changes a setting for one output, avoiding
 * unnecessary recreation checks on the other two outputs.
 */
async function syncSingleOutput(outputKey) {
  if (!companionProcess) return;
  const config = ndiStore.get(`outputs.${outputKey}`);
  if (!config) return;

  if (config.enabled) {
    const result = await sendCommand('enable_output', config, { output: outputKey });
    if (!result.success) {
      console.warn(`[NDI] Failed to sync ${outputKey}:`, result.error || 'Unknown error');
    }
  } else {
    const result = await sendCommand('disable_output', {}, { output: outputKey });
    if (!result.success) {
      console.warn(`[NDI] Failed to disable ${outputKey}:`, result.error || 'Unknown error');
    }
  }
}

async function requestStats() {
  if (!companionProcess) return;
  const result = await sendCommand('request_stats', {});
  if (!result.success || !Array.isArray(result.responses)) return;

  const stats = result.responses.find((e) => e?.type === 'stats');
  if (stats) {
    notifyAllWindows('ndi:companion-telemetry', { stats: stats.payload || null });
  }
}

function startStatsLoop() {
  if (statsInterval) clearInterval(statsInterval);
  statsInterval = setInterval(() => {
    requestStats().catch((err) => {
      console.warn('[NDI] Telemetry poll failed:', err?.message || err);
    });
  }, 5000);
}

function stopStatsLoop() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
}

async function launchCompanion() {
  if (companionProcess) {
    return { success: true, message: 'Already running' };
  }

  const entryPath = getCompanionEntryPath();
  const ipcConfig = getIpcConfig();

  if (isDev) {
    // In dev mode, launch via the running Electron binary pointing at the companion source.
    if (!fs.existsSync(entryPath)) {
      return { success: false, error: `Companion source not found at ${entryPath}` };
    }

    const electronBin = process.execPath;
    const companionDir = getInstallPath();
    const args = [
      companionDir,
      '--host', ipcConfig.host,
      '--port', String(ipcConfig.port),
      '--app-url', 'http://localhost:5173',
      '--no-hash',
    ];

    const childEnv = { ...process.env };
    delete childEnv.ELECTRON_RUN_AS_NODE;

    try {
      console.log(`[NDI] Launching companion (dev): ${electronBin} ${args.join(' ')}`);
      companionProcess = spawn(electronBin, args, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: companionDir,
        env: childEnv,
      });
    } catch (error) {
      console.error('[NDI] Failed to launch companion (dev):', error);
      companionProcess = null;
      return { success: false, error: error.message };
    }
  } else {
    if (!fs.existsSync(entryPath)) {
      return { success: false, error: `NDI companion not found at ${entryPath}` };
    }

    const args = [
      '--host', ipcConfig.host,
      '--port', String(ipcConfig.port),
      '--app-url', 'http://127.0.0.1:4000',
    ];

    try {
      console.log(`[NDI] Launching companion: ${entryPath} ${args.join(' ')}`);
      companionProcess = spawn(entryPath, args, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: path.dirname(entryPath),
        env: { ...process.env },
      });
    } catch (error) {
      console.error('[NDI] Failed to launch companion:', error);
      companionProcess = null;
      return { success: false, error: error.message };
    }
  }

  companionProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[NDI Companion] ${msg}`);
  });

  companionProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[NDI Companion] ${msg}`);
  });

  companionProcess.on('exit', (code) => {
    console.log('[NDI] Companion exited with code:', code);
    companionProcess = null;
    companionProtocolVersion = null;
    destroyPersistentSocket();
    stopStatsLoop();
    notifyAllWindows('ndi:companion-status', { running: false });
  });

  companionProcess.on('error', (err) => {
    console.error('[NDI] Companion error:', err);
    companionProcess = null;
    companionProtocolVersion = null;
    destroyPersistentSocket();
    stopStatsLoop();
    notifyAllWindows('ndi:companion-status', { running: false, error: err.message });
  });

  notifyAllWindows('ndi:companion-status', { running: true });
  startStatsLoop();

  setTimeout(async () => {
    const hello = await sendCommand('hello', {});
    if (!hello.success) {
      console.warn('[NDI] Hello handshake failed:', hello.error || 'Unknown error');
    } else {
      const helloResponse = hello.responses?.find((r) => r?.type === 'hello');
      if (helloResponse?.payload?.version) {
        companionProtocolVersion = helloResponse.payload.version;
        console.log(`[NDI] Companion protocol version: ${companionProtocolVersion}`);

        const expectedVersion = ndiStore.get('version') || '';
        if (expectedVersion && companionProtocolVersion !== expectedVersion) {
          console.warn(`[NDI] Version mismatch: expected v${expectedVersion}, companion reports v${companionProtocolVersion}`);
        }
      }
    }

    connectPersistentSocket();

    await syncOutputs();
    await requestStats();
  }, 1500);

  console.log('[NDI] Companion launched successfully');
  return { success: true };
}

function stopCompanion() {
  if (!companionProcess) {
    return { success: true, message: 'Not running' };
  }

  sendCommand('shutdown', {}).catch((error) => {
    console.warn('[NDI] Graceful shutdown request failed:', error?.message || error);
  });

  try { companionProcess.kill(); } catch (error) {
    console.warn('[NDI] Error killing companion process:', error);
  }

  stopStatsLoop();
  destroyPersistentSocket();
  companionProcess = null;
  companionProtocolVersion = null;
  notifyAllWindows('ndi:companion-status', { running: false });
  console.log('[NDI] Companion stopped');
  return { success: true };
}

function getCompanionStatus() {
  const installStatus = checkInstalled();
  return {
    running: companionProcess !== null,
    installed: installStatus.installed,
    companionPath: installStatus.companionPath,
    version: ndiStore.get('version') || '',
    protocolVersion: companionProtocolVersion,
    autoLaunch: ndiStore.get('autoLaunch') || false,
  };
}

// ============ Settings ============

function formatOutputLabel(outputKey) {
  if (outputKey === 'stage') return 'Stage';
  const match = /^output(\d+)$/i.exec(String(outputKey));
  if (match) return `Output ${match[1]}`;
  return String(outputKey);
}

function getOutputDefaults(outputKey) {
  const label = formatOutputLabel(outputKey);
  return {
    enabled: false,
    resolution: '1080p',
    customWidth: 1920,
    customHeight: 1080,
    framerate: 30,
    sourceName: `LyricDisplay ${label}`,
  };
}

function ensureOutputSettings(outputKey) {
  const defaults = getOutputDefaults(outputKey);
  const current = ndiStore.get(`outputs.${outputKey}`);
  const safeCurrent = (current && typeof current === 'object') ? current : {};
  const merged = { ...defaults, ...safeCurrent };
  const needsWrite = Object.keys(defaults).some((key) => safeCurrent[key] === undefined);

  if (needsWrite) {
    ndiStore.set(`outputs.${outputKey}`, merged);
  }

  return merged;
}

function getOutputSettings(outputKey) {
  const settings = ensureOutputSettings(outputKey);
  return {
    settings,
    companionConnected: companionProcess !== null,
    isBroadcasting: settings?.enabled && companionProcess !== null,
  };
}

function setOutputSetting(outputKey, key, value) {
  ensureOutputSettings(outputKey);
  ndiStore.set(`outputs.${outputKey}.${key}`, value);
  if (companionProcess) {
    syncSingleOutput(outputKey).catch((error) => {
      console.warn('[NDI] Failed syncing output setting change:', error?.message || error);
    });
  }
  return { success: true };
}

// ============ Pending Update State ============

function storePendingUpdateInfo(updateInfo) {
  if (updateInfo && updateInfo.updateAvailable) {
    ndiStore.set('pendingUpdateInfo', updateInfo);
    return true;
  }
  return false;
}

function getPendingUpdateInfo() {
  return ndiStore.get('pendingUpdateInfo') || null;
}

function clearPendingUpdateInfo() {
  ndiStore.set('pendingUpdateInfo', null);
}

// ============ Helpers ============

function notifyAllWindows(channel, data) {
  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    });
  } catch (error) {
    console.warn('[NDI] Error notifying windows:', error);
  }
}

// ============ Startup Update Check ============

async function performStartupUpdateCheck() {
  try {
    if (isDev) {
      console.log('[NDI] Skipping startup update check in development mode');
      ndiStore.set('pendingUpdateInfo', null);
      return;
    }

    const status = checkInstalled();
    if (!status.installed) return;

    const pending = ndiStore.get('pendingUpdateInfo');
    if (pending?.latestVersion && status.version && compareVersions(status.version, pending.latestVersion) >= 0) {
      ndiStore.set('pendingUpdateInfo', null);
    }
    const updateInfo = await checkForCompanionUpdate();
    if (updateInfo.updateAvailable) {
      console.log(`[NDI] Companion update available: v${updateInfo.currentVersion} -> v${updateInfo.latestVersion}`);
      storePendingUpdateInfo(updateInfo);
      notifyAllWindows('ndi:update-available', updateInfo);
    }
  } catch (error) {
    console.warn('[NDI] Startup update check failed:', error.message);
  }
}

// ============ Initialization & IPC ============

function cleanupStaleArtifacts() {
  try {
    const installPath = getInstallPath();
    const parentDir = path.dirname(installPath);
    const baseName = path.basename(installPath);

    if (!fs.existsSync(parentDir)) return;

    const entries = fs.readdirSync(parentDir);
    for (const entry of entries) {
      if (entry.startsWith(baseName + '-extracting-')) {
        const fullPath = path.join(parentDir, entry);
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log('[NDI] Cleaned up stale extraction directory:', fullPath);
        } catch (err) {
          console.warn('[NDI] Failed to clean up stale directory:', fullPath, err.message);
        }
      }
    }
  } catch (err) {
    console.warn('[NDI] Stale artifact cleanup failed:', err.message);
  }

  try {
    const tempDir = app.getPath('temp');
    const tempEntries = fs.readdirSync(tempDir);
    for (const entry of tempEntries) {
      if (entry.startsWith('ndi-companion-') && entry.endsWith('.zip')) {
        const fullPath = path.join(tempDir, entry);
        try {
          fs.unlinkSync(fullPath);
          console.log('[NDI] Cleaned up stale temp zip:', fullPath);
        } catch { /* may be in use by another process */ }
      }
    }
  } catch { /* non-critical */ }
}

export function initializeNdiManager() {
  cleanupStaleArtifacts();

  if (isDev) {
    ndiStore.set('pendingUpdateInfo', null);
  }

  const installStatus = checkInstalled();

  if (ndiStore.get('autoLaunch') && installStatus.installed) {
    console.log('[NDI] Auto-launching companion');
    setTimeout(() => {
      launchCompanion().catch((err) => {
        console.error('[NDI] Auto-launch failed:', err);
      });
    }, 3000);
  }

  setTimeout(() => {
    performStartupUpdateCheck();
  }, 8000);
}

export function registerNdiIpcHandlers() {
  ipcMain.handle('ndi:check-installed', () => checkInstalled());

  ipcMain.handle('ndi:download', async () => {
    try {
      return await downloadCompanion();
    } catch (err) {
      console.error('[NDI] Download handler error:', err);
      return { success: false, error: err?.message || 'Download failed' };
    }
  });

  ipcMain.handle('ndi:update-companion', async () => {
    try {
      const updateInfo = await checkForCompanionUpdate();
      stopCompanion();
      return await downloadCompanion(updateInfo);
    } catch (err) {
      console.error('[NDI] Update handler error:', err);
      return { success: false, error: err?.message || 'Update failed' };
    }
  });

  ipcMain.handle('ndi:uninstall', () => uninstallCompanion());

  ipcMain.handle('ndi:launch-companion', async () => launchCompanion());

  ipcMain.handle('ndi:stop-companion', () => stopCompanion());

  ipcMain.handle('ndi:get-companion-status', () => getCompanionStatus());

  ipcMain.handle('ndi:check-for-update', async () => {
    latestReleaseCache = null;
    lastReleaseCheck = 0;
    return checkForCompanionUpdate();
  });

  ipcMain.handle('ndi:set-auto-launch', (_, { enabled }) => {
    ndiStore.set('autoLaunch', enabled);
    return { success: true };
  });

  ipcMain.handle('ndi:get-output-settings', (_, { outputKey }) => getOutputSettings(outputKey));

  ipcMain.handle('ndi:set-output-enabled', (_, { outputKey, enabled }) => setOutputSetting(outputKey, 'enabled', enabled));

  ipcMain.handle('ndi:set-source-name', (_, { outputKey, name }) => setOutputSetting(outputKey, 'sourceName', name));

  ipcMain.handle('ndi:set-resolution', (_, { outputKey, resolution }) => setOutputSetting(outputKey, 'resolution', resolution));

  ipcMain.handle('ndi:set-custom-resolution', (_, { outputKey, width, height }) => {
    ensureOutputSettings(outputKey);
    ndiStore.set(`outputs.${outputKey}.resolution`, 'custom');
    ndiStore.set(`outputs.${outputKey}.customWidth`, Math.max(320, Math.min(7680, width)));
    ndiStore.set(`outputs.${outputKey}.customHeight`, Math.max(240, Math.min(4320, height)));
    if (companionProcess) {
      syncSingleOutput(outputKey).catch((error) => {
        console.warn('[NDI] Failed syncing custom resolution change:', error?.message || error);
      });
    }
    return { success: true };
  });

  ipcMain.handle('ndi:set-framerate', (_, { outputKey, framerate }) => setOutputSetting(outputKey, 'framerate', framerate));

  ipcMain.handle('ndi:get-pending-update-info', () => getPendingUpdateInfo());

  ipcMain.handle('ndi:clear-pending-update-info', () => {
    clearPendingUpdateInfo();
    return { success: true };
  });

  ipcMain.handle('ndi:cancel-download', () => cancelDownload());

  console.log('[NDI] IPC handlers registered');
}

export function cleanupNdiManager() {
  stopCompanion();
  console.log('[NDI] Manager cleaned up');
}

export default {
  initializeNdiManager,
  registerNdiIpcHandlers,
  cleanupNdiManager,
};