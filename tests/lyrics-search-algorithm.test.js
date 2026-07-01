import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeQuery, calculateRelevanceScore, mergeResults } from '../main/lyricsProviders/searchAlgorithm.js';

test('analyzeQuery supports artist dash title order', () => {
  const analysis = analyzeQuery('John Newton - Amazing Grace');

  assert.equal(analysis.inferredArtist, 'john newton');
  assert.equal(analysis.inferredTitle, 'amazing grace');
  assert.ok(analysis.confidence >= 0.9);
});

test('analyzeQuery supports title dash artist order', () => {
  const analysis = analyzeQuery('Amazing Grace - John Newton');

  assert.equal(analysis.inferredArtist, 'john newton');
  assert.equal(analysis.inferredTitle, 'amazing grace');
  assert.ok(analysis.confidence >= 0.9);
  assert.ok(analysis.interpretations.length >= 1);
});

test('analyzeQuery returns multiple interpretations for ambiguous separators', () => {
  const analysis = analyzeQuery('Amazing Grace | John Newton');

  assert.equal(analysis.inferredArtist, 'john newton');
  assert.equal(analysis.inferredTitle, 'amazing grace');
  assert.ok(analysis.interpretations.length >= 2);
  assert.equal(analysis.interpretations[0].source, 'separator_title_artist');
});

test('analyzeQuery supports quoted title followed by artist', () => {
  const analysis = analyzeQuery('"Great Are You Lord" All Sons & Daughters');

  assert.equal(analysis.inferredArtist, 'all sons daughters');
  assert.equal(analysis.inferredTitle, 'great are you lord');
  assert.equal(analysis.interpretations[0].source, 'quoted_title_artist');
});

test('analyzeQuery keeps parenthetical version text available for scoring', () => {
  const analysis = analyzeQuery('"Way Maker" (Live) Sinach');

  assert.equal(analysis.inferredArtist, 'sinach');
  assert.equal(analysis.inferredTitle, 'way maker live');
  assert.deepEqual(analysis.versionTokens, ['live']);
});

test('analyzeQuery recognizes worship artists from the bundled artist data', () => {
  const analysis = analyzeQuery('Great Are You Lord All Sons & Daughters');

  assert.equal(analysis.inferredArtist, 'all sons daughters');
  assert.equal(analysis.inferredTitle, 'great are you lord');
});

test('analyzeQuery recognizes multi-word artists that were missing from bundled data', () => {
  const analysis = analyzeQuery('By Your Side Tenth Avenue North');

  assert.equal(analysis.inferredArtist, 'tenth avenue north');
  assert.equal(analysis.inferredTitle, 'by your side');
});

test('mergeResults ranks exact inferred artist and title above same-title covers', () => {
  const chunks = [{
    provider: { id: 'mock', displayName: 'Mock' },
    results: [
      { provider: 'lrclib', title: 'Way Maker', artist: 'Leeland' },
      { provider: 'lrclib', title: 'Way Maker', artist: 'Sinach' },
      { provider: 'openHymnal', title: 'Way Maker', artist: 'Traditional' },
    ],
  }];

  const [top] = mergeResults(chunks, { query: 'Way Maker Sinach', limit: 3 });

  assert.equal(top.title, 'Way Maker');
  assert.equal(top.artist, 'Sinach');
});

test('mergeResults does not let provider health penalties override semantic relevance', () => {
  let meta = null;
  const chunks = [{
    provider: { id: 'mock', displayName: 'Mock' },
    results: [
      { provider: 'lrclib', title: 'Way Maker', artist: 'Sinach' },
      { provider: 'lyricsOvh', title: 'Way Maker', artist: 'Leeland' },
    ],
  }];
  const penalties = new Map([['lrclib', 120000]]);

  const [top] = mergeResults(chunks, {
    query: 'Way Maker Sinach',
    limit: 2,
    providerPenalties: penalties,
    onMergeMeta: (nextMeta) => { meta = nextMeta; },
  });

  assert.equal(top.title, 'Way Maker');
  assert.equal(top.artist, 'Sinach');
  assert.equal(meta.providerPenaltiesAvailable, true);
  assert.equal(meta.providerPenaltiesApplied, false);
});

test('calculateRelevanceScore returns normalized bounded scores', () => {
  const analysis = analyzeQuery('Way Maker Sinach');
  const exact = calculateRelevanceScore(
    { provider: 'lrclib', title: 'Way Maker', artist: 'Sinach', metadata: { hasSyncedLyrics: true } },
    analysis,
  );
  const weak = calculateRelevanceScore(
    { provider: 'chartlyrics', title: 'Oceans', artist: 'Hillsong United' },
    analysis,
  );

  assert.ok(exact.score >= 0 && exact.score <= 1);
  assert.ok(weak.score >= 0 && weak.score <= 1);
  assert.ok(exact.score > weak.score);
  assert.equal(exact.isExact, true);
});

test('mergeResults treats ChartLyrics as lower-trust when relevance is otherwise tied', () => {
  const chunks = [{
    provider: { id: 'mock', displayName: 'Mock' },
    results: [
      { provider: 'chartlyrics', title: 'Way Maker', artist: 'Sinach' },
      { provider: 'lrclib', title: 'Way Maker', artist: 'Sinach' },
    ],
  }];

  const [top] = mergeResults(chunks, { query: 'Way Maker', limit: 2 });

  assert.equal(top.provider, 'lrclib');
});

