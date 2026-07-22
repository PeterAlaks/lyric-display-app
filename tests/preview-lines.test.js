import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PREVIEW_LINE_COMMIT_WINDOW_MS,
  isPreviewLinesEnabled,
  resolvePreviewLineClick,
} from '../src/utils/previewLineInteraction.js';
import { createLyricsSessionSlice } from '../src/context/lyricsStore/lyricsSessionSlice.js';

test('Preview Lyric Lines is off by default and forced on by Live Safety', () => {
  assert.equal(isPreviewLinesEnabled({}), false);
  assert.equal(isPreviewLinesEnabled({ preferenceEnabled: true }), true);
  assert.equal(isPreviewLinesEnabled({ liveSafetyEnabled: true }), true);
});

test('clicking the live line keeps it live and clears any other preview', () => {
  assert.deepEqual(resolvePreviewLineClick({
    currentPreviewLine: 7,
    currentLiveLine: 4,
    clickedLine: 4,
    previewedAt: 1000,
    clickedAt: 1200,
  }), {
    action: 'keep-live',
    nextPreviewLine: null,
    nextPreviewedAt: null,
  });
});

test('a first line click starts preview without changing the live line', () => {
  assert.deepEqual(resolvePreviewLineClick({
    currentPreviewLine: null,
    clickedLine: 4,
    previewedAt: null,
    clickedAt: 1000,
  }), {
    action: 'preview',
    nextPreviewLine: 4,
    nextPreviewedAt: 1000,
  });
});

test('a quick second click commits the previewed line', () => {
  assert.deepEqual(resolvePreviewLineClick({
    currentPreviewLine: 4,
    clickedLine: 4,
    previewedAt: 1000,
    clickedAt: 1000 + PREVIEW_LINE_COMMIT_WINDOW_MS,
  }), {
    action: 'commit',
    nextPreviewLine: null,
    nextPreviewedAt: null,
  });
});

test('a delayed second click clears the preview instead of committing it', () => {
  assert.deepEqual(resolvePreviewLineClick({
    currentPreviewLine: 4,
    clickedLine: 4,
    previewedAt: 1000,
    clickedAt: 1001 + PREVIEW_LINE_COMMIT_WINDOW_MS,
  }), {
    action: 'clear',
    nextPreviewLine: null,
    nextPreviewedAt: null,
  });
});

test('clicking a different line moves the preview and restarts its timing window', () => {
  assert.deepEqual(resolvePreviewLineClick({
    currentPreviewLine: 4,
    clickedLine: 7,
    previewedAt: 1000,
    clickedAt: 1400,
  }), {
    action: 'preview',
    nextPreviewLine: 7,
    nextPreviewedAt: 1400,
  });
});

test('clearing the selected line also clears the shared preview state', () => {
  let state;
  const set = (update) => {
    const next = typeof update === 'function' ? update(state) : update;
    state = next === state ? state : { ...state, ...next };
  };
  state = createLyricsSessionSlice(set);

  state.selectLine(2);
  state.setPreviewLine(5);
  assert.equal(state.selectedLine, 2);
  assert.equal(state.previewLine, 5);

  state.selectLine(null);
  assert.equal(state.selectedLine, null);
  assert.equal(state.previewLine, null);
  assert.equal(state.lineStateClearRevision, 1);

  state.selectLine(null);
  assert.equal(state.lineStateClearRevision, 2);
});
