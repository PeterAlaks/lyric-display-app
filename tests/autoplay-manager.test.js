import assert from 'node:assert/strict';
import test from 'node:test';
import { getAutoplayStartIndex, getNextIntelligentAutoplayStep } from '../src/utils/timestampHelpers.js';

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

test('intelligent autoplay starts from the selected line when start-from-first is disabled', () => {
  const lyrics = ['First line', 'Second line', 'Third line', 'Fourth line', 'Fifth line', 'Sixth line'];
  const isLineBlank = () => false;

  assert.equal(getAutoplayStartIndex({
    lyrics,
    selectedLine: 4,
    settings: { startFromFirst: false, skipBlankLines: true },
    isLineBlank
  }), 4);

  assert.equal(getAutoplayStartIndex({
    lyrics,
    selectedLine: 4,
    settings: { startFromFirst: true, skipBlankLines: true },
    isLineBlank
  }), 0);
});

test('intelligent autoplay start index falls back to the first usable line', () => {
  const lyrics = ['', 'First line', 'Second line'];
  const isLineBlank = (line) => line === '';
  const settings = { startFromFirst: false, skipBlankLines: true };

  assert.equal(getAutoplayStartIndex({ lyrics, selectedLine: null, settings, isLineBlank }), 1);
  assert.equal(getAutoplayStartIndex({ lyrics, selectedLine: 99, settings, isLineBlank }), 1);
  assert.equal(getAutoplayStartIndex({ lyrics: ['', ''], selectedLine: null, settings, isLineBlank }), null);
});

test('intelligent autoplay resumed mid-song keeps the original LRC timeline', () => {
  const lyrics = ['First line', 'Second line', 'Third line', 'Fourth line', 'Fifth line', 'Sixth line'];
  const timestamps = [500, 900, 1700, 2500, 3100, 3800];

  const step = getNextIntelligentAutoplayStep({
    lyrics,
    timestamps,
    currentIndex: 4,
    settings: { interval: 5, skipBlankLines: true },
    isLineBlank: () => false
  });

  assert.deepEqual(step, { status: 'next', nextIndex: 5, delayMs: 7000 });
});
