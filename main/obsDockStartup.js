import { app } from 'electron';

const OBS_DOCK_LOGIN_ARGS = ['--headless', '--obs-dock'];

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
