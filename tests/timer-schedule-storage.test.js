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
    scheduleNotificationsEnabled: true,
    criticalSeconds: 30,
  }, storage);

  const restored = readTimerScheduleSnapshot(storage);

  assert.equal(restored.scheduleTitle, 'Visual test');
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
