import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isTrustedAppRendererUrl,
  normalizeAuthIdentity,
  normalizeBrowserUrl,
  normalizeTokenStorePayload,
} from '../main/ipc/senderValidation.js';

test('IPC sender validation accepts only loopback application origins', () => {
  assert.equal(isTrustedAppRendererUrl('http://127.0.0.1:4000/#/output1'), true);
  assert.equal(isTrustedAppRendererUrl('http://localhost:4000/timer-control'), true);
  assert.equal(isTrustedAppRendererUrl('http://localhost:5173/', { development: true }), true);
  assert.equal(isTrustedAppRendererUrl('http://localhost:5173/'), false);
  assert.equal(isTrustedAppRendererUrl('https://127.0.0.1:4000/'), false);
  assert.equal(isTrustedAppRendererUrl('http://example.com:4000/'), false);
  assert.equal(isTrustedAppRendererUrl('data:text/html,test'), false);
});

test('desktop JWT identity validation bounds renderer-supplied identifiers', () => {
  assert.deepEqual(normalizeAuthIdentity({ deviceId: 'device_123456', sessionId: 'session_123456' }), {
    deviceId: 'device_123456',
    sessionId: 'session_123456',
  });
  assert.throws(() => normalizeAuthIdentity({ deviceId: '../device', sessionId: 'session_123456' }), /Invalid device ID/);
  assert.throws(() => normalizeAuthIdentity({ deviceId: 'device_123456', sessionId: 'x' }), /Invalid session ID/);
});

test('embedded browser navigation permits HTTP(S) and rejects privileged schemes', () => {
  assert.equal(normalizeBrowserUrl('https://example.com/path'), 'https://example.com/path');
  assert.throws(() => normalizeBrowserUrl('file:///C:/Windows/System32/drivers/etc/hosts'), /Only HTTP and HTTPS/);
  assert.throws(() => normalizeBrowserUrl('javascript:alert(1)'), /Only HTTP and HTTPS/);
});

test('secure token IPC validates account keys and token size', () => {
  assert.deepEqual(normalizeTokenStorePayload({ clientType: 'output12', deviceId: 'device_123456' }), {
    clientType: 'output12',
    deviceId: 'device_123456',
  });
  assert.equal(normalizeTokenStorePayload({
    clientType: 'desktop',
    deviceId: 'device_123456',
    token: 'x'.repeat(32),
    expiresAt: 1234,
  }, { requireToken: true }).token.length, 32);
  assert.equal(normalizeTokenStorePayload({
    clientType: 'output-discovery',
    deviceId: 'device_123456',
  }).clientType, 'output-discovery');
  assert.throws(() => normalizeTokenStorePayload({ clientType: '../desktop', deviceId: 'device_123456' }), /client type/);
  assert.throws(() => normalizeTokenStorePayload({
    clientType: 'desktop',
    deviceId: 'device_123456',
    token: 'short',
  }, { requireToken: true }), /token value/);
});
