import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OSC_ALL_INTERFACES_ADDRESS,
  OSC_LOOPBACK_ADDRESS,
  OscMessageGuard,
  isOscSourceAllowed,
  normalizeOscAllowedSources,
} from '../main/oscSecurity.js';

test('OSC loopback binding rejects non-loopback sources', () => {
  assert.equal(isOscSourceAllowed('127.0.0.1', { bindAddress: OSC_LOOPBACK_ADDRESS }), true);
  assert.equal(isOscSourceAllowed('127.12.3.4', { bindAddress: OSC_LOOPBACK_ADDRESS }), true);
  assert.equal(isOscSourceAllowed('192.168.1.20', { bindAddress: OSC_LOOPBACK_ADDRESS }), false);
});

test('OSC LAN binding supports an optional normalized IPv4 allowlist', () => {
  assert.deepEqual(normalizeOscAllowedSources('192.168.1.20, bad, 192.168.1.20,10.0.0.2'), [
    '192.168.1.20',
    '10.0.0.2',
  ]);
  assert.equal(isOscSourceAllowed('192.168.1.20', { bindAddress: OSC_ALL_INTERFACES_ADDRESS }), true);
  assert.equal(isOscSourceAllowed('192.168.1.20', {
    bindAddress: OSC_ALL_INTERFACES_ADDRESS,
    allowedSources: ['10.0.0.2'],
  }), false);
});

test('OSC guard drops duplicate packets inside the configured window', () => {
  const guard = new OscMessageGuard({ rateLimit: 30, duplicateWindowMs: 75 });
  const message = { sourceAddress: '127.0.0.1', address: '/lyricdisplay/line/next', args: [], now: 1000 };
  assert.equal(guard.evaluate(message).allowed, true);
  assert.deepEqual(guard.evaluate({ ...message, now: 1050 }), { allowed: false, reason: 'duplicate' });
  assert.equal(guard.evaluate({ ...message, now: 1125 }).allowed, true);
});

test('OSC guard applies rate limits independently per source', () => {
  const guard = new OscMessageGuard({ rateLimit: 5, duplicateWindowMs: 0 });
  for (let index = 0; index < 5; index += 1) {
    assert.equal(guard.evaluate({ sourceAddress: '10.0.0.1', address: `/test/${index}`, now: 1000 }).allowed, true);
  }
  assert.deepEqual(
    guard.evaluate({ sourceAddress: '10.0.0.1', address: '/test/overflow', now: 1000 }),
    { allowed: false, reason: 'rate_limit' }
  );
  assert.equal(guard.evaluate({ sourceAddress: '10.0.0.2', address: '/test/other', now: 1000 }).allowed, true);
  assert.equal(guard.evaluate({ sourceAddress: '10.0.0.1', address: '/test/new-window', now: 2000 }).allowed, true);
});
