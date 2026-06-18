import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findNavigableLyricLineIndex,
  isStructureTagLyricLine,
} from '../src/utils/lyricLineNavigation.js';

test('detects common section title lines', () => {
  assert.equal(isStructureTagLyricLine('[Verse 1]'), true);
  assert.equal(isStructureTagLyricLine('Chorus:'), true);
  assert.equal(isStructureTagLyricLine('Amazing grace'), false);
});

test('finds next lyric line while skipping section titles', () => {
  const lyrics = ['[Verse 1]', 'Amazing grace', '[Chorus]', 'How sweet the sound'];

  assert.equal(findNavigableLyricLineIndex(lyrics, 0, 1, { skipSectionTitles: true }), 1);
  assert.equal(findNavigableLyricLineIndex(lyrics, 2, 1, { skipSectionTitles: true }), 3);
  assert.equal(findNavigableLyricLineIndex(lyrics, 2, -1, { skipSectionTitles: true }), 1);
});

test('keeps section titles navigable when skipping is disabled', () => {
  const lyrics = ['[Verse 1]', 'Amazing grace'];

  assert.equal(findNavigableLyricLineIndex(lyrics, 0, 1, { skipSectionTitles: false }), 0);
});
