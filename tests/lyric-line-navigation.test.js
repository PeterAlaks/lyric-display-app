import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  findNavigableLyricLineIndex,
  isStructureTagLyricLine,
} from '../src/utils/parseLyrics.js';
import useLyricsListRows, {
  VIRTUALIZATION_THRESHOLD,
} from '../src/hooks/LyricsList/useLyricsListRows.js';

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

test('virtualized section-title rows use the small spacer height', () => {
  const lyrics = [
    '[Verse 1]',
    ...Array.from({ length: VIRTUALIZATION_THRESHOLD }, (_, index) => `Lyric ${index + 1}`),
  ];
  let rows;

  function Harness() {
    rows = useLyricsListRows({
      lyrics,
      lyricsSections: [],
      lineToSection: {},
      selectedLine: null,
      previewLine: null,
      maxLinesPerGroup: 2,
      highlightedLineIndex: null,
      searchQuery: '',
      darkMode: false,
    });
    return React.createElement('div');
  }

  renderToStaticMarkup(React.createElement(Harness));

  assert.ok(lyrics.length > VIRTUALIZATION_THRESHOLD);
  assert.equal(rows.rowHeightConfig.getRowHeight(0), 16);
  assert.equal(rows.rowHeightConfig.getRowHeight(1), 56);
});
