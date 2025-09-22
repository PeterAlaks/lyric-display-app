// main/adminKey.js
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { getDefaultConfigDir, decryptJson } from '../server/secretManager.js';

let keytar = null;
try {
  // Try to import keytar in main process
  ({ default: keytar } = await import('keytar').catch(() => ({ default: null })));
} catch {
  keytar = null;
}

const SERVICE_NAME = 'LyricDisplay';
const ACCOUNT_NAME = 'server-secrets';

let cachedAdminKey = null;

async function loadAdminKey() {
  try {
    // Try keytar first
    if (keytar) {
      try {
        const keytarData = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
        if (keytarData) {
          const parsed = JSON.parse(keytarData);
          console.log('Admin key loaded from keytar (main process)');
          return parsed.ADMIN_ACCESS_KEY;
        }
      } catch (keytarError) {
        console.warn('Keytar read failed in main process, falling back to file:', keytarError.message);
      }
    }

    // Fall back to encrypted file
    const configDir = process.env.CONFIG_PATH || getDefaultConfigDir();
    const secretsPath = path.join(configDir, 'secrets.json');
    const keyPath = path.join(configDir, 'secrets.key');

    console.log('Main process config dir:', configDir);
    console.log('Secrets file exists:', fs.existsSync(secretsPath));
    console.log('Key file exists:', fs.existsSync(keyPath));

    if (!fs.existsSync(secretsPath) || !fs.existsSync(keyPath)) {
      console.log('Admin key files missing');
      return null;
    }

    const wrapped = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    const key = fs.readFileSync(keyPath);
    const decrypted = decryptJson(wrapped, key);
    console.log('Admin key loaded from encrypted file (main process)');
    return decrypted.ADMIN_ACCESS_KEY;

  } catch (error) {
    console.error('Failed to load admin key in main process:', error.message);
    return null;
  }
}

export async function getAdminKey() {
  if (cachedAdminKey) {
    return cachedAdminKey;
  }

  cachedAdminKey = await loadAdminKey();
  if (cachedAdminKey) {
    console.log('Admin key loaded and cached successfully');
  } else {
    console.log('Failed to load admin key');
  }
  return cachedAdminKey;
}

export function clearAdminKeyCache() {
  cachedAdminKey = null;
}

export async function getAdminKeyWithRetry(maxRetries = 5, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const key = await getAdminKey();
    if (key) {
      return key;
    }

    if (attempt < maxRetries) {
      console.log(`Admin key not available, retry ${attempt}/${maxRetries} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error('Failed to get admin key after', maxRetries, 'attempts');
  return null;
}