/**
 * NDI Manager
 * Manages NDI companion app installation, lifecycle, settings, and version checking.
 * The companion is a separate Node.js app with Puppeteer that handles actual NDI broadcasting
 * by rendering output pages in headless Chromium and sending frames via grandi.
 */

import { app, ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import { spawn, execSync as execSyncFn } from 'child_process';
import https from 'https';
import http from 'http';

const isDev = !app.isPackaged;

const GITHUB_OWNER = 'PeterAlaks';
const GITHUB_REPO = 'lyricdisplay-ndi';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

const ndiStore = new Store({
  name: 'ndi-settings',
  defaults: {
    installed: false,
    version: '',
    installPath: '',
    autoLaunch: false,
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

// ============ Path Helpers ============

function getInstallPath() {
  if (isDev) {
    // In dev mode, use the local lyricdisplay-ndi/ source directory directly
    const devPath = path.join(app.getAppPath(), 'lyricdisplay-ndi');
    if (fs.existsSync(devPath)) {
      return devPath;
    }
  }
  // In production, install to a dedicated directory next to the app executable
  return path.join(path.dirname(app.getPath('exe')), 'ndi-companion');
}

function getCompanionEntryPath() {
  const installPath = getInstallPath();
  // The downloaded zip extracts with a lyricdisplay-ndi subfolder structure
  // Check both possible layouts: flat (src/index.js) and nested (lyricdisplay-ndi/src/index.js)
  const flatPath = path.join(installPath, 'src', 'index.js');
  const nestedPath = path.join(installPath, 'lyricdisplay-ndi', 'src', 'index.js');

  if (fs.existsSync(flatPath)) return flatPath;
  if (fs.existsSync(nestedPath)) return nestedPath;

  // Default to flat path (for dev mode and fresh installs)
  return flatPath;
}

function getCompanionRootPath() {
  // Returns the actual root of the companion app (where package.json lives)
  const installPath = getInstallPath();
  const flatPkg = path.join(installPath, 'package.json');
  const nestedPkg = path.join(installPath, 'lyricdisplay-ndi', 'package.json');

  if (fs.existsSync(flatPkg)) return installPath;
  if (fs.existsSync(nestedPkg)) return path.join(installPath, 'lyricdisplay-ndi');

  return installPath;
}

function getCompanionNodeModulesPath() {
  return path.join(getCompanionRootPath(), 'node_modules');
}

// ============ Platform Helpers ============

function getPlatformSuffix() {
  if (process.platform === 'win32') return 'win';
  if (process.platform === 'darwin') return 'mac';
  return 'linux';
}

// ============ Installation Check ============

function checkInstalled() {
  const entryPath = getCompanionEntryPath();
  const modulesPath = getCompanionNodeModulesPath();
  const entryExists = fs.existsSync(entryPath);
  const modulesExist = fs.existsSync(modulesPath);
  const exists = entryExists && modulesExist;

  if (exists) {
    let version = ndiStore.get('version') || '';

    // If store has no version, try reading from the companion's package.json
    if (!version) {
      try {
        const pkgPath = path.join(getCompanionRootPath(), 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          version = pkg.version || '';
          if (version) {
            ndiStore.set('version', version);
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    return {
      installed: true,
      version: version || '',
      installPath: getInstallPath()
    };
  }

  // If the files don't exist but store says installed, correct the store
  if (ndiStore.get('installed')) {
    ndiStore.set('installed', false);
  }

  return { installed: false, version: '', installPath: '' };
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

          // Determine the installed version from the extracted package.json
          let installedVersion = updateInfo?.latestVersion || '';
          if (!installedVersion) {
            try {
              const pkgPath = path.join(getCompanionRootPath(), 'package.json');
              if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                installedVersion = pkg.version || '1.0.0';
              }
            } catch {
              installedVersion = '1.0.0';
            }
          }

          ndiStore.set('installed', true);
          ndiStore.set('version', installedVersion);
          ndiStore.set('installPath', installPath);

          // Invalidate release cache so next check reflects the new version
          latestReleaseCache = null;
          lastReleaseCheck = 0;

          console.log(`[NDI] Companion installed: v${installedVersion} at ${installPath}`);

          resolve({
            success: true,
            version: installedVersion,
            path: installPath
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

async function launchCompanion() {
  if (companionProcess) {
    return { success: true, message: 'Already running' };
  }

  const entryPath = getCompanionEntryPath();
  if (!fs.existsSync(entryPath)) {
    return { success: false, error: 'Companion not installed' };
  }

  // Determine the backend port (default 4000)
  const backendPort = process.env.PORT || '4000';

  try {
    // Use system node if available (preferred for native module compatibility
    // with grandi). Fall back to Electron's embedded Node.js (process.execPath)
    // if system node is not on PATH.
    let nodeExecutable = 'node';
    if (!isDev) {
      try {
        execSyncFn('node --version', { stdio: 'ignore', timeout: 5000 });
      } catch {
        // System node not available, use Electron's embedded Node.js
        nodeExecutable = process.execPath;
        console.log('[NDI] System node not found, using Electron Node.js');
      }
    }
    const companionRoot = getCompanionRootPath();

    const args = [
      entryPath,
      '--port', backendPort
    ];

    // In dev mode, the frontend is served by Vite on port 5173, not by Express on port 4000.
    // The companion needs to load pages from the Vite dev server to get the React app.
    if (isDev) {
      args.push('--frontend-url', 'http://localhost:5173');
    }

    console.log(`[NDI] Launching: ${nodeExecutable} ${args.join(' ')}`);
    console.log(`[NDI] CWD: ${companionRoot}`);

    companionProcess = spawn(nodeExecutable, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: companionRoot,
      env: {
        ...process.env,
        NODE_PATH: getCompanionNodeModulesPath()
      }
    });

    // Log companion stdout/stderr
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
      notifyAllWindows('ndi:companion-status', { running: false });
    });

    companionProcess.on('error', (err) => {
      console.error('[NDI] Companion error:', err);
      companionProcess = null;
      notifyAllWindows('ndi:companion-status', { running: false, error: err.message });
    });

    // Notify renderer that companion is running
    notifyAllWindows('ndi:companion-status', { running: true });

    console.log('[NDI] Companion launched successfully');
    return { success: true };
  } catch (error) {
    console.error('[NDI] Failed to launch companion:', error);
    companionProcess = null;
    return { success: false, error: error.message };
  }
}

function stopCompanion() {
  if (!companionProcess) {
    return { success: true, message: 'Not running' };
  }

  try {
    companionProcess.kill();
  } catch (error) {
    console.warn('[NDI] Error killing companion process:', error);
  }

  companionProcess = null;
  notifyAllWindows('ndi:companion-status', { running: false });
  console.log('[NDI] Companion stopped');
  return { success: true };
}

function getCompanionStatus() {
  return {
    running: companionProcess !== null,
    installed: checkInstalled().installed,
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
  // The companion watches the ndi-settings.json file for changes
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
      console.log(`[NDI] Companion update available: v${updateInfo.currentVersion} → v${updateInfo.latestVersion}`);
      notifyAllWindows('ndi:update-available', updateInfo);
    }
  } catch (error) {
    console.warn('[NDI] Startup update check failed:', error.message);
  }
}

// ============ Initialization & IPC ============

export function initializeNdiManager(getMainWindow) {
  // Auto-launch companion if enabled and installed
  if (ndiStore.get('autoLaunch') && checkInstalled().installed) {
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
    return { success: true };
  });

  ipcMain.handle('ndi:set-framerate', (_, { outputKey, framerate }) => {
    return setOutputSetting(outputKey, 'framerate', framerate);
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
