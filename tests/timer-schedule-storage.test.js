import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TIMER_SCHEDULE_STORAGE_KEY,
  readTimerScheduleSnapshot,
  saveTimerScheduleSnapshot,
} from '../src/utils/timerScheduleStorage.js';

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
    scheduleNotificationsEnabled: true,
    criticalSeconds: 30,
  }, storage);

  const restored = readTimerScheduleSnapshot(storage);

  assert.equal(restored.scheduleTitle, 'Visual test');
  assert.equal(restored.scheduleEventDate, '2026-07-22');
  assert.equal(restored.scheduleScheduledStartAt, 1_900_000);
  assert.equal(restored.sets.length, 2);
  assert.equal(restored.sets[1].timed, false);
  assert.equal(restored.criticalSeconds, 30);
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

test('saved timer schedules reject snapshots from unsupported future versions', () => {
  const storage = createMemoryStorage();
  storage.setItem(TIMER_SCHEDULE_STORAGE_KEY, JSON.stringify({
    version: 2,
    sets: [{ id: 'welcome', label: 'Welcome', durationMs: 60_000 }],
  }));

  assert.equal(readTimerScheduleSnapshot(storage), null);
});
