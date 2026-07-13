import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('cross-window timer sync never rebroadcasts the broad persisted lyrics store', async () => {
  const [appProvidersSource, sharedTimerSource] = await Promise.all([
    readFile(new URL('../src/components/AppProviders.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/hooks/useSharedTimer.js', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(appProvidersSource, /addEventListener\(\s*['"]storage['"]/);
  assert.doesNotMatch(appProvidersSource, /['"]lyrics-store['"]/);
  assert.doesNotMatch(appProvidersSource, /updateTimer(?:Display|Control)Settings/);

  assert.match(sharedTimerSource, /event\.key\s*!==\s*TIMER_STORAGE_KEY/);
  assert.match(sharedTimerSource, /addEventListener\(\s*['"]storage['"]\s*,\s*handleStorage\s*\)/);
});
