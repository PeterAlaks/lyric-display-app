import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultOutputSettings,
  createOutputSlice,
  partializeOutputState,
  rehydrateOutputState,
} from '../src/context/lyricsStore/outputSlice.js';
import { registerConnectionHandlers } from '../server/realtime/handlers/connectionHandlers.js';
import { registerLyricsHandlers } from '../server/realtime/handlers/lyricsHandlers.js';
import { registerOutputHandlers } from '../server/realtime/handlers/outputHandlers.js';
import { registerSetlistHandlers } from '../server/realtime/handlers/setlistHandlers.js';
import { sanitizePersistedStageTimerState } from '../server/realtime/sessionPersistence.js';
import { buildCurrentState, buildPeriodicState, state } from '../server/realtime/state.js';

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

function createTrackedClient(socketId, { type, purpose = type, permissions = ['lyrics:read'] }) {
  const events = [];
  const socket = {
    id: socketId,
    connected: true,
    emit(eventName, payload) {
      events.push({ eventName, payload });
    },
  };

  state.connectedClients.set(socketId, {
    type,
    purpose,
    socket,
    permissions,
    deviceId: `${socketId}-device`,
    sessionId: `${socketId}-session`,
    connectedAt: Date.now(),
  });

  return { socket, events };
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

test('setlistLoad emits parsed LRC lyrics, timestamps, sections, and editable raw content', () => {
  const previousConnectedClients = state.connectedClients;
  const previousSetlist = state.setlistFiles;
  const previousLyrics = state.currentLyrics;
  const previousTimestamps = state.currentLyricsTimestamps;
  const previousEnhancedTimestamps = state.currentLyricsEnhancedTimestamps;
  const previousFileName = state.currentLyricsFileName;
  const previousRawLyricsContent = state.currentRawLyricsContent;
  const previousLyricsSource = state.currentLyricsSource;
  const previousSongMetadata = state.currentSongMetadata;
  const previousSections = state.currentLyricsSections;
  const previousLineToSection = state.currentLineToSection;

  state.connectedClients = new Map();
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
    assert.deepEqual(state.currentLyricsEnhancedTimestamps, [[], [], []]);
    assert.equal(state.currentLyricsFileName, 'Service Song');
    assert.equal(state.currentRawLyricsContent, state.setlistFiles[0].content);
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
    assert.equal(load.rawLyricsContent, state.setlistFiles[0].content);
    assert.deepEqual(load.lyricsTimestamps, [500, 1000, 2000]);
    assert.deepEqual(load.lyricsEnhancedTimestamps, [[], [], []]);
    assert.equal(load.lyricsSource.fileName, 'Service Song.lrc');
    assert.equal(load.songMetadata.title, 'Service Song');
    assert.equal(success.fileName, 'Service Song');
    assert.equal(success.rawContent, state.setlistFiles[0].content);
    assert.equal(success.linesCount, 3);
    assert.equal(success.metadata.source, 'test');
    assert.ok(Array.isArray(success.metadata.sections));
  } finally {
    state.connectedClients = previousConnectedClients;
    state.setlistFiles = previousSetlist;
    state.currentLyrics = previousLyrics;
    state.currentLyricsTimestamps = previousTimestamps;
    state.currentLyricsEnhancedTimestamps = previousEnhancedTimestamps;
    state.currentLyricsFileName = previousFileName;
    state.currentRawLyricsContent = previousRawLyricsContent;
    state.currentLyricsSource = previousLyricsSource;
    state.currentSongMetadata = previousSongMetadata;
    state.currentLyricsSections = previousSections;
    state.currentLineToSection = previousLineToSection;
  }
});

