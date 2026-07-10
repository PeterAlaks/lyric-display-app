import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_SETLIST_ITEMS } from '../shared/setlistLimits.js';
import { getClientPermissions } from '../server/auth/permissions.js';
import { localhostOnly } from '../server/middleware/localhostOnly.js';
import { registerDraftHandlers } from '../server/realtime/handlers/draftHandlers.js';
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

test('only desktop or admin permissions can approve lyrics drafts', () => {
  assert.equal(getClientPermissions('desktop').includes('lyrics:draft:approve'), true);
  assert.equal(getClientPermissions('web').includes('lyrics:draft:approve'), false);
  assert.equal(getClientPermissions('mobile').includes('lyrics:draft:approve'), false);
  assert.equal(getClientPermissions('obsDock').includes('lyrics:draft:approve'), false);
});

test('ordinary lyric write permission cannot approve a draft', () => {
  const previousLyrics = state.currentLyrics;
  state.currentLyrics = ['Existing live lyric'];

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

    registerDraftHandlers({
      io: { emit() {} },
      socket,
      hasPermission: (_socket, permission) => permission === 'lyrics:write',
      clientType: 'web',
      deviceId: 'web-device',
      sessionId: 'web-session',
    });

    handlers.get('lyricsDraftApprove')?.({
      draftId: 'draft-1',
      title: 'Unapproved',
      rawText: 'Replacement',
      processedLines: ['Replacement'],
    });

    assert.deepEqual(emitted.at(-1), {
      eventName: 'permissionError',
      payload: 'Insufficient permissions to approve drafts',
    });
    assert.deepEqual(state.currentLyrics, ['Existing live lyric']);
  } finally {
    state.currentLyrics = previousLyrics;
  }
});

test('live safety blocks draft approval from a secondary controller even if permission is granted', () => {
  const previousLiveSafety = state.liveSafety;
  const previousPendingDrafts = state.pendingDrafts;
  const previousLyrics = state.currentLyrics;

  state.liveSafety = { enabled: true, updatedAt: Date.now(), updatedBy: { clientType: 'desktop' } };
  state.pendingDrafts = new Map([['draft-live-safety', {
    submitterSessionId: 'submitter-session',
    title: 'Pending draft',
  }]]);
  state.currentLyrics = ['Existing live lyric'];

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

    registerDraftHandlers({
      io: { emit() {} },
      socket,
      hasPermission: () => true,
      clientType: 'mobile',
      deviceId: 'mobile-device',
      sessionId: 'mobile-session',
    });

    handlers.get('lyricsDraftApprove')?.({
      draftId: 'draft-live-safety',
      title: 'Pending draft',
      rawText: 'Replacement',
      processedLines: ['Replacement'],
    });

    assert.equal(emitted.at(-1).eventName, 'liveSafetyBlocked');
    assert.equal(emitted.at(-1).payload.action, 'lyricsDraftApprove');
    assert.equal(state.pendingDrafts.has('draft-live-safety'), true);
    assert.deepEqual(state.currentLyrics, ['Existing live lyric']);
  } finally {
    state.liveSafety = previousLiveSafety;
    state.pendingDrafts = previousPendingDrafts;
    state.currentLyrics = previousLyrics;
  }
});

test('desktop draft approval requires a pending valid draft and updates persisted lyric state', () => {
  const previousState = {
    connectedClients: state.connectedClients,
    currentLyrics: state.currentLyrics,
    currentLyricsTimestamps: state.currentLyricsTimestamps,
    currentLyricsEnhancedTimestamps: state.currentLyricsEnhancedTimestamps,
    currentSelectedLine: state.currentSelectedLine,
    currentLyricsFileName: state.currentLyricsFileName,
    currentRawLyricsContent: state.currentRawLyricsContent,
    currentLyricsSource: state.currentLyricsSource,
    currentSongMetadata: state.currentSongMetadata,
    currentLyricsSections: state.currentLyricsSections,
    currentLineToSection: state.currentLineToSection,
    pendingDrafts: state.pendingDrafts,
    liveSafety: state.liveSafety,
  };

  state.connectedClients = new Map();
  state.pendingDrafts = new Map([['draft-valid', {
    submitterSessionId: 'submitter-session',
    title: 'Approved song',
  }]]);
  state.liveSafety = { enabled: false, updatedAt: null, updatedBy: null };

  try {
    const handlers = new Map();
    const socketEvents = [];
    const socket = {
      on(eventName, handler) {
        handlers.set(eventName, handler);
      },
      emit(eventName, payload) {
        socketEvents.push({ eventName, payload });
      },
    };

    registerDraftHandlers({
      io: { emit() {} },
      socket,
      hasPermission: (_socket, permission) => permission === 'lyrics:draft:approve',
      clientType: 'desktop',
      deviceId: 'desktop-device',
      sessionId: 'desktop-session',
    });

    handlers.get('lyricsDraftApprove')?.({
      draftId: 'draft-missing',
      title: 'Expired song',
      rawText: 'Expired',
      processedLines: ['Expired'],
    });
    assert.equal(socketEvents.at(-1).eventName, 'draftError');

    handlers.get('lyricsDraftApprove')?.({
      draftId: 'draft-valid',
      title: 'Approved song',
      rawText: 'First line\nSecond line',
      processedLines: ['First line', 'Second line'],
    });

    assert.deepEqual(state.currentLyrics, ['First line', 'Second line']);
    assert.equal(state.currentLyricsFileName, 'Approved song');
    assert.equal(state.currentRawLyricsContent, 'First line\nSecond line');
    assert.equal(state.currentLyricsSource.content, 'First line\nSecond line');
    assert.equal(state.currentSongMetadata.origin, 'draft');
    assert.equal(state.pendingDrafts.has('draft-valid'), false);
  } finally {
    Object.assign(state, previousState);
  }
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

test('line navigation rejects indices outside the active lyrics', () => {
  const previousSelectedLine = state.currentSelectedLine;
  const previousLyrics = state.currentLyrics;
  state.currentLyrics = ['Line 1', 'Line 2'];
  state.currentSelectedLine = 0;

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

    registerLyricsHandlers({
      io: { emit: (eventName, payload) => ioEvents.push({ eventName, payload }) },
      socket,
      hasPermission: (_socket, permission) => permission === 'output:control',
      clientType: 'desktop',
      deviceId: 'desktop-device',
      sessionId: 'desktop-session',
    });

    handlers.get('lineUpdate')?.({ index: 2 });

    assert.deepEqual(emitted.at(-1), {
      eventName: 'permissionError',
      payload: 'Invalid line update payload',
    });
    assert.equal(state.currentSelectedLine, 0);
    assert.equal(ioEvents.some((event) => event.eventName === 'lineUpdate'), false);
  } finally {
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
