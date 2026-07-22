import assert from 'node:assert/strict';
import test from 'node:test';
import { getEmphasisToggleStateClassName } from '../src/utils/emphasisToggleStyles.js';

test('emphasis toggles use matching active states in dark and light themes', () => {
  assert.match(getEmphasisToggleStateClassName(true, true), /!bg-white/);
  assert.match(getEmphasisToggleStateClassName(true, true), /!text-gray-900/);
  assert.match(getEmphasisToggleStateClassName(true, false), /!bg-black/);
  assert.match(getEmphasisToggleStateClassName(true, false), /!text-white/);
});

test('emphasis toggles use matching inactive states in dark and light themes', () => {
  assert.match(getEmphasisToggleStateClassName(false, true), /!bg-transparent/);
  assert.match(getEmphasisToggleStateClassName(false, true), /!border-gray-600/);
  assert.match(getEmphasisToggleStateClassName(false, false), /!bg-transparent/);
  assert.match(getEmphasisToggleStateClassName(false, false), /!border-gray-300/);
});
