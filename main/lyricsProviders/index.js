import { TTLCache } from './cache.js';
import * as lyricsOvh from './providers/lyricsOvh.js';
import * as openHymnal from './providers/openHymnal.js';
import * as lrclib from './providers/lrclib.js';
import * as chartlyrics from './providers/chartlyrics.js';
import { deleteProviderKey, getProviderKey, listProviderKeys, setProviderKey } from '../providerCredentials.js';
import { mergeResults } from './searchAlgorithm.js';
import fs from 'fs';
import path from 'path';
import electron from 'electron';
import '../appIdentity.js';
import {
  computePenaltyFromHealth,
  createAbortError,
  createTimedAbortController,
  getCircuitState,
  getProviderSearchTimeout,
  normalizeSearchMode,
  recordProviderHealth,
} from './providerReliability.js';

const { app } = electron || {};

const providers = [
  openHymnal,
  lrclib,
  lyricsOvh,
  chartlyrics,
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
            consecutiveFailures: typeof stats.consecutiveFailures === 'number' ? stats.consecutiveFailures : 0,
            circuitOpenUntil: typeof stats.circuitOpenUntil === 'number' ? stats.circuitOpenUntil : null,
            lastFailureAt: typeof stats.lastFailureAt === 'number' ? stats.lastFailureAt : null,
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
  const updated = recordProviderHealth(providerHealth.get(providerId), { duration, errors });
  providerHealth.set(providerId, updated);
  scheduleHealthSave();
  return updated;
}

function getProviderPenaltyMap() {
  const map = new Map();
  const now = Date.now();
  providerHealth.forEach((stats, providerId) => {
    map.set(providerId, computePenaltyFromHealth(stats, now));
  });
  return map;
}

function buildProviderMeta(chunk, providerPenalties) {
  const health = providerHealth.get(chunk.provider.id) || null;
  const circuit = getCircuitState(health);
  return {
    id: chunk.provider.id,
    displayName: chunk.provider.displayName,
    count: chunk.results.length,
    errors: chunk.errors,
    duration: chunk.duration,
    isSlow: chunk.duration > 3000,
    hadErrors: chunk.errors.length > 0,
    penalty: providerPenalties.get(chunk.provider.id) || 0,
    health,
    skipped: Boolean(chunk.skipped),
    circuitOpenUntil: circuit.openUntil,
  };
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

export const searchAllProviders = async (query, { limit = 10, skipCache = false, signal, onPartialResults, mode } = {}) => {
  const trimmed = (query || '').trim();
  const searchMode = normalizeSearchMode({ mode, limit });
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

  if (signal?.aborted) {
    throw signal.reason || createAbortError();
  }

  const cacheKey = `${trimmed.toLowerCase()}::${limit}::${searchMode}`;
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

  const executions = providers.map(async (mod) => {
    const health = providerHealth.get(mod.definition.id) || null;
    const circuit = getCircuitState(health);
    if (circuit.open) {
      const chunk = {
        provider: mod.definition,
        results: [],
        errors: [`${mod.definition.displayName} is temporarily paused after repeated failures.`],
        duration: 0,
        skipped: true,
      };

      if (onPartialResults) {
        completedChunks.push(chunk);
        partialMerged = mergeResults(completedChunks, {
          limit,
          query: trimmed,
          providerPenalties,
          includeDedupDropped: true,
          onMergeMeta: (meta) => { mergeMeta = meta; },
        });
        onPartialResults({
          results: partialMerged,
          meta: {
            providers: completedChunks.map((c) => buildProviderMeta(c, providerPenalties)),
            search: mergeMeta || undefined,
          },
          isComplete: false,
        });
      }

      return chunk;
    }

    const startTime = Date.now();
    const providerName = mod.definition.displayName;
    const timeoutMs = getProviderSearchTimeout(mod.definition.id, searchMode);
    const timed = createTimedAbortController(signal, timeoutMs);

    try {
      const result = await mod.search(trimmed, { limit: perProviderLimit, signal: timed.signal, timeoutMs });
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

      updateProviderHealth(mod.definition.id, { duration, errors: chunk.errors });
      providerPenalties = getProviderPenaltyMap();

      if (onPartialResults) {
        completedChunks.push(chunk);
        partialMerged = mergeResults(completedChunks, {
          limit,
          query: trimmed,
          providerPenalties,
          includeDedupDropped: true,
          onMergeMeta: (meta) => { mergeMeta = meta; },
        });
        onPartialResults({
          results: partialMerged,
          meta: {
            providers: completedChunks.map((c) => buildProviderMeta(c, providerPenalties)),
            search: mergeMeta || undefined,
          },
          isComplete: false,
        });
      }

      return chunk;
    } catch (error) {
      const duration = Date.now() - startTime;
      if (error?.name === 'AbortError') {
        return {
          provider: mod.definition,
          results: [],
          errors: [],
          duration,
          aborted: true,
        };
      }

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
    } finally {
      timed.cancel();
    }
  });

  const settledChunks = await Promise.allSettled(executions);
  if (signal?.aborted) {
    throw signal.reason || createAbortError();
  }

  const chunks = settledChunks.map((settled, index) => {
    if (settled.status === 'fulfilled') {
      return settled.value;
    }

    const provider = providers[index].definition;
    const message = settled.reason?.message || 'Unknown provider error';
    console.error(`[LyricsProvider] ${provider.displayName} failed unexpectedly:`, message);
    updateProviderHealth(provider.id, { duration: null, errors: [message] });
    providerPenalties = getProviderPenaltyMap();

    return {
      provider,
      results: [],
      errors: [message],
      duration: null,
    };
  });
  const merged = mergeResults(chunks, {
    limit,
    query: trimmed,
    providerPenalties,
    includeDedupDropped: true,
    onMergeMeta: (meta) => { mergeMeta = meta; },
  });

  const meta = {
    providers: chunks.map((chunk) => buildProviderMeta(chunk, providerPenalties)),
    search: mergeMeta || undefined,
  };

  const payload = { results: merged, meta, isComplete: true };
  if (!signal?.aborted) {
    searchCache.set(cacheKey, payload);
  }
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
