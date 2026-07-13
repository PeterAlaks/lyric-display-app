import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateUserDataForTests } from '../main/appIdentity.js';

const LEGACY_APP_NAME = 'lyric-display-app';
const APP_NAME = 'LyricDisplay';
const LEGACY_NDI_NAME = 'lyricdisplay-ndi';
const NDI_NAME = 'NDI';
const NDI_INSTALL_NAME = 'Companion';
const NDI_USER_DATA_NAME = 'User Data';
const NDI_MANAGED_INSTALL_MARKER = '.managed-install-complete';
const MARKER_FILE = 'user-data-migration.json';
const ORIGINAL_MIGRATED_AT = '2025-01-02T03:04:05.000Z';

function makeTempAppData() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lyricdisplay-migration-'));
}

function writeMarker(targetPath, overrides = {}) {
  fs.mkdirSync(targetPath, { recursive: true });
  fs.writeFileSync(
    path.join(targetPath, MARKER_FILE),
    JSON.stringify({
      migratedAt: ORIGINAL_MIGRATED_AT,
      sourcePath: path.join(path.dirname(targetPath), LEGACY_APP_NAME),
      targetPath,
      copiedFiles: 0,
      skippedExisting: 0,
      skippedSymlinks: 0,
      skippedOther: 0,
      deletedLegacy: true,
      legacyDeleteSkippedReason: null,
      errors: [],
      ...overrides,
    }, null, 2),
    'utf8'
  );
}

test('reconciles a reappearing legacy folder before deleting it', () => {
  const appDataPath = makeTempAppData();
  const sourcePath = path.join(appDataPath, LEGACY_APP_NAME);
  const targetPath = path.join(appDataPath, APP_NAME);

  fs.mkdirSync(sourcePath, { recursive: true });
  fs.writeFileSync(path.join(sourcePath, 'missing-preference.json'), '{"ok":true}', 'utf8');
  writeMarker(targetPath);

  const result = migrateUserDataForTests(appDataPath);
  const marker = JSON.parse(fs.readFileSync(path.join(targetPath, MARKER_FILE), 'utf8'));

  assert.equal(result.reconciliationAttempted, true);
  assert.equal(result.deletedLegacy, true);
  assert.equal(fs.existsSync(sourcePath), false);
  assert.equal(fs.readFileSync(path.join(targetPath, 'missing-preference.json'), 'utf8'), '{"ok":true}');
  assert.equal(marker.migratedAt, ORIGINAL_MIGRATED_AT);
  assert.ok(marker.updatedAt);
});

test('does not delete legacy data when an existing target file differs', () => {
  const appDataPath = makeTempAppData();
  const sourcePath = path.join(appDataPath, LEGACY_APP_NAME);
  const targetPath = path.join(appDataPath, APP_NAME);

  fs.mkdirSync(sourcePath, { recursive: true });
  fs.mkdirSync(targetPath, { recursive: true });
  fs.writeFileSync(path.join(sourcePath, 'settings.json'), '{"theme":"legacy"}', 'utf8');
  fs.writeFileSync(path.join(targetPath, 'settings.json'), '{"theme":"current"}', 'utf8');
  writeMarker(targetPath);

  const result = migrateUserDataForTests(appDataPath);
  const marker = JSON.parse(fs.readFileSync(path.join(targetPath, MARKER_FILE), 'utf8'));

  assert.equal(result.reconciliationAttempted, true);
  assert.equal(result.deletedLegacy, false);
  assert.equal(fs.existsSync(sourcePath), true);
  assert.equal(fs.readFileSync(path.join(targetPath, 'settings.json'), 'utf8'), '{"theme":"current"}');
  assert.equal(result.conflicts.length, 1);
  assert.equal(marker.conflicts.length, 1);
  assert.equal(marker.migratedAt, ORIGINAL_MIGRATED_AT);
});

test('preserves migratedAt when migration is already complete', () => {
  const appDataPath = makeTempAppData();
  const targetPath = path.join(appDataPath, APP_NAME);

  writeMarker(targetPath);

  const result = migrateUserDataForTests(appDataPath);
  const marker = JSON.parse(fs.readFileSync(path.join(targetPath, MARKER_FILE), 'utf8'));

  assert.equal(result.attempted, false);
  assert.equal(result.reconciliationAttempted, false);
  assert.equal(result.deletedLegacy, true);
  assert.equal(marker.migratedAt, ORIGINAL_MIGRATED_AT);
  assert.ok(marker.updatedAt);
});

