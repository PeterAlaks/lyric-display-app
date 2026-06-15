import assert from 'node:assert/strict';
import test from 'node:test';
import { getLyrics, search } from '../main/lyricsProviders/providers/lyricsOvh.js';

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
  text: async () => typeof body === 'string' ? body : JSON.stringify(body),
});

test('lyrics.ovh search normalizes suggest results into selectable tracks', async () => {
  const response = await search('Way Maker Sinach', {
    limit: 1,
    fetchImpl: async () => jsonResponse({
      data: [
        {
          id: 101,
          title: 'Way Maker',
          artist: { id: 202, name: 'Sinach' },
          album: { id: 303, title: 'Way Maker - Single' },
          link: 'https://www.deezer.com/track/101',
        },
        {
          id: 404,
          title: 'Way Maker',
          artist: { name: 'Leeland' },
        },
      ],
    }),
  });

  assert.equal(response.errors.length, 0);
  assert.equal(response.results.length, 1);
  assert.equal(response.results[0].id, 'lyricsOvh:101');
  assert.equal(response.results[0].title, 'Way Maker');
  assert.equal(response.results[0].artist, 'Sinach');
  assert.equal(response.results[0].album, 'Way Maker - Single');
  assert.deepEqual(response.results[0].payload, { artist: 'Sinach', title: 'Way Maker' });
});

test('lyrics.ovh search returns provider errors without throwing', async () => {
  const response = await search('Way Maker Sinach', {
    fetchImpl: async () => jsonResponse('bad gateway', { ok: false, status: 502 }),
  });

  assert.deepEqual(response.results, []);
  assert.deepEqual(response.errors, ['lyrics.ovh suggest failed with status 502']);
});

test('lyrics.ovh getLyrics rejects missing payload fields', async () => {
  await assert.rejects(
    () => getLyrics({ payload: { artist: 'Sinach' } }),
    /requires artist and title/,
  );
});

test('lyrics.ovh getLyrics includes provider status and body on failure', async () => {
  await assert.rejects(
    () => getLyrics({
      payload: { artist: 'Sinach', title: 'Way Maker' },
    }, {
      fetchImpl: async () => jsonResponse('provider unavailable', { ok: false, status: 503 }),
    }),
    /lyrics request failed: 503 provider unavailable/,
  );
});

test('lyrics.ovh getLyrics rejects empty lyrics payloads', async () => {
  await assert.rejects(
    () => getLyrics({
      payload: { artist: 'Sinach', title: 'Way Maker' },
    }, {
      fetchImpl: async () => jsonResponse({ lyrics: '   ' }),
    }),
    /returned empty lyrics/,
  );
});

test('lyrics.ovh getLyrics returns normalized lyric documents', async () => {
  const lyric = await getLyrics({
    payload: { artist: 'Sinach', title: 'Way Maker' },
  }, {
    fetchImpl: async () => jsonResponse({ lyrics: 'You are here\nMoving in our midst', credits: 'lyrics.ovh' }),
  });

  assert.equal(lyric.provider, 'lyricsOvh');
  assert.equal(lyric.title, 'Way Maker');
  assert.equal(lyric.artist, 'Sinach');
  assert.equal(lyric.content, 'You are here\nMoving in our midst');
  assert.equal(lyric.credits, 'lyrics.ovh');
  assert.ok(lyric.sourceUrl.includes('Way%20Maker%20Sinach%20lyrics'));
});
