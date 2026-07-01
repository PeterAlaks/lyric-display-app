import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Fuse from 'fuse.js';
import { isStructureTag } from '../../../shared/lyricsParsing/structureTags.js';

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
const STRUCTURED_METADATA_KEYS = new Set(['id', 'title', 'author', 'year', 'meter', 'topics', 'lyrics']);
const REPEATABLE_SECTION_KEYS = new Set(['chorus', 'refrain', 'hook']);
const STRUCTURE_KEY_LABELS = new Map([
  ['adlib', 'Adlibs'],
  ['adlibs', 'Adlibs'],
  ['backingvocals', 'Backing Vocals'],
  ['break', 'Break'],
  ['bridge', 'Bridge'],
  ['chorus', 'Chorus'],
  ['coda', 'Coda'],
  ['endingchorus', 'Ending Chorus'],
  ['finalchorus', 'Final Chorus'],
  ['hook', 'Hook'],
  ['instrumental', 'Instrumental'],
  ['interlude', 'Interlude'],
  ['intro', 'Intro'],
  ['outro', 'Outro'],
  ['outrochorus', 'Outro Chorus'],
  ['postchorus', 'Post-Chorus'],
  ['posthook', 'Post-Hook'],
  ['prechorus', 'Pre-Chorus'],
  ['prehook', 'Pre-Hook'],
  ['rap', 'Rap'],
  ['rapverse', 'Rap Verse'],
  ['refrain', 'Refrain'],
  ['solo', 'Solo'],
  ['spoken', 'Spoken'],
  ['vamp', 'Vamp'],
]);

const buildSearchHaystack = (entry) => normalizeText([
  entry?.title,
  entry?.author,
  Array.isArray(entry?.topics) ? entry.topics.join(' ') : '',
].filter(Boolean).join(' '));

const isAcceptableSpecificMatch = ({ item, score }, normalizedQuery, queryWords) => {
  if (normalizedQuery.length < 4 || queryWords.length > 2) return true;

  const haystack = buildSearchHaystack(item);
  if (haystack.includes(normalizedQuery)) return true;
  if (queryWords.some((word) => word.length >= 4 && haystack.split(/\s+/).includes(word))) return true;

  return Number(score) <= 0.2;
};

const normalizeStructureKey = (key) => String(key || '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, '')
  .toLowerCase();

const getStructuredSectionLabel = (key) => {
  const label = STRUCTURE_KEY_LABELS.get(normalizeStructureKey(key));
  if (!label) return null;
  return isStructureTag(`[${label}]`) ? label : null;
};

const normalizeLyricBlock = (block) => {
  if (Array.isArray(block)) {
    return block
      .map((line) => String(line || '').trim())
      .filter(Boolean)
      .join('\n');
  }

  return String(block || '').trim();
};

const collectStructuredSections = (entry) => {
  if (!entry) return [];

  const verseBlocks = Array.isArray(entry.lyrics)
    ? entry.lyrics.map(normalizeLyricBlock).filter(Boolean)
    : [];
  const sections = [];
  const repeatedSections = [];
  const trailingSections = [];

  Object.entries(entry).forEach(([key, value]) => {
    if (STRUCTURED_METADATA_KEYS.has(key)) return;

    const label = getStructuredSectionLabel(key);
    if (!label) return;

    const blocks = Array.isArray(value)
      ? value.map(normalizeLyricBlock).filter(Boolean)
      : [normalizeLyricBlock(value)].filter(Boolean);

    blocks.forEach((content, index) => {
      const section = {
        label: blocks.length > 1 ? `${label} ${index + 1}` : label,
        content,
      };
      const normalizedKey = normalizeStructureKey(key);
      if (REPEATABLE_SECTION_KEYS.has(normalizedKey)) {
        repeatedSections.push(section);
      } else {
        trailingSections.push(section);
      }
    });
  });

  verseBlocks.forEach((content, index) => {
    sections.push({
      label: `Verse ${index + 1}`,
      content,
    });
    sections.push(...repeatedSections);
  });

  if (verseBlocks.length === 0) {
    sections.push(...repeatedSections);
  }

  sections.push(...trailingSections);
  return sections;
};

const formatTaggedSections = (sections = []) => sections
  .map(({ label, content }) => `[${label}]\n${content}`)
  .filter(Boolean)
  .join('\n\n');

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

const buildMatchedSnippet = (entry, query = '') => {
  const content = collectText(entry).replace(/\s+/g, ' ').trim();
  const trimmedQuery = String(query || '').trim();
  if (!content || !trimmedQuery) return '';

  const index = content.toLowerCase().indexOf(trimmedQuery.toLowerCase());
  if (index === -1) return '';

  const start = Math.max(0, index - 45);
  const end = Math.min(content.length, index + trimmedQuery.length + 95);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';
  return `${prefix}${content.slice(start, end)}${suffix}`;
};

const normalizeEntry = (entry, match = null) => {
  const firstStanza = Array.isArray(entry?.lyrics) ? entry.lyrics[0] : '';
  const matchedSnippet = match?.query ? buildMatchedSnippet(entry, match.query) : '';
  const snippet = matchedSnippet || (typeof firstStanza === 'string' ? firstStanza.slice(0, 140) : '');
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
      ...(match ? {
        searchMatch: {
          field: match.field,
          score: match.score,
          exactPhrase: Boolean(match.exactPhrase),
        },
      } : {}),
    },
  };
};

