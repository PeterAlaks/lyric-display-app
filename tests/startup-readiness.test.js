import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MAIN_RENDERER_READY_CHANNEL,
  normalizeRendererReadyPayload,
  waitForRendererStartup,
} from '../main/startupReadiness.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

class FakeWebContents extends EventEmitter {
  isDestroyed() {
    return false;
  }
}

test('renderer startup wait resolves only for the readiness channel', async () => {
  const webContents = new FakeWebContents();
  const waiting = waitForRendererStartup(webContents, { timeoutMs: 100 });

  webContents.emit('ipc-message', {}, 'unrelated-channel', { ready: true });
  webContents.emit('ipc-message', {}, MAIN_RENDERER_READY_CHANNEL, {
    authStatus: 'authenticated',
    connectionStatus: 'connected',
    fontStatus: 'loaded',
    ready: true,
    timings: { tokenMs: 123.6, socketMs: 20.2 },
  });

  const result = await waiting;
  assert.equal(result.outcome, 'ready');
  assert.equal(result.payload.ready, true);
  assert.equal(result.payload.fontStatus, 'loaded');
  assert.deepEqual(result.payload.timings, { tokenMs: 124, socketMs: 20 });
  assert.equal(webContents.listenerCount('ipc-message'), 0);
});

test('renderer startup wait has a bounded timeout', async () => {
  const result = await waitForRendererStartup(new FakeWebContents(), { timeoutMs: 5 });
  assert.equal(result.outcome, 'timeout');
  assert.equal(result.payload, null);
});

test('renderer readiness payload is bounded and sanitized for logs', () => {
  const result = normalizeRendererReadyPayload({
    authStatus: 'a'.repeat(100),
    connectionStatus: 42,
    fontStatus: 'unexpected',
    ready: 'yes',
    timings: { tokenMs: -1, rendererReadyMs: Number.POSITIVE_INFINITY, totalConnectionMs: 900_000 },
  });

  assert.equal(result.authStatus.length, 32);
  assert.equal(result.connectionStatus, 'unknown');
  assert.equal(result.fontStatus, 'unknown');
  assert.equal(result.ready, false);
  assert.deepEqual(result.timings, { totalConnectionMs: 600_000 });
});

test('main startup keeps the control window hidden until renderer readiness settles', () => {
  const startup = read('main/startup.js');
  assert.match(startup, /createWindow\('\/'\s*,\s*\{\s*deferShow:\s*true\s*\}\)/);
  assert.match(startup, /await rendererStartupPromise/);
  assert.match(startup, /mainWindow\.showInactive\(\)/);
});

test('renderer readiness follows document font loading without naming an interface font', () => {
  const reporter = read('src/components/routes/StartupReadinessReporter.jsx');

  assert.match(reporter, /await document\.fonts\.ready/);
  assert.doesNotMatch(reporter, /Space Grotesk/);
});
