import assert from 'node:assert/strict';
import test from 'node:test';
import { localhostOnly } from '../server/middleware/localhostOnly.js';
import { registerSetlistHandlers } from '../server/realtime/handlers/setlistHandlers.js';
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
    items: Array.from({ length: 101 }, (_, index) => ({
      displayName: `Song ${index + 1}`,
      originalName: `Song ${index + 1}.txt`,
      content: 'Lyrics',
      fileType: 'txt',
    })),
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /more than 100/i);
});

test('setlist default names are sanitized and forced to .ldset', () => {
  assert.equal(sanitizeSetlistDefaultName('../Bad:Name'), 'BadName.ldset');
  assert.equal(sanitizeSetlistDefaultName('Service.ldset'), 'Service.ldset');
});
