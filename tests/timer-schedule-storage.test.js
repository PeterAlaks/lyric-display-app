import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TIMER_SCHEDULE_STORAGE_KEY,
  clearTimerScheduleSettings,
  readTimerScheduleSnapshot,
  saveTimerScheduleSnapshot,
} from '../src/utils/timerScheduleStorage.js';
import { normalizeTimerControlSettings } from '../src/utils/timerUtils.js';

const createMemoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

test('a loaded timer schedule survives a local save and restore cycle', () => {
  const storage = createMemoryStorage();
  saveTimerScheduleSnapshot({
    sets: [
      { id: 'welcome', label: 'Welcome', durationMs: 60_000, timed: true },
      { id: 'manual', label: 'Manual advancement', durationMs: null, timed: false },
    ],
    scheduleTitle: 'Visual test',
    scheduleEventStartTime: '09:00',
    scheduleEventDate: '2026-07-22',
    scheduleScheduledStartAt: 1_900_000,
    scheduleShowGlobalTimeDuringManualItems: false,
    scheduleNotificationsEnabled: true,
    criticalSeconds: 30,
  }, storage);

  const restored = readTimerScheduleSnapshot(storage);

  assert.equal(restored.scheduleTitle, 'Visual test');
  assert.equal(restored.scheduleEventDate, '2026-07-22');
  assert.equal(restored.scheduleScheduledStartAt, 1_900_000);
  assert.equal(restored.scheduleShowGlobalTimeDuringManualItems, false);
  assert.equal(restored.sets.length, 2);
  assert.equal(restored.sets[1].timed, false);
  assert.equal(restored.criticalSeconds, 30);
});

test('schedule snapshots preserve all schedule controls without injecting manual timer defaults', () => {
  const storage = createMemoryStorage();
  saveTimerScheduleSnapshot({
    useSets: false,
    sets: [
      { id: 'welcome', label: 'Welcome', durationMs: 60_000, timed: true },
      { id: 'manual', label: 'Open ministry', durationMs: null, timed: false },
    ],
    scheduleTitle: 'Complete persistence test',
    scheduleEventStartTime: '09:15',
    scheduleEventDate: '2026-07-26',
    scheduleScheduledStartAt: 2_000_000,
    scheduleIdealEndTime: '11:45',
    scheduleShowGlobalTimeDuringManualItems: false,
    showGlobalClockDuringPause: false,
    scheduleNotificationsEnabled: false,
    autoStartNext: false,
    indicatorEnabled: false,
    indicatorSeconds: 17,
    indicatorLabel: 'Stand by',
    warningSeconds: 75,
    criticalSeconds: 20,
    targetHourFormat: '24',
    mode: 'target',
    durationMinutes: 42,
    targetTime: '18:30',
    overrunMode: true,
  }, storage);

  const restored = readTimerScheduleSnapshot(storage);

  assert.deepEqual(restored, {
    useSets: false,
    sets: [
      {
        id: 'welcome',
        label: 'Welcome',
        durationMs: 60_000,
        timed: true,
        notes: '',
        plannedStartTime: '',
      },
      {
        id: 'manual',
        label: 'Open ministry',
        durationMs: null,
        timed: false,
        notes: '',
        plannedStartTime: '',
      },
    ],
    scheduleTitle: 'Complete persistence test',
    scheduleEventStartTime: '09:15',
    scheduleEventDate: '2026-07-26',
    scheduleScheduledStartAt: 2_000_000,
    scheduleIdealEndTime: '11:45',
    scheduleShowGlobalTimeDuringManualItems: false,
    showGlobalClockDuringPause: false,
    scheduleNotificationsEnabled: false,
    autoStartNext: false,
    indicatorEnabled: false,
    indicatorSeconds: 17,
    indicatorLabel: 'Stand by',
    warningSeconds: 75,
    criticalSeconds: 20,
    targetHourFormat: '24',
    settingsUpdatedAt: restored.settingsUpdatedAt,
  });
  assert.ok(restored.settingsUpdatedAt > 0);
  assert.equal(Object.hasOwn(restored, 'mode'), false);
  assert.equal(Object.hasOwn(restored, 'durationMinutes'), false);
  assert.equal(Object.hasOwn(restored, 'targetTime'), false);
  assert.equal(Object.hasOwn(restored, 'overrunMode'), false);
  assert.equal(Object.hasOwn(restored, 'awaitingNext'), false);

  const merged = normalizeTimerControlSettings({
    ...normalizeTimerControlSettings({
      mode: 'target',
      durationMinutes: 42,
      targetTime: '18:30',
      overrunMode: true,
    }),
    ...restored,
  });
  assert.equal(merged.mode, 'target');
  assert.equal(merged.durationMinutes, 42);
  assert.equal(merged.targetTime, '18:30');
  assert.equal(merged.overrunMode, true);
});

