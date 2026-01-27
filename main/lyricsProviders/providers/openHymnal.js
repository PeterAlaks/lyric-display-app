import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Fuse from 'fuse.js';

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

const DEFAULT_DATA_PATH = path.resolve(__dirname, '../../../shared/data/openhymnal-bundle.json');
let cachedDataset = null;
let lastLoadedPath = null;
let fuse = null;

const normalizeText = (text) => (text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const splitWords = (text) => normalizeText(text).split(/\s+/).filter(Boolean);

export const loadDataset = async () => {
  const overridePath = process.env.OPEN_HYMNAL_DATA_PATH || process.env.LYRICDISPLAY_OPEN_HYMNAL_PATH || null;
  let targetPath = overridePath ? path.resolve(overridePath) : DEFAULT_DATA_PATH;

  if (process.env.NODE_ENV === 'production' && targetPath.includes('app.asar')) {
    targetPath = targetPath.replace('app.asar', 'app.asar.unpacked');
  }

  if (cachedDataset && targetPath === lastLoadedPath) {
    return cachedDataset;
  }

  try {
    console.time('openHymnal-loadDataset');
    const raw = await fs.readFile(targetPath, 'utf8');
    const data = JSON.parse(raw);
    cachedDataset = Array.isArray(data) ? data : [];
    lastLoadedPath = targetPath;

    fuse = new Fuse(cachedDataset, {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'author', weight: 0.3 },
        { name: 'topics', weight: 0.2 },
        { name: 'lyrics', weight: 0.1 },
      ],
      includeScore: true,
      threshold: 0.4,
      minMatchCharLength: 2,
      ignoreLocation: true,
      useExtendedSearch: true,
    });
    console.timeEnd('openHymnal-loadDataset');
    console.log(`[openHymnal] Loaded ${cachedDataset.length} hymns`);
  } catch (error) {
    console.warn('[openHymnal] Failed to load dataset:', error.message);
    cachedDataset = [];
    fuse = null;
    lastLoadedPath = targetPath;
  }

  return cachedDataset;
};

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
  console.time('openHymnal-search');
  if (!query || !query.trim()) {
    const dataset = await loadDataset();
    const results = dataset.slice(0, limit).map(normalizeEntry);
    console.timeEnd('openHymnal-search');
    return { results, errors: [] };
  }

  const dataset = await loadDataset();
  if (!dataset.length || !fuse) {
    console.timeEnd('openHymnal-search');
    return { results: [], errors: ['Open Hymnal dataset is unavailable.'] };
  }

  const results = fuse.search(query, { limit: Math.max(limit, 20) }).map((result) => result.item);
  const normalizedResults = results.map(normalizeEntry);

  // Fallback lyric-line matching for common queries (e.g., famous opening lines)
  const normalizedQuery = normalizeText(query);
  const queryWords = splitWords(query);
  const existingIds = new Set(normalizedResults.map((r) => r.id));
  const scoredFallbacks = [];

  if (normalizedQuery.length >= 10 && queryWords.length >= 3) {
    for (const entry of dataset) {
      const text = collectText(entry);
      const normalizedText = normalizeText(`${entry?.title || ''} ${text}`);
      let score = 0;

      if (normalizedText.includes(normalizedQuery)) {
        score = 1.0;
      } else {
        let matched = 0;
        for (const w of queryWords) {
          if (w.length < 3) continue;
          if (normalizedText.includes(w)) matched++;
        }
        score = matched / queryWords.length;
      }

      if (score >= 0.45) {
        scoredFallbacks.push({ entry, score });
      }
    }
  }

  scoredFallbacks
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .forEach(({ entry }) => {
      const normalized = normalizeEntry(entry);
      if (!existingIds.has(normalized.id)) {
        normalizedResults.push(normalized);
        existingIds.add(normalized.id);
      }
    });

  const limited = normalizedResults.slice(0, limit);
  console.timeEnd('openHymnal-search');
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
    year: target.year || null,
    content,
    sourceUrl: 'https://openhymnal.org/',
    metadata: {
      meter: target.meter || null,
      year: target.year || null,
      topics: target.topics || [],
    },
  };
}