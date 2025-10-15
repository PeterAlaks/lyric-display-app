import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const SERVICE_NAME = 'LyricDisplayProviderKeys';
const CACHE = new Map();
let keytarModule;
let keytarLoadAttempted = false;

const FALLBACK_SECRET_FILE = 'provider-keys.json';
const FALLBACK_KEY_FILE = 'provider-keys.key';

const resolveConfigDir = () => {
  const homeDir = typeof os.homedir === 'function' ? os.homedir() : (process.env.HOME || process.cwd());

  if (process.env.CONFIG_PATH) {
    return process.env.CONFIG_PATH;
  }

  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
    return path.join(base, 'LyricDisplay', 'providers');
  }

  if (process.platform === 'darwin') {
    const base = path.join(homeDir, 'Library', 'Application Support');
    return path.join(base, 'LyricDisplay', 'providers');
  }

  const base = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
  return path.join(base, 'lyricdisplay', 'providers');
};

const ensureDirectory = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true, mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
};

const getFallbackPaths = () => {
  const baseDir = resolveConfigDir();
  const secretPath = path.join(baseDir, FALLBACK_SECRET_FILE);
  const keyPath = path.join(baseDir, FALLBACK_KEY_FILE);
  return { baseDir, secretPath, keyPath };
};

const getOrCreateFallbackKey = async () => {
  const { baseDir, keyPath } = getFallbackPaths();
  await ensureDirectory(baseDir);

  try {
    const existing = await fs.readFile(keyPath);
    if (existing?.length === 32) {
      return existing;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[provider-keys] Failed to read fallback key, regenerating:', error.message);
    }
  }

  const key = crypto.randomBytes(32);
  await fs.writeFile(keyPath, key, { mode: 0o600 });
  return key;
};

const encryptFallbackPayload = async (payload) => {
  const key = await getOrCreateFallbackKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(encoded), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
};

const decryptFallbackPayload = async (ciphertext) => {
  const key = await getOrCreateFallbackKey();
  const raw = Buffer.from(ciphertext, 'base64');
  const iv = raw.subarray(0, 16);
  const tag = raw.subarray(16, 32);
  const encrypted = raw.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
};

const readFallbackStore = async () => {
  const { secretPath } = getFallbackPaths();
  try {
    const contents = await fs.readFile(secretPath, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    console.warn('[provider-keys] Failed to read fallback store:', error.message);
    return {};
  }
};

const writeFallbackStore = async (store) => {
  const { baseDir, secretPath } = getFallbackPaths();
  await ensureDirectory(baseDir);
  await fs.writeFile(secretPath, JSON.stringify(store, null, 2), { mode: 0o600 });
};

const getKeytar = async () => {
  if (keytarModule !== undefined) {
    return keytarModule;
  }

  try {
    const mod = await import('keytar');
    keytarModule = mod.default ?? mod;
  } catch (error) {
    keytarModule = null;
    if (!keytarLoadAttempted) {
      keytarLoadAttempted = true;
      console.warn('[provider-keys] Keytar unavailable, using encrypted fallback storage:', error.message);
    }
  }

  return keytarModule;
};

export const getProviderKey = async (providerId) => {
  if (!providerId) return null;
  if (CACHE.has(providerId)) {
    return CACHE.get(providerId);
  }

  const keytar = await getKeytar();
  if (keytar) {
    try {
      const raw = await keytar.getPassword(SERVICE_NAME, providerId);
      if (raw) {
        CACHE.set(providerId, raw);
        return raw;
      }
    } catch (error) {
      console.warn('[provider-keys] Keytar read failed, checking fallback:', error.message);
    }
  }

  const store = await readFallbackStore();
  const encrypted = store[providerId];
  if (!encrypted) return null;

  try {
    const payload = await decryptFallbackPayload(encrypted);
    if (payload?.key) {
      CACHE.set(providerId, payload.key);
      return payload.key;
    }
  } catch (error) {
    console.error('[provider-keys] Failed to decrypt fallback payload:', error.message);
  }

  return null;
};

export const setProviderKey = async (providerId, key) => {
  if (!providerId) {
    throw new Error('providerId is required');
  }

  if (!key) {
    await deleteProviderKey(providerId);
    return;
  }

  CACHE.set(providerId, key);

  const keytar = await getKeytar();
  if (keytar) {
    try {
      await keytar.setPassword(SERVICE_NAME, providerId, key);
      return;
    } catch (error) {
      console.warn('[provider-keys] Keytar write failed, persisting fallback copy:', error.message);
    }
  }

  const payload = await encryptFallbackPayload({ key, updatedAt: Date.now() });
  const store = await readFallbackStore();
  store[providerId] = payload;
  await writeFallbackStore(store);
};

export const deleteProviderKey = async (providerId) => {
  if (!providerId) return;
  CACHE.delete(providerId);

  const keytar = await getKeytar();
  if (keytar) {
    try {
      await keytar.deletePassword(SERVICE_NAME, providerId);
    } catch (error) {
      console.warn('[provider-keys] Keytar delete failed, clearing fallback entry:', error.message);
    }
  }

  const store = await readFallbackStore();
  if (store[providerId]) {
    delete store[providerId];
    await writeFallbackStore(store);
  }
};

export const listProviderKeys = async () => {
  const result = {};

  const keytar = await getKeytar();
  if (keytar && typeof keytar.findCredentials === 'function') {
    try {
      const creds = await keytar.findCredentials(SERVICE_NAME);
      for (const { account, password } of creds) {
        if (account && password) {
          result[account] = password;
          CACHE.set(account, password);
        }
      }
      return result;
    } catch (error) {
      console.warn('[provider-keys] Keytar list failed, reading fallback store:', error.message);
    }
  }

  const store = await readFallbackStore();
  const entries = Object.entries(store || {});
  for (const [providerId, encrypted] of entries) {
    try {
      const payload = await decryptFallbackPayload(encrypted);
      if (payload?.key) {
        result[providerId] = payload.key;
        CACHE.set(providerId, payload.key);
      }
    } catch (error) {
      console.error('[provider-keys] Failed to decrypt fallback key for provider:', providerId, error.message);
    }
  }

  return result;
};

export const prewarmCredentials = async () => {
  try {
    await listProviderKeys();
    console.log('[ProviderCredentials] Keys pre-warmed in cache');
  } catch (error) {
    console.warn('[ProviderCredentials] Pre-warm failed, will load on demand:', error.message);
  }
};