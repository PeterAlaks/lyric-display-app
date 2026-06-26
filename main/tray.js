import { app, Menu, nativeImage, Tray } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { appRoot } from './paths.js';

let appTray = null;
let appTrayMenu = null;
let windowsTrayHostProcess = null;

function getTrayIconCandidates() {
  const executableDir = path.dirname(process.execPath);
  const resourcesPath = process.resourcesPath || appRoot;
  const extension = process.platform === 'win32' ? 'ico' : 'png';

  return [
    path.join(appRoot, 'public', `favicon.${extension}`),
    path.join(resourcesPath, 'app.asar', 'public', `favicon.${extension}`),
    path.join(executableDir, 'LyricDisplay-icon.ico'),
    path.join(executableDir, 'LyricDisplay-icon.png'),
    path.join(appRoot, 'public', 'LyricDisplay-icon.png'),
    path.join(resourcesPath, 'app.asar', 'public', 'LyricDisplay-icon.png'),
  ];
}

function createTrayIcon() {
  let image = nativeImage.createEmpty();
  let selectedPath = null;

  for (const candidate of getTrayIconCandidates()) {
    image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) {
      selectedPath = candidate;
      break;
    }
  }

  if (image.isEmpty()) {
    console.warn('[Tray] Failed to load tray icon from known paths');
  } else {
    console.log('[Tray] Loaded tray icon:', selectedPath);
  }

  if (process.platform === 'darwin' && !image.isEmpty()) {
    image.setTemplateImage(true);
  }

  if (process.platform === 'win32' && !image.isEmpty()) {
    return image.resize({ width: 16, height: 16 });
  }

  return image;
}

function logTrayEvent(eventName, isHeadlessMode, bounds) {
  console.log('[Tray] Tray event:', eventName, {
    isHeadlessMode,
    bounds: bounds && Number.isFinite(bounds.x)
    ? {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    }
    : null,
  });
}

function getWindowsTrayHostSourcePath() {
  return path.join(appRoot, 'main', 'windowsTrayHost.ps1');
}

function getWindowsTrayHostRuntimePath() {
  return path.join(app.getPath('userData'), 'windowsTrayHost.ps1');
}

function getWindowsPowerShellPath() {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  const candidate = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return fs.existsSync(candidate) ? candidate : 'powershell.exe';
}

function prepareWindowsTrayHostScript() {
  const sourcePath = getWindowsTrayHostSourcePath();
  const runtimePath = getWindowsTrayHostRuntimePath();
  const script = fs.readFileSync(sourcePath, 'utf8');
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  fs.writeFileSync(runtimePath, script, 'utf8');
  return runtimePath;
}

function stopWindowsTrayHost() {
  if (!windowsTrayHostProcess) return;
  try {
    windowsTrayHostProcess.kill();
  } catch {
  }
  windowsTrayHostProcess = null;
}

function startWindowsTrayHost({ isHeadlessMode = false } = {}) {
  if (windowsTrayHostProcess && !windowsTrayHostProcess.killed) {
    return windowsTrayHostProcess;
  }

  let scriptPath;
  try {
    scriptPath = prepareWindowsTrayHostScript();
  } catch (error) {
    console.warn('[Tray] Failed to prepare Windows native tray host script:', error);
    return null;
  }

  const args = [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-STA',
    '-WindowStyle', 'Hidden',
    '-File', scriptPath,
    '-ParentPid', String(process.pid),
    '-ExePath', process.execPath,
    '-BaseUrl', 'http://127.0.0.1:4000',
    '-Tooltip', isHeadlessMode ? 'LyricDisplay Dock Mode' : 'LyricDisplay',
    '-Mode', isHeadlessMode ? 'dock' : 'desktop',
  ];

  try {
    windowsTrayHostProcess = spawn(getWindowsPowerShellPath(), args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    windowsTrayHostProcess.stdout?.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) console.log('[TrayHost]', text);
    });

    windowsTrayHostProcess.stderr?.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) console.warn('[TrayHost]', text);
    });

    windowsTrayHostProcess.on('exit', (code, signal) => {
      console.log('[Tray] Windows native tray host exited', { code, signal });
      windowsTrayHostProcess = null;
    });

    console.log('[Tray] Windows native tray host started', { pid: windowsTrayHostProcess.pid });
    return windowsTrayHostProcess;
  } catch (error) {
    console.warn('[Tray] Failed to start Windows native tray host:', error);
    windowsTrayHostProcess = null;
    return null;
  }
}

export function createAppTray({
  isHeadlessMode = false,
  openMainWindow,
  quitApp,
} = {}) {
  if (process.platform === 'win32') {
    return startWindowsTrayHost({ isHeadlessMode });
  }

  if (appTray) return appTray;

  const icon = createTrayIcon();
  appTray = new Tray(icon);
  appTray.setToolTip(isHeadlessMode ? 'LyricDisplay Dock Mode' : 'LyricDisplay');

  console.log('[Tray] Creating tray', { isHeadlessMode });

  const showMainWindow = () => {
    console.log(isHeadlessMode ? '[Tray] Open LyricDisplay desktop requested' : '[Tray] Open LyricDisplay requested');
    if (typeof openMainWindow === 'function') {
      openMainWindow();
    }
  };

  const handleQuit = () => {
    console.log(isHeadlessMode ? '[Tray] Quit LyricDisplay Dock Mode requested' : '[Tray] Quit LyricDisplay requested');
    if (typeof quitApp === 'function') {
      quitApp();
      return;
    }
    app.isQuitting = true;
    app.quit();
  };

  appTrayMenu = Menu.buildFromTemplate([
    {
      label: isHeadlessMode ? 'Open LyricDisplay Desktop' : 'Open LyricDisplay',
      click: showMainWindow,
    },
    { type: 'separator' },
    {
      label: isHeadlessMode ? 'Quit LyricDisplay Dock Mode' : 'Quit LyricDisplay',
      click: handleQuit,
    },
  ]);

  appTray.setContextMenu(appTrayMenu);
  console.log('[Tray] Native context menu attached');

  appTray.on('click', (_event, bounds) => {
    logTrayEvent('click', isHeadlessMode, bounds);
    showMainWindow();
  });

  appTray.on('right-click', (_event, bounds) => {
    logTrayEvent('right-click', isHeadlessMode, bounds);
  });

  appTray.on('middle-click', (_event, bounds) => {
    logTrayEvent('middle-click', isHeadlessMode, bounds);
    showMainWindow();
  });

  // Double-click: open the main window directly, bypassing the menu.
  appTray.on('double-click', (_event, bounds) => {
    logTrayEvent('double-click', isHeadlessMode, bounds);
    showMainWindow();
  });

  return appTray;
}

export function destroyAppTray() {
  stopWindowsTrayHost();

  if (!appTray) return;
  try {
    appTray.setContextMenu(null);
    appTray.destroy();
  } catch {
  }
  appTray = null;
  appTrayMenu = null;
}
