import assert from 'node:assert/strict';
import test from 'node:test';
import { getLyrics } from '../main/lyricsProviders/providers/lrclib.js';

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
  text: async () => typeof body === 'string' ? body : JSON.stringify(body),
});

test('LRCLIB getLyrics fetches by result id when lrcId is available', async () => {
  const urls = [];
  const lyric = await getLyrics({
    payload: {
      lrcId: 2589376,
      artist: 'Sinach',
      title: 'Way Maker',
    },
  }, {
    fetchImpl: async (url) => {
      urls.push(url);
      return jsonResponse({
        trackName: 'Way Maker',
        artistName: 'Sinach',
        plainLyrics: 'You are here',
        syncedLyrics: '',
        duration: 272,
        instrumental: false,
      });
    },
  });

  assert.equal(urls.length, 1);
  assert.equal(urls[0], 'https://lrclib.net/api/get/2589376');
  assert.equal(lyric.title, 'Way Maker');
  assert.equal(lyric.artist, 'Sinach');
  assert.equal(lyric.content, 'You are here');
});

test('LRCLIB getLyrics falls back to artist and title when id lookup fails', async () => {
  const urls = [];
  const lyric = await getLyrics({
    payload: {
      lrcId: 111,
      artist: 'Sinach',
      title: 'Way Maker',
      album: 'Way Maker - Single',
      duration: 272,
    },
  }, {
    fetchImpl: async (url) => {
      urls.push(url);
      if (url.endsWith('/get/111')) {
        return jsonResponse('not found', { ok: false, status: 404 });
      }
      return jsonResponse({
        trackName: 'Way Maker',
        artistName: 'Sinach',
        plainLyrics: 'I worship You',
        syncedLyrics: '',
        duration: 272,
        instrumental: false,
      });
    },
  });

  assert.equal(urls.length, 2);
  assert.equal(urls[0], 'https://lrclib.net/api/get/111');
  assert.ok(urls[1].startsWith('https://lrclib.net/api/get?'));
  assert.ok(urls[1].includes('track_name=Way+Maker'));
  assert.ok(urls[1].includes('artist_name=Sinach'));
  assert.equal(lyric.content, 'I worship You');
});