const collectText = (entry) => {
  const structured = formatTaggedSections(collectStructuredSections(entry));
  if (structured) return structured;

  const verses = Array.isArray(entry?.lyrics) ? entry.lyrics : [];
  return verses.map(normalizeLyricBlock).filter(Boolean).join('\n\n');
};

const scoreLyricMatch = (entry, normalizedQuery, queryWords) => {
  if (normalizedQuery.length < 4) return null;

  const lyricsText = collectText(entry);
  if (!lyricsText) return null;

  const normalizedLyrics = normalizeText(lyricsText);
  if (normalizedLyrics.includes(normalizedQuery)) {
    return {
      field: 'lyrics',
      score: 1,
      exactPhrase: true,
    };
  }

  if (normalizedQuery.length < 10 || queryWords.length < 3) return null;

  const searchableWords = queryWords.filter((word) => word.length >= 3);
  if (searchableWords.length < 3) return null;

  let matchedWords = 0;
  for (const word of searchableWords) {
    if (normalizedLyrics.includes(word)) {
      matchedWords++;
    }
  }

  const ratio = matchedWords / searchableWords.length;
  if (ratio < 0.65) return null;

  return {
    field: 'lyrics',
    score: 0.45 + (ratio * 0.25),
    exactPhrase: false,
  };
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

  const normalizedQuery = normalizeText(query);
  const queryWords = splitWords(query);
  const scoredResults = new Map();
  const addScoredResult = (entry, match) => {
    const key = entry?.id || entry?.title;
    if (!key) return;

    const existing = scoredResults.get(key);
    if (!existing || match.score > existing.match.score) {
      scoredResults.set(key, { entry, match });
    }
  };

  fuse
    .search(query, { limit: Math.max(limit, 20) })
    .filter((result) => isAcceptableSpecificMatch(result, normalizedQuery, queryWords))
    .forEach((result) => {
      const fuseScore = Number.isFinite(result.score) ? result.score : 1;
      addScoredResult(result.item, {
        field: 'metadata',
        score: Math.max(0.05, 0.55 - (fuseScore * 0.5)),
        exactPhrase: false,
        query,
      });
    });

  for (const entry of dataset) {
    const lyricMatch = scoreLyricMatch(entry, normalizedQuery, queryWords);
    if (lyricMatch) {
      addScoredResult(entry, { ...lyricMatch, query });
    }
  }

  const limited = Array.from(scoredResults.values())
    .sort((a, b) => {
      const exactPhraseDelta = Number(Boolean(b.match.exactPhrase)) - Number(Boolean(a.match.exactPhrase));
      if (exactPhraseDelta !== 0) return exactPhraseDelta;
      const scoreDelta = b.match.score - a.match.score;
      if (scoreDelta !== 0) return scoreDelta;
      return String(a.entry?.title || '').localeCompare(String(b.entry?.title || ''));
    })
    .slice(0, limit)
    .map(({ entry, match }) => normalizeEntry(entry, match));
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
