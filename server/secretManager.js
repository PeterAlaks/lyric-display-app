import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

let keytar = null;
try {
  ({ default: keytar } = await import('keytar').catch(() => ({ default: null })));
} catch {
  keytar = null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_NAME = 'LyricDisplay';
const ACCOUNT_NAME = 'server-secrets';
const APP_CONFIG_DIR_NAME = 'LyricDisplay';

// ---------- Paths / dirs ----------
const getDefaultConfigDir = () => {
  let homeDir;

  if (process.platform === 'win32') {
    homeDir = process.env.USERPROFILE || process.env.HOME;
  } else {
    homeDir = process.env.HOME;
  }

  if (!homeDir && typeof os.homedir === 'function') {
    try {
      homeDir = os.homedir();
    } catch (error) {
      console.warn('os.homedir() failed:', error.message);
    }
  }

  if (!homeDir) {
    console.warn('Could not determine home directory, using current working directory');
    homeDir = process.cwd();
  }

  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
    return path.join(base, APP_CONFIG_DIR_NAME, 'config');
  }

  if (process.platform === 'darwin') {
    const base = path.join(homeDir, 'Library', 'Application Support');
    return path.join(base, APP_CONFIG_DIR_NAME, 'config');
  }

  const base = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
  return path.join(base, APP_CONFIG_DIR_NAME.toLowerCase().replace(/\s+/g, '-'), 'config');
};

const keyFileName = 'secrets.key';
const encFileName = 'secrets.json';

// ---------- File helpers ----------
function ensureDir700(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  }
}

// ---------- AES-GCM encrypted file store ----------
function getKeyPath(configDir) {
  return path.join(configDir, keyFileName);
}

function getEncPath(configDir) {
  return path.join(configDir, encFileName);
}

function getOrCreateAesKey(configDir) {
  const keyPath = getKeyPath(configDir);
  if (fs.existsSync(keyPath)) {
    const key = fs.readFileSync(keyPath);
    if (key && key.length === 32) return key;
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key, { mode: 0o600 });
  return key;
}

function encryptJson(payload, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { __enc: true, iv: iv.toString('base64'), tag: tag.toString('base64'), data: enc.toString('base64') };
}


function persistEncryptedSecrets(configDir, secretsPath, secrets) {
  try {
    ensureDir700(configDir);
    const keyPath = getKeyPath(configDir);
    const key = getOrCreateAesKey(configDir);
    const wrapped = encryptJson(secrets, key);
    fs.writeFileSync(secretsPath, JSON.stringify(wrapped, null, 2), { mode: 0o600 });
    const stats = fs.existsSync(secretsPath) ? fs.statSync(secretsPath) : null;
    const modeOctal = stats ? (stats.mode & 0o777).toString(8).padStart(3, '0') : 'n/a';
    const sizeInfo = stats ? `, size ${stats.size} bytes` : '';
    console.log(`Encrypted secrets backup refreshed at ${secretsPath} (mode ${modeOctal}${sizeInfo}); key path ${keyPath}`);
    return { success: true, path: secretsPath, stats };
  } catch (error) {
    console.error(`Failed to persist encrypted secrets backup at ${secretsPath}:`, error.message);
    return { success: false, error };
  }
}

