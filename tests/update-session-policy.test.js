import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CURRENT_PREFERENCES_SCHEMA_VERSION,
  migratePreferences,
} from '../main/preferenceMigrations.js';
import { createUpdateSessionPolicy } from '../main/updateSessionPolicy.js';
import {
  CURRENT_SESSION_SCHEMA_VERSION,
  migrateSessionSnapshot,
} from '../server/realtime/sessionPersistence.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Live Safety defers automatic checks until the session closes', () => {
  const policy = createUpdateSessionPolicy();
  assert.equal(policy.deferCheck(), false);

  policy.setSessionActive(true);
  assert.equal(policy.deferCheck(), true);
  assert.deepEqual(policy.getSnapshot(), {
    sessionActive: true,
    checkDeferred: true,
    deferredCheckInteractive: false,
    deferredNotification: null,
  });

  assert.deepEqual(policy.setSessionActive(false), {
    changed: true,
    runDeferredCheck: true,
    deferredCheckInteractive: false,
    releaseNotification: null,
  });
});

test('an interactive check is also deferred and retains its operator feedback intent', () => {
  const policy = createUpdateSessionPolicy();
  policy.setSessionActive(true);
  assert.equal(policy.deferCheck({ interactive: true }), true);
  assert.deepEqual(policy.setSessionActive(false), {
    changed: true,
    runDeferredCheck: true,
    deferredCheckInteractive: true,
    releaseNotification: null,
  });
});

test('downloaded updates require explicit installation instead of installing on ordinary quit', () => {
  const updaterSource = fs.readFileSync(path.join(root, 'main/updater.js'), 'utf8');
  assert.match(updaterSource, /autoUpdater\.autoDownload\s*=\s*false/);
  assert.match(updaterSource, /autoUpdater\.autoInstallOnAppQuit\s*=\s*false/);
  assert.match(updaterSource, /autoUpdater\.quitAndInstall\(false, true\)/);
  assert.match(updaterSource, /process\.windowsStore\s*===\s*true/);
  assert.match(updaterSource, /updateMode:\s*isWindowsStoreUpdater\(\)\s*\?\s*'store'/);
});

test('only the highest-priority bounded update notification is released', () => {
  const policy = createUpdateSessionPolicy();
  policy.setSessionActive(true);
  assert.equal(policy.deferNotification('available'), true);
  assert.equal(policy.deferNotification('downloaded'), true);
  assert.equal(policy.deferNotification('available'), true);

  assert.deepEqual(policy.setSessionActive(false), {
    changed: true,
    runDeferredCheck: false,
    deferredCheckInteractive: false,
    releaseNotification: 'downloaded',
  });
  assert.equal(policy.getSnapshot().deferredNotification, null);
});

test('legacy preferences migrate once without overwriting valid operator choices', () => {
  const result = migratePreferences({
    general: { autoCheckForUpdates: false, liveSafetyMode: true, confirmOnClose: false },
    appearance: { themeMode: 'dark' },
  });

  assert.equal(result.success, true);
  assert.equal(result.changed, true);
  assert.equal(result.preferences._schemaVersion, CURRENT_PREFERENCES_SCHEMA_VERSION);
  assert.equal(result.preferences.general.autoCheckForUpdates, false);
  assert.equal(result.preferences.general.liveSafetyMode, true);
  assert.equal(result.preferences.general.confirmOnClose, false);
  assert.equal(result.preferences.general.previewLines, false);
  assert.equal(result.preferences.general.shareAnonymousUsageData, undefined);
  assert.equal(result.preferences.advanced.shareAnonymousUsageData, false);
  assert.equal(result.preferences.advanced.telemetryConsentDecided, false);
  assert.equal(result.preferences.formatting.capitalizedWords.includes('Holy Spirit'), true);
  assert.equal(result.preferences.parsing.sectionTagPhrases.includes('Verse'), true);
  assert.deepEqual(result.preferences.appearance, {
    themeMode: 'dark',
    timerStateTransitionAnimation: 'fade',
    timerStateTransitionDuration: 300,
    backgroundMediaTransitionAnimation: 'fade',
    backgroundMediaTransitionDuration: 300,
    outputVisibilityTransitionAnimation: 'fade',
    outputVisibilityTransitionDuration: 300,
    preview: {
      order: ['output1', 'output2', 'stage', 'time'],
      gridStyle: 'featured',
      gap: 'comfortable',
      previewResolution: '720p',
      showHeader: true,
      showLabels: true,
      showRoutePaths: false,
    },
  });

  const repeated = migratePreferences(result.preferences);
  assert.equal(repeated.success, true);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.preferences, result.preferences);
});

test('an explicit legacy telemetry opt-out remains declined after migration', () => {
  const result = migratePreferences({
    _schemaVersion: 2,
    general: { shareAnonymousUsageData: false },
  });

  assert.equal(result.success, true);
  assert.equal(result.preferences._schemaVersion, CURRENT_PREFERENCES_SCHEMA_VERSION);
  assert.equal(result.preferences.general.shareAnonymousUsageData, undefined);
  assert.equal(result.preferences.advanced.shareAnonymousUsageData, false);
  assert.equal(result.preferences.advanced.telemetryConsentDecided, true);
});

