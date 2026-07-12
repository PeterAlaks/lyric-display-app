import assert from 'node:assert/strict';
import test from 'node:test';
import { migratePreferences } from '../main/preferenceMigrations.js';
import { createUpdateSessionPolicy } from '../main/updateSessionPolicy.js';
import {
  CURRENT_SESSION_SCHEMA_VERSION,
  migrateSessionSnapshot,
} from '../server/realtime/sessionPersistence.js';

test('Live Safety defers automatic checks until the session closes', () => {
  const policy = createUpdateSessionPolicy();
  assert.equal(policy.deferAutomaticCheck(), false);

  policy.setSessionActive(true);
  assert.equal(policy.deferAutomaticCheck(), true);
  assert.deepEqual(policy.getSnapshot(), {
    sessionActive: true,
    automaticCheckDeferred: true,
    deferredNotification: null,
  });

  assert.deepEqual(policy.setSessionActive(false), {
    changed: true,
    runDeferredCheck: true,
    releaseNotification: null,
  });
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
  assert.equal(result.preferences._schemaVersion, 1);
  assert.equal(result.preferences.general.autoCheckForUpdates, false);
  assert.equal(result.preferences.general.liveSafetyMode, true);
  assert.equal(result.preferences.general.confirmOnClose, false);
  assert.deepEqual(result.preferences.appearance, { themeMode: 'dark' });

  const repeated = migratePreferences(result.preferences);
  assert.equal(repeated.success, true);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.preferences, result.preferences);
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