test('lyricsLoad fanout sends render-only payloads to displays and skips timer clients', () => {
  const previousConnectedClients = state.connectedClients;
  const previousLyrics = state.currentLyrics;
  const previousTimestamps = state.currentLyricsTimestamps;
  const previousFileName = state.currentLyricsFileName;
  const previousRawLyricsContent = state.currentRawLyricsContent;
  const previousLyricsSource = state.currentLyricsSource;
  const previousSongMetadata = state.currentSongMetadata;
  const previousSections = state.currentLyricsSections;
  const previousLineToSection = state.currentLineToSection;

  state.connectedClients = new Map();
  const desktop = createTrackedClient('socket-desktop', { type: 'desktop', purpose: 'control', permissions: ['admin:full'] });
  const output = createTrackedClient('socket-output', { type: 'output1', purpose: 'output1' });
  const stage = createTrackedClient('socket-stage', { type: 'stage', purpose: 'stage-display' });
  const timerControl = createTrackedClient('socket-timer', { type: 'desktop', purpose: 'timer-control' });
  const timeDisplay = createTrackedClient('socket-time', { type: 'stage', purpose: 'time-display' });

  try {
    const { handlers, io, ioEvents, socket } = createSocketHarness();
    registerLyricsHandlers({
      io,
      socket,
      hasPermission: (_socket, permission) => permission === 'lyrics:write',
      clientType: 'desktop',
      deviceId: 'device-test',
      sessionId: 'session-test',
    });

    handlers.get('lyricsLoad')?.({
      lyrics: ['First line', 'Second line'],
      fileName: 'Service Song',
      rawLyricsContent: 'Raw source that displays should not receive',
      lyricsSource: { content: 'Raw source that displays should not receive', fileType: 'txt', fileName: 'Service Song.txt' },
      songMetadata: { title: 'Service Song', artists: ['Artist'] },
      lyricsTimestamps: [1000, 2000],
      sections: [{ id: 'verse-1', label: 'Verse 1', startIndex: 0 }],
      lineToSection: { 0: 'verse-1' },
    });

    assert.equal(ioEvents.some((event) => event.eventName === 'lyricsLoad'), false);

    const desktopLoad = desktop.events.find((event) => event.eventName === 'lyricsLoad')?.payload;
    assert.equal(desktopLoad.rawLyricsContent, 'Raw source that displays should not receive');
    assert.equal(desktopLoad.lyricsSource.fileName, 'Service Song.txt');
    assert.equal(desktopLoad.songMetadata.title, 'Service Song');

    const outputLoad = output.events.find((event) => event.eventName === 'lyricsLoad')?.payload;
    assert.deepEqual(outputLoad.lyrics, ['First line', 'Second line']);
    assert.deepEqual(outputLoad, {
      lyrics: ['First line', 'Second line'],
      fileName: 'Service Song',
    });
    assert.equal(Object.hasOwn(outputLoad, 'rawLyricsContent'), false);
    assert.equal(Object.hasOwn(outputLoad, 'lyricsSource'), false);
    assert.equal(Object.hasOwn(outputLoad, 'songMetadata'), false);

    const stageLoad = stage.events.find((event) => event.eventName === 'lyricsLoad')?.payload;
    assert.deepEqual(stageLoad, {
      lyrics: ['First line', 'Second line'],
      fileName: 'Service Song',
    });

    assert.equal(timerControl.events.some((event) => event.eventName === 'lyricsLoad'), false);
    assert.equal(timeDisplay.events.some((event) => event.eventName === 'lyricsLoad'), false);
    assert.equal(timerControl.events.some((event) => event.eventName === 'lyricsSectionsUpdate'), false);
    assert.equal(timeDisplay.events.some((event) => event.eventName === 'lyricsSectionsUpdate'), false);
    assert.equal(output.events.some((event) => event.eventName === 'lyricsTimestampsUpdate'), false);
    assert.equal(output.events.some((event) => event.eventName === 'lyricsSectionsUpdate'), false);
    assert.equal(stage.events.some((event) => event.eventName === 'lyricsTimestampsUpdate'), false);
    assert.equal(stage.events.some((event) => event.eventName === 'lyricsSectionsUpdate'), false);
  } finally {
    state.connectedClients = previousConnectedClients;
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

test('splitNormalGroup preserves aligned line and enhanced timestamps', () => {
  const previousConnectedClients = state.connectedClients;
  const previousLyrics = state.currentLyrics;
  const previousTimestamps = state.currentLyricsTimestamps;
  const previousEnhancedTimestamps = state.currentLyricsEnhancedTimestamps;
  const previousFileName = state.currentLyricsFileName;
  const previousRawLyricsContent = state.currentRawLyricsContent;
  const previousLyricsSource = state.currentLyricsSource;
  const previousSongMetadata = state.currentSongMetadata;
  const previousSections = state.currentLyricsSections;
  const previousLineToSection = state.currentLineToSection;

  state.connectedClients = new Map();
  state.currentLyrics = [
    {
      type: 'normal-group',
      id: 'group_1',
      lines: ['Hello world', 'Next line'],
      line1: 'Hello world',
      line2: 'Next line',
      displayText: 'Hello world\nNext line',
      searchText: 'Hello world Next line',
    },
    'Final line',
  ];
  state.currentLyricsTimestamps = [100, 300];
  state.currentLyricsEnhancedTimestamps = [
    [[{ time: 100, text: 'Hello' }], [{ time: 150, text: 'Next' }]],
    [{ time: 300, text: 'Final' }],
  ];
  state.currentLyricsFileName = 'Enhanced Song';
  state.currentRawLyricsContent = '';
  state.currentLyricsSource = null;
  state.currentSongMetadata = null;
  state.currentLyricsSections = [];
  state.currentLineToSection = {};

  try {
    const { handlers, ioEvents, socketEvents, socket } = createSocketHarness();
    registerLyricsHandlers({
      io: { emit(eventName, payload) { ioEvents.push({ eventName, payload }); } },
      socket,
      hasPermission: (_socket, permission) => permission === 'output:control',
      clientType: 'desktop',
      deviceId: 'device-test',
      sessionId: 'session-test',
    });

    handlers.get('splitNormalGroup')?.({ index: 0 });

    assert.deepEqual(state.currentLyrics, ['Hello world', 'Next line', 'Final line']);
    assert.deepEqual(state.currentLyricsTimestamps, [100, 100, 300]);
    assert.deepEqual(state.currentLyricsEnhancedTimestamps, [
      [{ time: 100, text: 'Hello' }],
      [{ time: 150, text: 'Next' }],
      [{ time: 300, text: 'Final' }],
    ]);

    const load = ioEvents.find((event) => event.eventName === 'lyricsLoad')?.payload;
    assert.deepEqual(load.lyricsTimestamps, [100, 100, 300]);
    assert.deepEqual(load.lyricsEnhancedTimestamps, state.currentLyricsEnhancedTimestamps);
    assert.deepEqual(socketEvents.at(-1), { eventName: 'lyricsSplitSuccess', payload: { index: 0 } });
  } finally {
    state.connectedClients = previousConnectedClients;
    state.currentLyrics = previousLyrics;
    state.currentLyricsTimestamps = previousTimestamps;
    state.currentLyricsEnhancedTimestamps = previousEnhancedTimestamps;
    state.currentLyricsFileName = previousFileName;
    state.currentRawLyricsContent = previousRawLyricsContent;
    state.currentLyricsSource = previousLyricsSource;
    state.currentSongMetadata = previousSongMetadata;
    state.currentLyricsSections = previousSections;
    state.currentLineToSection = previousLineToSection;
  }
});

test('setlistLoad fanout keeps raw load success on controllers only', () => {
  const previousConnectedClients = state.connectedClients;
  const previousSetlist = state.setlistFiles;
  const previousLyrics = state.currentLyrics;
  const previousTimestamps = state.currentLyricsTimestamps;
  const previousFileName = state.currentLyricsFileName;
  const previousRawLyricsContent = state.currentRawLyricsContent;
  const previousLyricsSource = state.currentLyricsSource;
  const previousSongMetadata = state.currentSongMetadata;
  const previousSections = state.currentLyricsSections;
  const previousLineToSection = state.currentLineToSection;

  state.connectedClients = new Map();
  const desktop = createTrackedClient('socket-desktop', { type: 'desktop', purpose: 'control', permissions: ['admin:full'] });
  const output = createTrackedClient('socket-output', { type: 'output1', purpose: 'output1' });
  const stage = createTrackedClient('socket-stage', { type: 'stage', purpose: 'stage-display' });
  const timerControl = createTrackedClient('socket-timer', { type: 'desktop', purpose: 'timer-control' });
  state.setlistFiles = [{
    id: 'setlist_txt',
    displayName: 'Plain Song',
    originalName: 'Plain Song.txt',
    fileType: 'txt',
    content: 'First line\nSecond line',
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

    handlers.get('setlistLoad')?.('setlist_txt');

    assert.equal(ioEvents.some((event) => event.eventName === 'lyricsLoad'), false);
    assert.equal(ioEvents.some((event) => event.eventName === 'setlistLoadSuccess'), false);

    assert.equal(desktop.events.find((event) => event.eventName === 'setlistLoadSuccess')?.payload.rawContent, 'First line\nSecond line');
    assert.equal(output.events.some((event) => event.eventName === 'setlistLoadSuccess'), false);
    assert.equal(stage.events.some((event) => event.eventName === 'setlistLoadSuccess'), false);
    assert.equal(timerControl.events.some((event) => event.eventName === 'setlistLoadSuccess'), false);

    const outputLoad = output.events.find((event) => event.eventName === 'lyricsLoad')?.payload;
    assert.equal(outputLoad.lyrics.length, 1);
    assert.equal(outputLoad.lyrics[0].displayText, 'First line\nSecond line');
    assert.equal(Object.hasOwn(outputLoad, 'lyricsTimestamps'), false);
    assert.equal(Object.hasOwn(outputLoad, 'sections'), false);
    assert.equal(Object.hasOwn(outputLoad, 'rawLyricsContent'), false);
    assert.equal(Object.hasOwn(outputLoad, 'lyricsSource'), false);
    assert.equal(Object.hasOwn(outputLoad, 'songMetadata'), false);
    const stageLoad = stage.events.find((event) => event.eventName === 'lyricsLoad')?.payload;
    assert.equal(stageLoad.lyrics.length, 1);
    assert.equal(Object.hasOwn(stageLoad, 'lyricsTimestamps'), false);
    assert.equal(Object.hasOwn(stageLoad, 'sections'), false);
    assert.equal(stage.events.some((event) => event.eventName === 'lyricsTimestampsUpdate'), false);
    assert.equal(stage.events.some((event) => event.eventName === 'lyricsSectionsUpdate'), false);
    assert.equal(timerControl.events.some((event) => event.eventName === 'lyricsLoad'), false);
  } finally {
    state.connectedClients = previousConnectedClients;
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

test('setlistUpdate fanout sends full setlist to controllers and names only to stage displays', () => {
  const previousConnectedClients = state.connectedClients;
  const previousSetlist = state.setlistFiles;

  state.connectedClients = new Map();
  state.setlistFiles = [];
  const desktop = createTrackedClient('socket-desktop', { type: 'desktop', purpose: 'control', permissions: ['admin:full'] });
  const stage = createTrackedClient('socket-stage', { type: 'stage', purpose: 'stage-display' });
  const output = createTrackedClient('socket-output', { type: 'output1', purpose: 'output1' });
  const timerControl = createTrackedClient('socket-timer', { type: 'desktop', purpose: 'timer-control' });

  try {
    const { handlers, ioEvents, socket } = createSocketHarness();
    registerSetlistHandlers({
      io: { emit(eventName, payload) { ioEvents.push({ eventName, payload }); } },
      socket,
      hasPermission: (_socket, permission) => permission === 'setlist:write',
      clientType: 'desktop',
      deviceId: 'device-test',
      sessionId: 'session-test',
    });

    handlers.get('setlistAdd')?.([{
      name: 'Service Song.txt',
      content: 'First line\nSecond line',
      metadata: { source: 'test' },
      lastModified: 123,
    }]);

    assert.equal(ioEvents.some((event) => event.eventName === 'setlistUpdate'), false);

    const desktopUpdate = desktop.events.find((event) => event.eventName === 'setlistUpdate')?.payload;
    assert.equal(desktopUpdate.length, 1);
    assert.equal(desktopUpdate[0].content, 'First line\nSecond line');
    assert.equal(desktopUpdate[0].metadata.source, 'test');

    const stageUpdate = stage.events.find((event) => event.eventName === 'setlistUpdate')?.payload;
    assert.deepEqual(stageUpdate, [{
      id: desktopUpdate[0].id,
      displayName: 'Service Song',
      originalName: 'Service Song.txt',
    }]);
    assert.equal(Object.hasOwn(stageUpdate[0], 'content'), false);
    assert.equal(Object.hasOwn(stageUpdate[0], 'metadata'), false);

    assert.equal(output.events.some((event) => event.eventName === 'setlistUpdate'), false);
    assert.equal(timerControl.events.some((event) => event.eventName === 'setlistUpdate'), false);
  } finally {
    state.connectedClients = previousConnectedClients;
    state.setlistFiles = previousSetlist;
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
    assert.equal(ioEvents.some((event) => event.eventName === 'outputMetrics'), false);
    const metricsEvent = socketEvents.find((event) => event.eventName === 'outputMetrics');
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

test('stage output toggle fanout reaches controllers and stage display only', () => {
  const previousConnectedClients = state.connectedClients;
  const previousStageEnabled = state.currentStageEnabled;

  state.connectedClients = new Map();
  state.currentStageEnabled = true;
  const desktop = createTrackedClient('socket-desktop', { type: 'desktop', purpose: 'control', permissions: ['admin:full'] });
  const stage = createTrackedClient('socket-stage', { type: 'stage', purpose: 'stage-display' });
  const output = createTrackedClient('socket-output', { type: 'output1', purpose: 'output1' });
  const timerControl = createTrackedClient('socket-timer', { type: 'desktop', purpose: 'timer-control' });

  try {
    const { handlers, ioEvents, socket } = createSocketHarness();
    registerOutputHandlers({
      io: { emit(eventName, payload) { ioEvents.push({ eventName, payload }); } },
      socket,
      hasPermission: (_socket, permission) => permission === 'output:control',
      clientType: 'desktop',
      deviceId: 'device-test',
      sessionId: 'session-test',
    });

    handlers.get('individualOutputToggle')?.({ output: 'stage', enabled: false });

    assert.equal(state.currentStageEnabled, false);
    assert.equal(ioEvents.some((event) => event.eventName === 'individualOutputToggle'), false);
    assert.deepEqual(desktop.events.find((event) => event.eventName === 'individualOutputToggle')?.payload, {
      output: 'stage',
      enabled: false,
    });
    assert.deepEqual(stage.events.find((event) => event.eventName === 'individualOutputToggle')?.payload, {
      output: 'stage',
      enabled: false,
    });
    assert.equal(output.events.some((event) => event.eventName === 'individualOutputToggle'), false);
    assert.equal(timerControl.events.some((event) => event.eventName === 'individualOutputToggle'), false);
  } finally {
    state.connectedClients = previousConnectedClients;
    state.currentStageEnabled = previousStageEnabled;
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
  const previousSelectedLine = state.currentSelectedLine;
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
  state.currentSelectedLine = 1;
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
  state.setlistFiles = [{
    id: 'next-song',
    displayName: 'Next Song',
    originalName: 'Next Song.txt',
    content: 'Full source should stay off stage displays',
    metadata: { source: 'test' },
  }];
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
    assert.equal(Object.hasOwn(outputState, 'lyricsTimestamps'), false);
    assert.equal(Object.hasOwn(outputState, 'lyricsSections'), false);
    assert.equal(Object.hasOwn(outputState, 'lineToSection'), false);
    assert.equal(Object.hasOwn(outputState, 'rawLyricsContent'), false);
    assert.equal(Object.hasOwn(outputState, 'lyricsSource'), false);
    assert.equal(Object.hasOwn(outputState, 'songMetadata'), false);
    assert.equal(Object.hasOwn(outputState, 'setlistFiles'), false);

    const stageState = buildCurrentState({ type: 'stage', purpose: 'stage-display', permissions: ['lyrics:read'] });
    assert.deepEqual(stageState.lyrics, ['Line one', 'Line two']);
    assert.deepEqual(stageState.setlistFiles, [{
      id: 'next-song',
      displayName: 'Next Song',
      originalName: 'Next Song.txt',
    }]);
    assert.deepEqual(stageState.stageMessages, [{ text: 'Welcome' }]);
    assert.equal(Object.hasOwn(stageState, 'lyricsTimestamps'), false);
    assert.equal(Object.hasOwn(stageState, 'lyricsSections'), false);
    assert.equal(Object.hasOwn(stageState, 'lineToSection'), false);
    assert.equal(Object.hasOwn(stageState, 'rawLyricsContent'), false);
    assert.equal(Object.hasOwn(stageState, 'lyricsSource'), false);

    const periodicOutputState = buildPeriodicState({ type: 'output1', purpose: 'output1', permissions: ['lyrics:read'] });
    assert.deepEqual(periodicOutputState.output1Settings, { fontSize: 72 });
    assert.equal(periodicOutputState.selectedLine, 1);
    assert.equal(periodicOutputState.isOutputOn, true);
    assert.equal(Object.hasOwn(periodicOutputState, 'lyrics'), false);
    assert.equal(Object.hasOwn(periodicOutputState, 'lyricsFileName'), false);
    assert.equal(Object.hasOwn(periodicOutputState, 'stageTimerState'), false);

    const periodicStageState = buildPeriodicState({ type: 'stage', purpose: 'stage-display', permissions: ['lyrics:read'] });
    assert.equal(periodicStageState.stageTimerState.remaining, '1:00');
    assert.equal(periodicStageState.isOutputOn, true);
    assert.equal(periodicStageState.stageEnabled, true);
    assert.equal(Object.hasOwn(periodicStageState, 'lyrics'), false);
    assert.equal(Object.hasOwn(periodicStageState, 'stageSettings'), false);
    assert.equal(Object.hasOwn(periodicStageState, 'stageMessages'), false);

    const periodicTimeDisplayState = buildPeriodicState({ type: 'stage', purpose: 'time-display', permissions: ['lyrics:read'] });
    assert.equal(periodicTimeDisplayState.stageTimerState.remaining, '1:00');
    assert.equal(Object.hasOwn(periodicTimeDisplayState, 'lyrics'), false);
  } finally {
    state.currentLyrics = previousLyrics;
    state.currentLyricsTimestamps = previousTimestamps;
    state.currentLyricsFileName = previousFileName;
    state.currentRawLyricsContent = previousRawLyricsContent;
    state.currentLyricsSource = previousLyricsSource;
    state.currentSongMetadata = previousSongMetadata;
    state.currentLyricsSections = previousSections;
    state.currentLineToSection = previousLineToSection;
    state.currentSelectedLine = previousSelectedLine;
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

test('persisted active stage timer runtime is reset for a new app session', () => {
  const sanitized = sanitizePersistedStageTimerState({
    status: 'running',
    running: true,
    paused: false,
    durationMs: 60_000,
    startTime: 1_000_000,
    endTime: 1_060_000,
    remaining: null,
    display: {
      label: 'Service Timer',
    },
  });

  assert.equal(sanitized.status, 'idle');
  assert.equal(sanitized.running, false);
  assert.equal(sanitized.paused, false);
  assert.equal(sanitized.finished, false);
  assert.equal(sanitized.durationMs, 0);
  assert.equal(sanitized.startTime, null);
  assert.equal(sanitized.endTime, null);
  assert.equal(sanitized.remaining, null);
  assert.deepEqual(sanitized.display, { label: 'Service Timer' });
});
