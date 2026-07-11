import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import SimpleSecretManager from '../server/security/secretManager.js';
import {
  clearAdminKeyCache,
  getAdminKey,
  setAdminKeyFromBackend,
} from '../main/adminKey.js';

const JWT_SECRET = 'a'.repeat(64);
const ADMIN_ACCESS_KEY = 'b'.repeat(64);

const createSecrets = () => ({
  JWT_SECRET,
  ADMIN_ACCESS_KEY,
  TOKEN_EXPIRY: '24h',
  ADMIN_TOKEN_EXPIRY: '7d',
  RATE_LIMIT_WINDOW_MS: 900000,
  RATE_LIMIT_MAX_REQUESTS: 50,
  created: '2026-01-01T00:00:00.000Z',
  lastRotated: '2026-01-01T00:00:00.000Z',
});

const createMemoryKeytar = () => {
  let value = null;
  return {
    async getPassword() { return value; },
    async setPassword(_service, _account, nextValue) { value = nextValue; },
  };
};

test('verified keytar storage leaves no adjacent encrypted backup artifacts', async () => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-secrets-keytar-'));
  try {
    const manager = new SimpleSecretManager({ configDir, keytarImpl: createMemoryKeytar() });
    const saved = await manager.saveSecrets(createSecrets());
    const files = await fs.readdir(configDir);
    const status = await manager.getSecretsStatus();

    assert.equal(saved.JWT_SECRET, JWT_SECRET);
    assert.deepEqual(files, []);
    assert.equal(status.storageBackend, 'keytar');
    assert.equal(status.configPath, null);
    assert.equal(status.legacyBackupPresent, false);
  } finally {
    await fs.rm(configDir, { recursive: true, force: true });
  }
});

test('legacy encrypted fallback migrates only after verified keytar persistence', async () => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-secrets-migrate-'));
  try {
    const fallbackManager = new SimpleSecretManager({ configDir, keytarImpl: null });
    await fallbackManager.saveSecrets(createSecrets());
    assert.deepEqual((await fs.readdir(configDir)).sort(), ['secrets.json', 'secrets.key']);

    const keytarImpl = createMemoryKeytar();
    const vaultManager = new SimpleSecretManager({ configDir, keytarImpl });
    const loaded = await vaultManager.loadSecrets();

    assert.equal(loaded.ADMIN_ACCESS_KEY, ADMIN_ACCESS_KEY);
    assert.deepEqual(await fs.readdir(configDir), []);
    assert.equal(JSON.parse(await keytarImpl.getPassword()).JWT_SECRET, JWT_SECRET);
  } finally {
    await fs.rm(configDir, { recursive: true, force: true });
  }
});

test('encrypted file fallback remains available when keytar verification fails', async () => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-secrets-fallback-'));
  const failingKeytar = {
    async getPassword() { return null; },
    async setPassword() { throw new Error('vault unavailable'); },
  };

  try {
    const manager = new SimpleSecretManager({ configDir, keytarImpl: failingKeytar });
    await manager.saveSecrets(createSecrets());
    assert.deepEqual((await fs.readdir(configDir)).sort(), ['secrets.json', 'secrets.key']);

    const fallbackReader = new SimpleSecretManager({ configDir, keytarImpl: null });
    const loaded = await fallbackReader.loadSecrets();
    const status = await fallbackReader.getSecretsStatus();
    assert.equal(loaded.ADMIN_ACCESS_KEY, ADMIN_ACCESS_KEY);
    assert.equal(status.storageBackend, 'encrypted-file-fallback');
    assert.equal(status.legacyBackupPresent, true);
  } finally {
    await fs.rm(configDir, { recursive: true, force: true });
  }
});

test('vault read failure without a fallback never regenerates credentials', async () => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-secrets-read-failure-'));
  const failingKeytar = {
    async getPassword() { throw new Error('credential service temporarily unavailable'); },
    async setPassword() { throw new Error('must not write replacement credentials'); },
  };

  try {
    const manager = new SimpleSecretManager({ configDir, keytarImpl: failingKeytar });
    await assert.rejects(
      manager.loadSecrets(),
      /credential vault read failed.*no encrypted fallback/i
    );
    assert.deepEqual(await fs.readdir(configDir), []);
  } finally {
    await fs.rm(configDir, { recursive: true, force: true });
  }
});

test('invalid vault payload without a fallback never regenerates credentials', async () => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-secrets-invalid-vault-'));
  const invalidKeytar = {
    async getPassword() {
      return JSON.stringify({ ...createSecrets(), ADMIN_ACCESS_KEY: 'corrupted' });
    },
    async setPassword() { throw new Error('must not write replacement credentials'); },
  };

  try {
    const manager = new SimpleSecretManager({ configDir, keytarImpl: invalidKeytar });
    await assert.rejects(
      manager.loadSecrets(),
      /credential vault payload is invalid.*no encrypted fallback/i
    );
    assert.deepEqual(await fs.readdir(configDir), []);
  } finally {
    await fs.rm(configDir, { recursive: true, force: true });
  }
});

test('Electron accepts only canonical admin keys from the trusted backend handoff', async () => {
  clearAdminKeyCache();
  try {
    assert.equal(setAdminKeyFromBackend('not-a-key'), false);
    assert.equal(setAdminKeyFromBackend(ADMIN_ACCESS_KEY.toUpperCase()), true);
    assert.equal(await getAdminKey(), ADMIN_ACCESS_KEY);
  } finally {
    clearAdminKeyCache();
  }
});
