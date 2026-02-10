/**
 * NDI Manager
 * Manages NDI companion app installation, lifecycle, and settings.
 * The companion is a separate Node.js app with Puppeteer that handles actual NDI broadcasting
 * by rendering output pages in headless Chromium and sending frames via grandi.
 */

import { app, ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import https from 'https';
import http from 'http';

const isDev = !app.isPackaged;

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

// ============ Path Helpers ============

function getInstallPath() {
  if (app.isPackaged) {
    return path.join(path.dirname(app.getPath('exe')), 'ndi-companion');
  }
  // In dev mode, use the local lyricdisplay-ndi/ source directory directly
  // (no download needed — just npm install in lyricdisplay-ndi/ and launch)
  const devPath = path.join(app.getAppPath(), 'lyricdisplay-ndi');
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  return path.join(app.getAppPath(), 'ndi-companion');
}

function getCompanionEntryPath() {
  // The companion is a Node.js app, not a compiled binary
  // It's launched via: node src/index.js --port <port>
  return path.join(getInstallPath(), 'src', 'index.js');
}

function getCompanionNodeModulesPath() {
  return path.join(getInstallPath(), 'node_modules');
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
        const pkgPath = path.join(getInstallPath(), 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          version = pkg.version || '';
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

// ============ Download & Install ============

function followRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'));
    }

    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        followRedirects(response.headers.location, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
      } else if (response.statusCode === 200) {
        resolve(response);
      } else {
        reject(new Error(`Download failed with status ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

async function downloadCompanion(mainWindow) {
  // TODO: Update this URL to the actual release URL for the NDI companion
  const platformSuffix = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux';
  const downloadUrl = `https://github.com/PeterAlaks/lyricdisplay-ndi/releases/latest/download/lyricdisplay-ndi-${platformSuffix}.zip`;

  const installPath = getInstallPath();
  const zipPath = path.join(installPath, 'ndi-companion.zip');

  // Ensure directory exists
  fs.mkdirSync(installPath, { recursive: true });

  return new Promise(async (resolve, reject) => {
    try {
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
          await extractZip(zipPath, installPath);

          // Clean up zip file
          try { fs.unlinkSync(zipPath); } catch { }

          ndiStore.set('installed', true);
          ndiStore.set('version', '1.0.0');
          ndiStore.set('installPath', installPath);

          resolve({
            success: true,
            version: '1.0.0',
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
    // In dev mode, use system node to avoid Electron-specific Node.js quirks
    // with native addons (grandi). In production, process.execPath is the
    // Electron binary which embeds Node.js and works fine.
    const nodeExecutable = isDev ? 'node' : process.execPath;

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
    console.log(`[NDI] CWD: ${getInstallPath()}`);

    companionProcess = spawn(nodeExecutable, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: getInstallPath(),
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
}

export function registerNdiIpcHandlers() {
  ipcMain.handle('ndi:check-installed', () => {
    return checkInstalled();
  });

  ipcMain.handle('ndi:download', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return downloadCompanion(win);
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