test('clearing a timer schedule removes its saved snapshot', () => {
  const storage = createMemoryStorage();
  saveTimerScheduleSnapshot({
    sets: [{ id: 'welcome', label: 'Welcome', durationMs: 60_000, timed: true }],
  }, storage);
  assert.ok(storage.getItem(TIMER_SCHEDULE_STORAGE_KEY));

  saveTimerScheduleSnapshot({ sets: [] }, storage);

  assert.equal(storage.getItem(TIMER_SCHEDULE_STORAGE_KEY), null);
  assert.equal(readTimerScheduleSnapshot(storage), null);
});

test('clearing a schedule preserves the last-used automation options for the next schedule', () => {
  const cleared = clearTimerScheduleSettings({
    useSets: true,
    sets: [{ id: 'welcome', label: 'Welcome', durationMs: 60_000, timed: true }],
    scheduleTitle: 'Sunday Service',
    scheduleEventStartTime: '09:00',
    scheduleEventDate: '2026-09-06',
    scheduleScheduledStartAt: 2_000_000,
    scheduleIdealEndTime: '11:00',
    autoStartNext: false,
    scheduleShowGlobalTimeDuringManualItems: false,
    showGlobalClockDuringPause: true,
    scheduleNotificationsEnabled: false,
    indicatorEnabled: false,
    indicatorSeconds: 23,
    indicatorLabel: 'Please wait',
    warningSeconds: 90,
    criticalSeconds: 15,
  }, 3_000_000);

  assert.equal(cleared.useSets, true);
  assert.deepEqual(cleared.sets, []);
  assert.equal(cleared.scheduleTitle, 'Service Schedule');
  assert.equal(cleared.scheduleEventStartTime, '');
  assert.equal(cleared.scheduleEventDate, '');
  assert.equal(cleared.scheduleScheduledStartAt, null);
  assert.equal(cleared.scheduleIdealEndTime, '');
  assert.equal(cleared.autoStartNext, false);
  assert.equal(cleared.scheduleShowGlobalTimeDuringManualItems, false);
  assert.equal(cleared.showGlobalClockDuringPause, true);
  assert.equal(cleared.scheduleNotificationsEnabled, false);
  assert.equal(cleared.indicatorEnabled, false);
  assert.equal(cleared.indicatorSeconds, 23);
  assert.equal(cleared.indicatorLabel, 'Please wait');
  assert.equal(cleared.warningSeconds, 90);
  assert.equal(cleared.criticalSeconds, 15);
  assert.equal(cleared.settingsUpdatedAt, 3_000_000);
});

test('saved timer schedules reject snapshots from unsupported future versions', () => {
  const storage = createMemoryStorage();
  storage.setItem(TIMER_SCHEDULE_STORAGE_KEY, JSON.stringify({
    version: 2,
    sets: [{ id: 'welcome', label: 'Welcome', durationMs: 60_000 }],
  }));

  assert.equal(readTimerScheduleSnapshot(storage), null);
});
