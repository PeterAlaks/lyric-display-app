import { app } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import { appRoot, isDev } from './paths.js';

const OBS_DOCK_LOGIN_ARGS = ['--headless', '--obs-dock'];

function getDockFilePath() {
  if (isDev) {
    return path.join(appRoot, 'obs-dock.html');
  }

  return path.join(path.dirname(process.execPath), 'obs-dock.html');
}

function getDockFileUrl(dockFilePath) {
  const dockFileUrl = pathToFileURL(dockFilePath).href;
  return isDev ? `${dockFileUrl}?mode=dev` : dockFileUrl;
}

function getRelaunchArgs() {
  if (isDev) {
    return [appRoot, ...OBS_DOCK_LOGIN_ARGS];
  }

  return [...OBS_DOCK_LOGIN_ARGS];
}

function getDesktopRelaunchArgs() {
  if (isDev) {
    return [appRoot];
  }

  return [];
}

function clearHeadlessEnvironment() {
  delete process.env.LYRICDISPLAY_HEADLESS;
  delete process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH;
  delete process.env.LYRICDISPLAY_OBS_DOCK_PAIRING_TOKEN;
}

export function getObsDockStartupStatus() {
  try {
    const settings = app.getLoginItemSettings({
      args: OBS_DOCK_LOGIN_ARGS,
    });

    return {
      success: true,
      supported: true,
      enabled: Boolean(settings.openAtLogin),
      executableWillLaunchAtLogin: Boolean(settings.executableWillLaunchAtLogin ?? settings.openAtLogin),
      args: OBS_DOCK_LOGIN_ARGS,
    };
  } catch (error) {
    console.warn('[OBSDockStartup] Failed to read login item settings:', error);
    return {
      success: false,
      supported: false,
      enabled: false,
      error: error.message,
      args: OBS_DOCK_LOGIN_ARGS,
    };
  }
}

export function setObsDockStartupEnabled(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      openAsHidden: true,
      args: OBS_DOCK_LOGIN_ARGS,
    });

    return getObsDockStartupStatus();
  } catch (error) {
    console.warn('[OBSDockStartup] Failed to update login item settings:', error);
    return {
      success: false,
      supported: false,
      enabled: false,
      error: error.message,
      args: OBS_DOCK_LOGIN_ARGS,
    };
  }
}

export function getObsDockSetupInfo() {
  const dockFilePath = getDockFilePath();

  return {
    success: true,
    isDev,
    dockFilePath,
    dockFileUrl: getDockFileUrl(dockFilePath),
    controllerUrl: isDev
      ? 'http://127.0.0.1:5173/?dock=obs&clientType=obsDock'
      : 'http://127.0.0.1:4000/#/obs-dock',
    headlessCommand: isDev
      ? 'npm run electron-dev:headless'
      : `"${process.execPath}" ${OBS_DOCK_LOGIN_ARGS.join(' ')}`,
    relaunchArgs: getRelaunchArgs(),
  };
}

export function relaunchInObsDockHeadlessMode() {
  try {
    app.relaunch({ args: getRelaunchArgs() });
    app.exit(0);
    return { success: true };
  } catch (error) {
    console.warn('[OBSDockStartup] Failed to relaunch in LyricDisplay Dock headless mode:', error);
    return { success: false, error: error.message };
  }
}

export function relaunchInDesktopMode() {
  try {
    clearHeadlessEnvironment();
    app.isQuitting = true;
    app.relaunch({ args: getDesktopRelaunchArgs() });
    app.quit();
    return { success: true };
  } catch (error) {
    console.warn('[OBSDockStartup] Failed to relaunch LyricDisplay desktop mode:', error);
    try {
      app.exit(1);
    } catch {
    }
    return { success: false, error: error.message };
  }
}
