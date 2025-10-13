import { TTLCache } from './cache.js';
import * as lyricsOvh from './providers/lyricsOvh.js';
import * as vagalume from './providers/vagalume.js';
import * as hymnary from './providers/hymnary.js';
import * as openHymnal from './providers/openHymnal.js';
import { deleteProviderKey, getProviderKey, listProviderKeys, setProviderKey } from '../providerCredentials.js';

const providers = [
  lyricsOvh,
  vagalume,
  hymnary,
  openHymnal,
];

const providerById = new Map(providers.map((mod) => [mod.definition.id, mod]));

const searchCache = new TTLCache({ max: 100, ttlMs: 45_000 });

const dedupeKey = (item) => `${item.provider}|${(item.title || '').toLowerCase()}|${(item.artist || '').toLowerCase()}`;

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

const mergeResults = (chunks, { limit }) => {
  const merged = [];
  const seen = new Set();

  const queues = chunks.map((chunk, index) => ({
    providerId: chunk.provider.id,
    priority: index,
    cursor: 0,
    items: chunk.results.map((item) => ({
      ...item,
      _providerPriority: index,
    })),
  }));

  const addItem = (item) => {
    const key = dedupeKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    merged.push(item);
    return true;
  };

  let progress = true;
  while (merged.length < limit && progress) {
    progress = false;
    for (const queue of queues) {
      if (merged.length >= limit) break;
      if (queue.cursor >= queue.items.length) continue;
      const candidate = queue.items[queue.cursor];
      queue.cursor += 1;
      if (addItem(candidate)) {
        progress = true;
      }
    }
  }

  if (merged.length >= limit) {
    return merged.slice(0, limit);
  }

  const remaining = queues
    .flatMap((queue) => queue.items)
    .sort((a, b) => {
      if (a._providerPriority !== b._providerPriority) {
        return a._providerPriority - b._providerPriority;
      }
      const titleCompare = (a.title || '').localeCompare(b.title || '');
      if (titleCompare !== 0) return titleCompare;
      return (a.artist || '').localeCompare(b.artist || '');
    });

  for (const item of remaining) {
    if (merged.length >= limit) break;
    addItem(item);
  }

  return merged.slice(0, limit);
};

export const searchAllProviders = async (query, { limit = 10, skipCache = false, signal } = {}) => {
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

  const executions = providers.map(async (mod) => {
    try {
      const result = await mod.search(trimmed, { limit: perProviderLimit, signal });
      return {
        provider: mod.definition,
        results: Array.isArray(result?.results) ? result.results : [],
        errors: Array.isArray(result?.errors) ? result.errors : [],
      };
    } catch (error) {
      return {
        provider: mod.definition,
        results: [],
        errors: [error?.message || 'Unknown provider error'],
      };
    }
  });

  const chunks = await Promise.all(executions);
  const merged = mergeResults(chunks, { limit });

  const meta = {
    providers: chunks.map((chunk) => ({
      id: chunk.provider.id,
      displayName: chunk.provider.displayName,
      count: chunk.results.length,
      errors: chunk.errors,
    })),
  };

  const payload = { results: merged, meta };
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
