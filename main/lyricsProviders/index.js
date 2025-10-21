import { TTLCache } from './cache.js';
import * as lyricsOvh from './providers/lyricsOvh.js';
import * as vagalume from './providers/vagalume.js';
import * as hymnary from './providers/hymnary.js';
import * as openHymnal from './providers/openHymnal.js';
import * as lrclib from './providers/lrclib.js';
import * as chartlyrics from './providers/chartlyrics.js';
import { deleteProviderKey, getProviderKey, listProviderKeys, setProviderKey } from '../providerCredentials.js';
import { mergeResults } from './searchAlgorithm.js';

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