import { TTLCache } from './cache.js';
import { EventEmitter } from 'events';
import * as lyricsOvh from './providers/lyricsOvh.js';
import * as vagalume from './providers/vagalume.js';
import * as hymnary from './providers/hymnary.js';
import * as openHymnal from './providers/openHymnal.js';
import * as lrclib from './providers/lrclib.js';
import * as chartlyrics from './providers/chartlyrics.js';
import { deleteProviderKey, getProviderKey, listProviderKeys, setProviderKey } from '../providerCredentials.js';

let knownArtistsList = [];
try {
  const module = await import('../../shared/data/knownArtists.json', {
    with: { type: 'json' },
  });
  knownArtistsList = module.default;
} catch (err) {
  console.error('Failed to load knownArtists.json:', err);
}

function analyzeQuery(query) {
  const normalized = query.toLowerCase().trim();

  if (!normalized) {
    return {
      rawQuery: query,
      normalizedQuery: normalized,
      words: [],
      inferredArtist: null,
      inferredTitle: null,
      stopWords: new Set(['the', 'a', 'an', 'of', 'to', 'in', 'by', 'with', 'for']),
    };
  }

  let inferredArtist = null;
  let inferredTitle = null;
  if (normalized.includes(' by ')) {
    const parts = normalized.split(' by ');
    inferredTitle = parts[0].trim();
    inferredArtist = parts.slice(1).join(' by ').trim();
  } else if (normalized.includes(' - ')) {
    const parts = normalized.split(' - ');
    inferredTitle = parts[0].trim();
    inferredArtist = parts.slice(1).join(' - ').trim();
  }

  const words = normalized.split(/\s+/);

  const knownArtists = knownArtistsList.map(a => a.toLowerCase());

  if (!inferredTitle || !inferredArtist) {
    if (words.length >= 2) {
      for (const knownArtist of knownArtists) {
        if (normalized.includes(knownArtist)) {
          inferredArtist = knownArtist;
          const artistWords = knownArtist.split(/\s+/);
          const remainingWords = words.filter(w => !artistWords.includes(w));
          inferredTitle = remainingWords.join(' ');
          break;
        }
      }
    }
  }

  if (!inferredTitle) {
    inferredTitle = normalized;
  }

  return {
    rawQuery: query,
    normalizedQuery: normalized,
    words,
    inferredArtist,
    inferredTitle,
    stopWords: new Set(['the', 'a', 'an', 'of', 'to', 'in', 'by', 'with', 'for']),
  };
}

function levenshteinDistance(str1, str2, maxDistance = 10) {
  const len1 = str1.length;
  const len2 = str2.length;

  if (Math.abs(len1 - len2) > maxDistance) {
    return maxDistance + 1;
  }

  let prev = Array(len2 + 1).fill(0).map((_, i) => i);

  for (let i = 1; i <= len1; i++) {
    let curr = [i];

    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }

    if (Math.min(...curr) > maxDistance) {
      return maxDistance + 1;
    }

    prev = curr;
  }

  return prev[len2];
}

function fuzzyMatch(str1, str2, similarityThreshold = 0.8) {
  const maxLen = Math.max(str1.length, str2.length);

  if (str1 === str2) return 1.0;

  if (maxLen < 3 || Math.abs(str1.length - str2.length) > maxLen * 0.5) {
    return 0;
  }

  const maxDistance = Math.ceil(maxLen * (1 - similarityThreshold));
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase(), maxDistance);

  if (distance > maxDistance) return 0;

  const similarity = 1 - (distance / maxLen);
  return similarity >= similarityThreshold ? similarity : 0;
}

function bigramSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Set();
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1[i] + s1[i + 1]);
  }

  let matches = 0;
  const total = s2.length - 1;

  for (let i = 0; i < total; i++) {
    if (bigrams1.has(s2[i] + s2[i + 1])) {
      matches++;
    }
  }

  return total > 0 ? matches / total : 0;
}

