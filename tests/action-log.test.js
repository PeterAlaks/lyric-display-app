import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendActionLog,
  clearActionLog,
  getActionLogSnapshot,
  resetActionLogForTests,
} from '../server/realtime/actionLog.js';
import { registerActionLogHandlers } from '../server/realtime/handlers/actionLogHandlers.js';
import { registerLyricsHandlers } from '../server/realtime/handlers/lyricsHandlers.js';
import { registerOutputHandlers } from '../server/realtime/handlers/outputHandlers.js';
import { state } from '../server/realtime/state.js';

function createHarness() {
  const handlers = new Map();
  const socketEvents = [];
  const ioEvents = [];
  const socket = {
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

test('action log stores sanitized entries and broadcasts updates', () => {
  resetActionLogForTests();
  const ioEvents = [];
  const io = { emit: (eventName, payload) => ioEvents.push({ eventName, payload }) };

  const entry = appendActionLog(io, {
    type: 'setlist',
    label: '  Setlist   song loaded  ',
    detail: 'Loaded\nAmazing   Grace',
    actor: { clientType: 'mobile', deviceId: 'device-a', sessionId: 'session-a' },
    target: 'Amazing Grace',
    metadata: { lines: 12, ignored: { nested: true }, songs: ['A', 'B'] },
  });

  assert.equal(entry.label, 'Setlist song loaded');
  assert.equal(entry.detail, 'Loaded Amazing Grace');
  assert.equal(entry.actor.clientType, 'mobile');
  assert.deepEqual(entry.metadata, { lines: 12, songs: ['A', 'B'] });
  assert.equal(ioEvents.at(-1).eventName, 'actionLogUpdate');
  assert.deepEqual(getActionLogSnapshot(), [entry]);
});

test('action log keeps the newest entries within the ring buffer limit', () => {
  resetActionLogForTests();

  for (let index = 0; index < 760; index += 1) {
    appendActionLog(null, {
      type: 'line',
      label: `Line ${index}`,
      detail: `Selected ${index}`,
      actor: { clientType: 'desktop' },
    });
  }

  const snapshot = getActionLogSnapshot();
  assert.equal(snapshot.length, 750);
  assert.equal(snapshot[0].label, 'Line 10');
  assert.equal(snapshot.at(-1).label, 'Line 759');
});

test('requestActionLog requires admin permission', () => {
  resetActionLogForTests();
  appendActionLog(null, {
    type: 'output',
    label: 'Output toggled',
    actor: { clientType: 'desktop' },
  });

  const { handlers, io, socket, socketEvents } = createHarness();
  registerActionLogHandlers({
    io,
    socket,
    hasPermission: () => false,
    clientType: 'mobile',
    deviceId: 'device-a',
    sessionId: 'session-a',
  });

  handlers.get('requestActionLog')?.();

  assert.deepEqual(socketEvents, [{
    eventName: 'permissionError',
    payload: 'Insufficient permissions to view operator action log',
  }]);
});

test('action log handlers return snapshots and clear log for admin clients', () => {
  resetActionLogForTests();
  appendActionLog(null, {
    type: 'line',
    label: 'Line changed',
    actor: { clientType: 'desktop' },
  });

  const { handlers, io, ioEvents, socket, socketEvents } = createHarness();
  registerActionLogHandlers({
    io,
    socket,
    hasPermission: (_socket, permission) => permission === 'admin:full',
    clientType: 'desktop',
    deviceId: 'desktop-device',
    sessionId: 'desktop-session',
  });

  handlers.get('requestActionLog')?.({ limit: 5 });
  assert.equal(socketEvents.at(-1).eventName, 'actionLogSnapshot');
  assert.equal(socketEvents.at(-1).payload.length, 1);

  handlers.get('actionLogClear')?.();

  assert.equal(ioEvents.at(-1).eventName, 'actionLogUpdate');
  assert.equal(ioEvents.at(-1).payload.label, 'Action log cleared');
  assert.equal(socketEvents.at(-1).eventName, 'actionLogSnapshot');
  assert.equal(socketEvents.at(-1).payload.length, 1);
  assert.equal(socketEvents.at(-1).payload[0].type, 'system');
});

test('unchanged line, filename, and style refreshes do not create action log entries', () => {
  resetActionLogForTests();
  const previousSelectedLine = state.currentSelectedLine;
  const previousFileName = state.currentLyricsFileName;
  const previousOutputSettings = state.outputSettings;
  const previousOutputEnabled = state.outputEnabled;
  const previousRegisteredOutputs = state.registeredOutputs;

  state.currentSelectedLine = 2;
  state.currentLyricsFileName = 'Already Loaded';
  state.outputSettings = new Map([['output1', { fontSize: 48, textColor: '#ffffff' }]]);
  state.outputEnabled = new Map([['output1', true]]);
  state.registeredOutputs = new Set(['output1', 'output2']);

  try {
    const { handlers, io, ioEvents, socket } = createHarness();
    registerLyricsHandlers({
      io,
      socket,
      hasPermission: () => true,
      clientType: 'desktop',
      deviceId: 'desktop-device',
      sessionId: 'desktop-session',
    });
    registerOutputHandlers({
      io,
      socket,
      hasPermission: () => true,
      clientType: 'desktop',
      deviceId: 'desktop-device',
      sessionId: 'desktop-session',
    });

    handlers.get('lineUpdate')?.({ index: 2 });
    handlers.get('fileNameUpdate')?.('Already Loaded');
    handlers.get('styleUpdate')?.({ output: 'output1', settings: { fontSize: 48 } });

    assert.equal(ioEvents.filter((event) => event.eventName === 'actionLogUpdate').length, 0);

    handlers.get('styleUpdate')?.({ output: 'output1', settings: { fontSize: 52 } });
    const logEvents = ioEvents.filter((event) => event.eventName === 'actionLogUpdate');
    assert.equal(logEvents.length, 1);
    assert.deepEqual(logEvents[0].payload.metadata, { keys: ['fontSize'] });
  } finally {
    state.currentSelectedLine = previousSelectedLine;
    state.currentLyricsFileName = previousFileName;
    state.outputSettings = previousOutputSettings;
    state.outputEnabled = previousOutputEnabled;
    state.registeredOutputs = previousRegisteredOutputs;
  }
});
