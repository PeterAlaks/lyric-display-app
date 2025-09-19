// server/secretManager.js
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_CONFIG_DIR_NAME = 'LyricDisplay';

const getDefaultConfigDir = () => {
  const homeDir = typeof os.homedir === 'function' ? os.homedir() : (process.env.HOME || process.cwd());

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


class SimpleSecretManager {
  constructor() {
    const legacyConfigDir = path.join(__dirname, '..', 'config');
    const legacySecretsPath = path.join(legacyConfigDir, 'secrets.json');

    let configDir;
    if (process.env.CONFIG_PATH) {
      configDir = process.env.CONFIG_PATH;
    } else {
      const secureDir = getDefaultConfigDir();
      const secureSecretsPath = path.join(secureDir, 'secrets.json');

      if (fs.existsSync(legacySecretsPath)) {
        try {
          if (!fs.existsSync(path.dirname(secureSecretsPath))) {
            fs.mkdirSync(path.dirname(secureSecretsPath), { recursive: true, mode: 0o700 });
          }
          fs.copyFileSync(legacySecretsPath, secureSecretsPath);
          fs.unlinkSync(legacySecretsPath);
          console.log('Migrated secrets to secure directory:', secureSecretsPath);
        } catch (migrationError) {
          console.error('Failed to migrate legacy secrets file:', migrationError);
        }
      }

      configDir = secureDir;
    }

    this.secretsPath = path.join(configDir, 'secrets.json');
    console.log('Secrets path:', this.secretsPath);
    this.ensureSecretsDirectory();
  }

  ensureSecretsDirectory() {
    const configDir = path.dirname(this.secretsPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    }
  }

  generateJWTSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  loadSecrets() {
    try {
      if (!fs.existsSync(this.secretsPath)) {
        console.log('No secrets file found, creating with new JWT secret...');
        return this.createDefaultSecrets();
      }

      const secretsData = fs.readFileSync(this.secretsPath, 'utf8');
      const secrets = JSON.parse(secretsData);

      // Validate required secrets exist
      if (!secrets.JWT_SECRET) {
        console.warn('JWT_SECRET missing from secrets file, generating new one...');
        secrets.JWT_SECRET = this.generateJWTSecret();
        this.saveSecrets(secrets);
      }

      console.log('✅ Secrets loaded successfully');
      return secrets;

    } catch (error) {
      console.error('❌ Error loading secrets:', error.message);
      console.log('Creating new secrets file...');
      return this.createDefaultSecrets();
    }
  }

  createDefaultSecrets() {
    const defaultSecrets = {
      JWT_SECRET: this.generateJWTSecret(),
      ADMIN_ACCESS_KEY: crypto.randomBytes(32).toString('hex'),
      TOKEN_EXPIRY: '24h',
      ADMIN_TOKEN_EXPIRY: '7d',
      RATE_LIMIT_WINDOW_MS: 900000,
      RATE_LIMIT_MAX_REQUESTS: 50,
      created: new Date().toISOString(),
      lastRotated: new Date().toISOString(),
      rotationNote: "Rotate JWT_SECRET every 6-12 months for security"
    };

    this.saveSecrets(defaultSecrets);
    return defaultSecrets;
  }

  saveSecrets(secrets) {
    try {
      const secretsData = JSON.stringify(secrets, null, 2);
      fs.writeFileSync(this.secretsPath, secretsData, { mode: 0o600 });
      console.log('✅ Secrets saved successfully');
    } catch (error) {
      console.error('❌ Error saving secrets:', error.message);
      throw error;
    }
  }

  rotateJWTSecret() {
    try {
      const secrets = this.loadSecrets();
      const oldSecret = secrets.JWT_SECRET;

      secrets.JWT_SECRET = this.generateJWTSecret();
      secrets.lastRotated = new Date().toISOString();
      secrets.previousSecret = oldSecret; // Keep old secret for 24h grace period
      secrets.previousSecretExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      this.saveSecrets(secrets);

      console.log('✅ JWT Secret rotated successfully');
      console.log('⚠️  Server restart required for changes to take effect');
      console.log('⚠️  Old tokens will remain valid for 24 hours');

      return secrets;
    } catch (error) {
      console.error('❌ Error rotating JWT secret:', error);
      throw error;
    }
  }

  validateSecret(token, secrets) {
    try {
      // Try current secret first
      return jwt.verify(token, secrets.JWT_SECRET);
    } catch (error) {
      // If current secret fails and we have a previous secret within grace period
      if (secrets.previousSecret && secrets.previousSecretExpiry) {
        const graceExpiry = new Date(secrets.previousSecretExpiry);
        if (new Date() < graceExpiry) {
          try {
            return jwt.verify(token, secrets.previousSecret);
          } catch (previousError) {
            throw error; // Throw original error
          }
        }
      }
      throw error;
    }
  }

  getSecretsStatus() {
    try {
      const secrets = this.loadSecrets();
      const lastRotated = new Date(secrets.lastRotated);
      const daysSinceRotation = Math.floor((Date.now() - lastRotated.getTime()) / (1000 * 60 * 60 * 24));

      return {
        exists: true,
        lastRotated: secrets.lastRotated,
        daysSinceRotation,
        needsRotation: daysSinceRotation > 180, // 6 months
        configPath: this.secretsPath,
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