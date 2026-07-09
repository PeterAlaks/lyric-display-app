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
import { NDI_FOLDER_NAME, LEGACY_NDI_FOLDER_NAME } from './appIdentity.js';
import path from 'path';
import fs from 'fs';
import * as userPreferences from './userPreferences.js';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { createNdiIpcClient } from './ndi/ipcClient.js';
import { createOutputSettingsManager } from './ndi/outputSettings.js';
import { createNdiInstaller } from './ndi/installer.js';
import { DEFAULT_OUTPUT_IDS } from '../shared/outputRegistry.js';

const isDev = !app.isPackaged;

const GITHUB_OWNER = 'PeterAlaks';
const GITHUB_REPO = 'lyricdisplay-ndi';
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
let commandSeq = 0;
let statsInterval = null;
let companionProtocolVersion = null; // set from hello handshake
let companionLaunchGeneration = 0;
let companionStarting = false;
let companionReady = false;
let companionBootstrapError = null;
let companionAuthToken = '';

const DEFAULT_BACKEND_PORT = Number(process.env.PORT) || 4000;
const DEFAULT_BACKEND_HOST = '127.0.0.1';
const COMPANION_BOOTSTRAP_MAX_ATTEMPTS = 20;
const COMPANION_BOOTSTRAP_BASE_DELAY_MS = 250;
const COMPANION_BOOTSTRAP_MAX_DELAY_MS = 2000;
const COMPANION_SYNC_RETRY_ATTEMPTS = 6;
const COMPANION_SYNC_RETRY_DELAY_MS = 350;

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const ipcClient = createNdiIpcClient({
  getIpcConfig,
  getNextSeq,
  getAuthToken: () => companionAuthToken,
});
const outputSettingsManager = createOutputSettingsManager({
  ndiStore,
  backendHost: DEFAULT_BACKEND_HOST,
  backendPort: DEFAULT_BACKEND_PORT,
});
const installer = createNdiInstaller({
  app,
  fs,
  path,
  isDev,
  ndiStore,
  githubOwner: GITHUB_OWNER,
  githubRepo: GITHUB_REPO,
  notifyAllWindows,
  getInstallPath,
  getResolvedInstallPath,
  getLegacyInstallPaths,
  getCompanionEntryPath,
  getPlatformAssetName,
  stopCompanion,
});

const normalizeOutputList = outputSettingsManager.normalizeOutputList;
const normalizeOutputKey = outputSettingsManager.normalizeOutputKey;
const normalizeOutputConfig = outputSettingsManager.normalizeOutputConfig;
const ensureOutputSettings = outputSettingsManager.ensureOutputSettings;
const syncOutputsFromRegistry = outputSettingsManager.syncOutputsFromRegistry;

function sendCommand(type, payload = {}, extra = {}) {
  return ipcClient.sendCommand(type, payload, extra);
}

function connectPersistentSocket() {
  ipcClient.connectPersistentSocket();
}

function destroyPersistentSocket() {
  ipcClient.destroyPersistentSocket();
}

// ============ Path Helpers ============

function getInstallPath() {
  if (isDev) {
    return path.join(app.getAppPath(), LEGACY_NDI_FOLDER_NAME);
  }

  return path.join(app.getPath('userData'), NDI_FOLDER_NAME);
}

function getLegacyInstallPaths() {
  if (isDev) return [];
  return [path.join(app.getPath('userData'), LEGACY_NDI_FOLDER_NAME)];
}

function getCompanionBinaryName() {
  if (process.platform === 'win32') return 'LyricDisplay NDI.exe';
  if (process.platform === 'darwin') return 'LyricDisplay NDI.app/Contents/MacOS/LyricDisplay NDI';
  return 'lyricdisplay-ndi';
}

function getCompanionEntryPath() {
  const installPath = getInstallPath();

  if (isDev) {
    return path.join(installPath, 'src', 'main.js');
  }

  const currentEntryPath = findCompanionEntryPath(installPath);
  if (fs.existsSync(currentEntryPath)) return currentEntryPath;

  for (const legacyInstallPath of getLegacyInstallPaths()) {
    const legacyEntryPath = findCompanionEntryPath(legacyInstallPath);
    if (fs.existsSync(legacyEntryPath)) return legacyEntryPath;
  }

  return currentEntryPath;
}

