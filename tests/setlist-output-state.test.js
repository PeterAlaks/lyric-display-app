import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultOutputSettings,
  createOutputSlice,
  partializeOutputState,
  rehydrateOutputState,
} from '../src/context/lyricsStore/outputSlice.js';
import { registerConnectionHandlers } from '../server/realtime/handlers/connectionHandlers.js';
import { registerOutputHandlers } from '../server/realtime/handlers/outputHandlers.js';
import { registerSetlistHandlers } from '../server/realtime/handlers/setlistHandlers.js';
import { buildCurrentState, state } from '../server/realtime/state.js';

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
  const previousRawLyricsContent = state.currentRawLyricsContent;
  const previousLyricsSource = state.currentLyricsSource;
  const previousSongMetadata = state.currentSongMetadata;
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
    assert.equal(state.currentRawLyricsContent, '[Verse 1]\nFirst line\nSecond line');
    assert.deepEqual(state.currentLyricsSource, {
      content: state.setlistFiles[0].content,
      fileType: 'lrc',
      filePath: null,
      fileName: 'Service Song.lrc',
    });
    assert.equal(state.currentSongMetadata.title, 'Service Song');
    assert.equal(state.currentSongMetadata.source, 'test');

    assert.deepEqual(ioEvents
      .map((event) => event.eventName)
      .filter((eventName) => eventName !== 'actionLogUpdate'), [
      'lyricsLoad',
      'lyricsTimestampsUpdate',
      'lyricsSectionsUpdate',
      'setlistLoadSuccess',
    ]);

    const success = ioEvents.find((event) => event.eventName === 'setlistLoadSuccess')?.payload;
    const load = ioEvents.find((event) => event.eventName === 'lyricsLoad')?.payload;
    assert.equal(load.fileName, 'Service Song');
    assert.equal(load.rawLyricsContent, '[Verse 1]\nFirst line\nSecond line');
    assert.deepEqual(load.lyricsTimestamps, [500, 1000, 2000]);
    assert.equal(load.lyricsSource.fileName, 'Service Song.lrc');
    assert.equal(load.songMetadata.title, 'Service Song');
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
    state.currentRawLyricsContent = previousRawLyricsContent;
    state.currentLyricsSource = previousLyricsSource;
    state.currentSongMetadata = previousSongMetadata;
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

test('last output disconnect broadcasts zero active instances', () => {
  const previousConnectedClients = state.connectedClients;
  const previousOutputInstances = state.outputInstances;
  const previousRegisteredOutputs = state.registeredOutputs;
  const previousOutputSettings = state.outputSettings;
  const previousOutputEnabled = state.outputEnabled;

  state.connectedClients = new Map();
  state.outputInstances = new Map([
    ['output1', new Map([
      ['socket-output', {
        socketId: 'socket-output',
        viewportWidth: 1280,
        viewportHeight: 720,
        autosizerActive: false,
        lastUpdate: Date.now(),
      }],
    ])],
  ]);
  state.registeredOutputs = new Set(['output1', 'output2']);
  state.outputSettings = new Map([['output1', {}]]);
  state.outputEnabled = new Map([['output1', true]]);

  try {
    const handlers = new Map();
    const ioEvents = [];
    const socketEvents = [];
    const socket = {
      id: 'socket-output',
      connected: true,
      userData: {
        permissions: ['lyrics:read'],
        connectedAt: Date.now(),
      },
      broadcast: {
        emit(eventName, payload) {
          socketEvents.push({ eventName, payload });
        },
      },
      on(eventName, handler) {
        if (!handlers.has(eventName)) handlers.set(eventName, []);
        handlers.get(eventName).push(handler);
      },
      emit(eventName, payload) {
        socketEvents.push({ eventName, payload });
      },
      disconnect() {},
    };
    const io = {
      emit(eventName, payload) {
        ioEvents.push({ eventName, payload });
      },
    };

    const connected = registerConnectionHandlers({
      io,
      socket,
      clientType: 'output1',
      deviceId: 'output-device',
      sessionId: 'output-session',
    });

    assert.equal(connected, true);
    handlers.get('disconnect')?.forEach((handler) => handler('transport close'));

    const metricsEvent = ioEvents.find((event) => (
      event.eventName === 'outputMetrics' &&
      event.payload?.output === 'output1' &&
      event.payload?.instanceCount === 0
    ));
    assert.deepEqual(metricsEvent, {
      eventName: 'outputMetrics',
      payload: {
        output: 'output1',
        metrics: {},
        allInstances: [],
        instanceCount: 0,
      },
    });
    assert.equal(state.outputInstances.has('output1'), false);
  } finally {
    state.connectedClients = previousConnectedClients;
    state.outputInstances = previousOutputInstances;
    state.registeredOutputs = previousRegisteredOutputs;
    state.outputSettings = previousOutputSettings;
    state.outputEnabled = previousOutputEnabled;
  }
});