test('mergeResults publishes bounded ranking diagnostics in merge metadata', () => {
  let meta = null;
  const chunks = [{
    provider: { id: 'mock', displayName: 'Mock' },
    results: [
      { provider: 'lrclib', title: 'Way Maker', artist: 'Leeland' },
      { provider: 'lrclib', title: 'Way Maker', artist: 'Sinach' },
      { provider: 'lyricsOvh', title: 'Waymaker', artist: 'Sinach' },
      { provider: 'openHymnal', title: 'Amazing Grace', artist: 'John Newton' },
      { provider: 'chartlyrics', title: 'Oceans', artist: 'Hillsong United' },
      { provider: 'lrclib', title: 'Jireh', artist: 'Elevation Worship' },
    ],
  }];

  const results = mergeResults(chunks, {
    query: 'Way Maker Sinach',
    limit: 3,
    includeDedupDropped: true,
    onMergeMeta: (nextMeta) => { meta = nextMeta; },
  });

  assert.equal(results[0].artist, 'Sinach');
  assert.equal(meta.ranking.totalCandidates, 6);
  assert.equal(meta.ranking.returnedCount, results.length);
  assert.equal(meta.ranking.topCandidates.length, 5);
  assert.equal(meta.ranking.topCandidates[0].rank, 1);
  assert.equal(meta.ranking.topCandidates[0].title, 'Way Maker');
  assert.equal(meta.ranking.topCandidates[0].artist, 'Sinach');
  assert.equal(typeof meta.ranking.topCandidates[0].score, 'number');
  assert.ok(meta.ranking.topCandidates[0].signals.exactCombinedMatch);
  assert.ok(meta.inferred.interpretations.length >= 1);
});

test('mergeResults clusters compact title duplicates from different providers', () => {
  const chunks = [{
    provider: { id: 'mock', displayName: 'Mock' },
    results: [
      { provider: 'lrclib', title: 'Way Maker', artist: 'Sinach' },
      { provider: 'lyricsOvh', title: 'Waymaker', artist: 'Sinach' },
    ],
  }];

  const results = mergeResults(chunks, { query: 'Way Maker Sinach', limit: 5, includeDedupDropped: true });

  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Way Maker');
});

test('mergeResults keeps same-title covers as distinct results', () => {
  const chunks = [{
    provider: { id: 'mock', displayName: 'Mock' },
    results: [
      { provider: 'lrclib', title: 'Way Maker', artist: 'Sinach' },
      { provider: 'lyricsOvh', title: 'Way Maker', artist: 'Leeland' },
    ],
  }];

  const results = mergeResults(chunks, { query: 'Way Maker', limit: 5 });

  assert.equal(results.length, 2);
});

test('mergeResults promotes explicit lyric text matches above unrelated metadata matches', () => {
  const chunks = [{
    provider: { id: 'mock', displayName: 'Mock' },
    results: [
      {
        provider: 'lrclib',
        title: 'Sunshine in My Soul',
        artist: 'The Mormon Tabernacle Choir',
        snippet: 'Then Sings My Soul - 3:33',
      },
      {
        provider: 'openHymnal',
        title: 'How Great Thou Art',
        artist: 'Stuart K. Hine',
        snippet: 'Then sings my soul, my Savior God, to thee; how great thou art',
        metadata: {
          searchMatch: {
            field: 'lyrics',
            score: 1,
            exactPhrase: true,
          },
        },
      },
    ],
  }];

  const [top] = mergeResults(chunks, { query: 'Then sings my soul', limit: 2 });

  assert.equal(top.provider, 'openHymnal');
  assert.equal(top.title, 'How Great Thou Art');
});

test('mergeResults prefers requested live versions over studio versions', () => {
  const chunks = [{
    provider: { id: 'mock', displayName: 'Mock' },
    results: [
      { provider: 'lrclib', title: 'Graves Into Gardens', artist: 'Elevation Worship' },
      { provider: 'lrclib', title: 'Graves Into Gardens - Live', artist: 'Elevation Worship' },
    ],
  }];

  const [top] = mergeResults(chunks, { query: 'Graves Into Gardens Elevation Worship live', limit: 2 });

  assert.equal(top.title, 'Graves Into Gardens - Live');
});

test('mergeResults lightly demotes unrequested versions for base song queries', () => {
  const chunks = [{
    provider: { id: 'mock', displayName: 'Mock' },
    results: [
      { provider: 'lrclib', title: 'Reckless Love - Acoustic', artist: 'Cory Asbury' },
      { provider: 'lrclib', title: 'Reckless Love', artist: 'Cory Asbury' },
    ],
  }];

  const [top] = mergeResults(chunks, { query: 'Reckless Love Cory Asbury', limit: 2 });

  assert.equal(top.title, 'Reckless Love');
});

test('mergeResults treats versioned and base songs as distinct dedupe groups', () => {
  const chunks = [{
    provider: { id: 'mock', displayName: 'Mock' },
    results: [
      { provider: 'lrclib', title: 'Way Maker', artist: 'Sinach' },
      { provider: 'lyricsOvh', title: 'Waymaker', artist: 'Sinach' },
      { provider: 'lrclib', title: 'Way Maker - Live', artist: 'Sinach' },
    ],
  }];

  const results = mergeResults(chunks, { query: 'Way Maker Sinach', limit: 5 });

  assert.equal(results.length, 2);
  assert.equal(results.some((item) => item.title === 'Way Maker'), true);
  assert.equal(results.some((item) => item.title === 'Way Maker - Live'), true);
});

test('mergeResults recognizes instrumental version signals from metadata', () => {
  const chunks = [{
    provider: { id: 'mock', displayName: 'Mock' },
    results: [
      { provider: 'lrclib', title: 'Oceans', artist: 'Hillsong United' },
      { provider: 'lrclib', title: 'Oceans', artist: 'Hillsong United', metadata: { instrumental: true } },
    ],
  }];

  const [top] = mergeResults(chunks, { query: 'Oceans Hillsong United instrumental', limit: 2 });

  assert.equal(top.metadata.instrumental, true);
});