function getResolvedInstallPath() {
  const installPath = getInstallPath();
  if (isDev) return installPath;

  if (fs.existsSync(findCompanionEntryPath(installPath))) {
    return installPath;
  }

  for (const legacyInstallPath of getLegacyInstallPaths()) {
    if (fs.existsSync(findCompanionEntryPath(legacyInstallPath))) {
      return legacyInstallPath;
    }
  }

  return installPath;
}

function findCompanionEntryPath(installPath) {
  const binary = getCompanionBinaryName();

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

function checkInstalled() {
  return installer.checkInstalled();
}

function checkForCompanionUpdate() {
  return installer.checkForCompanionUpdate();
}

function resetUpdateCache() {
  installer.resetUpdateCache();
}

function downloadCompanion(updateInfo = null) {
  return installer.downloadCompanion(updateInfo);
}

function cancelDownload() {
  return installer.cancelDownload();
}

function uninstallCompanion() {
  return installer.uninstallCompanion();
}

function getPendingUpdateInfo() {
  return installer.getPendingUpdateInfo();
}

function clearPendingUpdateInfo() {
  installer.clearPendingUpdateInfo();
}

function performStartupUpdateCheck() {
  return installer.performStartupUpdateCheck();
}

function cleanupStaleArtifacts() {
  installer.cleanupStaleArtifacts();
}

// ============ Companion Process Management ============

function buildOutputsPayload() {
  const outputs = ndiStore.get('outputs');
  return {
    outputs: outputs && typeof outputs === 'object' ? outputs : {},
  };
}

function createCompanionAuthToken() {
  return randomBytes(24).toString('hex');
}

function resetCompanionRuntimeState({ clearAuthToken = true } = {}) {
  companionStarting = false;
  companionReady = false;
  companionBootstrapError = null;
  companionProtocolVersion = null;
  if (clearAuthToken) {
    companionAuthToken = '';
  }
}

function notifyCompanionStatus(extra = {}) {
  notifyAllWindows('ndi:companion-status', {
    running: companionProcess !== null,
    starting: companionStarting,
    ready: companionReady,
    bootstrapError: companionBootstrapError,
    protocolVersion: companionProtocolVersion,
    ...extra,
  });
}

/**
 * Send the full output configuration to the companion.
 * Used during the initial handshake after launch.
 */
async function syncOutputs() {
  if (!companionProcess) return false;
  await syncOutputsFromRegistry();
  const result = await sendCommand('set_outputs', buildOutputsPayload());
  if (!result.success) {
    console.warn('[NDI] Failed to sync output settings:', result.error || 'Unknown error');
    return false;
  }
  return true;
}

/**
 * Send only a single output's configuration to the companion.
 * Used when the user changes a setting for one output, avoiding
 * unnecessary recreation checks on the other two outputs.
 */
async function syncSingleOutput(outputKey) {
  if (!companionProcess) return false;
  const config = ndiStore.get(`outputs.${outputKey}`);
  if (!config) return false;

  if (config.enabled) {
    const result = await sendCommand('enable_output', config, { output: outputKey });
    if (!result.success) {
      console.warn(`[NDI] Failed to sync ${outputKey}:`, result.error || 'Unknown error');
      return false;
    }
    return true;
  } else {
    const result = await sendCommand('disable_output', {}, { output: outputKey });
    if (!result.success) {
      console.warn(`[NDI] Failed to disable ${outputKey}:`, result.error || 'Unknown error');
      return false;
    }
    return true;
  }
}

async function requestStats() {
  if (!companionProcess) return;
  const result = await sendCommand('request_stats', {});
  if (!result.success || !Array.isArray(result.responses)) return;

  const stats = result.responses.find((e) => e?.type === 'stats');
  if (stats) {
    notifyAllWindows('ndi:companion-telemetry', {
      stats: stats.payload || null,
      health: stats.payload?.health || null,
    });
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

function applyHelloMetadata(helloResponse) {
  const version = helloResponse?.payload?.version;
  if (!version) return;

  companionProtocolVersion = version;
  console.log(`[NDI] Companion protocol version: ${companionProtocolVersion}`);

  const expectedVersion = ndiStore.get('version') || '';
  if (expectedVersion && companionProtocolVersion !== expectedVersion) {
    console.warn(`[NDI] Version mismatch: expected v${expectedVersion}, companion reports v${companionProtocolVersion}`);
  }
}

async function bootstrapCompanionSession(launchGeneration) {
  const isStaleLaunch = () => !companionProcess || launchGeneration !== companionLaunchGeneration;

  let helloResponse = null;
  for (let attempt = 1; attempt <= COMPANION_BOOTSTRAP_MAX_ATTEMPTS; attempt += 1) {
    if (isStaleLaunch()) return false;

    const hello = await sendCommand('hello', {});
    if (hello.success) {
      helloResponse = hello.responses?.find((r) => r?.type === 'hello') || null;
      if (helloResponse) {
        break;
      }
    }

    const waitMs = Math.min(COMPANION_BOOTSTRAP_BASE_DELAY_MS * attempt, COMPANION_BOOTSTRAP_MAX_DELAY_MS);
    await delay(waitMs);
  }

  if (!helloResponse) {
    console.warn('[NDI] Companion bootstrap failed: hello handshake did not succeed within retry window');
    return false;
  }

  applyHelloMetadata(helloResponse);

  if (isStaleLaunch()) return false;
  connectPersistentSocket();

  let synced = false;
  for (let attempt = 1; attempt <= COMPANION_SYNC_RETRY_ATTEMPTS; attempt += 1) {
    if (isStaleLaunch()) return false;
    synced = await syncOutputs();
    if (synced) break;
    await delay(COMPANION_SYNC_RETRY_DELAY_MS * attempt);
  }

  if (!synced) {
    console.warn('[NDI] Companion bootstrap failed: output sync did not succeed within retry window');
    return false;
  }

  if (isStaleLaunch()) return false;
  await requestStats();
  return true;
}

async function launchCompanion() {
  if (companionProcess) {
    return { success: true, message: 'Already running' };
  }

  const entryPath = getCompanionEntryPath();
  const ipcConfig = getIpcConfig();
  companionAuthToken = createCompanionAuthToken();
  companionStarting = true;
  companionReady = false;
  companionBootstrapError = null;

  if (isDev) {
    // In dev mode, launch via the running Electron binary pointing at the companion source.
    if (!fs.existsSync(entryPath)) {
      resetCompanionRuntimeState();
      return { success: false, error: `Companion source not found at ${entryPath}` };
    }

    const electronBin = process.execPath;
    const companionDir = getInstallPath();
    const args = [
      companionDir,
      '--host', ipcConfig.host,
      '--port', String(ipcConfig.port),
      '--auth-token', companionAuthToken,
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
      resetCompanionRuntimeState();
      return { success: false, error: error.message };
    }
  } else {
    if (!fs.existsSync(entryPath)) {
      resetCompanionRuntimeState();
      return { success: false, error: `NDI companion not found at ${entryPath}` };
    }

    const args = [
      '--host', ipcConfig.host,
      '--port', String(ipcConfig.port),
      '--auth-token', companionAuthToken,
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
      resetCompanionRuntimeState();
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
    companionLaunchGeneration += 1;
    companionProcess = null;
    resetCompanionRuntimeState();
    destroyPersistentSocket();
    stopStatsLoop();
    notifyCompanionStatus();
  });

  companionProcess.on('error', (err) => {
    console.error('[NDI] Companion error:', err);
    companionLaunchGeneration += 1;
    companionProcess = null;
    resetCompanionRuntimeState();
    companionBootstrapError = err.message;
    destroyPersistentSocket();
    stopStatsLoop();
    notifyCompanionStatus({ error: err.message });
  });

  notifyCompanionStatus();
  startStatsLoop();
  const launchGeneration = companionLaunchGeneration + 1;
  companionLaunchGeneration = launchGeneration;
  companionProtocolVersion = null;

  bootstrapCompanionSession(launchGeneration).then((success) => {
    if (!success && companionProcess && launchGeneration === companionLaunchGeneration) {
      companionStarting = false;
      companionReady = false;
      companionBootstrapError = companionBootstrapError || 'Companion launched but did not finish setup';
      console.warn('[NDI] Companion launched but bootstrap did not fully complete');
      notifyCompanionStatus();
    } else if (success && companionProcess && launchGeneration === companionLaunchGeneration) {
      companionStarting = false;
      companionReady = true;
      companionBootstrapError = null;
      notifyCompanionStatus();
    }
  }).catch((error) => {
    if (companionProcess && launchGeneration === companionLaunchGeneration) {
      companionStarting = false;
      companionReady = false;
      companionBootstrapError = error?.message || String(error);
      console.warn('[NDI] Companion bootstrap error:', error?.message || error);
      notifyCompanionStatus();
    }
  });

  console.log('[NDI] Companion launched successfully');
  return { success: true };
}

function stopCompanion() {
  if (!companionProcess) {
    return { success: true, message: 'Not running' };
  }

  companionLaunchGeneration += 1;

  sendCommand('shutdown', {}).catch((error) => {
    console.warn('[NDI] Graceful shutdown request failed:', error?.message || error);
  });

  try { companionProcess.kill(); } catch (error) {
    console.warn('[NDI] Error killing companion process:', error);
  }

  stopStatsLoop();
  destroyPersistentSocket();
  companionProcess = null;
  resetCompanionRuntimeState();
  notifyCompanionStatus();
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
    starting: companionStarting,
    ready: companionReady,
    bootstrapError: companionBootstrapError,
  };
}

// ============ Settings ============

function getOutputSettings(outputKey) {
  const safeOutputKey = normalizeOutputKey(outputKey);
  if (!safeOutputKey) {
    return { success: false, error: 'Invalid output key' };
  }
  return outputSettingsManager.getOutputSettings(safeOutputKey, companionProcess !== null);
}

function setOutputSetting(outputKey, key, value) {
  const safeOutputKey = normalizeOutputKey(outputKey);
  if (!safeOutputKey) {
    return { success: false, error: 'Invalid output key' };
  }

  const current = ensureOutputSettings(safeOutputKey);
  const normalized = normalizeOutputConfig(safeOutputKey, { ...current, [key]: value });
  if (!Object.prototype.hasOwnProperty.call(normalized, key)) {
    return { success: false, error: 'Invalid setting key' };
  }

  ndiStore.set(`outputs.${safeOutputKey}.${key}`, normalized[key]);
  if (companionProcess) {
    syncSingleOutputWithFallback(safeOutputKey, 'output setting change');
  }
  return { success: true };
}

function syncSingleOutputWithFallback(outputKey, contextLabel = 'output setting change') {
  syncSingleOutput(outputKey).then((success) => {
    if (!success) {
      syncOutputs().catch((error) => {
        console.warn(`[NDI] Failed fallback full output sync after ${contextLabel}:`, error?.message || error);
      });
    }
  }).catch((error) => {
    console.warn(`[NDI] Failed syncing ${contextLabel}:`, error?.message || error);
    syncOutputs().catch((syncError) => {
      console.warn(`[NDI] Failed fallback full output sync after ${contextLabel}:`, syncError?.message || syncError);
    });
  });
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

// ============ Initialization & IPC ============

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
    const autoCheck = userPreferences.getPreference('general.autoCheckForUpdates') ?? true;
    if (autoCheck) {
      performStartupUpdateCheck();
    }
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
    resetUpdateCache();
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
    const safeOutputKey = normalizeOutputKey(outputKey);
    if (!safeOutputKey) {
      return { success: false, error: 'Invalid output key' };
    }

    const current = ensureOutputSettings(safeOutputKey);
    const normalized = normalizeOutputConfig(safeOutputKey, {
      ...current,
      resolution: 'custom',
      customWidth: width,
      customHeight: height,
    });
    ndiStore.set(`outputs.${safeOutputKey}.resolution`, normalized.resolution);
    ndiStore.set(`outputs.${safeOutputKey}.customWidth`, normalized.customWidth);
    ndiStore.set(`outputs.${safeOutputKey}.customHeight`, normalized.customHeight);
    if (companionProcess) {
      syncSingleOutputWithFallback(safeOutputKey, 'custom resolution change');
    }
    return { success: true };
  });

  ipcMain.handle('ndi:set-framerate', (_, { outputKey, framerate }) => setOutputSetting(outputKey, 'framerate', framerate));

  ipcMain.handle('ndi:register-outputs', async (_, { outputs }) => {
    const customOutputs = normalizeOutputList(outputs);
    const registered = new Set([...DEFAULT_OUTPUT_IDS, ...customOutputs]);

    for (const outputKey of registered) {
      ensureOutputSettings(outputKey);
    }

    const storedOutputs = ndiStore.get('outputs') || {};
    for (const key of Object.keys(storedOutputs)) {
      if (!key.startsWith('output')) continue;
      if (key === 'output1' || key === 'output2') continue;
      if (!registered.has(key)) {
        ndiStore.set(`outputs.${key}.enabled`, false);
      }
    }

    if (companionProcess) {
      await syncOutputs();
    }

    return { success: true };
  });

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
