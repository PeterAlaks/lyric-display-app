import assert from 'node:assert/strict';
import test from 'node:test';
import { definition, getLyrics, search } from '../main/lyricsProviders/providers/chartlyrics.js';

const xmlResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  text: async () => body,
});

test('ChartLyrics is marked as a low-trust legacy provider', () => {
  assert.equal(definition.metadata.legacyHttp, true);
  assert.equal(definition.metadata.lowTrust, true);
  assert.equal(definition.metadata.trustScore, 0.5);
});

test('ChartLyrics search uses analyzed artist and title instead of splitting query in half', async () => {
  let requestedUrl = null;
  const response = await search('Way Maker Sinach', {
    limit: 5,
    fetchImpl: async (url) => {
      requestedUrl = url;
      return xmlResponse(`
        <ArrayOfSearchLyricResult>
          <SearchLyricResult>
            <LyricId>123</LyricId>
            <LyricChecksum>abc</LyricChecksum>
            <Song><![CDATA[Way Maker]]></Song>
            <Artist>Sinach</Artist>
            <SongUrl>http://example.test/song?x=1&amp;y=2</SongUrl>
          </SearchLyricResult>
        </ArrayOfSearchLyricResult>
      `);
    },
  });

  assert.ok(requestedUrl.includes('song=way%20maker'));
  assert.ok(requestedUrl.includes('artist=sinach'));
  assert.equal(response.errors.length, 0);
  assert.equal(response.results.length, 1);
  assert.equal(response.results[0].title, 'Way Maker');
  assert.equal(response.results[0].artist, 'Sinach');
  assert.equal(response.results[0].metadata.songUrl, 'http://example.test/song?x=1&y=2');
});

test('ChartLyrics search tolerates malformed or empty XML responses', async () => {
  const response = await search('Way Maker Sinach', {
    fetchImpl: async () => xmlResponse('<ArrayOfSearchLyricResult><SearchLyricResult><Song>Way Maker</Song>'),
  });

  assert.deepEqual(response.results, []);
  assert.deepEqual(response.errors, []);
});

test('ChartLyrics getLyrics parses CDATA and XML entities from lyric payloads', async () => {
  const lyric = await getLyrics({
    payload: {
      lyricId: '123',
      checksum: 'abc',
      title: 'Fallback title',
      artist: 'Fallback artist',
    },
  }, {
    fetchImpl: async () => xmlResponse(`
      <GetLyricResult>
        <LyricSong><![CDATA[Way Maker]]></LyricSong>
        <LyricArtist>Sinach &amp; Friends</LyricArtist>
        <Lyric><![CDATA[You are here &amp; moving in our midst]]></Lyric>
        <LyricUrl>http://example.test/lyrics?x=1&amp;y=2</LyricUrl>
      </GetLyricResult>
    `),
  });

  assert.equal(lyric.title, 'Way Maker');
  assert.equal(lyric.artist, 'Sinach & Friends');
  assert.equal(lyric.content, 'You are here & moving in our midst');
  assert.equal(lyric.sourceUrl, 'http://example.test/lyrics?x=1&y=2');
});

test('ChartLyrics getLyrics rejects empty lyric content', async () => {
  await assert.rejects(
    () => getLyrics({
      payload: {
        lyricId: '123',
        checksum: 'abc',
        title: 'Way Maker',
        artist: 'Sinach',
      },
    }, {
      fetchImpl: async () => xmlResponse(`
        <GetLyricResult>
          <LyricSong>Way Maker</LyricSong>
          <LyricArtist>Sinach</LyricArtist>
          <Lyric></Lyric>
        </GetLyricResult>
      `),
    }),
    /returned no lyric content/,
  );
});
