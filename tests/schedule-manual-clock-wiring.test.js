import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('manual-item global time remains wired from schedule creation to the time display only', async () => {
  const [
    scheduleUtilsSource,
    creatorSource,
    timerControlSource,
    scheduleOpenSource,
    scheduleStorageSource,
    sharedTimerSource,
    timerAuthoritySource,
    timeDisplaySource,
  ] = await Promise.all([
    readFile(new URL('../shared/scheduleUtils.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ScheduleCreatorWizard.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/TimerControlModule.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/bridges/ScheduleFileOpenBridge.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/utils/timerScheduleStorage.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/hooks/useSharedTimer.js', import.meta.url), 'utf8'),
    readFile(new URL('../shared/timerAuthority.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/TimeDisplay.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(scheduleUtilsSource, /showGlobalTimeDuringManualItems:\s*document\.showGlobalTimeDuringManualItems\s*!==\s*false/);
  assert.match(creatorSource, /checked=\{draft\.showGlobalTimeDuringManualItems\}/);
  assert.match(creatorSource, /updateDraft\(\{\s*showGlobalTimeDuringManualItems:\s*checked\s*\}\)/);
  assert.match(timerControlSource, /scheduleShowGlobalTimeDuringManualItems:\s*schedule\.showGlobalTimeDuringManualItems/);
  assert.doesNotMatch(timerControlSource, /shouldShowGlobalTimeForManualScheduleItem/);
  assert.match(scheduleOpenSource, /scheduleShowGlobalTimeDuringManualItems:\s*schedule\.showGlobalTimeDuringManualItems/);
  assert.match(scheduleStorageSource, /scheduleShowGlobalTimeDuringManualItems:\s*settings\.scheduleShowGlobalTimeDuringManualItems/);
  assert.match(sharedTimerSource, /scheduleShowGlobalTimeDuringManualItems:\s*options\.scheduleShowGlobalTimeDuringManualItems\s*!==\s*false/);
  assert.match(timerAuthoritySource, /scheduleShowGlobalTimeDuringManualItems:\s*incomingState\.scheduleShowGlobalTimeDuringManualItems\s*!==\s*false/);
  assert.match(timeDisplaySource, /shouldShowGlobalTimeForManualScheduleItem\(timerState\)/);
});
