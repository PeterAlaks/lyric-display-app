const DB_NAME = 'lyric-display-token-store';
const STORE_NAME = 'tokens';
const DB_VERSION = 1;
const SALT_SEED = 'lyricdisplay-token-store-salt:v1';
const memoryCache = new Map();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI?.tokenStore;

const isSecureCryptoAvailable = () => {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext === false) return false;
  return !!window.crypto?.subtle;
};

const hasIndexedDb = () => typeof indexedDB !== 'undefined';
const getCacheKey = ({ clientType, deviceId }) => `${clientType || 'unknown'}::${deviceId || 'default'}`;

const openDb = () => {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
};

const arrayBufferToBase64 = (buffer) => {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
};

const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const deriveAesKey = async (deviceId) => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return null;
  }

  const material = encoder.encode(deviceId || 'lyricdisplay-default-device');
  const salt = encoder.encode(SALT_SEED);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    material,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 200000,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
};

const encryptToken = async (payload, deviceId) => {
  const key = await deriveAesKey(deviceId);
  if (!key) return null;

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = encoder.encode(JSON.stringify(payload));
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    data: arrayBufferToBase64(cipherBuffer),
  };
};

const decryptToken = async (ciphertext, deviceId) => {
  const key = await deriveAesKey(deviceId);
  if (!key) return null;

  const ivBuffer = base64ToArrayBuffer(ciphertext.iv);
  const dataBuffer = base64ToArrayBuffer(ciphertext.data);

  const plainBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    key,
    dataBuffer
  );

  const json = decoder.decode(plainBuffer);
  return JSON.parse(json);
};

const persistToIndexedDb = async (record) => {
  const db = await openDb();
  if (!db) return;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || request.error);
  });
};

const readFromIndexedDb = async (id) => {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Failed to read token record'));
  });
};

const deleteFromIndexedDb = async (id) => {
  const db = await openDb();
  if (!db) return;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || request.error);
  });
};

export async function readSecureToken({ clientType, deviceId }) {
  const cacheKey = getCacheKey({ clientType, deviceId });
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  if (isElectron()) {
    const value = await window.electronAPI.tokenStore.get({ clientType, deviceId });
    if (value) {
      memoryCache.set(cacheKey, value);
    }
    return value;
  }

  if (!isSecureCryptoAvailable() || !hasIndexedDb()) {
    return null;
  }

  try {
    const record = await readFromIndexedDb(cacheKey);
    if (!record?.value) {
      return null;
    }
    const decrypted = await decryptToken(record.value, record.deviceId);
    memoryCache.set(cacheKey, decrypted);
    return decrypted;
  } catch (error) {
    console.warn('[secureTokenStore] Failed to read token from IndexedDB:', error);
    return null;
  }
}

export async function writeSecureToken({ clientType, deviceId, token, expiresAt }) {
  const cacheKey = getCacheKey({ clientType, deviceId });

  if (!token) {
    await clearSecureToken({ clientType, deviceId });
    return;
  }

  const payload = {
    token,
    expiresAt: typeof expiresAt === 'number' ? expiresAt : null,
    clientType: clientType || null,
    deviceId: deviceId || null,
    updatedAt: Date.now(),
  };

  memoryCache.set(cacheKey, payload);

  if (isElectron()) {
    await window.electronAPI.tokenStore.set({ clientType, deviceId, token, expiresAt: payload.expiresAt });
    return;
  }

  if (!isSecureCryptoAvailable() || !hasIndexedDb()) {
    console.info('[secureTokenStore] Persistence skipped (insecure context or IndexedDB unavailable)');
    return;
  }

  try {
    const encrypted = await encryptToken(payload, deviceId);
    if (!encrypted) {
      console.warn('[secureTokenStore] Failed to encrypt token payload');
      return;
    }
    await persistToIndexedDb({ id: cacheKey, deviceId, value: encrypted });
  } catch (error) {
    console.warn('[secureTokenStore] Failed to persist token:', error);
  }
}

export async function clearSecureToken({ clientType, deviceId }) {
  const cacheKey = getCacheKey({ clientType, deviceId });
  memoryCache.delete(cacheKey);

  if (isElectron()) {
    await window.electronAPI.tokenStore.clear({ clientType, deviceId });
    return;
  }

  if (!hasIndexedDb()) {
    return;
  }

  try {
    await deleteFromIndexedDb(cacheKey);
  } catch (error) {
    console.warn('[secureTokenStore] Failed to delete token:', error);
  }
}
