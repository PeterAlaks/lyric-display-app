import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLyricsSyncPayload } from '../src/utils/lyricsSyncPayload.js';

test('buildLyricsSyncPayload includes source content needed to add synced lyrics to setlist', () => {
  const payload = buildLyricsSyncPayload({
    lyrics: ['First line', 'Second line'],
    lyricsFileName: 'Service Song',
    rawLyricsContent: 'First line\nSecond line',
    lyricsSource: {
      content: 'First line\nSecond line',
      fileType: 'txt',
      fileName: 'Service Song.txt',
      filePath: 'C:\\lyrics\\Service Song.txt',
    },
    songMetadata: { title: 'Service Song', artists: ['Writer'] },
    lyricsTimestamps: [1000, 2000],
    lyricsEnhancedTimestamps: [[{ time: 1000, text: 'First' }], []],
    lyricsSections: [{ id: 'verse-1', label: 'Verse 1', startIndex: 0 }],
    lineToSection: { 0: 'verse-1' },
  });

  assert.deepEqual(payload, {
    lyrics: ['First line', 'Second line'],
    fileName: 'Service Song',
    rawLyricsContent: 'First line\nSecond line',
    lyricsSource: {
      content: 'First line\nSecond line',
      fileType: 'txt',
      fileName: 'Service Song.txt',
      filePath: 'C:\\lyrics\\Service Song.txt',
    },
    songMetadata: { title: 'Service Song', artists: ['Writer'] },
    lyricsTimestamps: [1000, 2000],
    lyricsEnhancedTimestamps: [[{ time: 1000, text: 'First' }], []],
    sections: [{ id: 'verse-1', label: 'Verse 1', startIndex: 0 }],
    lineToSection: { 0: 'verse-1' },
  });
});

test('buildLyricsSyncPayload falls back to caller lyrics when store has no lyrics array', () => {
  const payload = buildLyricsSyncPayload({
    lyricsFileName: 'Fallback Song',
  }, ['Fallback line']);

  assert.deepEqual(payload.lyrics, ['Fallback line']);
  assert.equal(payload.fileName, 'Fallback Song');
  assert.equal(payload.rawLyricsContent, '');
  assert.equal(payload.lyricsSource, null);
  assert.equal(payload.songMetadata, null);
  assert.deepEqual(payload.lyricsTimestamps, []);
  assert.deepEqual(payload.lyricsEnhancedTimestamps, []);
  assert.deepEqual(payload.sections, []);
  assert.deepEqual(payload.lineToSection, {});
});
