/**
 * NDI Manager
 * Manages NDI companion app installation, lifecycle, settings, and version checking.
 * The companion is a native Rust process packaged from the lyricdisplay-ndi repository.
 */

import { app, ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import https from 'https';
import http from 'http';
import { createNativeCommand, sendNativeCommand } from './ndiNativeClient.js';

const isDev = !app.isPackaged;

const GITHUB_OWNER = 'PeterAlaks';
const GITHUB_REPO = 'lyricdisplay-ndi';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
const DEFAULT_NATIVE_IPC_HOST = '127.0.0.1';
const DEFAULT_NATIVE_IPC_PORT = 9137;
const DEFAULT_NDI_RUNTIME_DIRNAME = 'ndi-runtime';

const ndiStore = new Store({
  name: 'ndi-settings',
  defaults: {
    installed: false,
    version: '',
    installPath: '',
    autoLaunch: false,
    nativeIpc: {
      host: DEFAULT_NATIVE_IPC_HOST,
      port: DEFAULT_NATIVE_IPC_PORT
    },
    outputs: {
      output1: {
        enabled: false,
        resolution: '1080p',
        customWidth: 1920,
        customHeight: 1080,
        framerate: 30,
        sourceName: 'LyricDisplay Output 1'
      },
      output2: {
        enabled: false,
        resolution: '1080p',
        customWidth: 1920,
        customHeight: 1080,
        framerate: 30,
        sourceName: 'LyricDisplay Output 2'
      },
      stage: {
        enabled: false,
        resolution: '1080p',
        customWidth: 1920,
        customHeight: 1080,
        framerate: 30,
        sourceName: 'LyricDisplay Stage'
      }
    }
  }
});

let companionProcess = null;
let latestReleaseCache = null;
let lastReleaseCheck = 0;
const RELEASE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
let nativeCommandSeq = 0;
let nativeStatsInterval = null;
const VALID_OUTPUT_TARGETS = new Set(['output1', 'output2', 'stage', 'global']);

// ============ Path Helpers ============

function getNativeIpcConfig() {
  const settings = ndiStore.get('nativeIpc') || {};
  const host = String(settings.host || DEFAULT_NATIVE_IPC_HOST);
  const rawPort = Number(settings.port || DEFAULT_NATIVE_IPC_PORT);
  const port = Number.isFinite(rawPort) ? Math.max(1024, Math.min(65535, rawPort)) : DEFAULT_NATIVE_IPC_PORT;
  return { host, port };
}

function getNextNativeSeq() {
  nativeCommandSeq += 1;
  return nativeCommandSeq;
}

function getInstallPath() {
  if (isDev) {
    // In dev mode, always resolve to the sibling lyricdisplay-ndi repository path.
    return path.join(app.getAppPath(), 'lyricdisplay-ndi');
  }

  // In production, keep companion binaries under a lyricdisplay-ndi folder.
  return path.join(path.dirname(app.getPath('exe')), 'lyricdisplay-ndi');
}

function getNativeBinaryName() {
  return process.platform === 'win32' ? 'lyricdisplay-ndi-native.exe' : 'lyricdisplay-ndi-native';
}

function getNativeCompanionEntryPath() {
  const binary = getNativeBinaryName();
  const installPath = getInstallPath();
  const appRoot = app.getAppPath();

  const candidates = isDev
    ? [
      path.join(appRoot, 'lyricdisplay-ndi', 'native', 'target', 'release', binary),
      path.join(appRoot, 'lyricdisplay-ndi', 'native', 'target', 'debug', binary),
      path.join(appRoot, 'lyricdisplay-ndi', binary)
    ]
    : [
      path.join(installPath, binary),
      path.join(installPath, 'lyricdisplay-ndi', binary),
      path.join(installPath, 'native', 'target', 'release', binary),
      path.join(installPath, 'native', 'target', 'debug', binary)
    ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function getRuntimeLibraryCandidates() {
  if (process.platform === 'win32') {
    return ['Processing.NDI.Lib.x64.dll'];
  }
  if (process.platform === 'darwin') {
    return ['libndi.dylib'];
  }
  return ['libndi.so.6', 'libndi.so.5', 'libndi.so'];
}

function hasAnyRuntimeLibrary(folderPath) {
  if (!folderPath) {
    return false;
  }

  return getRuntimeLibraryCandidates().some((library) =>
    fs.existsSync(path.join(folderPath, library))
  );
}

function getBundledRuntimeFolder() {
  const installPath = getInstallPath();
  const nativePath = getNativeCompanionEntryPath();
  const candidates = [
    path.join(installPath, DEFAULT_NDI_RUNTIME_DIRNAME),
    path.join(installPath, 'runtime'),
    path.join(path.dirname(nativePath), DEFAULT_NDI_RUNTIME_DIRNAME),
    path.dirname(nativePath)
  ];

  for (const candidate of candidates) {
    if (hasAnyRuntimeLibrary(candidate)) {
      return candidate;
    }
  }

  return '';
}

function isSystemRuntimeAvailable() {
  if (process.platform === 'win32') {
    return (
      fs.existsSync('C:\\Program Files\\NDI\\NDI 6 Runtime\\Processing.NDI.Lib.x64.dll') ||
      fs.existsSync('C:\\Program Files\\NDI\\NDI 5 Runtime\\Processing.NDI.Lib.x64.dll')
    );
  }

  if (process.platform === 'darwin') {
    return (
      fs.existsSync('/usr/local/lib/libndi.dylib') ||
      fs.existsSync('/opt/homebrew/lib/libndi.dylib')
    );
  }

  return (
    fs.existsSync('/usr/lib/libndi.so.6') ||
    fs.existsSync('/usr/local/lib/libndi.so.6') ||
    fs.existsSync('/usr/lib/libndi.so.5') ||
    fs.existsSync('/usr/local/lib/libndi.so.5')
  );
}

// ============ Platform Helpers ============

function getPlatformSuffix() {
  if (process.platform === 'win32') return 'win';
  if (process.platform === 'darwin') return 'mac';
  return 'linux';
}

// ============ Installation Check ============

function checkInstalled() {
  const nativeEntryPath = getNativeCompanionEntryPath();
  const installed = fs.existsSync(nativeEntryPath);
  const bundledRuntimePath = getBundledRuntimeFolder();
  const systemRuntimeAvailable = isSystemRuntimeAvailable();
  const runtimeReady = Boolean(bundledRuntimePath) || systemRuntimeAvailable;

  if (installed) {
    return {
      installed: true,
      version: ndiStore.get('version') || '',
      installPath: getInstallPath(),
      nativeAvailable: true,
      nativePath: nativeEntryPath,
      runtime: {
        bundled: Boolean(bundledRuntimePath),
        bundledPath: bundledRuntimePath,
        systemAvailable: systemRuntimeAvailable,
        ready: runtimeReady
      }
    };
  }

  if (ndiStore.get('installed')) {
    ndiStore.set('installed', false);
  }

  return {
    installed: false,
    version: ndiStore.get('version') || '',
    installPath: '',
    nativeAvailable: false,
    nativePath: nativeEntryPath,
    runtime: {
      bundled: false,
      bundledPath: '',
      systemAvailable: false,
      ready: false
    }
  };
}

// ============ GitHub API Helpers ============

function githubApiRequest(urlPath) {
  return new Promise((resolve, reject) => {
    const url = urlPath.startsWith('http') ? urlPath : `${GITHUB_API_BASE}${urlPath}`;

    https.get(url, {
      headers: {
        'User-Agent': 'LyricDisplay-App',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        } else if (res.statusCode === 404) {
          resolve(null); // No releases found
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
  const now = Date.now();

  // Use cache if recent
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

    // Find the download URL for the current platform
    const platformSuffix = getPlatformSuffix();
    const expectedAssetName = `lyricdisplay-ndi-${platformSuffix}.zip`;
    const asset = release.assets?.find(a => a.name === expectedAssetName);

    const result = {
      updateAvailable: installed && currentVersion && compareVersions(latestVersion, currentVersion) > 0,
      latestVersion,
      currentVersion,
      downloadUrl: asset?.browser_download_url || null,
      downloadSize: asset?.size || 0,
      releaseNotes: release.body || '',
      releaseName: release.name || '',
      releaseDate: release.published_at || '',
      htmlUrl: release.html_url || ''
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
      error: error.message
    };
  }
}

// ============ Download & Install ============

function followRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'));
    }

    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, {
      headers: { 'User-Agent': 'LyricDisplay-App' },
      timeout: 30000
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        followRedirects(response.headers.location, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
      } else if (response.statusCode === 200) {
        resolve(response);
      } else {
        reject(new Error(`Download failed with status ${response.statusCode}`));
      }
    }).on('error', reject)
      .on('timeout', function () { this.destroy(); reject(new Error('Download timeout')); });
  });
}

async function downloadCompanion(mainWindow, updateInfo = null) {
  const platformSuffix = getPlatformSuffix();

  // Use the download URL from version check if available, otherwise construct it
  let downloadUrl;
  if (updateInfo?.downloadUrl) {
    downloadUrl = updateInfo.downloadUrl;
  } else {
    downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/lyricdisplay-ndi-${platformSuffix}.zip`;
  }

  const installPath = getInstallPath();
  const zipPath = path.join(app.getPath('temp'), `ndi-companion-${Date.now()}.zip`);

  // Ensure install directory exists
  fs.mkdirSync(installPath, { recursive: true });

  return new Promise(async (resolve, reject) => {
    try {
      console.log(`[NDI] Downloading from: ${downloadUrl}`);
      const response = await followRedirects(downloadUrl);
      const totalSize = parseInt(response.headers['content-length'], 10) || 0;
      let downloadedSize = 0;

      const file = fs.createWriteStream(zipPath);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ndi:download-progress', {
            percent,
            downloaded: downloadedSize,
            total: totalSize,
            status: 'downloading'
          });
        }
      });

      response.pipe(file);

      file.on('finish', async () => {
        file.close();

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ndi:download-progress', {
            percent: 100,
            status: 'extracting'
          });
        }

        try {
          // Clean existing installation before extracting
          if (fs.existsSync(installPath) && !isDev) {
            // Stop companion first if running
            stopCompanion();

            // Remove old files but keep the directory
            const entries = fs.readdirSync(installPath);
            for (const entry of entries) {
              const entryPath = path.join(installPath, entry);
              fs.rmSync(entryPath, { recursive: true, force: true });
            }
          }

          await extractZip(zipPath, installPath);

          // Clean up zip file
          try { fs.unlinkSync(zipPath); } catch { }

          // Determine installed version (prefer release metadata from update flow)
          let installedVersion = updateInfo?.latestVersion || '';
          if (!installedVersion) {
            try {
              const latest = await checkForCompanionUpdate();
              if (latest?.latestVersion) {
                installedVersion = latest.latestVersion;
              }
            } catch {
              installedVersion = '';
            }
          }

          ndiStore.set('installed', true);
          ndiStore.set('version', installedVersion);
          ndiStore.set('installPath', installPath);

          // Invalidate release cache so next check reflects the new version
          latestReleaseCache = null;
          lastReleaseCheck = 0;

          const installStatus = checkInstalled();
          if (!installStatus.runtime?.ready) {
            console.warn('[NDI Native] Companion installed without detectable NDI runtime libraries');
          }

          console.log(`[NDI] Companion installed: v${installedVersion} at ${installPath}`);

          resolve({
            success: true,
            version: installedVersion,
            path: installPath,
            runtime: installStatus.runtime || null
          });
        } catch (err) {
          // Clean up on extraction failure
          try { fs.unlinkSync(zipPath); } catch { }
          reject(new Error(`Extraction failed: ${err.message}`));
        }
      });

      file.on('error', (err) => {
        try { fs.unlinkSync(zipPath); } catch { }
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function extractZip(zipPath, destPath) {
  const extract = (await import('extract-zip')).default;
  await extract(zipPath, { dir: destPath });
}

// ============ Uninstall ============

function uninstallCompanion() {
  stopCompanion();

  const installPath = getInstallPath();

  // Don't delete in dev mode (it's the source directory)
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

  // Invalidate cache
  latestReleaseCache = null;
  lastReleaseCheck = 0;

  return { success: true };
}

// ============ Companion Process Management ============

function buildNativeOutputsPayload() {
  return {
    outputs: {
      output1: ndiStore.get('outputs.output1'),
      output2: ndiStore.get('outputs.output2'),
      stage: ndiStore.get('outputs.stage')
    }
  };
}

async function sendNativeCompanionCommand(type, payload = {}, extra = {}) {
  const ipcConfig = getNativeIpcConfig();
  const command = createNativeCommand(type, payload, {
    seq: getNextNativeSeq(),
    ts: Date.now(),
    ...extra
  });

  return sendNativeCommand(command, {
    host: ipcConfig.host,
    port: ipcConfig.port,
    timeoutMs: 1500
  });
}

function normalizeOutputTarget(outputKey) {
  if (typeof outputKey !== 'string') {
    return undefined;
  }

  const trimmed = outputKey.trim();
  if (!trimmed) {
    return undefined;
  }

  return VALID_OUTPUT_TARGETS.has(trimmed) ? trimmed : undefined;
}

async function forwardNativeRuntimeCommand(type, outputKey, payload = {}) {
  if (!companionProcess) {
    return { success: false, error: 'Companion not running' };
  }

  const output = normalizeOutputTarget(outputKey);
  const commandPayload = payload && typeof payload === 'object' ? payload : {};

  return sendNativeCompanionCommand(type, commandPayload, output ? { output } : {});
}

async function syncNativeCompanionOutputs() {
  if (!companionProcess) {
    return;
  }

  const result = await sendNativeCompanionCommand('set_outputs', buildNativeOutputsPayload());
  if (!result.success) {
    console.warn('[NDI Native] Failed to sync output settings:', result.error || 'Unknown error');
  }
}

async function requestNativeCompanionStats() {
  if (!companionProcess) {
    return;
  }

  const result = await sendNativeCompanionCommand('request_stats', {});
  if (!result.success || !Array.isArray(result.responses)) {
    return;
  }

  const stats = result.responses.find((entry) => entry?.type === 'stats');
  const health = result.responses.find((entry) => entry?.type === 'health');

  if (stats || health) {
    notifyAllWindows('ndi:native-telemetry', {
      stats: stats?.payload || null,
      health: health?.payload || null
    });
  }
}

function startNativeStatsLoop() {
  if (nativeStatsInterval) {
    clearInterval(nativeStatsInterval);
  }

  nativeStatsInterval = setInterval(() => {
    requestNativeCompanionStats().catch((error) => {
      console.warn('[NDI Native] Telemetry poll failed:', error?.message || error);
    });
  }, 5000);
}

function stopNativeStatsLoop() {
  if (nativeStatsInterval) {
    clearInterval(nativeStatsInterval);
    nativeStatsInterval = null;
  }
}

async function launchCompanion() {
  if (companionProcess) {
    return { success: true, message: 'Already running' };
  }

  const nativePath = getNativeCompanionEntryPath();
  if (!fs.existsSync(nativePath)) {
    return {
      success: false,
      error: `NDI companion not found at ${nativePath}.`
    };
  }

  const nativeIpc = getNativeIpcConfig();
  const args = ['--host', nativeIpc.host, '--port', String(nativeIpc.port)];
  const bundledRuntimePath = getBundledRuntimeFolder();
  const launchEnv = {
    ...process.env
  };

  if (bundledRuntimePath) {
    launchEnv.NDILIB_REDIST_FOLDER = bundledRuntimePath;
  }

  try {
    console.log(`[NDI Native] Launching: ${nativePath} ${args.join(' ')}`);

    companionProcess = spawn(nativePath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.dirname(nativePath),
      env: launchEnv
    });

    companionProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log(`[NDI Native] ${msg}`);
    });

    companionProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.error(`[NDI Native] ${msg}`);
    });

    companionProcess.on('exit', (code) => {
      console.log('[NDI Native] Companion exited with code:', code);
      companionProcess = null;
      stopNativeStatsLoop();
      notifyAllWindows('ndi:companion-status', { running: false });
    });

    companionProcess.on('error', (err) => {
      console.error('[NDI Native] Companion error:', err);
      companionProcess = null;
      stopNativeStatsLoop();
      notifyAllWindows('ndi:companion-status', { running: false, error: err.message });
    });

    notifyAllWindows('ndi:companion-status', { running: true });
    startNativeStatsLoop();

    // Give the IPC listener a brief moment to initialize, then perform handshake and first sync.
    setTimeout(async () => {
      const hello = await sendNativeCompanionCommand('hello', {});
      if (!hello.success) {
        console.warn('[NDI Native] Hello handshake failed:', hello.error || 'Unknown error');
      }
      await syncNativeCompanionOutputs();
      await requestNativeCompanionStats();
    }, 300);

    console.log('[NDI Native] Companion launched successfully');
    return { success: true };
  } catch (error) {
    console.error('[NDI Native] Failed to launch companion:', error);
    companionProcess = null;
    return { success: false, error: error.message };
  }
}

function stopCompanion() {
  if (!companionProcess) {
    return { success: true, message: 'Not running' };
  }

  sendNativeCompanionCommand('shutdown', {}).catch((error) => {
    console.warn('[NDI Native] Graceful shutdown request failed:', error?.message || error);
  });

  try {
    companionProcess.kill();
  } catch (error) {
    console.warn('[NDI] Error killing companion process:', error);
  }

  stopNativeStatsLoop();
  companionProcess = null;
  notifyAllWindows('ndi:companion-status', { running: false });
  console.log('[NDI] Companion stopped');
  return { success: true };
}

function getCompanionStatus() {
  const installStatus = checkInstalled();
  return {
    running: companionProcess !== null,
    installed: installStatus.installed,
    nativeAvailable: installStatus.nativeAvailable,
    nativePath: installStatus.nativePath,
    runtime: installStatus.runtime,
    version: ndiStore.get('version') || '',
    autoLaunch: ndiStore.get('autoLaunch') || false
  };
}

// ============ Settings ============

function getOutputSettings(outputKey) {
  const settings = ndiStore.get(`outputs.${outputKey}`);
  return {
    settings: settings || {
      enabled: false,
      resolution: '1080p',
      customWidth: 1920,
      customHeight: 1080,
      framerate: 30,
      sourceName: `LyricDisplay ${outputKey === 'stage' ? 'Stage' : outputKey === 'output1' ? 'Output 1' : 'Output 2'}`
    },
    companionConnected: companionProcess !== null,
    isBroadcasting: settings?.enabled && companionProcess !== null
  };
}

function setOutputSetting(outputKey, key, value) {
  ndiStore.set(`outputs.${outputKey}.${key}`, value);
  if (companionProcess) {
    syncNativeCompanionOutputs().catch((error) => {
      console.warn('[NDI Native] Failed syncing output setting change:', error?.message || error);
    });
  }
  return { success: true };
}

// ============ Helpers ============

function notifyAllWindows(channel, data) {
  try {
    BrowserWindow.getAllWindows().forEach(win => {
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
    const status = checkInstalled();
    if (!status.installed) return;

    const updateInfo = await checkForCompanionUpdate();
    if (updateInfo.updateAvailable) {
      console.log(`[NDI] Companion update available: v${updateInfo.currentVersion} -> v${updateInfo.latestVersion}`);
      notifyAllWindows('ndi:update-available', updateInfo);
    }
  } catch (error) {
    console.warn('[NDI] Startup update check failed:', error.message);
  }
}

// ============ Initialization & IPC ============

export function initializeNdiManager(getMainWindow) {
  const installStatus = checkInstalled();
  const canAutoLaunch = installStatus.installed;

  // Auto-launch companion if enabled and installed
  if (ndiStore.get('autoLaunch') && canAutoLaunch) {
    console.log('[NDI] Auto-launching companion');
    // Delay auto-launch to ensure backend is fully ready
    setTimeout(() => {
      launchCompanion().catch(err => {
        console.error('[NDI] Auto-launch failed:', err);
      });
    }, 3000);
  }

  // Check for companion updates after a delay
  setTimeout(() => {
    performStartupUpdateCheck();
  }, 8000);
}

export function registerNdiIpcHandlers() {
  ipcMain.handle('ndi:check-installed', () => {
    return checkInstalled();
  });

  ipcMain.handle('ndi:download', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return downloadCompanion(win);
  });

  ipcMain.handle('ndi:update-companion', async (event) => {
    // Download the latest version (update flow)
    const win = BrowserWindow.fromWebContents(event.sender);
    const updateInfo = await checkForCompanionUpdate();

    // Stop companion before updating
    stopCompanion();

    return downloadCompanion(win, updateInfo);
  });

  ipcMain.handle('ndi:uninstall', () => {
    return uninstallCompanion();
  });

  ipcMain.handle('ndi:launch-companion', async () => {
    return launchCompanion();
  });

  ipcMain.handle('ndi:stop-companion', () => {
    return stopCompanion();
  });

  ipcMain.handle('ndi:get-companion-status', () => {
    return getCompanionStatus();
  });

  ipcMain.handle('ndi:check-for-update', async () => {
    // Force a fresh check
    latestReleaseCache = null;
    lastReleaseCheck = 0;
    return checkForCompanionUpdate();
  });

  ipcMain.handle('ndi:set-auto-launch', (_, { enabled }) => {
    ndiStore.set('autoLaunch', enabled);
    return { success: true };
  });

  ipcMain.handle('ndi:get-output-settings', (_, { outputKey }) => {
    return getOutputSettings(outputKey);
  });

  ipcMain.handle('ndi:set-output-enabled', (_, { outputKey, enabled }) => {
    return setOutputSetting(outputKey, 'enabled', enabled);
  });

  ipcMain.handle('ndi:set-source-name', (_, { outputKey, name }) => {
    return setOutputSetting(outputKey, 'sourceName', name);
  });

  ipcMain.handle('ndi:set-resolution', (_, { outputKey, resolution }) => {
    return setOutputSetting(outputKey, 'resolution', resolution);
  });

  ipcMain.handle('ndi:set-custom-resolution', (_, { outputKey, width, height }) => {
    ndiStore.set(`outputs.${outputKey}.resolution`, 'custom');
    ndiStore.set(`outputs.${outputKey}.customWidth`, Math.max(320, Math.min(7680, width)));
    ndiStore.set(`outputs.${outputKey}.customHeight`, Math.max(240, Math.min(4320, height)));

    if (companionProcess) {
      syncNativeCompanionOutputs().catch((error) => {
        console.warn('[NDI Native] Failed syncing custom resolution change:', error?.message || error);
      });
    }

    return { success: true };
  });

  ipcMain.handle('ndi:set-framerate', (_, { outputKey, framerate }) => {
    return setOutputSetting(outputKey, 'framerate', framerate);
  });

  ipcMain.handle('ndi:set-content', async (_, { outputKey, content }) => {
    return forwardNativeRuntimeCommand('set_content', outputKey, content);
  });

  ipcMain.handle('ndi:set-scene-style', async (_, { outputKey, style }) => {
    return forwardNativeRuntimeCommand('set_scene_style', outputKey, style);
  });

  ipcMain.handle('ndi:set-media', async (_, { outputKey, media }) => {
    return forwardNativeRuntimeCommand('set_media', outputKey, media);
  });

  ipcMain.handle('ndi:set-transition', async (_, { outputKey, transition }) => {
    return forwardNativeRuntimeCommand('set_transition', outputKey, transition);
  });

  console.log('[NDI] IPC handlers registered');
}

export function cleanupNdiManager() {
  stopCompanion();
  console.log('[NDI] Manager cleaned up');
}

export default {
  initializeNdiManager,
  registerNdiIpcHandlers,
  cleanupNdiManager
};
