import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const APP_DATA_RESET_ARG_PREFIX = '--lyricdisplay-reset-token=';
const RESET_REQUEST_VERSION = 1;
const RESET_REQUEST_PREFIX = '.lyricdisplay-reset-request-';
const RESET_COMPLETION_PREFIX = '.lyricdisplay-reset-complete-';
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const comparablePath = (value) => {
  const resolved = path.resolve(String(value || ''));
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

function assertSafeUserDataTarget(appDataPath, userDataPath) {
  const appData = path.resolve(String(appDataPath || ''));
  const userData = path.resolve(String(userDataPath || ''));
  if (!appDataPath || !userDataPath || path.dirname(userData) !== appData || userData === appData) {
    throw new Error('Refusing to reset an unsafe user-data target');
  }
  return { appData, userData };
}

function getResetToken(argv = process.argv) {
  const resetArg = argv.find((arg) => String(arg).startsWith(APP_DATA_RESET_ARG_PREFIX));
  if (!resetArg) return { requested: false, token: null };
  const token = String(resetArg).slice(APP_DATA_RESET_ARG_PREFIX.length);
  return { requested: true, token: TOKEN_PATTERN.test(token) ? token : null };
}

function getRequestMarkerPath(appDataPath, token) {
  return path.join(appDataPath, `${RESET_REQUEST_PREFIX}${token}.json`);
}

function getCompletionMarkerPath(appDataPath, userDataPath) {
  const targetHash = crypto
    .createHash('sha256')
    .update(comparablePath(userDataPath))
    .digest('hex')
    .slice(0, 16);
  return path.join(appDataPath, `${RESET_COMPLETION_PREFIX}${targetHash}.json`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value, options = {}) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
    ...options,
  });
}

export function getRelaunchArgsWithoutResetToken(argv = process.argv) {
  return argv
    .slice(1)
    .filter((arg) => !String(arg).startsWith(APP_DATA_RESET_ARG_PREFIX));
}

export function createAppDataResetRequest({
  appDataPath,
  userDataPath,
  argv = process.argv,
  createToken = crypto.randomUUID,
} = {}) {
  const { appData, userData } = assertSafeUserDataTarget(appDataPath, userDataPath);
  const token = createToken();
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error('Could not create a valid app reset authorization token');
  }

  fs.mkdirSync(appData, { recursive: true });
  const markerPath = getRequestMarkerPath(appData, token);
  writeJson(markerPath, {
    version: RESET_REQUEST_VERSION,
    token,
    targetPath: userData,
    requestedAt: new Date().toISOString(),
  }, { flag: 'wx' });

  const resetArg = `${APP_DATA_RESET_ARG_PREFIX}${token}`;
  return {
    markerPath,
    relaunchArgs: [...getRelaunchArgsWithoutResetToken(argv), resetArg],
    resetArg,
    token,
  };
}

export function hasCompletedAppDataReset({ appDataPath, userDataPath } = {}) {
  try {
    const { appData, userData } = assertSafeUserDataTarget(appDataPath, userDataPath);
    const marker = readJson(getCompletionMarkerPath(appData, userData));
    return marker?.version === RESET_REQUEST_VERSION &&
      comparablePath(marker.targetPath) === comparablePath(userData);
  } catch {
    return false;
  }
}

export function consumeAppDataResetRequest({
  appDataPath,
  userDataPath,
  argv = process.argv,
} = {}) {
  const resetToken = getResetToken(argv);
  if (!resetToken.requested) {
    return { requested: false, reset: false };
  }
  if (!resetToken.token) {
    return { requested: true, reset: false, error: 'Invalid reset authorization token.' };
  }

  let appData;
  let userData;
  try {
    ({ appData, userData } = assertSafeUserDataTarget(appDataPath, userDataPath));
  } catch (error) {
    return { requested: true, reset: false, error: error.message };
  }

  const markerPath = getRequestMarkerPath(appData, resetToken.token);
  let marker;
  try {
    marker = readJson(markerPath);
  } catch {
    if (hasCompletedAppDataReset({ appDataPath: appData, userDataPath: userData })) {
      return { requested: true, reset: false, alreadyCompleted: true };
    }
    return { requested: true, reset: false, error: 'Reset authorization was not found.' };
  }

  if (
    marker?.version !== RESET_REQUEST_VERSION ||
    marker?.token !== resetToken.token ||
    comparablePath(marker?.targetPath) !== comparablePath(userData)
  ) {
    return { requested: true, reset: false, error: 'Reset authorization target did not match the user-data folder.' };
  }

  try {
    fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    writeJson(getCompletionMarkerPath(appData, userData), {
      version: RESET_REQUEST_VERSION,
      targetPath: userData,
      completedAt: new Date().toISOString(),
    });
    fs.rmSync(markerPath, { force: true });
    return { requested: true, reset: true };
  } catch (error) {
    return {
      requested: true,
      reset: false,
      error: `Could not clear the user-data folder: ${error.message}`,
    };
  }
}

export function requestAppDataResetAndRelaunch({
  appApi,
  argv = process.argv,
  createToken = crypto.randomUUID,
  scheduleExit = setTimeout,
} = {}) {
  let request;
  try {
    request = createAppDataResetRequest({
      appDataPath: appApi.getPath('appData'),
      userDataPath: appApi.getPath('userData'),
      argv,
      createToken,
    });
    appApi.relaunch({ args: request.relaunchArgs });
  } catch (error) {
    if (request?.markerPath) {
      try { fs.rmSync(request.markerPath, { force: true }); } catch { }
    }
    return { success: false, error: error.message };
  }

  scheduleExit(() => appApi.exit(0), 100);
  return { success: true, restarting: true };
}