test('output connection immediately broadcasts an active instance', () => {
  const previousConnectedClients = state.connectedClients;
  const previousOutputInstances = state.outputInstances;
  const previousRegisteredOutputs = state.registeredOutputs;
  const previousOutputSettings = state.outputSettings;
  const previousOutputEnabled = state.outputEnabled;

  state.connectedClients = new Map();
  state.outputInstances = new Map([['output1', new Map()]]);
  state.registeredOutputs = new Set(['output1', 'output2']);
  state.outputSettings = new Map([['output1', {}]]);
  state.outputEnabled = new Map([['output1', true]]);

  try {
    const handlers = new Map();
    const ioEvents = [];
    const socketEvents = [];
    const socket = {
      id: 'socket-output',
      connected: true,
      userData: {
        permissions: ['lyrics:read'],
        connectedAt: Date.now(),
      },
      broadcast: {
        emit(eventName, payload) {
          socketEvents.push({ eventName, payload });
        },
      },
      on(eventName, handler) {
        if (!handlers.has(eventName)) handlers.set(eventName, []);
        handlers.get(eventName).push(handler);
      },
      emit(eventName, payload) {
        socketEvents.push({ eventName, payload });
      },
      disconnect() {},
    };
    const io = {
      emit(eventName, payload) {
        ioEvents.push({ eventName, payload });
      },
    };

    const connected = registerConnectionHandlers({
      io,
      socket,
      clientType: 'output1',
      deviceId: 'output-device',
      sessionId: 'output-session',
    });

    assert.equal(connected, true);
    const metricsEvent = ioEvents.find((event) => event.eventName === 'outputMetrics');
    assert.equal(metricsEvent.payload.output, 'output1');
    assert.equal(metricsEvent.payload.instanceCount, 1);
    assert.equal(metricsEvent.payload.allInstances.length, 1);
    assert.equal(metricsEvent.payload.allInstances[0].socketId, 'socket-output');

    handlers.get('disconnect')?.forEach((handler) => handler('test cleanup'));
  } finally {
    state.connectedClients = previousConnectedClients;
    state.outputInstances = previousOutputInstances;
    state.registeredOutputs = previousRegisteredOutputs;
    state.outputSettings = previousOutputSettings;
    state.outputEnabled = previousOutputEnabled;
  }
});

test('preview output connection does not broadcast production readiness presence', () => {
  const previousConnectedClients = state.connectedClients;
  const previousOutputInstances = state.outputInstances;
  const previousRegisteredOutputs = state.registeredOutputs;
  const previousOutputSettings = state.outputSettings;
  const previousOutputEnabled = state.outputEnabled;

  state.connectedClients = new Map();
  state.outputInstances = new Map([['output1', new Map()]]);
  state.registeredOutputs = new Set(['output1', 'output2']);
  state.outputSettings = new Map([['output1', {}]]);
  state.outputEnabled = new Map([['output1', true]]);

  try {
    const handlers = new Map();
    const ioEvents = [];
    const socketEvents = [];
    const socket = {
      id: 'socket-preview-output',
      connected: true,
      userData: {
        permissions: ['lyrics:read'],
        connectedAt: Date.now(),
      },
      broadcast: {
        emit(eventName, payload) {
          socketEvents.push({ eventName, payload });
        },
      },
      on(eventName, handler) {
        if (!handlers.has(eventName)) handlers.set(eventName, []);
        handlers.get(eventName).push(handler);
      },
      emit(eventName, payload) {
        socketEvents.push({ eventName, payload });
      },
      disconnect() {},
    };
    const io = {
      emit(eventName, payload) {
        ioEvents.push({ eventName, payload });
      },
    };

    const connected = registerConnectionHandlers({
      io,
      socket,
      clientType: 'output1',
      deviceId: 'preview-device',
      sessionId: 'preview-session',
      isPreview: true,
    });

    assert.equal(connected, true);
    assert.equal(ioEvents.some((event) => event.eventName === 'outputMetrics'), false);
    assert.equal(state.outputInstances.get('output1').size, 0);

    handlers.get('disconnect')?.forEach((handler) => handler('test cleanup'));
    assert.equal(ioEvents.some((event) => event.eventName === 'outputMetrics'), false);
  } finally {
    state.connectedClients = previousConnectedClients;
    state.outputInstances = previousOutputInstances;
    state.registeredOutputs = previousRegisteredOutputs;
    state.outputSettings = previousOutputSettings;
    state.outputEnabled = previousOutputEnabled;
  }
});

