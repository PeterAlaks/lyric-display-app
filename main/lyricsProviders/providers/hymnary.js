import { getProviderKey } from '../../providerCredentials.js';

const BASE_URL = 'https://hymnary.org';

export const definition = {
  id: 'hymnary',
  displayName: 'Hymnary.org',
  description: 'Historic hymn database with public-domain texts. Free API key required.',
  requiresKey: true,
  homepage: 'https://hymnary.org/help/api',
  supportedFeatures: {
    suggestions: true,
    search: true,
    lyrics: true,
  },
};

const buildUrl = (path, params = {}) => {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    usp.set(key, value);
  });
  const query = usp.toString();
  return `${BASE_URL}${path}${query ? `?${query}` : ''}`;
};

const pickRecords = (payload) => {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload?.search?.records)) return payload.search.records;
  if (Array.isArray(payload?.result?.records)) return payload.result.records;
  if (Array.isArray(payload?.results?.records)) return payload.results.records;
  if (Array.isArray(payload?.data?.records)) return payload.data.records;
  return [];
};

const normalizeRecord = (record) => {
  const hymnId = record?.id || record?.hymnary_id || record?.hymn_id || record?.text_id;
  const title = record?.title || record?.tune || record?.name || 'Untitled Hymn';
  const author = record?.author || record?.text_author || record?.composer || record?.arranger || 'Traditional';
  const firstLine = record?.first_line || record?.incipit || record?.text || '';

  return {
    id: `${definition.id}:${hymnId || title}`,
    provider: definition.id,
    title,
    artist: author,
    snippet: firstLine ? firstLine.slice(0, 140) : '',
    payload: {
      hymnId,
      title,
      author,
    },
    metadata: {
      year: record?.year || record?.publication_date || null,
      tune: record?.tune || record?.tune_name || null,
      meter: record?.meter || null,
    },
  };
};

export async function search(query, { limit = 10, signal, fetchImpl = fetch } = {}) {
  if (!query || !query.trim()) {
    return { results: [], errors: [] };
  }

  const key = await getProviderKey(definition.id);
  if (!key) {
    return { results: [], errors: ['Add your Hymnary API key to search their catalog.'] };
  }

  const url = buildUrl('/api/search', {
    q: query.trim(),
    k: key,
    m: 'texts',
    size: Math.min(limit, 20),
    format: 'json',
  });

  try {
    const resp = await fetchImpl(url, {
      signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LyricDisplay/1.0 (+https://lyricdisplay.app)',
      },
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { results: [], errors: [`Hymnary search failed (${resp.status}): ${body.slice(0, 120)}`] };
    }
    const json = await resp.json();
    const records = pickRecords(json).slice(0, limit);
    const normalized = records.map(normalizeRecord);
    return { results: normalized, errors: [] };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { results: [], errors: [] };
    }
    return { results: [], errors: [error.message || 'Hymnary search failed'] };
  }
}

const pickText = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.text === 'string') return payload.text;
  if (typeof payload?.hymn?.text === 'string') return payload.hymn.text;
  if (Array.isArray(payload?.verses)) {
    return payload.verses.map((v) => (Array.isArray(v) ? v.join('\n') : v)).join('\n\n');
  }
  if (Array.isArray(payload?.hymn?.verses)) {
    return payload.hymn.verses.map((v) => (Array.isArray(v) ? v.join('\n') : v)).join('\n\n');
  }
  return null;
};

export async function getLyrics({ payload }, { signal, fetchImpl = fetch } = {}) {
  if (!payload?.hymnId) {
    throw new Error('Hymnary requires a hymnId to fetch lyrics.');
  }

  const key = await getProviderKey(definition.id);
  if (!key) {
    throw new Error('Add your Hymnary API key before loading hymn texts.');
  }

  const url = buildUrl(`/api/text/hymn/${encodeURIComponent(payload.hymnId)}`, {
    k: key,
    format: 'json',
  });

  const resp = await fetchImpl(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'LyricDisplay/1.0 (+https://lyricdisplay.app)',
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Hymnary lyrics request failed (${resp.status}): ${body.slice(0, 120)}`);
  }

  const json = await resp.json();
  const text = pickText(json);
  if (!text) {
    throw new Error('Hymnary returned no hymn text for this selection.');
  }

  return {
    provider: definition.id,
    title: payload.title || 'Unknown Hymn',
    artist: payload.author || 'Traditional',
    content: text,
    sourceUrl: `${BASE_URL}/text/${encodeURIComponent(payload.hymnId)}`,
  };
}

