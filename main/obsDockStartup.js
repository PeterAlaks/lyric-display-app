import { app } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import { appRoot, isDev } from './paths.js';

const OBS_DOCK_LOGIN_ARGS = ['--headless', '--obs-dock'];

function getDockFilePath() {
  if (isDev) {
    return path.join(appRoot, 'obs-dock-dev.html');
  }

  return path.join(path.dirname(process.execPath), 'obs-dock.html');
}

function getRelaunchArgs() {
  if (isDev) {
    return [appRoot, ...OBS_DOCK_LOGIN_ARGS];
  }

  return [...OBS_DOCK_LOGIN_ARGS];
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
    dockFileUrl: pathToFileURL(dockFilePath).href,
    controllerUrl: isDev
      ? 'http://localhost:5173/obs-dock'
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
    console.warn('[OBSDockStartup] Failed to relaunch in OBS dock headless mode:', error);
    return { success: false, error: error.message };
  }
}
