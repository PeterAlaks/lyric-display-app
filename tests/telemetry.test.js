import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createTelemetryEvents,
  getOrCreateAnonymousInstallation,
  recordSuccessfulAppLaunch,
  TELEMETRY_STATE_FILE,
} from '../main/telemetry.js';

test('anonymous installation identity is random and stable without device data', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricdisplay-telemetry-'));
  try {
    const first = getOrCreateAnonymousInstallation(directory);
    const second = getOrCreateAnonymousInstallation(directory);
    assert.match(first.installationId, /^[0-9a-f-]{36}$/i);
    assert.equal(second.installationId, first.installationId);

    const stored = JSON.parse(fs.readFileSync(path.join(directory, TELEMETRY_STATE_FILE), 'utf8'));
    assert.deepEqual(Object.keys(stored).sort(), ['installationId', 'lastReportedVersion']);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('launch payload contains only the anonymous operational fields', () => {
  const [event] = createTelemetryEvents({
    installationId: '2edcb9ca-e456-4e99-9537-66bf82dd8843',
    currentVersion: '2.8.1',
    previousVersion: null,
    platform: 'win32',
  });
  assert.deepEqual(event, {
    installationId: '2edcb9ca-e456-4e99-9537-66bf82dd8843',
    appVersion: '2.8.1',
    platform: 'win32',
    event: 'launch',
  });
});

test('a version change produces a completed-update event', () => {
  const events = createTelemetryEvents({
    installationId: '2edcb9ca-e456-4e99-9537-66bf82dd8843',
    currentVersion: '2.8.1',
    previousVersion: '2.8.0',
    platform: 'linux',
  });
  assert.equal(events.length, 2);
  assert.deepEqual(events[1], {
    installationId: '2edcb9ca-e456-4e99-9537-66bf82dd8843',
    appVersion: '2.8.1',
    previousVersion: '2.8.0',
    platform: 'linux',
    event: 'update_completed',
  });
});

test('reported version advances only after the event is accepted', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricdisplay-telemetry-'));
  const previousForce = process.env.LYRICDISPLAY_TELEMETRY_FORCE;
  process.env.LYRICDISPLAY_TELEMETRY_FORCE = '1';
  try {
    const sent = [];
    await recordSuccessfulAppLaunch({
      enabled: true,
      userDataPath: directory,
      currentVersion: '2.8.0',
      platform: 'darwin',
      sender: async (_endpoint, payload) => { sent.push(payload); },
    });
    await recordSuccessfulAppLaunch({
      enabled: true,
      userDataPath: directory,
      currentVersion: '2.8.1',
      platform: 'darwin',
      sender: async (_endpoint, payload) => { sent.push(payload); },
    });

    assert.deepEqual(sent.map((event) => event.event), ['launch', 'launch', 'update_completed']);
    const stored = JSON.parse(fs.readFileSync(path.join(directory, TELEMETRY_STATE_FILE), 'utf8'));
    assert.equal(stored.lastReportedVersion, '2.8.1');
  } finally {
    if (previousForce === undefined) delete process.env.LYRICDISPLAY_TELEMETRY_FORCE;
    else process.env.LYRICDISPLAY_TELEMETRY_FORCE = previousForce;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('disabled telemetry does not create an installation identifier or send', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricdisplay-telemetry-'));
  let calls = 0;
  try {
    const result = await recordSuccessfulAppLaunch({
      enabled: false,
      userDataPath: directory,
      currentVersion: '2.8.1',
      sender: async () => { calls += 1; },
    });
    assert.equal(result.skipped, true);
    assert.equal(calls, 0);
    assert.equal(fs.existsSync(path.join(directory, TELEMETRY_STATE_FILE)), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