function calculateRelevanceScore(item, queryAnalysis) {
  const { normalizedQuery, words, inferredArtist, inferredTitle, stopWords } = queryAnalysis;

  const titleLower = (item.title || '').toLowerCase().trim();
  const artistLower = (item.artist || '').toLowerCase().trim();

  let score = 0;
  const signals = {};

  let isExact = false;

  if (titleLower === normalizedQuery) {
    isExact = true;
    return { score: 1000000, signals: { exactTitleMatch: true }, isExact };
  }
  if (artistLower === normalizedQuery) {
    isExact = true;
    return { score: 900000, signals: { exactArtistMatch: true }, isExact };
  }

  const titleContains = titleLower.includes(normalizedQuery);
  const artistContains = artistLower.includes(normalizedQuery);

  if (titleContains) {
    score += 100000;
    signals.titleContainsQuery = true;
  }
  if (artistContains) {
    score += 80000;
    signals.artistContainsQuery = true;
  }

  if (inferredTitle && inferredArtist) {
    if (Math.abs(titleLower.length - inferredTitle.length) < 5) {
      const titleMatch = fuzzyMatch(titleLower, inferredTitle, 0.75);
      if (titleMatch > 0) {
        score += 300000 * titleMatch;
        signals.titleInferredMatch = titleMatch;
      }
    }

    if (Math.abs(artistLower.length - inferredArtist.length) < 5) {
      const artistMatch = fuzzyMatch(artistLower, inferredArtist, 0.75);
      if (artistMatch > 0) {
        score += 200000 * artistMatch;
        signals.artistInferredMatch = artistMatch;
      }
    }

    if (signals.titleInferredMatch >= 0.9 && signals.artistInferredMatch >= 0.9) {
      isExact = true;
    }
  } else if (inferredTitle && !inferredArtist && signals.titleInferredMatch >= 0.95) {

    isExact = true;
  }

  const meaningfulWords = words.filter(w => !stopWords.has(w) && w.length >= 3);

  if (meaningfulWords.length > 0) {
    let titleWordMatches = 0;
    let artistWordMatches = 0;

    for (const word of meaningfulWords) {
      if (titleLower.includes(word)) titleWordMatches++;
      if (artistLower.includes(word)) artistWordMatches++;
    }

    const wordMatchRatio = titleWordMatches / meaningfulWords.length;

    if (wordMatchRatio > 0.5) {
      score += 10000 * wordMatchRatio;
      signals.wordMatches = { titleWordMatches, artistWordMatches, ratio: wordMatchRatio };
    }
  }

  if (score < 50000) {
    const titleBigram = bigramSimilarity(titleLower, normalizedQuery);
    const artistBigram = bigramSimilarity(artistLower, normalizedQuery);

    if (titleBigram > 0.3) {
      score += 20000 * titleBigram;
      signals.titleBigramMatch = titleBigram;
    }
    if (artistBigram > 0.3) {
      score += 15000 * artistBigram;
      signals.artistBigramMatch = artistBigram;
    }
  }

  const queryHasYear = /202[0-5]|201[0-9]/.test(normalizedQuery);
  if (queryHasYear && item.provider === 'lrclib') {
    score += 5000;
    signals.modernContentBoost = true;
  }

  const queryHasHymnIndicator = /hymn|traditional|praise/i.test(normalizedQuery);
  if (queryHasHymnIndicator && (item.provider === 'openHymnal' || item.provider === 'hymnary')) {
    score += 5000;
    signals.traditionalContentBoost = true;
  }

  const positionPenalty = (item._resultIndex || 0) * -100;
  score += positionPenalty;

  return { score, signals, isExact };
}

const providers = [
  openHymnal,
  lrclib,
  lyricsOvh,
  chartlyrics,
  vagalume,
  hymnary,
];

const providerById = new Map(providers.map((mod) => [mod.definition.id, mod]));

const searchCache = new TTLCache({ max: 100, ttlMs: 45_000 });

export const getProviderDefinitions = async () => {
  const keys = await listProviderKeys();
  return providers.map((mod) => {
    const definition = mod.definition;
    return {
      ...definition,
      configured: definition.requiresKey ? Boolean(keys?.[definition.id]) : true,
      metadata: {
        ...(definition.metadata || {}),
      },
    };
  });
};

