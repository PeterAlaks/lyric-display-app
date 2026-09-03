import { isValidBackendPort } from './backendPort.js';

export const RENDERER_STORAGE_SNAPSHOT_VERSION = 1;
export const MAX_RENDERER_STORAGE_ENTRIES = 512;
export const MAX_RENDERER_STORAGE_KEY_LENGTH = 1024;
export const MAX_RENDERER_STORAGE_VALUE_LENGTH = 16 * 1024 * 1024;
export const MAX_RENDERER_STORAGE_TOTAL_LENGTH = 20 * 1024 * 1024;
export const PRIMARY_RENDERER_STATE_KEY = 'lyrics-store';

const normalizeEntries = (entries) => {
  if (!Array.isArray(entries)) {
    throw new TypeError('Renderer storage entries must be an array.');
  }
  if (entries.length > MAX_RENDERER_STORAGE_ENTRIES) {
    throw new RangeError('Renderer storage contains too many entries.');
  }

  const normalized = new Map();
  let totalLength = 0;

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new TypeError('Renderer storage entries must contain key/value pairs.');
    }

    const [rawKey, rawValue] = entry;
    if (typeof rawKey !== 'string' || typeof rawValue !== 'string') {
      throw new TypeError('Renderer storage keys and values must be strings.');
    }
    if (!rawKey || rawKey.length > MAX_RENDERER_STORAGE_KEY_LENGTH) {
      throw new RangeError('Renderer storage contains an invalid key.');
    }
    if (rawValue.length > MAX_RENDERER_STORAGE_VALUE_LENGTH) {
      throw new RangeError(`Renderer storage value for "${rawKey}" is too large.`);
    }

    normalized.set(rawKey, rawValue);
  }

  const result = [...normalized.entries()];
  for (const [key, value] of result) {
    totalLength += key.length + value.length;
    if (totalLength > MAX_RENDERER_STORAGE_TOTAL_LENGTH) {
      throw new RangeError('Renderer storage exceeds the portable storage limit.');
    }
  }

  return result;
};

const normalizePort = (value) => {
  if (!isValidBackendPort(value)) {
    throw new RangeError('Renderer storage requires a valid application port.');
  }
  return Number(value);
};

const normalizeStoredSnapshot = (snapshot) => {
  if (snapshot === null || snapshot === undefined) return null;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new TypeError('The native renderer storage snapshot is invalid.');
  }
  if (snapshot.version !== RENDERER_STORAGE_SNAPSHOT_VERSION) {
    throw new RangeError('The native renderer storage snapshot version is unsupported.');
  }

  return {
    version: RENDERER_STORAGE_SNAPSHOT_VERSION,
    lastPort: normalizePort(snapshot.lastPort),
    entries: normalizeEntries(snapshot.entries),
  };
};

const hasPrimaryState = (entries) => entries.some(([key]) => key === PRIMARY_RENDERER_STATE_KEY);

export const reconcileRendererStorageSnapshot = ({
  currentPort,
  legacyEntries = [],
  storedSnapshot = null,
} = {}) => {
  try {
    const port = normalizePort(currentPort);
    const legacy = normalizeEntries(legacyEntries);
    const stored = normalizeStoredSnapshot(storedSnapshot);
    const samePort = stored?.lastPort === port;
    const legacyIsAuthoritative = !stored || (
      samePort
      && legacy.length > 0
      && (hasPrimaryState(legacy) || !hasPrimaryState(stored.entries))
    );
    const entries = legacyIsAuthoritative ? legacy : stored.entries;

    return {
      success: true,
      source: legacyIsAuthoritative ? 'legacy-origin' : 'native',
      snapshot: {
        version: RENDERER_STORAGE_SNAPSHOT_VERSION,
        lastPort: port,
        entries,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Renderer storage could not be reconciled.',
      snapshot: null,
    };
  }
};

export const applyRendererStorageMutation = (snapshot, mutation) => {
  try {
    const stored = normalizeStoredSnapshot(snapshot);
    if (!stored) throw new TypeError('Renderer storage has not been initialized.');
    if (!mutation || typeof mutation !== 'object' || Array.isArray(mutation)) {
      throw new TypeError('Renderer storage mutation is invalid.');
    }

    const entries = new Map(stored.entries);
    const key = mutation.key;
    if (typeof key !== 'string' || !key || key.length > MAX_RENDERER_STORAGE_KEY_LENGTH) {
      throw new RangeError('Renderer storage mutation contains an invalid key.');
    }

    if (mutation.type === 'set') {
      if (typeof mutation.value !== 'string') {
        throw new TypeError('Renderer storage values must be strings.');
      }
      entries.set(key, mutation.value);
    } else if (mutation.type === 'remove') {
      entries.delete(key);
    } else {
      throw new TypeError('Renderer storage mutation type is unsupported.');
    }

    return {
      success: true,
      snapshot: {
        ...stored,
        entries: normalizeEntries([...entries]),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Renderer storage mutation failed.',
      snapshot: null,
    };
  }
};