test('Preview Lyric Lines preference is preserved when upgrading from schema 3', () => {
  const result = migratePreferences({
    _schemaVersion: 3,
    general: { previewLines: true },
  });

  assert.equal(result.success, true);
  assert.equal(result.changed, true);
  assert.equal(result.preferences._schemaVersion, CURRENT_PREFERENCES_SCHEMA_VERSION);
  assert.equal(result.preferences.general.previewLines, true);
});

test('schema 4 preferences gain a normalized editable capitalization list', () => {
  const result = migratePreferences({
    _schemaVersion: 4,
    formatting: {
      capitalizeReligiousTerms: false,
      capitalizedWords: ['  holy   spirit ', 'ABBA', 'abba', 'invalid!'],
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.preferences._schemaVersion, CURRENT_PREFERENCES_SCHEMA_VERSION);
  assert.equal(result.preferences.formatting.capitalizeReligiousTerms, false);
  assert.deepEqual(result.preferences.formatting.capitalizedWords, ['Holy Spirit', 'Abba']);
});

test('schema 5 preferences gain a normalized editable section-tag phrase list', () => {
  const result = migratePreferences({
    _schemaVersion: 5,
    parsing: {
      structureTagMode: 'keep',
      sectionTagPhrases: ['  call   and response ', 'CALL AND RESPONSE', 'invalid:'],
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.preferences._schemaVersion, CURRENT_PREFERENCES_SCHEMA_VERSION);
  assert.equal(result.preferences.parsing.structureTagMode, 'keep');
  assert.deepEqual(result.preferences.parsing.sectionTagPhrases, ['Call And Response']);
});

test('schema 6 preferences discard the removed default lyrics folder setting', () => {
  const result = migratePreferences({
    _schemaVersion: 6,
    fileHandling: {
      defaultLyricsPath: 'C:\\Legacy Lyrics',
      rememberLastOpenedPath: false,
      maxRecentFiles: 12,
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.preferences._schemaVersion, CURRENT_PREFERENCES_SCHEMA_VERSION);
  assert.equal(result.preferences.fileHandling.defaultLyricsPath, undefined);
  assert.equal(result.preferences.fileHandling.rememberLastOpenedPath, false);
  assert.equal(result.preferences.fileHandling.maxRecentFiles, 12);
});

test('schema 7 preferences gain normalized output transition settings', () => {
  const result = migratePreferences({
    _schemaVersion: 7,
    appearance: {
      themeMode: 'dark',
      timerStateTransitionAnimation: 'none',
      timerStateTransitionDuration: 5_000,
      backgroundMediaTransitionAnimation: 'unsupported',
      backgroundMediaTransitionDuration: 25,
      outputVisibilityTransitionAnimation: 'blur',
      outputVisibilityTransitionDuration: 450,
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.preferences.appearance.themeMode, 'dark');
  assert.equal(result.preferences.appearance.timerStateTransitionAnimation, 'none');
  assert.equal(result.preferences.appearance.timerStateTransitionDuration, 2_000);
  assert.equal(result.preferences.appearance.backgroundMediaTransitionAnimation, 'fade');
  assert.equal(result.preferences.appearance.backgroundMediaTransitionDuration, 100);
  assert.equal(result.preferences.appearance.outputVisibilityTransitionAnimation, 'blur');
  assert.equal(result.preferences.appearance.outputVisibilityTransitionDuration, 450);
});

test('schema 9 Preview settings migrate to the featured grid style', () => {
  const result = migratePreferences({
    _schemaVersion: 9,
    appearance: {
      preview: {
        order: ['stage', 'output1', 'output2', 'time'],
        columns: '3',
        gap: 'compact',
        previewResolution: '1080p',
        showHeader: false,
        showLabels: true,
        showRoutePaths: true,
      },
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.preferences._schemaVersion, CURRENT_PREFERENCES_SCHEMA_VERSION);
  assert.deepEqual(result.preferences.appearance.preview, {
    order: ['stage', 'output1', 'output2', 'time'],
    gridStyle: 'featured',
    gap: 'compact',
    previewResolution: '1080p',
    showHeader: false,
    showLabels: true,
    showRoutePaths: true,
  });
});

test('future preference and session schemas are rejected without mutation', () => {
  const futurePreferences = { _schemaVersion: 99, general: { liveSafetyMode: true } };
  const preferencesResult = migratePreferences(futurePreferences);
  assert.equal(preferencesResult.success, false);
  assert.equal(preferencesResult.futureVersion, true);
  assert.equal(preferencesResult.preferences, futurePreferences);

  const futureSession = { version: CURRENT_SESSION_SCHEMA_VERSION + 1, currentLyrics: ['future'] };
  const sessionResult = migrateSessionSnapshot(futureSession);
  assert.equal(sessionResult.valid, false);
  assert.equal(sessionResult.futureVersion, true);
  assert.deepEqual(futureSession, {
    version: CURRENT_SESSION_SCHEMA_VERSION + 1,
    currentLyrics: ['future'],
  });
});

test('legacy realtime session snapshots migrate to the current schema', () => {
  const legacy = { currentLyrics: ['Legacy line'] };
  const result = migrateSessionSnapshot(legacy);
  assert.equal(result.valid, true);
  assert.equal(result.migrated, true);
  assert.equal(result.snapshot.version, CURRENT_SESSION_SCHEMA_VERSION);
  assert.deepEqual(result.snapshot.currentLyrics, ['Legacy line']);
  assert.equal(legacy.version, undefined);
});
