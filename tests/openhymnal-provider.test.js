import assert from 'node:assert/strict';
import test from 'node:test';
import { getLyrics, loadDataset, search } from '../main/lyricsProviders/providers/openHymnal.js';
import { parseTxtContent } from '../shared/lyricsParsing/txtParser.js';

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
  const response = await search('Morning by morning new mercies', { limit: 5 });

  assert.deepEqual(response.errors, []);
  assert.equal(response.results[0]?.title, 'Great Is Thy Faithfulness');
  assert.equal(response.results[0]?.metadata?.searchMatch?.field, 'lyrics');
  assert.equal(response.results[0]?.metadata?.searchMatch?.exactPhrase, true);
  assert.match(response.results[0]?.snippet || '', /Morning by morning new mercies/i);
});

test('Open Hymnal bundle entries each load by their own unique id', async () => {
  const dataset = await loadDataset();
  const ids = dataset.map((entry) => entry.id);

  assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), []);

  for (const entry of dataset) {
    const lyric = await getLyrics({ payload: { entryId: entry.id } });
    assert.equal(lyric.title, entry.title, entry.id);
  }
});

test('Open Hymnal bundle authors are names rather than credit-line fragments', async () => {
  const dataset = await loadDataset();
  const malformed = dataset
    .filter(({ author }) => !/^[A-Z]/.test(author || '') || /\bcirca\b|\d|^(Verses?|Stanzas?|V|St|Copyright)$/i.test(author))
    .map(({ title, author }) => `${title}: ${author}`);

  assert.deepEqual(malformed, []);
});

test('Open Hymnal bundle includes texts added to openhymnal.org after the 2014 edition', async () => {
  const response = await search('What Wondrous Love Is This', { limit: 5 });

  assert.deepEqual(response.errors, []);
  assert.equal(response.results[0]?.title, 'What Wondrous Love Is This?');

  const lyric = await getLyrics({
    payload: { entryId: 'openhymnal:from-all-thy-saints-in-warfare' },
  });

  // Propers hymn: saint-day headings and rubrics are dropped so verse labels match the hymnal's numbering.
  assert.equal((lyric.content.match(/\[Verse \d+\]/g) || []).length, 20);
  assert.doesNotMatch(lyric.content, /Insert appropriate verse|\[Nov 30\]/);
});

test('Open Hymnal lyrics preserve verse and refrain structure for parsing', async () => {
  const lyric = await getLyrics({
    payload: { entryId: 'openhymnal:great-is-thy-faithfulness' },
  });

  assert.match(lyric.content, /^\[Verse 1\]/);
  assert.equal((lyric.content.match(/\[Refrain\]/g) || []).length, 3);
  assert.match(lyric.content, /\[Verse 3\]/);

  const parsed = parseTxtContent(lyric.content, { enableSplitting: false });
  const labels = parsed.sections.map((section) => section.label);

  assert.deepEqual(labels, [
    'Verse 1',
    'Refrain',
    'Verse 2',
    'Refrain',
    'Verse 3',
    'Refrain',
  ]);
  assert.equal(parsed.processedLines[0], '[Verse 1]');
  assert.equal(parsed.processedLines[2], '[Refrain]');
});

test('Open Hymnal imports become structured songs that play the refrain after every verse', async () => {
  const { prepareLyricTextImport } = await import('../shared/documentTextExtraction.js');
  const { parseLdsongDocument } = await import('../shared/lyricsParsing/ldsong.js');
  const lyric = await getLyrics({ payload: { entryId: 'openhymnal:great-is-thy-faithfulness' } });
  const imported = prepareLyricTextImport(lyric, { providerName: 'Open Hymnal', importedOn: '2026-11-07' });
  const { document, error } = parseLdsongDocument(imported.content);

  assert.equal(imported.fileType, 'ldsong');
  assert.equal(error, null);
  assert.equal(document.metadata.title, 'Great Is Thy Faithfulness');
  assert.deepEqual(document.sections.map((section) => section.label), ['Verse 1', 'Refrain', 'Verse 2', 'Verse 3']);
  assert.deepEqual(document.arrangement, ['Verse 1', 'Refrain', 'Verse 2', 'Refrain', 'Verse 3', 'Refrain']);
});
