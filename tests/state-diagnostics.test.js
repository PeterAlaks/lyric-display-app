import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  LARGE_STATE_PAYLOAD_BYTES,
  PERIODIC_STATE_DIAGNOSTIC_SAMPLE_INTERVAL,
  describeStatePayload,
  isStatePayloadNoteworthy,
  shouldSamplePeriodicState,
} from '../server/realtime/stateDiagnostics.js';

test('socket event hook subscribes only to stable store actions', () => {
  const source = fs.readFileSync(new URL('../src/hooks/useSocketEvents.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /useLyricsStore\(\s*\)/);
  assert.match(source, /useLyricsStore\(\(state\) => state\.setLyrics\)/);
  assert.match(source, /useLyricsStore\(\(state\) => state\.updateOutputSettings\)/);
});

test('state diagnostics report controller snapshot size and composition', () => {
  const metrics = describeStatePayload(
    { type: 'desktop', purpose: 'control' },
    {
      lyrics: ['one', 'two'],
      setlistFiles: [{ id: '1' }],
      rawLyricsContent: 'one\ntwo',
      selectedLine: 0,
    },
    { buildMs: 1.25 }
  );

  assert.equal(metrics.clientType, 'desktop');
  assert.equal(metrics.purpose, 'control');
  assert.equal(metrics.lyrics, 2);
  assert.equal(metrics.setlistItems, 1);
  assert.equal(metrics.hasRawLyricsContent, true);
  assert.ok(metrics.approxBytes > 0);
  assert.equal(metrics.buildMs, 1.25);
  assert.equal(metrics.serializationError, null);
});

test('periodic diagnostics sample the first snapshot, bounded intervals, and slow builds', () => {
  assert.equal(shouldSamplePeriodicState(1, 0), true);
  assert.equal(shouldSamplePeriodicState(2, 0), false);
  assert.equal(shouldSamplePeriodicState(PERIODIC_STATE_DIAGNOSTIC_SAMPLE_INTERVAL, 0), true);
  assert.equal(shouldSamplePeriodicState(2, 20), true);
});

test('large or unserializable state snapshots are noteworthy without throwing', () => {
  const largeMetrics = describeStatePayload(
    { type: 'desktop' },
    { rawLyricsContent: 'x'.repeat(LARGE_STATE_PAYLOAD_BYTES) }
  );
  assert.equal(isStatePayloadNoteworthy(largeMetrics), true);

  const cyclic = {};
  cyclic.self = cyclic;
  const cyclicMetrics = describeStatePayload({ type: 'desktop' }, cyclic);
  assert.equal(cyclicMetrics.approxBytes, -1);
  assert.match(cyclicMetrics.serializationError, /circular|cyclic/i);
  assert.equal(isStatePayloadNoteworthy(cyclicMetrics), true);
});