export function decryptJson(wrapped, key) {
  if (!wrapped || wrapped.__enc !== true) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(wrapped.iv, 'base64');
  const tag = Buffer.from(wrapped.tag, 'base64');
  const enc = Buffer.from(wrapped.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

export { getDefaultConfigDir };

// ---------- Secret Manager ----------
class SimpleSecretManager {
  constructor() {
    let configDir;
    if (process.env.CONFIG_PATH) {
      configDir = process.env.CONFIG_PATH;
    } else {
      configDir = getDefaultConfigDir();
    }

    this.configDir = configDir;
    this.secretsPath = getEncPath(this.configDir);

    console.log('Config directory resolved to:', this.configDir);
    console.log('Secrets path (encrypted):', this.secretsPath);
    console.log('Keytar available:', !!keytar);
  }
  ensureConfigDir() {
    ensureDir700(this.configDir);
  }

  generateJWTSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  _defaultSecrets() {
    const now = new Date().toISOString();
    return {
      JWT_SECRET: this.generateJWTSecret(),
      ADMIN_ACCESS_KEY: crypto.randomBytes(32).toString('hex'),
      TOKEN_EXPIRY: '24h',
      ADMIN_TOKEN_EXPIRY: '7d',
      RATE_LIMIT_WINDOW_MS: 900000,
      RATE_LIMIT_MAX_REQUESTS: 50,
      created: now,
      lastRotated: now,
      rotationNote: 'Rotate JWT_SECRET every 6-12 months for security'
    };
  }

  _normalizeSecrets(obj) {
    const now = new Date().toISOString();
    return {
      JWT_SECRET: obj?.JWT_SECRET || this.generateJWTSecret(),
      ADMIN_ACCESS_KEY: obj?.ADMIN_ACCESS_KEY || crypto.randomBytes(32).toString('hex'),
      TOKEN_EXPIRY: obj?.TOKEN_EXPIRY || '24h',
      ADMIN_TOKEN_EXPIRY: obj?.ADMIN_TOKEN_EXPIRY || '7d',
      RATE_LIMIT_WINDOW_MS: Number.isFinite(obj?.RATE_LIMIT_WINDOW_MS) ? obj.RATE_LIMIT_WINDOW_MS : 900000,
      RATE_LIMIT_MAX_REQUESTS: Number.isFinite(obj?.RATE_LIMIT_MAX_REQUESTS) ? obj.RATE_LIMIT_MAX_REQUESTS : 50,
      created: obj?.created || now,
      lastRotated: obj?.lastRotated || now,
      rotationNote: obj?.rotationNote || 'Rotate JWT_SECRET every 6-12 months for security',
      previousSecret: obj?.previousSecret,
      previousSecretExpiry: obj?.previousSecretExpiry
    };
  }

  async _readFromKeytar() {
    if (!keytar) return null;
    try {
      return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    } catch {
      return null;
    }
  }

  async _writeToKeytar(dataStr) {
    if (!keytar) return false;
    try {
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, dataStr);
      return true;
    } catch {
      return false;
    }
  }

  async loadSecrets() {
    try {
      const keytarData = await this._readFromKeytar();
      if (keytarData) {
        try {
          const parsed = JSON.parse(keytarData);
          const normalized = this._normalizeSecrets(parsed);
          const backupResult = persistEncryptedSecrets(this.configDir, this.secretsPath, normalized);
          if (backupResult.success) {
            console.log('Secrets loaded from keytar; encrypted backup refreshed');
          } else {
            console.warn('Secrets loaded from keytar but encrypted backup refresh failed');
          }
          return normalized;
        } catch (e) {
          console.warn('Keytar data corrupted, falling back to encrypted file');
        }
      }

      this.ensureConfigDir();

      if (fs.existsSync(this.secretsPath)) {
        const wrapped = JSON.parse(fs.readFileSync(this.secretsPath, 'utf8'));
        const key = getOrCreateAesKey(this.configDir);
        const decrypted = decryptJson(wrapped, key);
        const normalized = this._normalizeSecrets(decrypted);

        await this._writeToKeytar(JSON.stringify(normalized));

        console.log('Secrets loaded from encrypted file');
        return normalized;
      }

      const defaults = this._defaultSecrets();
      await this.saveSecrets(defaults);
      console.log('Created new encrypted secrets');
      return defaults;

    } catch (error) {
      console.error('Error loading secrets:', error.message);
      throw new Error('Failed to load secrets: ' + error.message);
    }
  }

  async saveSecrets(secrets) {
    try {
      this.ensureConfigDir();

      const normalized = this._normalizeSecrets(secrets);
      const dataStr = JSON.stringify(normalized);

      const keytarSuccess = await this._writeToKeytar(dataStr);

      const backupResult = persistEncryptedSecrets(this.configDir, this.secretsPath, normalized);
      console.log(`Secrets saved - Keytar: ${keytarSuccess ? 'yes' : 'no'}, File: ${backupResult.success ? 'yes' : 'no'}`);

      if (!backupResult.success) {
        throw backupResult.error || new Error('Failed to persist encrypted secrets backup');
      }

      return normalized;
    } catch (error) {
      console.error('Error saving secrets:', error.message);
      throw error;
    }
  }

  async rotateJWTSecret() {
    try {
      const secrets = await this.loadSecrets();
      const oldSecret = secrets.JWT_SECRET;

      secrets.JWT_SECRET = this.generateJWTSecret();
      secrets.lastRotated = new Date().toISOString();
      secrets.previousSecret = oldSecret;
      secrets.previousSecretExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await this.saveSecrets(secrets);
      return secrets;
    } catch (error) {
      console.error('Error rotating JWT secret:', error);
      throw error;
    }
  }

  async getSecretsStatus() {
    try {
      const secrets = await this.loadSecrets();
      const lastRotated = secrets.lastRotated ? new Date(secrets.lastRotated) : null;
      const lastRotatedTime = lastRotated && !Number.isNaN(lastRotated.getTime()) ? lastRotated.getTime() : null;
      const daysSinceRotation = lastRotatedTime != null
        ? Math.floor((Date.now() - lastRotatedTime) / (1000 * 60 * 60 * 24))
        : null;

      const backend = keytar ? 'keytar+encrypted-file' : 'encrypted-file';

      return {
        exists: true,
        lastRotated: secrets.lastRotated,
        daysSinceRotation,
        needsRotation: typeof daysSinceRotation === 'number' ? daysSinceRotation > 180 : false,
        configPath: this.secretsPath,
        storageBackend: backend,
        hasGraceSecret: !!(secrets.previousSecret && secrets.previousSecretExpiry)
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message,
        configPath: this.secretsPath
      };
    }
  }
}

export default SimpleSecretManager;
