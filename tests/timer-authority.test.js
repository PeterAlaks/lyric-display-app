import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceAuthoritativeTimerBoundary,
  applyAuthoritativeTimerUpdate,
  localizeAuthoritativeTimerState,
} from '../shared/timerAuthority.js';

test('authoritative timer updates rebase controller timestamps onto the server clock', () => {
  const result = applyAuthoritativeTimerUpdate({ revision: 0 }, {
    running: true,
    mode: 'countdown',
    durationMs: 60_000,
    startTime: 1_000_000,
    endTime: 1_060_000,
    clientSentAt: 1_000_000,
    baseRevision: 0,
  }, 2_000_000);

  assert.equal(result.accepted, true);
  assert.equal(result.state.revision, 1);
  assert.equal(result.state.startTime, 2_000_000);
  assert.equal(result.state.endTime, 2_060_000);
  assert.equal(result.state.serverNow, 2_000_000);
  assert.equal(result.state.clockBasis, 'server');
});

test('authoritative timer rejects an update based on an older revision', () => {
  const result = applyAuthoritativeTimerUpdate({ revision: 4 }, {
    running: false,
    baseRevision: 3,
  }, 2_000_000);

  assert.equal(result.accepted, false);
  assert.equal(result.stale, true);
  assert.match(result.error, /another controller/i);
});

test('authoritative timer snapshots are localized without changing their duration', () => {
  const localized = localizeAuthoritativeTimerState({
    clockBasis: 'server',
    serverNow: 2_000_000,
    startTime: 1_900_000,
    endTime: 2_060_000,
    overrunStartedAt: null,
  }, 1_000_000);

  assert.equal(localized.startTime, 900_000);
  assert.equal(localized.endTime, 1_060_000);
  assert.equal(localized.endTime - localized.startTime, 160_000);
  assert.equal(localized.clockBasis, 'local');
});

test('authoritative timer normalization preserves zero transitions and schedule invariants', () => {
  const result = applyAuthoritativeTimerUpdate({ revision: 0 }, {
    running: true,
    mode: 'countdown',
    warningMs: 10_000,
    criticalMs: 30_000,
    indicatorEnabled: true,
    indicatorDurationMs: 0,
    activeSetIndex: 1.8,
    scheduleEventStartTime: '09:30',
    sets: [
      { id: 'same', label: 'First', durationMs: 60_000 },
      { id: 'same', label: 'Second', durationMs: 60_000 },
    ],
    clientSentAt: 1_000_000,
    baseRevision: 0,
  }, 1_000_000);

  assert.equal(result.accepted, true);
  assert.equal(result.state.indicatorDurationMs, 0);
  assert.equal(result.state.criticalMs, 10_000);
  assert.equal(result.state.activeSetIndex, 1);
  assert.equal(result.state.scheduleEventStartTime, '09:30');
  assert.deepEqual(result.state.sets.map((item) => item.id), ['same', 'same-2']);
});

test('zero-duration transitions advance directly to the next schedule item', () => {
  const next = advanceAuthoritativeTimerBoundary({
    revision: 1,
    running: true,
    paused: false,
    mode: 'countdown',
    phase: 'timer',
    endTime: 1_000_000,
    activeSetIndex: 0,
    sets: [
      { id: 'first', label: 'First', durationMs: 60_000 },
      { id: 'second', label: 'Second', durationMs: 60_000 },
    ],
    autoStartNext: true,
    indicatorEnabled: true,
    indicatorDurationMs: 0,
  }, 1_000_000);

  assert.equal(next.phase, 'timer');
  assert.equal(next.activeSetIndex, 1);
  assert.equal(next.label, 'Second');
});

test('authoritative timer advances sets through an indicator using boundary continuity', () => {
  const base = {
    revision: 1,
    status: 'running',
    running: true,
    paused: false,
    finished: false,
    mode: 'countdown',
    phase: 'timer',
    label: 'First',
    startTime: 900_000,
    endTime: 1_000_000,
    durationMs: 100_000,
    activeSetIndex: 0,
    sets: [
      { id: 'first', label: 'First', durationMs: 100_000 },
      { id: 'second', label: 'Second', durationMs: 60_000 },
    ],
    autoStartNext: true,
    indicatorEnabled: true,
    indicatorDurationMs: 10_000,
    indicatorLabel: 'Up next',
  };

  const indicator = advanceAuthoritativeTimerBoundary(base, 1_005_000);
  assert.equal(indicator.phase, 'indicator');
  assert.equal(indicator.startTime, 1_000_000);
  assert.equal(indicator.endTime, 1_010_000);

  const second = advanceAuthoritativeTimerBoundary(indicator, 1_015_000);
  assert.equal(second.phase, 'timer');
  assert.equal(second.activeSetIndex, 1);
  assert.equal(second.startTime, 1_010_000);
  assert.equal(second.endTime, 1_070_000);

  const finished = advanceAuthoritativeTimerBoundary(second, 1_070_000);
  assert.equal(finished.status, 'finished');
  assert.equal(finished.running, false);
  assert.equal(finished.remaining, '0:00');
});

test('authoritative timer enters untimed schedule items as manual count-up steps', () => {
  const base = {
    revision: 1,
    status: 'running',
    running: true,
    paused: false,
    mode: 'countdown',
    phase: 'timer',
    label: 'Welcome',
    startTime: 900_000,
    endTime: 1_000_000,
    durationMs: 100_000,
    activeSetIndex: 0,
    sets: [
      { id: 'welcome', label: 'Welcome', durationMs: 100_000, timed: true },
      { id: 'response', label: 'Open response', durationMs: null, timed: false },
    ],
    autoStartNext: true,
    indicatorEnabled: false,
  };

  const manual = advanceAuthoritativeTimerBoundary(base, 1_000_000);
  assert.equal(manual.activeSetIndex, 1);
  assert.equal(manual.mode, 'countup');
  assert.equal(manual.durationMs, 0);
  assert.equal(manual.endTime, null);
  assert.equal(manual.running, true);
});

test('authoritative timer waits for manual next when auto-start is disabled', () => {
  const waiting = advanceAuthoritativeTimerBoundary({
    revision: 1,
    status: 'running',
    running: true,
    paused: false,
    mode: 'countdown',
    phase: 'timer',
    label: 'First',
    startTime: 900_000,
    endTime: 1_000_000,
    durationMs: 100_000,
    activeSetIndex: 0,
    sets: [
      { id: 'first', label: 'First', durationMs: 100_000, timed: true },
      { id: 'second', label: 'Second', durationMs: 60_000, timed: true },
    ],
    autoStartNext: false,
  }, 1_000_000);

  assert.equal(waiting.running, true);
  assert.equal(waiting.paused, true);
  assert.equal(waiting.awaitingNext, true);
  assert.equal(waiting.activeSetIndex, 0);
  assert.equal(waiting.endTime, null);
});

test('authoritative timer rejects cyclic and oversized controller payloads', () => {
  const cyclic = { running: false };
  cyclic.self = cyclic;
  assert.equal(applyAuthoritativeTimerUpdate({}, cyclic).accepted, false);

  const oversized = { running: false, label: 'x'.repeat(70 * 1024) };
  const result = applyAuthoritativeTimerUpdate({}, oversized);
  assert.equal(result.accepted, false);
  assert.match(result.error, /too large/i);
});
