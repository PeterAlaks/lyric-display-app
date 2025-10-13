const BASE_URL = 'https://api.lyrics.ovh';

export const definition = {
  id: 'lyricsOvh',
  displayName: 'Lyrics.ovh',
  description: 'Free public lyrics API powered by Deezer catalog.',
  requiresKey: false,
  homepage: 'https://lyricsovh.docs.apiary.io/',
  supportedFeatures: {
    suggestions: true,
    search: true,
    lyrics: true,
  },
};

const normalizeTrack = (item) => {
  const artist = item?.artist?.name || 'Unknown Artist';
  const title = item?.title || 'Untitled';
  const album = item?.album?.title || '';

  return {
    id: `${definition.id}:${item?.id ?? `${artist}:${title}`}`,
    provider: definition.id,
    title,
    artist,
    album,
    snippet: item?.album?.title ? `${item.album.title}` : '',
    payload: {
      artist,
      title,
    },
    metadata: {
      artistId: item?.artist?.id ?? null,
      albumId: item?.album?.id ?? null,
      deezerLink: item?.link ?? null,
    },
  };
};

export async function search(query, { limit = 10, signal, fetchImpl = fetch } = {}) {
  if (!query || !query.trim()) {
    return { results: [], errors: [] };
  }

  const url = `${BASE_URL}/suggest/${encodeURIComponent(query.trim())}`;

  try {
    const resp = await fetchImpl(url, { signal, headers: { 'User-Agent': 'LyricDisplay/1.0 (+https://lyricdisplay.app)' } });
    if (!resp.ok) {
      const message = `lyrics.ovh suggest failed with status ${resp.status}`;
      return { results: [], errors: [message] };
    }

    const data = await resp.json();
    const items = Array.isArray(data?.data) ? data.data.slice(0, limit) : [];
    const normalized = items.map(normalizeTrack);
    return { results: normalized, errors: [] };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { results: [], errors: [] };
    }
    return { results: [], errors: [error.message || 'lyrics.ovh search failed'] };
  }
}

export async function getLyrics({ payload }, { signal, fetchImpl = fetch } = {}) {
  if (!payload?.artist || !payload?.title) {
    throw new Error('lyrics.ovh requires artist and title');
  }

  const url = `${BASE_URL}/v1/${encodeURIComponent(payload.artist)}/${encodeURIComponent(payload.title)}`;

  const resp = await fetchImpl(url, { signal, headers: { 'User-Agent': 'LyricDisplay/1.0 (+https://lyricdisplay.app)' } });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`lyrics.ovh lyrics request failed: ${resp.status} ${body}`);
  }

  const json = await resp.json();
  const lyrics = (json?.lyrics || '').trim();
  if (!lyrics) {
    throw new Error('lyrics.ovh returned empty lyrics');
  }

  return {
    provider: definition.id,
    title: payload.title,
    artist: payload.artist,
    content: lyrics,
    credits: json?.credits || null,
    sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(`${payload.title} ${payload.artist} lyrics`)}`,
  };
}

