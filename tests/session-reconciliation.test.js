import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emitDesktopSessionBootstrap,
  shouldBootstrapDesktopSession,
} from '../shared/sessionReconciliation.js';
import { schedulePersistSessionState } from '../server/realtime/sessionPersistence.js';
import { buildCurrentState, state } from '../server/realtime/state.js';

test('desktop bootstrap is allowed only for a new uninitialized server session', () => {
  assert.equal(shouldBootstrapDesktopSession({
    isDesktopApp: true,
    snapshot: { sessionAuthority: { source: 'new', bootstrapAllowed: true } },
  }), true);
  assert.equal(shouldBootstrapDesktopSession({
    isDesktopApp: true,
    snapshot: { sessionAuthority: { source: 'restored', bootstrapAllowed: false } },
  }), false);
  assert.equal(shouldBootstrapDesktopSession({
    isDesktopApp: false,
    snapshot: { sessionAuthority: { source: 'new', bootstrapAllowed: true } },
  }), false);
});

test('desktop bootstrap sends bounded current state without cross-session setlists', () => {
  const events = [];
  const socket = {
    emit(eventName, payload) {
      events.push({ eventName, payload });
    },
  };

  assert.equal(emitDesktopSessionBootstrap(socket, {
    customOutputIds: ['output3', 'output99'],
    output1Settings: { fontSize: 72 },
    output99Settings: { fontSize: 999 },
    output1Enabled: true,
    output2Enabled: false,
    stageSettings: { fontSize: 40 },
    stageEnabled: true,
    isOutputOn: false,
    lyrics: ['Line one'],
    lyricsFileName: 'Song',
    rawLyricsContent: 'Line one',
    lyricsTimestamps: [1000],
    lyricsEnhancedTimestamps: [],
    lyricsSections: [],
    lineToSection: {},
    selectedLine: 0,
    setlistFiles: [{ id: 'must-not-bootstrap' }],
  }), true);

  assert.deepEqual(events.find((event) => event.eventName === 'outputsRegister')?.payload, {
    outputs: ['output3'],
  });
  assert.deepEqual(events.find((event) => event.eventName === 'lyricsLoad')?.payload.lyrics, ['Line one']);
  assert.equal(events.some((event) => event.eventName.startsWith('setlist')), false);
  assert.equal(events.some((event) => event.payload?.output === 'output99'), false);
  assert.equal(events.filter((event) => event.eventName === 'individualOutputToggle').length, 3);
});

test('the server closes the bootstrap gate as soon as authoritative state mutates', () => {
  const previousAuthority = state.sessionAuthority;
  state.sessionAuthority = { snapshotLoaded: false, initialized: false };

  try {
    const client = { type: 'desktop', permissions: ['admin:full'] };
    assert.equal(buildCurrentState(client).sessionAuthority.bootstrapAllowed, true);
    schedulePersistSessionState();
    assert.deepEqual(buildCurrentState(client).sessionAuthority, {
      source: 'new',
      bootstrapAllowed: false,
    });
  } finally {
    state.sessionAuthority = previousAuthority;
  }
});
