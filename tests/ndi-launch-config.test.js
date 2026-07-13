import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  COMPANION_USER_DATA_ENV,
  createCompanionLaunchConfig,
} from '../main/ndi/launchConfig.js';

test('NDI launch config binds Chromium and companion storage to managed user data', () => {
  const userDataPath = path.resolve('managed NDI user data');
  const config = createCompanionLaunchConfig({
    userDataPath,
    host: '127.0.0.1',
    port: 9137,
    authToken: 'test-token',
    appUrl: 'http://127.0.0.1:4000',
  });

  assert.equal(config.args[0], `--user-data-dir=${userDataPath}`);
  assert.equal(config.env[COMPANION_USER_DATA_ENV], userDataPath);
  assert.deepEqual(config.args.slice(1), [
    '--host', '127.0.0.1',
    '--port', '9137',
    '--auth-token', 'test-token',
    '--app-url', 'http://127.0.0.1:4000',
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

test('NDI launch config refuses to fall back to unmanaged storage', () => {
  assert.throws(
    () => createCompanionLaunchConfig({ userDataPath: '' }),
    /user-data path is required/i
  );
});
