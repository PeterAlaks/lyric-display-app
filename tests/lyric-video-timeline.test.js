import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getActiveLyricVideoLine,
  timestampCsToMs,
} from '../src/utils/lyricVideoTimeline.js';

const lyrics = ['Intro', 'Verse', 'Chorus'];
const timestamps = [100, 250, 500];

test('converts centisecond timestamps to milliseconds', () => {
  assert.equal(timestampCsToMs(123), 1230);
  assert.equal(timestampCsToMs(null), null);
});

test('finds active line from audio time', () => {
  const result = getActiveLyricVideoLine({
    lyrics,
    timestamps,
    currentTimeMs: 2600,
    clearAfterMs: 5000,
  });

  assert.equal(result.activeIndex, 1);
  assert.equal(result.activeLine, 'Verse');
  assert.equal(result.nextIndex, 2);
  assert.equal(result.inGap, false);
  assert.equal(result.progressToNext > 0, true);
});

test('positive offset advances the lyric timeline', () => {
  const result = getActiveLyricVideoLine({
    lyrics,
    timestamps,
    currentTimeMs: 500,
    offsetMs: 600,
  });

  assert.equal(result.activeIndex, 0);
});

test('returns no active line when timestamps are missing', () => {
  const result = getActiveLyricVideoLine({
    lyrics,
    timestamps: [null, null, null],
    currentTimeMs: 3000,
  });

  assert.deepEqual(result, {
    activeIndex: null,
    activeLine: null,
    nextIndex: null,
    progressToNext: 0,
    inGap: false,
    gapMs: 0,
  });
});

test('clears between lines after clearAfterMs for background-only gaps', () => {
  const result = getActiveLyricVideoLine({
    lyrics,
    timestamps,
    currentTimeMs: 1800,
    gapBehavior: 'background-only',
    clearAfterMs: 500,
  });

  assert.equal(result.activeIndex, null);
  assert.equal(result.activeLine, null);
  assert.equal(result.nextIndex, 1);
  assert.equal(result.inGap, true);
  assert.equal(result.gapMs, 300);
});

test('keeps previous line during gaps when requested', () => {
  const result = getActiveLyricVideoLine({
    lyrics,
    timestamps,
    currentTimeMs: 1800,
    gapBehavior: 'keep-previous-line',
    clearAfterMs: 500,
  });

  assert.equal(result.activeIndex, 0);
  assert.equal(result.activeLine, 'Intro');
  assert.equal(result.inGap, true);
});

test('seeking before first lyric reports next index only', () => {
  const result = getActiveLyricVideoLine({
    lyrics,
    timestamps,
    currentTimeMs: 250,
  });

  assert.equal(result.activeIndex, null);
  assert.equal(result.nextIndex, 0);
  assert.equal(result.progressToNext, 0);
});

test('seeking after last lyric can clear the last line', () => {
  const result = getActiveLyricVideoLine({
    lyrics,
    timestamps,
    currentTimeMs: 9000,
    clearAfterMs: 1000,
  });

  assert.equal(result.activeIndex, null);
  assert.equal(result.activeLine, null);
  assert.equal(result.nextIndex, null);
  assert.equal(result.progressToNext, 1);
  assert.equal(result.inGap, true);
});

test('duplicate and null timestamps resolve deterministically', () => {
  const result = getActiveLyricVideoLine({
    lyrics: ['First', 'Duplicate', 'Untimed', 'Next'],
    timestamps: [100, 100, null, 200],
    currentTimeMs: 1000,
    clearAfterMs: 5000,
  });

  assert.equal(result.activeIndex, 1);
  assert.equal(result.activeLine, 'Duplicate');
  assert.equal(result.nextIndex, 3);
});
