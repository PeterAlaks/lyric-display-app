// main/adminKey.js
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { resolveProductionPath } from './paths.js';

let cachedAdminKey = null;

export function getAdminKey() {
  if (cachedAdminKey) {
    return cachedAdminKey;
  }

  try {
    // Get config path using same logic as backend
    const configPath = resolveProductionPath('config');
    const secretsPath = path.join(configPath, 'secrets.json');

    if (!fs.existsSync(secretsPath)) {
      console.warn('Secrets file not found. Backend may not have started yet.');
      return null;
    }

    const secretsData = fs.readFileSync(secretsPath, 'utf8');
    const secrets = JSON.parse(secretsData);

    if (!secrets.ADMIN_ACCESS_KEY) {
      console.error('ADMIN_ACCESS_KEY not found in secrets file');
      return null;
    }

    cachedAdminKey = secrets.ADMIN_ACCESS_KEY;
    console.log('Admin key loaded successfully');
    return cachedAdminKey;

  } catch (error) {
    console.error('Failed to load admin key:', error.message);
    return null;
  }
}

export function clearAdminKeyCache() {
  cachedAdminKey = null;
}

// Retry logic for initial startup when secrets file might not exist yet
export async function getAdminKeyWithRetry(maxRetries = 5, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const key = getAdminKey();
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