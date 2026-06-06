import assert from 'node:assert/strict';
import test from 'node:test';
import { getNextIntelligentAutoplayStep } from '../src/utils/timestampHelpers.js';

test('intelligent autoplay advances adjacent LRC timestamps without cumulative drift', () => {
  const lyrics = ['Yellow', 'Blue', 'White', 'Orange', 'Red'];
  const timestamps = [0, 500, 1000, 1500, 2000];
  const settings = { interval: 5, skipBlankLines: false };
  const isLineBlank = () => false;

  let currentIndex = 0;
  const steps = [];

  while (true) {
    const step = getNextIntelligentAutoplayStep({
      lyrics,
      timestamps,
      currentIndex,
      settings,
      isLineBlank
    });

    if (step.status !== 'next') break;

    steps.push({ nextIndex: step.nextIndex, delayMs: step.delayMs });
    currentIndex = step.nextIndex;
  }

  assert.deepEqual(steps, [
    { nextIndex: 1, delayMs: 5000 },
    { nextIndex: 2, delayMs: 5000 },
    { nextIndex: 3, delayMs: 5000 },
    { nextIndex: 4, delayMs: 5000 },
  ]);
});
