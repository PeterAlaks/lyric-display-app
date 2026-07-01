import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateUserDataForTests } from '../main/appIdentity.js';

const LEGACY_APP_NAME = 'lyric-display-app';
const APP_NAME = 'LyricDisplay';
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
