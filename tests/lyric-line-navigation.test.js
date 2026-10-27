import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  findNavigableLyricLineIndex,
  isStructureTagLyricLine,
} from '../src/utils/parseLyrics.js';
import {
  findSectionJumpTarget,
  getSectionHotkey,
} from '../shared/lyricsParsing/sections.js';
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

test('section hotkeys map common song parts to letters', () => {
  assert.equal(getSectionHotkey('Verse 2'), 'V');
  assert.equal(getSectionHotkey('Chorus: Lead Vocalist'), 'C');
  assert.equal(getSectionHotkey('Refrain'), 'C');
  assert.equal(getSectionHotkey('Pre-Chorus'), 'P');
  assert.equal(getSectionHotkey('Pre Chorus 2'), 'P');
  assert.equal(getSectionHotkey('Bridge'), 'B');
  assert.equal(getSectionHotkey('Tag'), 'T');
  assert.equal(getSectionHotkey('Intro'), 'I');
  assert.equal(getSectionHotkey('Outro'), 'O');
  assert.equal(getSectionHotkey('Ending'), 'E');
  assert.equal(getSectionHotkey('Instrumental Break'), null);
});

test('section jumps go to the next matching section and wrap within the song', () => {
  const sections = [
    { id: 's0', label: 'Verse 1', startLine: 1 },
    { id: 's1', label: 'Chorus', startLine: 4 },
    { id: 's2', label: 'Verse 2', startLine: 7 },
    { id: 's3', label: 'Chorus', startLine: 10 },
    { id: 's4', label: 'Bridge', startLine: 13 },
  ];

  assert.equal(findSectionJumpTarget(sections, null, 'C')?.startLine, 4);
  assert.equal(findSectionJumpTarget(sections, 2, 'C')?.startLine, 4);
  assert.equal(findSectionJumpTarget(sections, 4, 'C')?.startLine, 10);
  assert.equal(findSectionJumpTarget(sections, 11, 'C')?.startLine, 4);
  assert.equal(findSectionJumpTarget(sections, 5, 'V')?.startLine, 7);
  assert.equal(findSectionJumpTarget(sections, 5, 'B')?.startLine, 13);
  assert.equal(findSectionJumpTarget(sections, 5, 'T'), null);
  assert.equal(findSectionJumpTarget([], 5, 'C'), null);
});
