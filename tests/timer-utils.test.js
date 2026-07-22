import assert from 'node:assert/strict';
import test from 'node:test';
import { createTimerSlice } from '../src/context/lyricsStore/timerSlice.js';
import {
  MAX_TIMER_SETS,
  getTimerDisplay,
  getTimerProgress,
  isTimerVisiblyActive,
  normalizeTimerControlSettings,
  normalizeTimerDisplaySettings,
  normalizeTimerState,
  resetActiveTimerRuntime,
} from '../src/utils/timerUtils.js';

function createTimerStoreHarness() {
  let currentState;
  let updateCount = 0;
  const set = (update) => {
    const next = typeof update === 'function' ? update(currentState) : update;
    if (!next || Object.keys(next).length === 0) return;
    updateCount += 1;
    currentState = { ...currentState, ...next };
  };

  currentState = createTimerSlice(set, (settings) => settings);

  return {
    getState: () => currentState,
    getUpdateCount: () => updateCount,
  };
}

test('timer progress advances for normalized stage panel countdown state', () => {
  const startTime = 1_000_000;
  const durationMs = 5 * 60_000;
  const timerState = {
    status: 'running',
    running: true,
    paused: false,
    mode: 'countdown',
    phase: 'timer',
    durationMs,
    startTime,
    endTime: startTime + durationMs,
  };

  assert.equal(getTimerProgress(timerState, startTime), 0);
  assert.equal(getTimerProgress(timerState, startTime + (durationMs / 2)), 0.5);
  assert.equal(getTimerProgress(timerState, startTime + durationMs), 1);
});

test('timer progress is zero for legacy stage payload without duration', () => {
  const now = 1_000_000;
  assert.equal(getTimerProgress({
    running: true,
    paused: false,
    endTime: now + 60_000,
    remaining: null,
  }, now), 0);
});

test('expired terminal countdown is not visibly active', () => {
  const startTime = 1_000_000;
  const durationMs = 60_000;
  assert.equal(isTimerVisiblyActive({
    status: 'running',
    running: true,
    paused: false,
    mode: 'countdown',
    phase: 'timer',
    durationMs,
    startTime,
    endTime: startTime + durationMs,
    overrunMode: false,
    sets: [],
  }, startTime + durationMs + 1), false);
});

test('expired countdown remains visibly active when a next set should auto-start', () => {
  const startTime = 1_000_000;
  const durationMs = 60_000;
  assert.equal(isTimerVisiblyActive({
    status: 'running',
    running: true,
    paused: false,
    mode: 'countdown',
    phase: 'timer',
    durationMs,
    startTime,
    endTime: startTime + durationMs,
    activeSetIndex: 0,
    autoStartNext: true,
    sets: [
      { id: 'set-1', label: 'Timer 1', durationMs },
      { id: 'set-2', label: 'Timer 2', durationMs },
    ],
  }, startTime + durationMs + 1), true);
});

test('overrun and paused timers remain visibly active', () => {
  const startTime = 1_000_000;
  const durationMs = 60_000;
  const expired = {
    status: 'running',
    running: true,
    paused: false,
    mode: 'countdown',
    phase: 'timer',
    durationMs,
    startTime,
    endTime: startTime + durationMs,
  };

  assert.equal(isTimerVisiblyActive({
    ...expired,
    overrunMode: true,
  }, startTime + durationMs + 1), true);

  assert.equal(isTimerVisiblyActive({
    ...expired,
    paused: true,
    pausedRemainingMs: 10_000,
  }, startTime + durationMs + 1), true);
});

test('reconciled overdue schedule items display overtime and remain visibly active', () => {
  const state = {
    status: 'running',
    running: true,
    paused: false,
    mode: 'countdown',
    phase: 'timer',
    durationMs: 60_000,
    startTime: 1_000_000,
    endTime: 1_060_000,
    scheduleReconciliationHold: true,
    overrunMode: false,
  };

  assert.equal(getTimerDisplay(state, 1_090_000), '+0:30');
  assert.equal(isTimerVisiblyActive(state, 1_090_000), true);
  assert.equal(getTimerDisplay({
    ...state,
    paused: true,
    endTime: null,
    pausedRemainingMs: 0,
    schedulePausedOverrunMs: 45_000,
  }, 1_090_000), '+0:45');
});

test('timer display scale normalization preserves defaults, migrations, and custom settings', () => {
  const defaults = normalizeTimerDisplaySettings({});

  assert.equal(defaults.otherItemsScale, 0.1);
  assert.equal(defaults.globalClockScale, 0.1);

  const untouchedLegacy = normalizeTimerDisplaySettings({
    otherItemsScale: 0.15,
    globalClockScale: 0.15,
    displayUpdatedAt: 0,
  });

  assert.equal(untouchedLegacy.otherItemsScale, 0.1);
  assert.equal(untouchedLegacy.globalClockScale, 0.1);

  const customLegacySized = normalizeTimerDisplaySettings({
    otherItemsScale: 0.15,
    globalClockScale: 0.15,
    displayUpdatedAt: 1_000_000,
  });

  assert.equal(customLegacySized.otherItemsScale, 0.15);
  assert.equal(customLegacySized.globalClockScale, 0.15);

  const state = normalizeTimerState({
    display: {
      otherItemsScale: 0.15,
      globalClockScale: 0.15,
      displayUpdatedAt: 0,
    },
  });

  assert.equal(state.display.otherItemsScale, 0.1);
  assert.equal(state.display.globalClockScale, 0.1);
});

