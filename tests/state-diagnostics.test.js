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
import {
  applyRendererStorageMutation,
  reconcileRendererStorageSnapshot,
} from '../shared/rendererPersistentStorage.js';

const lyricsStoreValue = (overrides = {}) => JSON.stringify({
  state: {
    hasSeenWelcome: true,
    timerControlSettings: { scheduleTitle: 'Sunday Service' },
    output1Settings: { fontSize: 72 },
    ...overrides,
  },
  version: 0,
});

test('Electron renderer state follows the app across production port origins', () => {
  const sourceEntries = [
    ['lyrics-store', lyricsStoreValue()],
    ['lyricdisplay_activeOutputTab', 'output2'],
  ];
  const initial = reconcileRendererStorageSnapshot({
    currentPort: 4000,
    legacyEntries: sourceEntries,
    storedSnapshot: null,
  });

  assert.equal(initial.success, true);
  assert.equal(initial.snapshot.lastPort, 4000);

  const targetOriginDefaults = [
    ['lyrics-store', lyricsStoreValue({
      hasSeenWelcome: false,
      timerControlSettings: { scheduleTitle: 'Timer Schedule' },
      output1Settings: { fontSize: 48 },
    })],
  ];
  const moved = reconcileRendererStorageSnapshot({
    currentPort: 7040,
    legacyEntries: targetOriginDefaults,
    storedSnapshot: initial.snapshot,
  });

  assert.equal(moved.success, true);
  assert.deepEqual(moved.snapshot.entries, sourceEntries);
  assert.equal(moved.snapshot.lastPort, 7040);
});

test('same-port browser storage can refresh the native snapshot without an empty origin erasing it', () => {
  const storedSnapshot = {
    version: 1,
    lastPort: 7040,
    entries: [['lyrics-store', lyricsStoreValue()]],
  };
  const newerEntries = [['lyrics-store', lyricsStoreValue({ selectedLine: 7 })]];

  const refreshed = reconcileRendererStorageSnapshot({
    currentPort: 7040,
    legacyEntries: newerEntries,
    storedSnapshot,
  });
  assert.deepEqual(refreshed.snapshot.entries, newerEntries);

  const recovered = reconcileRendererStorageSnapshot({
    currentPort: 7040,
    legacyEntries: [],
    storedSnapshot: refreshed.snapshot,
  });
  assert.deepEqual(recovered.snapshot.entries, newerEntries);
});

test('native renderer storage mutations are bounded and cannot corrupt the last valid snapshot', () => {
  const snapshot = {
    version: 1,
    lastPort: 4000,
    entries: [['lyrics-store', lyricsStoreValue()]],
  };
  const updated = applyRendererStorageMutation(snapshot, {
    type: 'set',
    key: 'lyricdisplay_activeOutputTab',
    value: 'stage',
  });
  assert.equal(updated.success, true);
  assert.deepEqual(updated.snapshot.entries.at(-1), ['lyricdisplay_activeOutputTab', 'stage']);

  const rejected = applyRendererStorageMutation(updated.snapshot, {
    type: 'set',
    key: '',
    value: 'invalid',
  });
  assert.equal(rejected.success, false);
  assert.equal(rejected.snapshot, null);
  assert.deepEqual(updated.snapshot.entries.at(-1), ['lyricdisplay_activeOutputTab', 'stage']);
});

test('Electron state persistence is wired through the native bridge instead of an origin-only store', () => {
  const mainStorageSource = fs.readFileSync(
    new URL('../main/rendererPersistentStorage.js', import.meta.url),
    'utf8',
  );
  const preloadSource = fs.readFileSync(new URL('../preload.js', import.meta.url), 'utf8');
  const lyricsStoreSource = fs.readFileSync(new URL('../src/context/LyricsStore.js', import.meta.url), 'utf8');
  const rendererStorageSource = fs.readFileSync(
    new URL('../src/utils/persistentStorage.js', import.meta.url),
    'utf8',
  );
  const preferencesIpcSource = fs.readFileSync(
    new URL('../main/ipc/preferences.js', import.meta.url),
    'utf8',
  );

  assert.match(mainStorageSource, /renderer-storage:initialize/);
  assert.match(mainStorageSource, /reconcileRendererStorageSnapshot/);
  assert.match(preloadSource, /persistentStorage:/);
  assert.match(preloadSource, /renderer-storage:initialize/);
  assert.match(lyricsStoreSource, /createJSONStorage/);
  assert.match(lyricsStoreSource, /getPersistentStorage/);
  assert.match(rendererStorageSource, /window\.electronAPI\?\.persistentStorage/);
  assert.match(preferencesIpcSource, /prepareRendererPersistentStorageForPortChange/);
});

test('socket event hook subscribes only to stable store actions', () => {
  const source = fs.readFileSync(new URL('../src/hooks/useSocketEvents.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /useLyricsStore\(\s*\)/);
  assert.match(source, /useLyricsStore\(\(state\) => state\.setLyrics\)/);
  assert.match(source, /useLyricsStore\(\(state\) => state\.updateOutputSettings\)/);
});

test('socket filename updates use the authoritative payload without the removed stale-state guard', () => {
  const source = fs.readFileSync(new URL('../src/hooks/useSocketEvents.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /shouldIgnoreEmptyRemoteFileName/);
  assert.match(source, /if \(!isLyricsFileNamePayload\(fileName\)\)/);
  assert.match(source, /setLyricsFileName\(fileName\)/);
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
