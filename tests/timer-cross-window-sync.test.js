import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('cross-window timer sync never rebroadcasts the broad persisted lyrics store', async () => {
  const [appProvidersSource, lyricsStoreSource, scheduleStorageSource, sharedTimerSource, timerControlSource, scheduleOpenSource] = await Promise.all([
    readFile(new URL('../src/components/AppProviders.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/context/LyricsStore.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/utils/timerScheduleStorage.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/hooks/useSharedTimer.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/TimerControlModule.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/bridges/ScheduleFileOpenBridge.jsx', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(appProvidersSource, /addEventListener\(\s*['"]storage['"]/);
  assert.doesNotMatch(appProvidersSource, /['"]lyrics-store['"]/);
  assert.doesNotMatch(appProvidersSource, /updateTimer(?:Display|Control)Settings/);
  assert.doesNotMatch(lyricsStoreSource, /addEventListener\(\s*['"]storage['"]/);
  assert.doesNotMatch(scheduleStorageSource, /addEventListener\(\s*['"]storage['"]/);

  assert.match(sharedTimerSource, /event\.key\s*!==\s*TIMER_STORAGE_KEY/);
  assert.match(sharedTimerSource, /addEventListener\(\s*['"]storage['"]\s*,\s*handleStorage\s*\)/);
  assert.match(timerControlSource, /event\.key\s*!==\s*TIMER_SCHEDULE_STORAGE_KEY/);
  assert.match(scheduleOpenSource, /openTimerControlWindow/);
  assert.doesNotMatch(scheduleOpenSource, /navigate\(['"]\/timer-control['"]\)\s*;\s*showToast/);

  const rejectedEmitIndex = sharedTimerSource.indexOf("if (sent === false) return latestStateRef.current;");
  const localMutationIndex = sharedTimerSource.indexOf('setTimerState(normalized);', rejectedEmitIndex);
  assert.notEqual(rejectedEmitIndex, -1);
  assert.ok(localMutationIndex > rejectedEmitIndex, 'rejected timer commands must not mutate local timer state');
});