test('timer display sync ignores equal timestamped settings', () => {
  const store = createTimerStoreHarness();
  const firstSettings = normalizeTimerDisplaySettings({
    label: 'Service Timer',
    accentColor: '#22C55E',
    displayUpdatedAt: 1_000_000,
  });

  store.getState().updateTimerDisplaySettings(firstSettings, { touch: false });
  assert.equal(store.getUpdateCount(), 1);
  const syncedSettingsRef = store.getState().timerDisplaySettings;

  store.getState().updateTimerDisplaySettings(firstSettings, { touch: false });

  assert.equal(store.getUpdateCount(), 1);
  assert.equal(store.getState().timerDisplaySettings, syncedSettingsRef);
});

test('timer control settings cap timer sets at the schedule limit', () => {
  const settings = normalizeTimerControlSettings({
    sets: Array.from({ length: MAX_TIMER_SETS + 2 }, (_, index) => ({
      id: `set-${index + 1}`,
      label: `Timer ${index + 1}`,
      durationMs: 60_000,
    })),
  });

  assert.equal(settings.sets.length, MAX_TIMER_SETS);
  assert.equal(settings.sets.at(-1).label, `Timer ${MAX_TIMER_SETS}`);
});

test('timer control settings preserve an empty schedule as a clean slate', () => {
  assert.deepEqual(normalizeTimerControlSettings({}).sets, []);
  assert.deepEqual(normalizeTimerControlSettings({ sets: [] }).sets, []);
  assert.deepEqual(normalizeTimerControlSettings({
    sets: [
      { id: 'timer-set-1', label: 'Timer 1', durationMs: 300_000 },
      { id: 'timer-set-2', label: 'Timer 2', durationMs: 300_000 },
    ],
  }).sets, []);
});

test('timer control settings preserve a valid optional schedule event start', () => {
  assert.equal(normalizeTimerControlSettings({ scheduleEventStartTime: '09:30' }).scheduleEventStartTime, '09:30');
  assert.equal(normalizeTimerControlSettings({ scheduleEventStartTime: '25:00' }).scheduleEventStartTime, '');
  assert.equal(normalizeTimerControlSettings({ scheduleEventDate: '2026-07-22' }).scheduleEventDate, '2026-07-22');
  assert.equal(normalizeTimerControlSettings({ scheduleEventDate: '2026-02-30' }).scheduleEventDate, '');
});

test('timer control settings preserve threshold ordering and unique schedule item ids', () => {
  const settings = normalizeTimerControlSettings({
    warningSeconds: 10,
    criticalSeconds: 30,
    sets: [
      { id: 'same', label: 'First', durationMs: 60_000 },
      { id: 'same', label: 'Second', durationMs: 60_000 },
    ],
  });

  assert.equal(settings.warningSeconds, 10);
  assert.equal(settings.criticalSeconds, 10);
  assert.deepEqual(settings.sets.map((item) => item.id), ['same', 'same-2']);
});

test('timer state normalization caps runtime timer sets at the schedule limit', () => {
  const state = normalizeTimerState({
    activeSetIndex: MAX_TIMER_SETS + 4,
    sets: Array.from({ length: MAX_TIMER_SETS + 3 }, (_, index) => ({
      id: `runtime-${index + 1}`,
      label: `Runtime ${index + 1}`,
      durationMs: 60_000,
    })),
  });

  assert.equal(state.sets.length, MAX_TIMER_SETS);
  assert.equal(state.activeSetIndex, MAX_TIMER_SETS - 1);
});

test('timer normalization preserves manual schedule items', () => {
  const state = normalizeTimerState({
    sets: [
      { id: 'manual', label: 'Open ministry', durationMs: null, timed: false },
    ],
  });

  assert.equal(state.sets.length, 1);
  assert.equal(state.sets[0].timed, false);
  assert.equal(state.sets[0].durationMs, null);
});

test('timer state normalization keeps runtime schedule fields internally consistent', () => {
  const state = normalizeTimerState({
    warningMs: 10_000,
    criticalMs: 30_000,
    activeSetIndex: 1.8,
    scheduleEventStartTime: '09:30',
    indicatorDurationMs: 0,
    sets: [
      { id: 'same', label: 'First', durationMs: 60_000 },
      { id: 'same', label: 'Second', durationMs: 60_000 },
    ],
  });

  assert.equal(state.criticalMs, 10_000);
  assert.equal(state.activeSetIndex, 1);
  assert.equal(state.scheduleEventStartTime, '09:30');
  assert.equal(state.indicatorDurationMs, 0);
  assert.deepEqual(state.sets.map((item) => item.id), ['same', 'same-2']);
});

test('active timer runtime is reset when hydrating a new app session', () => {
  const startTime = 1_000_000;
  const state = resetActiveTimerRuntime({
    status: 'running',
    running: true,
    paused: false,
    mode: 'countdown',
    durationMs: 5 * 60_000,
    startTime,
    endTime: startTime + (5 * 60_000),
    display: {
      label: 'Service Timer',
      displayUpdatedAt: 10,
    },
  });

  assert.equal(state.status, 'idle');
  assert.equal(state.running, false);
  assert.equal(state.paused, false);
  assert.equal(state.endTime, null);
  assert.equal(state.remaining, null);
  assert.equal(state.durationMs, 0);
  assert.equal(state.display.label, 'Service Timer');
});