test('moves the companion runtime folder into managed NDI user data', () => {
  const appDataPath = makeTempAppData();
  const legacyRuntimePath = path.join(appDataPath, LEGACY_NDI_NAME);
  const managedRuntimePath = path.join(appDataPath, APP_NAME, NDI_NAME, NDI_USER_DATA_NAME);

  fs.mkdirSync(legacyRuntimePath, { recursive: true });
  fs.writeFileSync(path.join(legacyRuntimePath, 'ndi-companion-settings.json'), '{"managed":true}', 'utf8');

  const result = migrateUserDataForTests(appDataPath);

  assert.equal(result.legacyNdi.deletedLegacy, true);
  assert.equal(fs.existsSync(legacyRuntimePath), false);
  assert.equal(
    fs.readFileSync(path.join(managedRuntimePath, 'ndi-companion-settings.json'), 'utf8'),
    '{"managed":true}'
  );
});

test('moves a nested legacy companion install into the managed Companion directory', () => {
  const appDataPath = makeTempAppData();
  const targetPath = path.join(appDataPath, APP_NAME);
  const legacyInstallPath = path.join(targetPath, LEGACY_NDI_NAME);
  const managedInstallPath = path.join(targetPath, NDI_NAME, NDI_INSTALL_NAME);

  fs.mkdirSync(legacyInstallPath, { recursive: true });
  fs.writeFileSync(path.join(legacyInstallPath, 'LyricDisplay NDI.exe'), 'legacy-binary', 'utf8');

  const result = migrateUserDataForTests(appDataPath);

  assert.equal(result.legacyUserDataNdi.deletedLegacy, true);
  assert.equal(fs.existsSync(legacyInstallPath), false);
  assert.equal(
    fs.readFileSync(path.join(managedInstallPath, 'LyricDisplay NDI.exe'), 'utf8'),
    'legacy-binary'
  );
});

test('splits a flat NDI directory into companion binaries and user data', () => {
  const appDataPath = makeTempAppData();
  const ndiRootPath = path.join(appDataPath, APP_NAME, NDI_NAME);
  const managedInstallPath = path.join(ndiRootPath, NDI_INSTALL_NAME);
  const managedRuntimePath = path.join(ndiRootPath, NDI_USER_DATA_NAME);

  fs.mkdirSync(path.join(ndiRootPath, 'resources'), { recursive: true });
  fs.mkdirSync(path.join(ndiRootPath, 'Cache'), { recursive: true });
  fs.writeFileSync(path.join(ndiRootPath, 'LyricDisplay NDI.exe'), 'flat-binary', 'utf8');
  fs.writeFileSync(path.join(ndiRootPath, 'resources', 'app.asar'), 'flat-resources', 'utf8');
  fs.writeFileSync(path.join(ndiRootPath, 'ndi-companion-settings.json'), '{"flat":true}', 'utf8');
  fs.writeFileSync(path.join(ndiRootPath, 'future-electron-state.json'), '{"preserve":true}', 'utf8');
  fs.writeFileSync(path.join(ndiRootPath, 'Cache', 'cache.bin'), 'cache', 'utf8');

  const result = migrateUserDataForTests(appDataPath);

  assert.equal(result.flatNdiInstall.deletedLegacy, true);
  assert.equal(fs.readFileSync(path.join(managedInstallPath, 'LyricDisplay NDI.exe'), 'utf8'), 'flat-binary');
  assert.equal(fs.readFileSync(path.join(managedInstallPath, 'resources', 'app.asar'), 'utf8'), 'flat-resources');
  assert.equal(
    fs.readFileSync(path.join(managedRuntimePath, 'ndi-companion-settings.json'), 'utf8'),
    '{"flat":true}'
  );
  assert.equal(fs.readFileSync(path.join(managedRuntimePath, 'Cache', 'cache.bin'), 'utf8'), 'cache');
  assert.equal(
    fs.readFileSync(path.join(managedRuntimePath, 'future-electron-state.json'), 'utf8'),
    '{"preserve":true}'
  );
  assert.deepEqual(
    fs.readdirSync(ndiRootPath).sort(),
    [NDI_INSTALL_NAME, NDI_USER_DATA_NAME].sort()
  );
});

