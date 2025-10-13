import { getProviderKey } from '../../providerCredentials.js';

const BASE_URL = 'https://api.vagalume.com.br';

export const definition = {
  id: 'vagalume',
  displayName: 'Vagalume',
  description: 'Brazil-based catalog with international coverage; free API key available.',
  requiresKey: true,
  homepage: 'https://auth.vagalume.com.br/applications',
  supportedFeatures: {
    suggestions: true,
    search: true,
    lyrics: true,
  },
};

const makeUrl = (path, params = {}) => {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    usp.set(key, value);
  });
  return `${BASE_URL}${path}?${usp.toString()}`;
};

const normalizeDoc = (doc) => {
  const artist = doc?.band || 'Unknown Artist';
  const title = doc?.title || 'Untitled';
  return {
    id: `${definition.id}:${doc?.id ?? `${artist}:${title}`}`,
    provider: definition.id,
    title,
    artist,
    snippet: '',
    payload: {
      artist,
      title,
      musId: doc?.id || null,
    },
    metadata: {
      url: doc?.url ? `https://www.vagalume.com.br${doc.url}` : null,
      langId: doc?.langID ?? null,
    },
  };
};

export async function search(query, { limit = 10, signal, fetchImpl = fetch } = {}) {
  if (!query || !query.trim()) {
    return { results: [], errors: [] };
  }

  const trimmed = query.trim();
  const key = await getProviderKey(definition.id);

  const url = makeUrl('/search.excerpt', {
    q: trimmed,
    limit: Math.min(limit, 20),
    apikey: key || undefined,
  });

  try {
    const resp = await fetchImpl(url, { signal, headers: { 'User-Agent': 'LyricDisplay/1.0 (+https://lyricdisplay.app)' } });
    if (!resp.ok) {
      const message = `Vagalume search failed (${resp.status})`;
      return { results: [], errors: [message] };
    }
    const data = await resp.json();
    const docs = Array.isArray(data?.response?.docs) ? data.response.docs.slice(0, limit) : [];
    const normalized = docs.map(normalizeDoc);
    const errors = (!key) ? ['Vagalume lyrics require an API key to fetch full text.'] : [];
    return { results: normalized, errors };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { results: [], errors: [] };
    }
    return { results: [], errors: [error.message || 'Vagalume search failed'] };
  }
}

const extractLyricsFromPayload = (payload) => {
  if (!payload) return null;
  const mus = Array.isArray(payload?.mus) ? payload.mus : [];
  const entry = mus.find((item) => item?.text);
  if (!entry || !entry.text) return null;
  return {
    title: entry.name || payload?.art?.name || 'Unknown Title',
    artist: payload?.art?.name || 'Unknown Artist',
    content: entry.text,
  };
};

export async function getLyrics({ payload }, { signal, fetchImpl = fetch } = {}) {
  if (!payload) {
    throw new Error('Vagalume payload missing');
  }

  const key = await getProviderKey(definition.id);
  if (!key) {
    throw new Error('Vagalume API key is required to load lyrics.');
  }

  const params = payload.musId
    ? { musid: payload.musId, apikey: key }
    : { art: payload.artist, mus: payload.title, apikey: key };

  const url = makeUrl('/search.php', params);
  const resp = await fetchImpl(url, { signal, headers: { 'User-Agent': 'LyricDisplay/1.0 (+https://lyricdisplay.app)' } });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Vagalume lyrics request failed: ${resp.status} ${body}`);
  }

  const json = await resp.json();
  if (json?.type === 'notfound') {
    throw new Error('Vagalume could not find lyrics for this song.');
  }

  const data = extractLyricsFromPayload(json);
  if (!data) {
    throw new Error('Vagalume returned no lyric text.');
  }

  return {
    provider: definition.id,
    title: data.title,
    artist: data.artist,
    content: data.content,
    sourceUrl: json?.mus?.[0]?.url ? `https://www.vagalume.com.br${json.mus[0].url}` : null,
    credits: json?.mus?.[0]?.translate?.map((t) => t.lang)?.join(', ') || null,
  };
}

