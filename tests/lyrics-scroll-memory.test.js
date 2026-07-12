import assert from 'node:assert/strict';
import test from 'node:test';
import {
  armLyricsScrollRestore,
  consumeLyricsScrollRestore,
  createLyricsScrollKey,
  getRememberedLyricsScrollPosition,
  isLyricsScrollRestorePending,
  markLyricsScrollRestoreApplied,
  observeLyricsScrollResetGuard,
  rememberLyricsScrollPosition,
  resetLyricsScrollMemoryForTests,
} from '../src/utils/lyricsScrollMemory.js';

test('lyrics scroll identity prefers stable setlist and file identities', () => {
  assert.equal(createLyricsScrollKey({
    lyricsSource: { setlistItemId: 'setlist_123', filePath: 'C:\\Lyrics\\Song.txt' },
    lyricsFileName: 'Song',
  }), 'setlist:setlist_123');

  assert.equal(createLyricsScrollKey({
    lyricsSource: { filePath: 'C:\\Lyrics\\Song.txt' },
    lyricsFileName: 'Song',
  }), 'path:c:/lyrics/song.txt');

  assert.equal(createLyricsScrollKey({ lyricsFileName: 'Fallback Song' }), 'name:fallback song');
});

test('lyrics scroll restoration is armed only for the matching song and consumed once', () => {
  resetLyricsScrollMemoryForTests();
  rememberLyricsScrollPosition('control', 'setlist:song-a', 482.5);
  armLyricsScrollRestore('setlist:song-a');

  assert.equal(getRememberedLyricsScrollPosition('control', 'setlist:song-a'), 482.5);
  assert.equal(isLyricsScrollRestorePending('setlist:song-a'), true);
  assert.equal(isLyricsScrollRestorePending('setlist:song-b'), false);
  assert.equal(consumeLyricsScrollRestore('setlist:song-b'), false);
  assert.equal(consumeLyricsScrollRestore('setlist:song-a'), true);
  assert.equal(isLyricsScrollRestorePending('setlist:song-a'), false);
});

test('lyrics scroll positions are isolated by rendering scope and clamped non-negative', () => {
  resetLyricsScrollMemoryForTests();
  rememberLyricsScrollPosition('control', 'name:song', 320);
  rememberLyricsScrollPosition('compact', 'name:song', -20);

  assert.equal(getRememberedLyricsScrollPosition('control', 'name:song'), 320);
  assert.equal(getRememberedLyricsScrollPosition('compact', 'name:song'), 0);
});

test('restoration and reset guards synchronize regardless of layout/effect ordering', () => {
  resetLyricsScrollMemoryForTests();
  armLyricsScrollRestore('name:first');
  assert.equal(markLyricsScrollRestoreApplied('name:first'), true);
  assert.equal(isLyricsScrollRestorePending('name:first'), true);
  assert.equal(observeLyricsScrollResetGuard('name:first'), true);
  assert.equal(isLyricsScrollRestorePending('name:first'), false);

  armLyricsScrollRestore('name:second');
  assert.equal(observeLyricsScrollResetGuard('name:second'), true);
  assert.equal(isLyricsScrollRestorePending('name:second'), true);
  assert.equal(markLyricsScrollRestoreApplied('name:second'), true);
  assert.equal(isLyricsScrollRestorePending('name:second'), false);
});