test('retries a previously conflicted companion runtime migration cleanly', () => {
  const appDataPath = makeTempAppData();
  const targetPath = path.join(appDataPath, APP_NAME);
  const legacyRuntimePath = path.join(appDataPath, LEGACY_NDI_NAME);

  fs.mkdirSync(legacyRuntimePath, { recursive: true });
  fs.writeFileSync(path.join(legacyRuntimePath, 'new-runtime-file.json'), '{"retry":true}', 'utf8');
  writeMarker(targetPath, {
    legacyNdi: {
      attempted: true,
      deletedLegacy: false,
      conflicts: [{ message: 'old conflict from the previous layout' }],
      errors: [],
    },
  });

  const result = migrateUserDataForTests(appDataPath);

  assert.equal(result.legacyNdi.deletedLegacy, true);
  assert.deepEqual(result.legacyNdi.conflicts, []);
  assert.equal(fs.existsSync(legacyRuntimePath), false);
});

test('prefers newly migrated runtime data over an older flat snapshot', () => {
  const appDataPath = makeTempAppData();
  const targetPath = path.join(appDataPath, APP_NAME);
  const ndiRootPath = path.join(targetPath, NDI_NAME);
  const legacyRuntimePath = path.join(appDataPath, LEGACY_NDI_NAME);
  const managedRuntimePath = path.join(ndiRootPath, NDI_USER_DATA_NAME);

  fs.mkdirSync(legacyRuntimePath, { recursive: true });
  fs.mkdirSync(ndiRootPath, { recursive: true });
  fs.writeFileSync(path.join(legacyRuntimePath, 'ndi-companion-settings.json'), '{"version":"new"}', 'utf8');
  fs.writeFileSync(path.join(ndiRootPath, 'ndi-companion-settings.json'), '{"version":"old"}', 'utf8');
  fs.writeFileSync(path.join(ndiRootPath, 'LyricDisplay NDI.exe'), 'flat-binary', 'utf8');

  const result = migrateUserDataForTests(appDataPath);

  assert.equal(result.legacyNdi.deletedLegacy, true);
  assert.equal(result.flatNdiInstall.deletedLegacy, true);
  assert.equal(result.flatNdiInstall.supersededEntries, 1);
  assert.equal(fs.existsSync(legacyRuntimePath), false);
  assert.equal(fs.existsSync(path.join(ndiRootPath, 'ndi-companion-settings.json')), false);
  assert.equal(
    fs.readFileSync(path.join(managedRuntimePath, 'ndi-companion-settings.json'), 'utf8'),
    '{"version":"new"}'
  );
});

test('removes superseded flat install artifacts after a managed install completes', () => {
  const appDataPath = makeTempAppData();
  const ndiRootPath = path.join(appDataPath, APP_NAME, NDI_NAME);
  const managedInstallPath = path.join(ndiRootPath, NDI_INSTALL_NAME);
  const managedRuntimePath = path.join(ndiRootPath, NDI_USER_DATA_NAME);

  fs.mkdirSync(path.join(managedInstallPath, 'resources'), { recursive: true });
  fs.mkdirSync(path.join(ndiRootPath, 'resources'), { recursive: true });
  fs.writeFileSync(path.join(managedInstallPath, NDI_MANAGED_INSTALL_MARKER), '{}', 'utf8');
  fs.writeFileSync(path.join(managedInstallPath, 'LyricDisplay NDI.exe'), 'current-binary', 'utf8');
  fs.writeFileSync(path.join(managedInstallPath, 'resources', 'app.asar'), 'current-resources', 'utf8');
  fs.writeFileSync(path.join(ndiRootPath, 'LyricDisplay NDI.exe'), 'superseded-binary', 'utf8');
  fs.writeFileSync(path.join(ndiRootPath, 'resources', 'app.asar'), 'superseded-resources', 'utf8');
  fs.writeFileSync(path.join(ndiRootPath, 'future-runtime-state.json'), '{"keep":true}', 'utf8');

  const result = migrateUserDataForTests(appDataPath);

  assert.equal(result.flatNdiInstall.deletedLegacy, true);
  assert.equal(result.flatNdiInstall.supersededEntries, 2);
  assert.equal(fs.readFileSync(path.join(managedInstallPath, 'LyricDisplay NDI.exe'), 'utf8'), 'current-binary');
  assert.equal(fs.readFileSync(path.join(managedInstallPath, 'resources', 'app.asar'), 'utf8'), 'current-resources');
  assert.equal(
    fs.readFileSync(path.join(managedRuntimePath, 'future-runtime-state.json'), 'utf8'),
    '{"keep":true}'
  );
  assert.deepEqual(
    fs.readdirSync(ndiRootPath).sort(),
    [NDI_INSTALL_NAME, NDI_USER_DATA_NAME].sort()
  );
});
