// main/adminKey.js
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { getDefaultConfigDir, decryptJson } from '../server/secretManager.js';

let keytar = null;
try {
  ({ default: keytar } = await import('keytar').catch(() => ({ default: null })));
} catch {
  keytar = null;
}

const SERVICE_NAME = 'LyricDisplay';
const ACCOUNT_NAME = 'server-secrets';
const ENC_FILE_NAME = 'secrets.json';
const KEY_FILE_NAME = 'secrets.key';
const LOG_PREFIX = '[adminKey]';
const adminKeyEvents = new EventEmitter();
const ADMIN_KEY_AVAILABLE_EVENT = 'available';
let lastEmittedAdminKey = null;


let cachedAdminKey = null;


function emitAdminKeyAvailable(adminKey) {
  lastEmittedAdminKey = adminKey;
  adminKeyEvents.emit(ADMIN_KEY_AVAILABLE_EVENT, adminKey);
}

export function onAdminKeyAvailable(listener) {
  adminKeyEvents.on(ADMIN_KEY_AVAILABLE_EVENT, listener);
  return () => adminKeyEvents.off(ADMIN_KEY_AVAILABLE_EVENT, listener);
}

function resolveBackupPaths() {
  const configDir = process.env.CONFIG_PATH || getDefaultConfigDir();
  return {
    configDir,
    secretsPath: path.join(configDir, ENC_FILE_NAME),
    keyPath: path.join(configDir, KEY_FILE_NAME)
  };
}

function describePath(filePath) {
  if (!fs.existsSync(filePath)) {
    return `${filePath} (missing)`;
  }
  try {
    const stats = fs.statSync(filePath);
    const mode = (stats.mode & 0o777).toString(8).padStart(3, '0');
    const sizeInfo = typeof stats.size === 'number' ? `, size ${stats.size} bytes` : '';
    return `${filePath} (mode ${mode}${sizeInfo})`;
  } catch (error) {
    return `${filePath} (stat failed: ${error.message})`;
  }
}

function readAdminKeyFromBackup(paths) {
  const { secretsPath, keyPath } = paths;

  if (!fs.existsSync(secretsPath) || !fs.existsSync(keyPath)) {
    console.warn(`${LOG_PREFIX} Encrypted backup missing: ${describePath(secretsPath)}; key: ${describePath(keyPath)}`);
    return null;
  }

  console.log(`${LOG_PREFIX} Using encrypted backup ${describePath(secretsPath)}; key ${describePath(keyPath)}`);

  try {
    const wrapped = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    const key = fs.readFileSync(keyPath);
    const decrypted = decryptJson(wrapped, key);
    const adminKey = decrypted?.ADMIN_ACCESS_KEY;
    if (!adminKey) {
      console.warn(`${LOG_PREFIX} Backup payload missing ADMIN_ACCESS_KEY`);
      return null;
    }
    console.log(`${LOG_PREFIX} Admin key loaded from encrypted backup`);
    return adminKey;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to load admin key from encrypted backup:`, error.message);
    return null;
  }
}

function parseKeytarPayload(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.ADMIN_ACCESS_KEY || null;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Keytar payload parse failed:`, error.message);
    return null;
  }
}

async function loadAdminKey() {
  const paths = resolveBackupPaths();
  console.log(`${LOG_PREFIX} Config dir resolved to ${paths.configDir}`);

  try {
    if (keytar) {
      try {
        const raw = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
        const adminKey = parseKeytarPayload(raw);
        if (adminKey) {
          console.log(`${LOG_PREFIX} Admin key loaded from keytar`);
          return adminKey;
        }
        console.warn(`${LOG_PREFIX} Keytar data unavailable or incomplete; refreshing encrypted backup`);
      } catch (error) {
        console.warn(`${LOG_PREFIX} Keytar read failed (${error.message}); attempting encrypted backup`);
      }
    } else {
      console.warn(`${LOG_PREFIX} Keytar not available in main process; relying on encrypted backup`);
    }

    const fallbackKey = readAdminKeyFromBackup(paths);
    if (!fallbackKey) {
      console.warn(`${LOG_PREFIX} Admin key backup unavailable or unreadable`);
    }
    return fallbackKey;
  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error while loading admin key:`, error);
    return null;
  }
}

export async function getAdminKey() {
  if (cachedAdminKey) {
    return cachedAdminKey;
  }

  cachedAdminKey = await loadAdminKey();
  if (cachedAdminKey) {
    console.log(`${LOG_PREFIX} Admin key loaded and cached successfully`);
    if (cachedAdminKey && cachedAdminKey !== lastEmittedAdminKey) {
      emitAdminKeyAvailable(cachedAdminKey);
    }
  } else {
    console.warn(`${LOG_PREFIX} Failed to load admin key`);
  }
  return cachedAdminKey;
}

export function clearAdminKeyCache() {
  cachedAdminKey = null;
  lastEmittedAdminKey = null;
}

export async function getAdminKeyWithRetry(maxRetries = 5, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const key = await getAdminKey();
    if (key) {
      return key;
    }

    if (attempt < maxRetries) {
      console.log(`${LOG_PREFIX} Admin key not available, retry ${attempt}/${maxRetries} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`${LOG_PREFIX} Failed to get admin key after ${maxRetries} attempts`);
  return null;
}
