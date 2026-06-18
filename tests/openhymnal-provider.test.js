import assert from 'node:assert/strict';
import test from 'node:test';
import { search } from '../main/lyricsProviders/providers/openHymnal.js';

test('Open Hymnal search does not surface weak fuzzy matches for specific non-hymn queries', async () => {
  const response = await search('Obinasom', { limit: 5 });

  assert.deepEqual(response.errors, []);
  assert.equal(response.results.length, 0);
});

test('Open Hymnal search still returns direct hymn title matches', async () => {
  const response = await search('Amazing Grace', { limit: 5 });

  assert.deepEqual(response.errors, []);
  assert.ok(response.results.some((result) => result.title === 'Amazing Grace'));
});
