import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export const definition = {
  id: 'openHymnal',
  displayName: 'Open Hymnal',
  description: 'Bundled public-domain hymn texts sourced from the Open Hymnal Project.',
  requiresKey: false,
  homepage: 'https://openhymnal.org/',
  supportedFeatures: {
    suggestions: true,
    search: true,
    lyrics: true,
  },
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATA_PATH = path.resolve(__dirname, '../../../shared/data/openhymnal-sample.json');
let cachedDataset = null;
let lastLoadedPath = null;

const loadDataset = async () => {
  const overridePath = process.env.OPEN_HYMNAL_DATA_PATH || process.env.LYRICDISPLAY_OPEN_HYMNAL_PATH || null;
  let targetPath = overridePath ? path.resolve(overridePath) : DEFAULT_DATA_PATH;

  if (process.env.NODE_ENV === 'production' && targetPath.includes('app.asar')) {
    targetPath = targetPath.replace('app.asar', 'app.asar.unpacked');
  }

  if (cachedDataset && targetPath === lastLoadedPath) {
    return cachedDataset;
  }

  try {
    const raw = await fs.readFile(targetPath, 'utf8');
    const data = JSON.parse(raw);
    cachedDataset = Array.isArray(data) ? data : [];
    lastLoadedPath = targetPath;
  } catch (error) {
    console.warn('[openHymnal] Failed to load dataset:', error.message);
    cachedDataset = [];
    lastLoadedPath = targetPath;
  }

  return cachedDataset;
};

const normalizeText = (text) => (text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

const normalizeEntry = (entry) => {
  const firstStanza = Array.isArray(entry?.lyrics) ? entry.lyrics[0] : '';
  const snippet = typeof firstStanza === 'string' ? firstStanza.slice(0, 140) : '';
  return {
    id: `${definition.id}:${entry?.id || entry?.title}`,
    provider: definition.id,
    title: entry?.title || 'Untitled Hymn',
    artist: entry?.author || 'Traditional',
    snippet,
    payload: {
      entryId: entry?.id || entry?.title,
    },
    metadata: {
      year: entry?.year ?? null,
      meter: entry?.meter ?? null,
      topics: Array.isArray(entry?.topics) ? entry.topics : [],
    },
  };
};

const collectText = (entry) => {
  if (!entry) return '';
  const verses = Array.isArray(entry.lyrics) ? entry.lyrics : [];
  const refrain = entry?.refrain;

  const blocks = verses.map((verse) => (Array.isArray(verse) ? verse.join('\n') : verse));
  if (refrain) {
    const refrainBlock = typeof refrain === 'string' ? refrain : Array.isArray(refrain) ? refrain.join('\n') : '';
    if (refrainBlock) {
      const withRefrain = [];
      blocks.forEach((verse) => {
        withRefrain.push(verse);
        withRefrain.push(refrainBlock);
      });
      return withRefrain.join('\n\n');
    }
  }

  return blocks.join('\n\n');
};

export async function search(query, { limit = 10 } = {}) {
  if (!query || !query.trim()) {
    const dataset = await loadDataset();
    return { results: dataset.slice(0, limit).map(normalizeEntry), errors: [] };
  }

  const dataset = await loadDataset();
  if (!dataset.length) {
    return { results: [], errors: ['Open Hymnal dataset is unavailable.'] };
  }

  const normQuery = normalizeText(query);
  const matches = dataset.filter((entry) => {
    const haystack = [
      entry?.title,
      entry?.author,
      ...(Array.isArray(entry?.topics) ? entry.topics : []),
      ...(Array.isArray(entry?.lyrics) ? entry.lyrics.join(' ') : []),
    ]
      .map(normalizeText)
      .join(' ');
    return haystack.includes(normQuery) || normQuery.split(/\s+/).every((part) => haystack.includes(part));
  });

  const limited = matches.slice(0, limit).map(normalizeEntry);
  return { results: limited, errors: [] };
}

export async function getLyrics({ payload }) {
  if (!payload?.entryId) {
    throw new Error('Open Hymnal entry id missing.');
  }

  const dataset = await loadDataset();
  const target = dataset.find(
    (entry) => entry.id === payload.entryId || entry.title === payload.entryId,
  );

  if (!target) {
    throw new Error('Open Hymnal entry not found.');
  }

  const content = collectText(target);
  if (!content) {
    throw new Error('Open Hymnal entry has no lyric text.');
  }

  return {
    provider: definition.id,
    title: target.title || 'Untitled Hymn',
    artist: target.author || 'Traditional',
    content,
    sourceUrl: 'https://openhymnal.org/',
    metadata: {
      meter: target.meter || null,
      year: target.year || null,
      topics: target.topics || [],
    },
  };
}
