import { TTLCache } from './cache.js';
import * as lyricsOvh from './providers/lyricsOvh.js';
import * as vagalume from './providers/vagalume.js';
import * as hymnary from './providers/hymnary.js';
import * as openHymnal from './providers/openHymnal.js';
import * as lrclib from './providers/lrclib.js';
import * as chartlyrics from './providers/chartlyrics.js';
import { deleteProviderKey, getProviderKey, listProviderKeys, setProviderKey } from '../providerCredentials.js';
import { mergeResults } from './searchAlgorithm.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

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
const providerHealth = new Map();
let healthStorePath = null;
let pendingHealthSave = null;

function resolveHealthStorePath() {
  if (healthStorePath) return healthStorePath;
  const baseDir =
    process.env.LYRICDISPLAY_DATA_DIR ||
    (() => {
      try { return app?.getPath?.('userData'); } catch { return null; }
    })() ||
    process.cwd();
  healthStorePath = path.join(baseDir, 'providerHealth.json');
  return healthStorePath;
}

function loadProviderHealthFromDisk() {
  const filePath = resolveHealthStorePath();
  try {
    if (!fs.existsSync(filePath)) return;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (parsed && typeof parsed === 'object') {
      Object.entries(parsed).forEach(([providerId, stats]) => {
        if (stats && typeof stats === 'object') {
          providerHealth.set(providerId, {
            avgDuration: typeof stats.avgDuration === 'number' ? stats.avgDuration : null,
            requests: typeof stats.requests === 'number' ? stats.requests : 0,
            failures: typeof stats.failures === 'number' ? stats.failures : 0,
          });
        }
      });
    }
  } catch (err) {
    console.warn('[LyricsProvider] Failed to load provider health cache:', err?.message || err);
  }
}

function saveProviderHealthToDisk() {
  const filePath = resolveHealthStorePath();
  try {
    const data = {};
    providerHealth.forEach((stats, providerId) => {
      data[providerId] = stats;
    });
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[LyricsProvider] Failed to persist provider health cache:', err?.message || err);
  }
}

function scheduleHealthSave() {
  if (pendingHealthSave) return;
  pendingHealthSave = setTimeout(() => {
    pendingHealthSave = null;
    saveProviderHealthToDisk();
  }, 1000);
}

loadProviderHealthFromDisk();

function updateProviderHealth(providerId, { duration = null, errors = [] } = {}) {
  const prev = providerHealth.get(providerId) || {
    avgDuration: null,
    requests: 0,
    failures: 0,
  };

  const requests = prev.requests + 1;
  const failures = prev.failures + (errors.length > 0 ? 1 : 0);

  const alpha = 0.3;
  const avgDuration = duration == null
    ? prev.avgDuration
    : prev.avgDuration == null
      ? duration
      : (alpha * duration) + ((1 - alpha) * prev.avgDuration);

  const updated = { avgDuration, requests, failures };
  providerHealth.set(providerId, updated);
  scheduleHealthSave();
  return updated;
}

function computePenaltyFromHealth(stats) {
  if (!stats) return 0;

  const failureRate = stats.requests > 0 ? stats.failures / stats.requests : 0;
  const latencyMs = stats.avgDuration ?? 0;

  const latencyPenalty = latencyMs > 1200 ? Math.min(60000, (latencyMs - 1200) * 30) : 0;
  const errorPenalty = Math.min(80000, failureRate * 80000);

  return Math.round(latencyPenalty + errorPenalty);
}

function getProviderPenaltyMap() {
  const map = new Map();
  providerHealth.forEach((stats, providerId) => {
    map.set(providerId, computePenaltyFromHealth(stats));
  });
  return map;
}

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
          isSlow: false,
          hadErrors: false,
          penalty: 0,
        })),
        search: {
          fallbackApplied: false,
          thresholdApplied: null,
          knownArtistsLoaded: false,
          knownArtistsCount: 0,
          providerPenaltiesApplied: false,
          lowQualityResults: [],
        },
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
  let mergeMeta = null;
  let providerPenalties = getProviderPenaltyMap();

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

      const stats = updateProviderHealth(mod.definition.id, { duration, errors: chunk.errors });
      providerPenalties = getProviderPenaltyMap();

      if (onPartialResults) {
        completedChunks.push(chunk);
        partialMerged = mergeResults(completedChunks, {
          limit,
          query: trimmed,
          providerPenalties,
          includeDedupDroppped: true,
          onMergeMeta: (meta) => { mergeMeta = meta; },
        });
        onPartialResults({
          results: partialMerged,
          meta: {
            providers: completedChunks.map((c) => ({
              id: c.provider.id,
              displayName: c.provider.displayName,
              count: c.results.length,
              errors: c.errors,
              duration: c.duration,
              isSlow: c.duration > 3000,
              hadErrors: c.errors.length > 0,
              penalty: providerPenalties.get(c.provider.id) || 0,
              health: providerHealth.get(c.provider.id) || null,
            })),
            search: mergeMeta || undefined,
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

      updateProviderHealth(mod.definition.id, { duration, errors: chunk.errors });
      providerPenalties = getProviderPenaltyMap();

      return chunk;
    }
  });

  const chunks = await Promise.all(executions);
  const merged = mergeResults(chunks, {
    limit,
    query: trimmed,
    providerPenalties,
    includeDedupDroppped: true,
    onMergeMeta: (meta) => { mergeMeta = meta; },
  });

  const meta = {
    providers: chunks.map((chunk) => ({
      id: chunk.provider.id,
      displayName: chunk.provider.displayName,
      count: chunk.results.length,
      errors: chunk.errors,
      duration: chunk.duration,
      isSlow: chunk.duration > 3000,
      hadErrors: chunk.errors.length > 0,
      penalty: providerPenalties.get(chunk.provider.id) || 0,
      health: providerHealth.get(chunk.provider.id) || null,
    })),
    search: mergeMeta || undefined,
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

  try {
    const start = Date.now();
    const result = await mod.getLyrics({ payload }, options);
    updateProviderHealth(providerId, { duration: Date.now() - start, errors: [] });
    return result;
  } catch (error) {
    updateProviderHealth(providerId, { duration: null, errors: [error?.message || 'lyrics fetch failed'] });
    throw error;
  }
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