import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultOutputSettings,
  createOutputSlice,
  partializeOutputState,
  rehydrateOutputState,
} from '../src/context/lyricsStore/outputSlice.js';
import { registerSetlistHandlers } from '../server/realtime/handlers/setlistHandlers.js';
import { state } from '../server/realtime/state.js';

function createSocketHarness() {
  const handlers = new Map();
  const socketEvents = [];
  const ioEvents = [];

  const socket = {
    id: 'socket-test',
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
    emit(eventName, payload) {
      socketEvents.push({ eventName, payload });
    },
  };

  const io = {
    emit(eventName, payload) {
      ioEvents.push({ eventName, payload });
    },
  };

  return { handlers, io, ioEvents, socket, socketEvents };
}

function createOutputStore() {
  let currentState;
  const get = () => currentState;
  const set = (update) => {
    const next = typeof update === 'function' ? update(currentState) : update;
    if (!next || next === currentState) return;
    currentState = { ...currentState, ...next };
  };

  currentState = createOutputSlice(set, get, (settings) => settings);
  return {
    getState: () => currentState,
  };
}

test('setlistLoad emits parsed LRC lyrics, timestamps, sections, and sanitized raw content', () => {
  const previousSetlist = state.setlistFiles;
  const previousLyrics = state.currentLyrics;
  const previousTimestamps = state.currentLyricsTimestamps;
  const previousFileName = state.currentLyricsFileName;
  const previousSections = state.currentLyricsSections;
  const previousLineToSection = state.currentLineToSection;

  state.setlistFiles = [{
    id: 'setlist_lrc',
    displayName: 'Service Song',
    originalName: 'Service Song.lrc',
    fileType: 'lrc',
    content: [
      '[00:05.00][Verse 1]',
      '[00:10.00]First line',
      '[00:20.00]Second line',
    ].join('\n'),
    metadata: { source: 'test' },
  }];

  try {
    const { handlers, io, ioEvents, socket } = createSocketHarness();
    registerSetlistHandlers({
      io,
      socket,
      hasPermission: (_socket, permission) => permission === 'lyrics:write',
      clientType: 'desktop',
      deviceId: 'device-test',
      sessionId: 'session-test',
    });

    handlers.get('setlistLoad')?.('setlist_lrc');

    assert.deepEqual(state.currentLyrics, ['[Verse 1]', 'First line', 'Second line']);
    assert.deepEqual(state.currentLyricsTimestamps, [500, 1000, 2000]);
    assert.equal(state.currentLyricsFileName, 'Service Song');

    assert.deepEqual(ioEvents.map((event) => event.eventName), [
      'lyricsLoad',
      'lyricsTimestampsUpdate',
      'lyricsSectionsUpdate',
      'setlistLoadSuccess',
    ]);

    const success = ioEvents.find((event) => event.eventName === 'setlistLoadSuccess')?.payload;
    assert.equal(success.fileName, 'Service Song');
    assert.equal(success.rawContent, '[Verse 1]\nFirst line\nSecond line');
    assert.equal(success.linesCount, 3);
    assert.equal(success.metadata.source, 'test');
    assert.ok(Array.isArray(success.metadata.sections));
  } finally {
    state.setlistFiles = previousSetlist;
    state.currentLyrics = previousLyrics;
    state.currentLyricsTimestamps = previousTimestamps;
    state.currentLyricsFileName = previousFileName;
    state.currentLyricsSections = previousSections;
    state.currentLineToSection = previousLineToSection;
  }
});

test('setCustomOutputs normalizes ids, initializes new output state, and removes stale output state', () => {
  const store = createOutputStore();
  const stateBeforeRemoval = store.getState();

  stateBeforeRemoval.setCustomOutputs(['output5', 'output3', 'output3', 'output2', 'bad']);
  assert.deepEqual(store.getState().customOutputIds, ['output3', 'output5']);
  assert.deepEqual(store.getState().getAllOutputIds(), ['output1', 'output2', 'output3', 'output5']);
  assert.equal(typeof store.getState().output3Enabled, 'boolean');
  assert.equal(store.getState().output3Settings.fontStyle, createDefaultOutputSettings().fontStyle);

  store.getState().setPreviewCustomOutputId('output5');
  assert.equal(store.getState().previewCustomOutputId, 'output5');

  store.getState().setCustomOutputs(['output3']);
  assert.deepEqual(store.getState().customOutputIds, ['output3']);
  assert.equal(store.getState().previewCustomOutputId, null);
  assert.equal(store.getState().output5Settings, undefined);
  assert.equal(store.getState().output5Enabled, undefined);
});

test('output persistence includes custom outputs and rehydration clears stale runtime fields', () => {
  const persisted = partializeOutputState({
    isOutputOn: true,
    output1Enabled: true,
    output2Enabled: false,
    previewCustomOutputId: 'output3',
    output1Settings: createDefaultOutputSettings({ fontSize: 50 }),
    output2Settings: createDefaultOutputSettings({ fontSize: 60 }),
    customOutputIds: ['output3'],
    output3Enabled: true,
    output3Settings: createDefaultOutputSettings({
      autosizerActive: true,
      primaryViewportWidth: 1920,
      primaryViewportHeight: 1080,
      allInstances: [{ id: 'preview' }],
      instanceCount: 1,
    }),
  });

  assert.equal(persisted.output3Enabled, true);
  assert.equal(persisted.output3Settings.primaryViewportWidth, 1920);

  rehydrateOutputState(persisted);
  assert.equal(persisted.previewCustomOutputId, 'output3');
  assert.equal(persisted.output3Settings.autosizerActive, false);
  assert.equal(persisted.output3Settings.primaryViewportWidth, null);
  assert.equal(persisted.output3Settings.primaryViewportHeight, null);
  assert.equal(persisted.output3Settings.allInstances, null);
  assert.equal(persisted.output3Settings.instanceCount, 0);

  persisted.customOutputIds = [];
  rehydrateOutputState(persisted);
  assert.equal(persisted.previewCustomOutputId, null);
});
