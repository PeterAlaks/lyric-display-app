import assert from 'node:assert/strict';
import test from 'node:test';
import { getLyrics, search } from '../main/lyricsProviders/providers/openHymnal.js';
import { parseTxtContent } from '../shared/lyricsParsing.js';

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

test('Open Hymnal search promotes exact lyric phrase matches', async () => {
  const response = await search('Then sings my soul', { limit: 5 });

  assert.deepEqual(response.errors, []);
  assert.equal(response.results[0]?.title, 'How Great Thou Art');
  assert.equal(response.results[0]?.metadata?.searchMatch?.field, 'lyrics');
  assert.equal(response.results[0]?.metadata?.searchMatch?.exactPhrase, true);
  assert.match(response.results[0]?.snippet || '', /Then sings my soul/i);
});

test('Open Hymnal lyrics preserve verse and refrain structure for parsing', async () => {
  const lyric = await getLyrics({
    payload: { entryId: 'openhymnal:how-great-thou-art' },
  });

  assert.match(lyric.content, /^\[Verse 1\]/);
  assert.equal((lyric.content.match(/\[Refrain\]/g) || []).length, 4);
  assert.match(lyric.content, /\[Verse 4\]/);

  const parsed = parseTxtContent(lyric.content, { enableSplitting: false });
  const labels = parsed.sections.map((section) => section.label);

  assert.deepEqual(labels, [
    'Verse 1',
    'Refrain',
    'Verse 2',
    'Refrain',
    'Verse 3',
    'Refrain',
    'Verse 4',
    'Refrain',
  ]);
  assert.equal(parsed.processedLines[0], '[Verse 1]');
  assert.equal(parsed.processedLines[2], '[Refrain]');
});
