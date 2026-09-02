import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  COMPANION_USER_DATA_ENV,
  createCompanionLaunchConfig,
  resolveAuthoritativeCompanionLocation,
} from '../main/ndi/launchConfig.js';

const createLocationHarness = ({ isDevelopment, existingInstallPaths }) => {
  const developmentInstallPath = path.resolve('lyricdisplay-ndi');
  const developmentEntryPath = path.join(developmentInstallPath, 'src', 'main.js');
  const managedInstallPath = path.resolve('user data', 'NDI', 'Companion');
  const legacyInstallPath = path.resolve('user data', 'lyricdisplay-ndi');
  const resolveEntryPath = (installPath) => path.join(installPath, 'LyricDisplay NDI.exe');
  const existingEntries = new Set(existingInstallPaths.map((installPath) => resolveEntryPath(installPath)));

  return {
    developmentEntryPath,
    developmentInstallPath,
    legacyInstallPath,
    managedInstallPath,
    location: resolveAuthoritativeCompanionLocation({
      isDevelopment,
      developmentInstallPath,
      developmentEntryPath,
      managedInstallPath,
      legacyInstallPaths: [legacyInstallPath],
      resolveEntryPath,
      entryExists: (entryPath) => existingEntries.has(entryPath),
    }),
    resolveEntryPath,
  };
};

test('NDI launch config uses clean app routes and managed user data by default', () => {
  const userDataPath = path.resolve('managed NDI user data');
  const config = createCompanionLaunchConfig({
    userDataPath,
    host: '127.0.0.1',
    port: 9137,
    authToken: 'test-token',
    appUrl: 'http://127.0.0.1:4567',
  });

  assert.equal(config.args[0], `--user-data-dir=${userDataPath}`);
  assert.equal(config.env[COMPANION_USER_DATA_ENV], userDataPath);
  assert.deepEqual(config.args.slice(1), [
    '--host', '127.0.0.1',
    '--port', '9137',
    '--auth-token', 'test-token',
    '--app-url', 'http://127.0.0.1:4567',
    '--no-hash',
  ]);
});

test('NDI dev launch keeps the Chromium switch before the Electron app path', () => {
  const userDataPath = path.resolve('managed NDI user data');
  const appPath = path.resolve('lyricdisplay-ndi');
  const config = createCompanionLaunchConfig({
    userDataPath,
    appPath,
    host: '127.0.0.1',
    port: 9137,
    authToken: 'test-token',
    appUrl: 'http://localhost:5173',
    hashRouting: false,
  });

  assert.equal(config.args[0], `--user-data-dir=${userDataPath}`);
  assert.equal(config.args[1], appPath);
  assert.equal(config.args.at(-1), '--no-hash');
});

test('NDI development source remains authoritative when a managed companion is also installed', () => {
  const paths = createLocationHarness({
    isDevelopment: true,
    existingInstallPaths: [path.resolve('user data', 'NDI', 'Companion')],
  });

  assert.deepEqual(paths.location, {
    installPath: paths.developmentInstallPath,
    companionPath: paths.developmentEntryPath,
    source: 'development',
  });
});

test('packaged NDI resolution retains managed-first and legacy fallback behavior', () => {
  const managed = createLocationHarness({
    isDevelopment: false,
    existingInstallPaths: [path.resolve('user data', 'NDI', 'Companion'), path.resolve('user data', 'lyricdisplay-ndi')],
  });
  assert.equal(managed.location.installPath, managed.managedInstallPath);
  assert.equal(managed.location.companionPath, managed.resolveEntryPath(managed.managedInstallPath));
  assert.equal(managed.location.source, 'managed');

  const legacy = createLocationHarness({
    isDevelopment: false,
    existingInstallPaths: [path.resolve('user data', 'lyricdisplay-ndi')],
  });
  assert.equal(legacy.location.installPath, legacy.legacyInstallPath);
  assert.equal(legacy.location.companionPath, legacy.resolveEntryPath(legacy.legacyInstallPath));
  assert.equal(legacy.location.source, 'legacy');
});

test('NDI launch config refuses to fall back to unmanaged storage', () => {
  assert.throws(
    () => createCompanionLaunchConfig({ userDataPath: '' }),
    /user-data path is required/i
  );
});
