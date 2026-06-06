import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_SETLIST_ITEMS } from '../shared/setlistLimits.js';
import { localhostOnly } from '../server/middleware/localhostOnly.js';
import { registerLiveSafetyHandlers } from '../server/realtime/handlers/liveSafetyHandlers.js';
import { registerLyricsHandlers } from '../server/realtime/handlers/lyricsHandlers.js';
import { registerSetlistHandlers } from '../server/realtime/handlers/setlistHandlers.js';
import { state } from '../server/realtime/state.js';
import {
  sanitizeSetlistDefaultName,
  validateSetlistData,
} from '../main/setlistValidation.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('localhostOnly rejects remote requests even with a localhost Host header', () => {
  const req = {
    ip: '10.0.0.25',
    hostname: 'localhost',
    socket: { remoteAddress: '10.0.0.25' },
    connection: { remoteAddress: '10.0.0.25' },
  };
  const res = createResponse();
  let nextCalled = false;

  localhostOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: 'Local access only' });
});

test('localhostOnly allows loopback requests', () => {
  const req = {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    connection: { remoteAddress: '127.0.0.1' },
  };
  const res = createResponse();
  let nextCalled = false;

  localhostOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('setlistLoad requires live lyric write permission', () => {
  const handlers = new Map();
  const emitted = [];
  const socket = {
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
    emit(eventName, payload) {
      emitted.push({ eventName, payload });
    },
  };

  registerSetlistHandlers({
    io: { emit() {} },
    socket,
    hasPermission: (_socket, permission) => permission === 'setlist:read',
    clientType: 'stage',
    deviceId: 'device-test',
    sessionId: 'session-test',
  });

  handlers.get('setlistLoad')?.('setlist_1');

  assert.deepEqual(emitted, [
    {
      eventName: 'permissionError',
      payload: 'Insufficient permissions to load setlist items into live lyrics',
    },
  ]);
});

test('setlist validation accepts normal ldset payloads', () => {
  const result = validateSetlistData({
    version: '1.0',
    savedAt: new Date().toISOString(),
    itemCount: 1,
    items: [
      {
        displayName: 'Amazing Grace',
        originalName: 'Amazing Grace.txt',
        content: 'Amazing grace\nHow sweet the sound',
        lastModified: Date.now(),
        fileType: 'txt',
        metadata: { source: 'test' },
      },
    ],
  });

  assert.equal(result.valid, true);
});

test('setlist validation rejects unsupported item file types', () => {
  const result = validateSetlistData({
    items: [
      {
        displayName: 'Bad File',
        originalName: 'Bad File.html',
        content: '<script>alert(1)</script>',
        fileType: 'html',
      },
    ],
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /unsupported file type/i);
});

test('setlist validation enforces item limits', () => {
  const result = validateSetlistData({
    items: Array.from({ length: MAX_SETLIST_ITEMS + 1 }, (_, index) => ({
      displayName: `Song ${index + 1}`,
      originalName: `Song ${index + 1}.txt`,
      content: 'Lyrics',
      fileType: 'txt',
    })),
  });

  assert.equal(result.valid, false);
  assert.match(result.error, new RegExp(`more than ${MAX_SETLIST_ITEMS}`, 'i'));
});

test('setlist validation accepts the configured maximum item count', () => {
  const result = validateSetlistData({
    items: Array.from({ length: MAX_SETLIST_ITEMS }, (_, index) => ({
      displayName: `Song ${index + 1}`,
      originalName: `Song ${index + 1}.txt`,
      content: 'Lyrics',
      fileType: 'txt',
    })),
  });

  assert.equal(result.valid, true);
});

test('setlistAdd allows setlists above the old 50 item cap', () => {
  const handlers = new Map();
  const emitted = [];
  const socket = {
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
    emit(eventName, payload) {
      emitted.push({ eventName, payload });
    },
  };

  state.setlistFiles = [];

  registerSetlistHandlers({
    io: { emit() {} },
    socket,
    hasPermission: (_socket, permission) => permission === 'setlist:write',
    clientType: 'desktop',
    deviceId: 'device-test',
    sessionId: 'session-test',
  });

  handlers.get('setlistAdd')?.(
    Array.from({ length: 60 }, (_, index) => ({
      name: `Song ${index + 1}.txt`,
      content: 'Lyrics',
    })),
  );

  assert.equal(state.setlistFiles.length, 60);
  assert.deepEqual(emitted.at(-1), {
    eventName: 'setlistAddSuccess',
    payload: {
      addedCount: 60,
      totalCount: 60,
    },
  });

  state.setlistFiles = [];
});

test('setlist default names are sanitized and forced to .ldset', () => {
  assert.equal(sanitizeSetlistDefaultName('../Bad:Name'), 'BadName.ldset');
  assert.equal(sanitizeSetlistDefaultName('Service.ldset'), 'Service.ldset');
});

test('live safety mode blocks secondary setlist loads while allowing line navigation', () => {
  const previousLiveSafety = state.liveSafety;
  const previousSelectedLine = state.currentSelectedLine;
  const previousLyrics = state.currentLyrics;

  state.liveSafety = { enabled: true, updatedAt: Date.now(), updatedBy: { clientType: 'desktop' } };
  state.currentLyrics = ['Line 1', 'Line 2'];
  state.currentSelectedLine = null;

  try {
    const handlers = new Map();
    const emitted = [];
    const ioEvents = [];
    const socket = {
      on(eventName, handler) {
        handlers.set(eventName, handler);
      },
      emit(eventName, payload) {
        emitted.push({ eventName, payload });
      },
    };

    const context = {
      io: { emit: (eventName, payload) => ioEvents.push({ eventName, payload }) },
      socket,
      hasPermission: () => true,
      clientType: 'mobile',
      deviceId: 'device-test',
      sessionId: 'session-test',
    };

    registerSetlistHandlers(context);
    registerLyricsHandlers(context);

    handlers.get('setlistLoad')?.('setlist_1');
    assert.equal(emitted.at(-1).eventName, 'liveSafetyBlocked');
    assert.equal(emitted.at(-1).payload.action, 'setlistLoad');

    handlers.get('lineUpdate')?.({ index: 1 });
    assert.equal(state.currentSelectedLine, 1);
    assert.deepEqual(ioEvents.at(-1), { eventName: 'lineUpdate', payload: { index: 1 } });
  } finally {
    state.liveSafety = previousLiveSafety;
    state.currentSelectedLine = previousSelectedLine;
    state.currentLyrics = previousLyrics;
  }
});

test('live safety mode blocks secondary group splitting', () => {
  const previousLiveSafety = state.liveSafety;
  const previousLyrics = state.currentLyrics;

  state.liveSafety = { enabled: true, updatedAt: Date.now(), updatedBy: { clientType: 'desktop' } };
  state.currentLyrics = [{
    type: 'normal-group',
    lines: ['Line 1', 'Line 2'],
    displayText: 'Line 1\nLine 2',
  }];

  try {
    const handlers = new Map();
    const emitted = [];
    const socket = {
      on(eventName, handler) {
        handlers.set(eventName, handler);
      },
      emit(eventName, payload) {
        emitted.push({ eventName, payload });
      },
    };

    registerLyricsHandlers({
      io: { emit() {} },
      socket,
      hasPermission: () => true,
      clientType: 'web',
      deviceId: 'device-test',
    });

    handlers.get('splitNormalGroup')?.({ index: 0 });

    assert.equal(emitted.at(-1).eventName, 'liveSafetyBlocked');
    assert.equal(emitted.at(-1).payload.action, 'splitNormalGroup');
    assert.equal(state.currentLyrics.length, 1);
  } finally {
    state.liveSafety = previousLiveSafety;
    state.currentLyrics = previousLyrics;
  }
});

test('live safety mode can be changed by desktop admin clients', () => {
  const previousLiveSafety = state.liveSafety;

  try {
    const handlers = new Map();
    const emitted = [];
    const ioEvents = [];
    const socket = {
      on(eventName, handler) {
        handlers.set(eventName, handler);
      },
      emit(eventName, payload) {
        emitted.push({ eventName, payload });
      },
    };

    registerLiveSafetyHandlers({
      io: { emit: (eventName, payload) => ioEvents.push({ eventName, payload }) },
      socket,
      hasPermission: (_socket, permission) => permission === 'admin:full',
      clientType: 'desktop',
      deviceId: 'desktop-device',
      sessionId: 'desktop-session',
    });

    handlers.get('liveSafetySet')?.({ enabled: true });

    assert.equal(state.liveSafety.enabled, true);
    assert.equal(ioEvents.at(-1).eventName, 'liveSafetyUpdate');
    assert.equal(ioEvents.at(-1).payload.enabled, true);
  } finally {
    state.liveSafety = previousLiveSafety;
  }
});