const mergeResults = (chunks, { limit, query }) => {
  const merged = [];
  const seen = new Set();

  const queryAnalysis = analyzeQuery(query);
  const scoredResults = [];

  chunks.forEach((chunk, providerIndex) => {
    chunk.results.forEach((item, resultIndex) => {
      const { score, signals, isExact } = calculateRelevanceScore(
        { ...item, _resultIndex: resultIndex },
        queryAnalysis
      );

      scoredResults.push({
        item,
        score,
        signals,
        isExact,
        providerIndex,
      });
    });
  });

  scoredResults.sort((a, b) => b.score - a.score);

  if (process.env.NODE_ENV === 'development' && scoredResults.length > 0) {
    console.log(`\n[LyricsSearch] Query: "${query}"`);
    console.log('[LyricsSearch] Inferred:', queryAnalysis.inferredTitle, 'by', queryAnalysis.inferredArtist);
    console.log('[LyricsSearch] Top 5 results:');
    scoredResults.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.score.toFixed(0)}] ${r.item.title} - ${r.item.artist} (${r.item.provider})`);
      console.log(`     Signals:`, r.signals);
      console.log(`     isExact:`, r.isExact);
    });
  }

  const dedupeKey = (scored) => {
    const item = scored.item;
    const baseKey = `${(item.title || '').toLowerCase().trim()}|${(item.artist || '').toLowerCase().trim()}`;
    return scored.isExact ? `${baseKey}|${item.provider}` : baseKey;
  };

  for (const scored of scoredResults) {
    if (merged.length >= limit) break;

    const key = dedupeKey(scored);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(scored.item);
    }
  }

  return merged;
};

export const searchAllProviders = async (query, { limit = 10, skipCache = false, signal, onPartialResults } = {}) => {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return {
      results: [],
      meta: {
        providers: providers.map((mod) => ({
          id: mod.definition.id,
          displayName: mod.definition.displayName,
          count: 0,
          errors: [],
        })),
      },
    };
  }

  const cacheKey = `${trimmed.toLowerCase()}::${limit}`;
  if (!skipCache) {
    const cached = searchCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const perProviderLimit = Math.min(Math.max(limit, 5), 15);
  const completedChunks = [];
  let partialMerged = [];

  const executions = providers.map(async (mod, index) => {
    const startTime = Date.now();
    const providerName = mod.definition.displayName;

    try {
      const result = await mod.search(trimmed, { limit: perProviderLimit, signal });
      const duration = Date.now() - startTime;

      if (duration > 3000) {
        console.warn(`[LyricsProvider] ${providerName} search took ${duration}ms (SLOW)`);
      } else if (duration > 1000) {
        console.log(`[LyricsProvider] ${providerName} search took ${duration}ms`);
      }

      const chunk = {
        provider: mod.definition,
        results: Array.isArray(result?.results)
          ? result.results.map(r => ({ ...r, searchQuery: trimmed }))
          : [],
        errors: Array.isArray(result?.errors) ? result.errors : [],
        duration,
      };

      if (onPartialResults) {
        completedChunks.push(chunk);
        partialMerged = mergeResults(completedChunks, { limit, query: trimmed });
        onPartialResults({
          results: partialMerged,
          meta: {
            providers: completedChunks.map((c) => ({
              id: c.provider.id,
              displayName: c.provider.displayName,
              count: c.results.length,
              errors: c.errors,
              duration: c.duration,
            })),
          },
          isComplete: false,
        });
      }

      return chunk;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[LyricsProvider] ${providerName} failed after ${duration}ms:`, error.message);

      const chunk = {
        provider: mod.definition,
        results: [],
        errors: [error?.message || 'Unknown provider error'],
        duration,
      };

      if (onPartialResults) {
        completedChunks.push(chunk);
      }

      return chunk;
    }
  });

  const chunks = await Promise.all(executions);
  const merged = mergeResults(chunks, { limit, query: trimmed });

  const meta = {
    providers: chunks.map((chunk) => ({
      id: chunk.provider.id,
      displayName: chunk.provider.displayName,
      count: chunk.results.length,
      errors: chunk.errors,
      duration: chunk.duration,
    })),
  };

  const payload = { results: merged, meta, isComplete: true };
  searchCache.set(cacheKey, payload);
  return payload;
};

export const fetchLyricsByProvider = async (providerId, payload, options = {}) => {
  if (!providerById.has(providerId)) {
    throw new Error(`Unknown lyrics provider: ${providerId}`);
  }

  const mod = providerById.get(providerId);
  if (mod.definition.requiresKey) {
    const key = await getProviderKey(providerId);
    if (!key) {
      throw new Error(`${mod.definition.displayName} API key is missing.`);
    }
  }

  return mod.getLyrics({ payload }, options);
};

export const saveProviderKey = async (providerId, key) => {
  if (!providerById.has(providerId)) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  await setProviderKey(providerId, key);
};

export const removeProviderKey = async (providerId) => {
  if (!providerById.has(providerId)) return;
  await deleteProviderKey(providerId);
};

export const getProviderKeyState = async (providerId) => {
  if (!providerById.has(providerId)) return null;
  const key = await getProviderKey(providerId);
  return key || null;
};