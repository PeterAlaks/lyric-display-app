import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTimedAbortController,
  getCircuitState,
  getProviderSearchTimeout,
  normalizeSearchMode,
  recordProviderHealth,
} from '../main/lyricsProviders/providerReliability.js';

test('provider reliability opens circuit after repeated failures and resets after success', () => {
  const now = 1_000_000;
  let health = null;

  health = recordProviderHealth(health, { errors: ['timeout'], now });
  assert.equal(getCircuitState(health, now).open, false);

  health = recordProviderHealth(health, { errors: ['502'], now: now + 1 });
  assert.equal(getCircuitState(health, now + 1).open, false);

  health = recordProviderHealth(health, { errors: ['timeout'], now: now + 2 });
  const circuit = getCircuitState(health, now + 2);
  assert.equal(circuit.open, true);
  assert.ok(circuit.openUntil > now + 2);

  health = recordProviderHealth(health, { duration: 250, errors: [], now: now + 3 });
  assert.equal(health.consecutiveFailures, 0);
  assert.equal(getCircuitState(health, now + 3).open, false);
});

test('provider reliability chooses mode and timeout budgets', () => {
  assert.equal(normalizeSearchMode({ limit: 10 }), 'suggestions');
  assert.equal(normalizeSearchMode({ limit: 25 }), 'full');
  assert.equal(normalizeSearchMode({ mode: 'full', limit: 10 }), 'full');
  assert.equal(getProviderSearchTimeout('chartlyrics', 'suggestions'), 1500);
  assert.equal(getProviderSearchTimeout('lrclib', 'suggestions'), 12000);
  assert.equal(getProviderSearchTimeout('lrclib', 'full'), 15000);
});

test('timed abort controller aborts with timeout reason', async () => {
  const timed = createTimedAbortController(null, 5);
  await new Promise((resolve) => setTimeout(resolve, 15));

  assert.equal(timed.signal.aborted, true);
  assert.equal(timed.signal.reason.name, 'TimeoutError');
  timed.cancel();
});

test('timed abort controller follows parent cancellation', () => {
  const parent = new AbortController();
  const timed = createTimedAbortController(parent.signal, 1000);
  const reason = Object.assign(new Error('cancelled by caller'), { name: 'AbortError' });

  parent.abort(reason);

  assert.equal(timed.signal.aborted, true);
  assert.equal(timed.signal.reason, reason);
  timed.cancel();
});
