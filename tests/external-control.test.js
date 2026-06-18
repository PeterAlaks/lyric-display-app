import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSetlistItemIdByIndex } from '../src/hooks/useExternalControl.js';

const setlistFiles = [
  { id: 'setlist_first', displayName: 'First Song' },
  { id: 'setlist_second', displayName: 'Second Song' },
  { id: 'setlist_third', displayName: 'Third Song' },
];

test('external control resolves setlist load indexes to setlist item ids', () => {
  assert.equal(resolveSetlistItemIdByIndex(setlistFiles, 0), 'setlist_first');
  assert.equal(resolveSetlistItemIdByIndex(setlistFiles, 1), 'setlist_second');
  assert.equal(resolveSetlistItemIdByIndex(setlistFiles, 2), 'setlist_third');
});

test('external control floors OSC float indexes when resolving setlist items', () => {
  assert.equal(resolveSetlistItemIdByIndex(setlistFiles, 1.9), 'setlist_second');
});

test('external control ignores invalid setlist item indexes', () => {
  assert.equal(resolveSetlistItemIdByIndex(setlistFiles, -1), null);
  assert.equal(resolveSetlistItemIdByIndex(setlistFiles, 3), null);
  assert.equal(resolveSetlistItemIdByIndex(setlistFiles, Number.NaN), null);
  assert.equal(resolveSetlistItemIdByIndex(null, 0), null);
});
