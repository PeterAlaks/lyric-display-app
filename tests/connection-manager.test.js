import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATTEMPT_LIMIT_COOLDOWN_MS,
  ConnectionManager,
} from '../src/utils/connectionManager.js';

test('connection attempts continue in bounded cycles after the configured attempt limit', () => {
  const manager = new ConnectionManager();
  const clientId = 'output-recovery-test';
  const state = manager.getConnectionState(clientId);
  state.maxAttempts = 2;

  const originalNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;

  try {
    manager.startConnectionAttempt(clientId);
    manager.recordConnectionFailure(clientId, new Error('offline'));
    manager.startConnectionAttempt(clientId);
    manager.recordConnectionFailure(clientId, new Error('offline'));

    const limited = manager.canAttemptConnection(clientId);
    assert.equal(limited.allowed, false);
    assert.equal(limited.reason, 'attempt_limit_backoff');
    assert.equal(limited.remainingMs, ATTEMPT_LIMIT_COOLDOWN_MS);

    now += ATTEMPT_LIMIT_COOLDOWN_MS;
    manager.globalBackoffState.backoffUntil = null;
    const nextCycle = manager.canAttemptConnection(clientId);
    assert.equal(nextCycle.allowed, true);
    assert.equal(state.attemptCount, 0);
    assert.equal(state.attemptLimitReachedAt, null);
  } finally {
    Date.now = originalNow;
  }
});
