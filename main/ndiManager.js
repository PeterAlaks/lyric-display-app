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
 */
function sendCommand(type, payload = {}, extra = {}) {
  const { host, port } = getIpcConfig();
  const timeoutMs = 1500;

  const command = {
    type,
    seq: extra.seq ?? getNextSeq(),
    ts: Date.now(),
    output: extra.output,
    payload,
  };

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
  return path.join(path.dirname(app.getPath('exe')), 'lyricdisplay-ndi');
}

function getCompanionBinaryName() {
  if (process.platform === 'win32') return 'LyricDisplay NDI.exe';
  if (process.platform === 'darwin') return 'LyricDisplay NDI.app/Contents/MacOS/LyricDisplay NDI';
  return 'lyricdisplay-ndi'; // Linux
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
    return {
      installed,
      version: ndiStore.get('version') || '',
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

async function downloadCompanion(mainWindow, updateInfo = null) {
  let downloadUrl;
  if (updateInfo?.downloadUrl) {
    downloadUrl = updateInfo.downloadUrl;
  } else {
    const assetName = getPlatformAssetName();
    downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/${assetName}`;
  }

  const installPath = getInstallPath();
  const zipPath = path.join(app.getPath('temp'), `ndi-companion-${Date.now()}.zip`);
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
            status: 'downloading',
          });
        }
      });

      response.pipe(file);

      file.on('finish', async () => {
        file.close();

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ndi:download-progress', { percent: 100, status: 'extracting' });
        }

        try {
          // Stop companion before replacing files.
          stopCompanion();

          // Clean existing installation before extracting.
          if (fs.existsSync(installPath) && !isDev) {
            const entries = fs.readdirSync(installPath);
            for (const entry of entries) {
              const entryPath = path.join(installPath, entry);
              fs.rmSync(entryPath, { recursive: true, force: true });
            }
          }

          await extractZip(zipPath, installPath);
          try { fs.unlinkSync(zipPath); } catch { /* ignore */ }

          let installedVersion = updateInfo?.latestVersion || '';
          if (!installedVersion) {
            try {
              const latest = await checkForCompanionUpdate();
              if (latest?.latestVersion) installedVersion = latest.latestVersion;
            } catch { /* ignore */ }
          }

          ndiStore.set('installed', true);
          ndiStore.set('version', installedVersion);
          ndiStore.set('installPath', installPath);

          latestReleaseCache = null;
          lastReleaseCheck = 0;

          console.log(`[NDI] Companion installed: v${installedVersion} at ${installPath}`);
          resolve({ success: true, version: installedVersion, path: installPath });
        } catch (err) {
          try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
          reject(new Error(`Extraction failed: ${err.message}`));
        }
      });

      file.on('error', (err) => {
        try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
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

  // On macOS and Linux, ensure the companion binary is executable.
  // extract-zip should preserve permissions, but some environments
  // strip the execute bit from extracted files.
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
  return {
    outputs: {
      output1: ndiStore.get('outputs.output1'),
      output2: ndiStore.get('outputs.output2'),
      stage: ndiStore.get('outputs.stage'),
    },
  };
}

async function syncOutputs() {
  if (!companionProcess) return;
  const result = await sendCommand('set_outputs', buildOutputsPayload());
  if (!result.success) {
    console.warn('[NDI] Failed to sync output settings:', result.error || 'Unknown error');
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

    // process.execPath is the actual Electron binary (not a .cmd shim),
    // so it works reliably on all platforms without shell: true.
    // We pass the companion's directory (which contains package.json with
    // "main": "src/main.js") so Electron loads it as a proper app, not
    // as a plain Node script.
    const electronBin = process.execPath;
    const companionDir = getInstallPath();
    const args = [
      companionDir,
      '--host', ipcConfig.host,
      '--port', String(ipcConfig.port),
      '--app-url', 'http://localhost:5173',
      '--no-hash',
    ];

    // Ensure ELECTRON_RUN_AS_NODE is not set, otherwise Electron runs
    // as plain Node.js and cannot create BrowserWindows.
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
    // Production: launch the packaged companion binary.
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
    stopStatsLoop();
    notifyAllWindows('ndi:companion-status', { running: false });
  });

  companionProcess.on('error', (err) => {
    console.error('[NDI] Companion error:', err);
    companionProcess = null;
    stopStatsLoop();
    notifyAllWindows('ndi:companion-status', { running: false, error: err.message });
  });

  notifyAllWindows('ndi:companion-status', { running: true });
  startStatsLoop();

  // Give the companion a moment to start its IPC server, then handshake and sync.
  setTimeout(async () => {
    const hello = await sendCommand('hello', {});
    if (!hello.success) {
      console.warn('[NDI] Hello handshake failed:', hello.error || 'Unknown error');
    }
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
    companionPath: installStatus.companionPath,
    version: ndiStore.get('version') || '',
    autoLaunch: ndiStore.get('autoLaunch') || false,
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
      sourceName: `LyricDisplay ${outputKey === 'stage' ? 'Stage' : outputKey === 'output1' ? 'Output 1' : 'Output 2'}`,
    },
    companionConnected: companionProcess !== null,
    isBroadcasting: settings?.enabled && companionProcess !== null,
  };
}

function setOutputSetting(outputKey, key, value) {
  ndiStore.set(`outputs.${outputKey}.${key}`, value);
  if (companionProcess) {
    syncOutputs().catch((error) => {
      console.warn('[NDI] Failed syncing output setting change:', error?.message || error);
    });
  }
  return { success: true };
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

  ipcMain.handle('ndi:download', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return downloadCompanion(win);
  });

  ipcMain.handle('ndi:update-companion', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const updateInfo = await checkForCompanionUpdate();
    stopCompanion();
    return downloadCompanion(win, updateInfo);
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
    ndiStore.set(`outputs.${outputKey}.resolution`, 'custom');
    ndiStore.set(`outputs.${outputKey}.customWidth`, Math.max(320, Math.min(7680, width)));
    ndiStore.set(`outputs.${outputKey}.customHeight`, Math.max(240, Math.min(4320, height)));
    if (companionProcess) {
      syncOutputs().catch((error) => {
        console.warn('[NDI] Failed syncing custom resolution change:', error?.message || error);
      });
    }
    return { success: true };
  });

  ipcMain.handle('ndi:set-framerate', (_, { outputKey, framerate }) => setOutputSetting(outputKey, 'framerate', framerate));

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