test('generic stage clientConnect does not downgrade authenticated time-display purpose', () => {
  const previousConnectedClients = state.connectedClients;
  const previousRawLyricsContent = state.currentRawLyricsContent;
  const previousSetlistFiles = state.setlistFiles;
  const previousStageTimerState = state.currentStageTimerState;

  state.connectedClients = new Map();
  state.currentRawLyricsContent = 'raw lyrics should not be sent to time display';
  state.setlistFiles = [{ id: 'song-1', displayName: 'Song One' }];
  state.currentStageTimerState = { running: true, remaining: '29:59' };

  try {
    const handlers = new Map();
    const socketEvents = [];
    const socket = {
      id: 'socket-time-display',
      connected: true,
      userData: {
        permissions: ['lyrics:read'],
        connectedAt: Date.now(),
      },
      broadcast: {
        emit() {},
      },
      on(eventName, handler) {
        if (!handlers.has(eventName)) handlers.set(eventName, []);
        handlers.get(eventName).push(handler);
      },
      emit(eventName, payload) {
        socketEvents.push({ eventName, payload });
      },
      disconnect() {},
    };
    const io = {
      emit() {},
    };

    const connected = registerConnectionHandlers({
      io,
      socket,
      clientType: 'stage',
      deviceId: 'time-display-device',
      sessionId: 'time-display-session',
      clientPurpose: 'time-display',
    });

    assert.equal(connected, true);
    assert.equal(state.connectedClients.get('socket-time-display').purpose, 'time-display');

    handlers.get('clientConnect')?.[0]?.({ type: 'stage', purpose: 'stage' });

    assert.equal(state.connectedClients.get('socket-time-display').purpose, 'time-display');
    const currentStateEvents = socketEvents.filter((event) => event.eventName === 'currentState');
    const latestState = currentStateEvents[currentStateEvents.length - 1].payload;
    assert.deepEqual(latestState.stageTimerState, state.currentStageTimerState);
    assert.equal('rawLyricsContent' in latestState, false);
    assert.equal('setlistFiles' in latestState, false);

    handlers.get('disconnect')?.forEach((handler) => handler('test cleanup'));
  } finally {
    state.connectedClients = previousConnectedClients;
    state.currentRawLyricsContent = previousRawLyricsContent;
    state.setlistFiles = previousSetlistFiles;
    state.currentStageTimerState = previousStageTimerState;
  }
});

