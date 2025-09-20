import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const SERVICE_NAME = 'LyricDisplayAuthTokens';
const CACHE = new Map();
let keytarModule;
let keytarLoadErrorLogged = false;

const FALLBACK_SECRET_FILE = 'token-store.json';
const FALLBACK_KEY_FILE = 'token-store.key';

const resolveConfigDir = () => {
  const homeDir = typeof os.homedir === 'function' ? os.homedir() : (process.env.HOME || process.cwd());

  if (process.env.CONFIG_PATH) {
    return process.env.CONFIG_PATH;
  }

  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
    return path.join(base, 'LyricDisplay', 'auth');
  }

  if (process.platform === 'darwin') {
    const base = path.join(homeDir, 'Library', 'Application Support');
    return path.join(base, 'LyricDisplay', 'auth');
  }

  const base = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
  return path.join(base, 'lyricdisplay', 'auth');
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
    if (existing && existing.length === 32) {
      return existing;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[token-store] Failed to read fallback key, regenerating:', error.message);
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
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
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
    console.warn('[token-store] Failed to read fallback store:', error.message);
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
    if (!keytarLoadErrorLogged) {
      console.warn('[token-store] Keytar unavailable, falling back to encrypted file storage:', error.message);
      keytarLoadErrorLogged = true;
    }
  }

  return keytarModule;
};

const getAccountId = ({ clientType, deviceId }) => {
  const type = clientType || 'unknown';
  const device = deviceId || 'default';
  return `${type}:${device}`;
};

const getCacheKey = ({ clientType, deviceId }) => `${clientType || 'unknown'}::${deviceId || 'default'}`;

export const readToken = async ({ clientType, deviceId }) => {
  const cacheKey = getCacheKey({ clientType, deviceId });
  if (CACHE.has(cacheKey)) {
    return CACHE.get(cacheKey);
  }

  const keytar = await getKeytar();
  if (keytar) {
    try {
      const account = getAccountId({ clientType, deviceId });
      const raw = await keytar.getPassword(SERVICE_NAME, account);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      CACHE.set(cacheKey, parsed);
      return parsed;
    } catch (error) {
      console.warn('[token-store] Keytar read failed, retrying fallback:', error.message);
    }
  }

  const store = await readFallbackStore();
  const account = getAccountId({ clientType, deviceId });
  const encrypted = store[account];
  if (!encrypted) {
    return null;
  }

  try {
    const payload = await decryptFallbackPayload(encrypted);
    CACHE.set(cacheKey, payload);
    return payload;
  } catch (error) {
    console.error('[token-store] Failed to decrypt fallback payload:', error.message);
    return null;
  }
};

export const writeToken = async ({ clientType, deviceId, token, expiresAt }) => {
  if (!token) {
    await clearToken({ clientType, deviceId });
    return;
  }

  const payload = {
    token,
    expiresAt: typeof expiresAt === 'number' ? expiresAt : null,
    clientType: clientType || null,
    deviceId: deviceId || null,
    updatedAt: Date.now()
  };

  const cacheKey = getCacheKey({ clientType, deviceId });
  CACHE.set(cacheKey, payload);

  const keytar = await getKeytar();
  if (keytar) {
    try {
      const account = getAccountId({ clientType, deviceId });
      await keytar.setPassword(SERVICE_NAME, account, JSON.stringify(payload));
      return;
    } catch (error) {
      console.warn('[token-store] Keytar write failed, persisting to fallback:', error.message);
    }
  }

  const encrypted = await encryptFallbackPayload(payload);
  const store = await readFallbackStore();
  const account = getAccountId({ clientType, deviceId });
  store[account] = encrypted;
  await writeFallbackStore(store);
};

export const clearToken = async ({ clientType, deviceId }) => {
  const cacheKey = getCacheKey({ clientType, deviceId });
  CACHE.delete(cacheKey);

  const keytar = await getKeytar();
  if (keytar) {
    try {
      const account = getAccountId({ clientType, deviceId });
      await keytar.deletePassword(SERVICE_NAME, account);
    } catch (error) {
      console.warn('[token-store] Keytar delete failed, clearing fallback copy:', error.message);
    }
  }

  const store = await readFallbackStore();
  const account = getAccountId({ clientType, deviceId });
  if (store[account]) {
    delete store[account];
    await writeFallbackStore(store);
  }
};