test('preview output metrics are ignored by production readiness tracking', () => {
  const previousOutputInstances = state.outputInstances;
  const previousOutputSettings = state.outputSettings;
  const previousOutputEnabled = state.outputEnabled;

  state.outputInstances = new Map([['output1', new Map()]]);
  state.outputSettings = new Map([['output1', {}]]);
  state.outputEnabled = new Map([['output1', true]]);

  try {
    const handlers = new Map();
    const ioEvents = [];
    const socketEvents = [];
    const socket = {
      id: 'socket-preview-output',
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

    registerOutputHandlers({
      io,
      socket,
      hasPermission: () => true,
      clientType: 'output1',
      deviceId: 'preview-device',
      sessionId: 'preview-session',
      isPreview: true,
    });

    handlers.get('outputMetrics')?.({
      output: 'output1',
      metrics: {
        autosizerActive: false,
        viewportWidth: 800,
        viewportHeight: 450,
      },
    });

    assert.equal(ioEvents.length, 0);
    assert.equal(socketEvents.length, 0);
    assert.equal(state.outputInstances.get('output1').size, 0);
  } finally {
    state.outputInstances = previousOutputInstances;
    state.outputSettings = previousOutputSettings;
    state.outputEnabled = previousOutputEnabled;
  }
});

test('current state is trimmed for timer, time display, and output clients', () => {
  const previousLyrics = state.currentLyrics;
  const previousTimestamps = state.currentLyricsTimestamps;
  const previousFileName = state.currentLyricsFileName;
  const previousRawLyricsContent = state.currentRawLyricsContent;
  const previousLyricsSource = state.currentLyricsSource;
  const previousSongMetadata = state.currentSongMetadata;
  const previousSections = state.currentLyricsSections;
  const previousLineToSection = state.currentLineToSection;
  const previousOutputSettings = state.outputSettings;
  const previousOutputEnabled = state.outputEnabled;
  const previousIsOutputOn = state.currentIsOutputOn;
  const previousStageSettings = state.currentStageSettings;
  const previousStageEnabled = state.currentStageEnabled;
  const previousSetlist = state.setlistFiles;
  const previousStageTimerState = state.currentStageTimerState;
  const previousStageMessages = state.currentStageMessages;

  state.currentLyrics = ['Line one', 'Line two'];
  state.currentLyricsTimestamps = [1000, 2000];
  state.currentLyricsFileName = 'Service Song';
  state.currentRawLyricsContent = 'raw source that should stay off passive display clients';
  state.currentLyricsSource = { content: state.currentRawLyricsContent, fileType: 'txt', fileName: 'Service Song.txt' };
  state.currentSongMetadata = { title: 'Service Song', artists: ['Artist'] };
  state.currentLyricsSections = [{ id: 'verse-1', label: 'Verse 1', startIndex: 0 }];
  state.currentLineToSection = { 0: 'verse-1' };
  state.outputSettings = new Map([
    ['output1', { fontSize: 72 }],
    ['output2', { fontSize: 96 }],
  ]);
  state.outputEnabled = new Map([
    ['output1', true],
    ['output2', false],
  ]);
  state.currentIsOutputOn = true;
  state.currentStageSettings = { showTime: true };
  state.currentStageEnabled = true;
  state.setlistFiles = [{ id: 'next-song', displayName: 'Next Song' }];
  state.currentStageTimerState = { running: true, remaining: '1:00', display: { label: 'Time Left' } };
  state.currentStageMessages = [{ text: 'Welcome' }];

  try {
    const timerState = buildCurrentState({ type: 'desktop', purpose: 'timer-control', permissions: ['admin:full'] });
    assert.equal(timerState.stageTimerState.remaining, '1:00');
    assert.equal(Object.hasOwn(timerState, 'lyrics'), false);
    assert.equal(Object.hasOwn(timerState, 'rawLyricsContent'), false);
    assert.equal(Object.hasOwn(timerState, 'output1Settings'), false);

    const timeDisplayState = buildCurrentState({ type: 'stage', purpose: 'time-display', permissions: ['lyrics:read'] });
    assert.equal(timeDisplayState.stageTimerState.remaining, '1:00');
    assert.equal(Object.hasOwn(timeDisplayState, 'lyrics'), false);
    assert.equal(Object.hasOwn(timeDisplayState, 'stageMessages'), false);

    const outputState = buildCurrentState({ type: 'output1', purpose: 'output1', permissions: ['lyrics:read'] });
    assert.deepEqual(outputState.lyrics, ['Line one', 'Line two']);
    assert.deepEqual(outputState.output1Settings, { fontSize: 72 });
    assert.equal(outputState.output1Enabled, true);
    assert.equal(outputState.isOutputOn, true);
    assert.equal(Object.hasOwn(outputState, 'output2Settings'), false);
    assert.equal(Object.hasOwn(outputState, 'rawLyricsContent'), false);
    assert.equal(Object.hasOwn(outputState, 'lyricsSource'), false);
    assert.equal(Object.hasOwn(outputState, 'songMetadata'), false);
    assert.equal(Object.hasOwn(outputState, 'setlistFiles'), false);

    const stageState = buildCurrentState({ type: 'stage', purpose: 'stage-display', permissions: ['lyrics:read'] });
    assert.deepEqual(stageState.lyrics, ['Line one', 'Line two']);
    assert.deepEqual(stageState.setlistFiles, [{ id: 'next-song', displayName: 'Next Song' }]);
    assert.deepEqual(stageState.stageMessages, [{ text: 'Welcome' }]);
    assert.equal(Object.hasOwn(stageState, 'rawLyricsContent'), false);
    assert.equal(Object.hasOwn(stageState, 'lyricsSource'), false);
  } finally {
    state.currentLyrics = previousLyrics;
    state.currentLyricsTimestamps = previousTimestamps;
    state.currentLyricsFileName = previousFileName;
    state.currentRawLyricsContent = previousRawLyricsContent;
    state.currentLyricsSource = previousLyricsSource;
    state.currentSongMetadata = previousSongMetadata;
    state.currentLyricsSections = previousSections;
    state.currentLineToSection = previousLineToSection;
    state.outputSettings = previousOutputSettings;
    state.outputEnabled = previousOutputEnabled;
    state.currentIsOutputOn = previousIsOutputOn;
    state.currentStageSettings = previousStageSettings;
    state.currentStageEnabled = previousStageEnabled;
    state.setlistFiles = previousSetlist;
    state.currentStageTimerState = previousStageTimerState;
    state.currentStageMessages = previousStageMessages;
  }
});
