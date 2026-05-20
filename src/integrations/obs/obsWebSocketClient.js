const OP_HELLO = 0;
const OP_IDENTIFY = 1;
const OP_IDENTIFIED = 2;
const OP_REQUEST = 6;
const OP_REQUEST_RESPONSE = 7;

const DEFAULT_TIMEOUT_MS = 8000;

function createRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function base64FromArrayBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Bytes(messageBytes) {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const bitLength = messageBytes.length * 8;
  const paddedLength = (((messageBytes.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLength);
  padded.set(messageBytes);
  padded[messageBytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rightRotate(words[index - 15], 7) ^ rightRotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rightRotate(words[index - 2], 17) ^ rightRotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + constants[index] + words[index]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  const output = new Uint8Array(32);
  const outputView = new DataView(output.buffer);
  hash.forEach((value, index) => outputView.setUint32(index * 4, value, false));
  return output.buffer;
}

async function sha256Base64(value) {
  const encoded = new TextEncoder().encode(value);
  const webCrypto = globalThis.crypto;
  const hash = webCrypto?.subtle
    ? await webCrypto.subtle.digest('SHA-256', encoded)
    : sha256Bytes(encoded);
  return base64FromArrayBuffer(hash);
}

async function createAuthenticationString(password, { salt, challenge }) {
  const secret = await sha256Base64(`${password}${salt}`);
  return sha256Base64(`${secret}${challenge}`);
}

function getCloseMessage(event) {
  if (event?.code === 4005) return 'OBS WebSocket authentication failed.';
  if (event?.code === 4009) return 'OBS WebSocket session was invalidated.';
  if (event?.reason) return event.reason;
  return 'OBS WebSocket connection closed.';
}

export class ObsWebSocketClient {
  constructor({ host = '127.0.0.1', port = 4455, password = '', timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.host = host;
    this.port = port;
    this.password = password;
    this.timeoutMs = timeoutMs;
    this.socket = null;
    this.pending = new Map();
    this.identified = false;
    this.versionInfo = null;
  }

  get url() {
    return `ws://${this.host}:${this.port}`;
  }

  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.identified) {
      return Promise.resolve(this.versionInfo);
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        this.disconnect();
        reject(new Error(`Timed out connecting to OBS at ${this.url}`));
      }, this.timeoutMs);

      const fail = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        this.disconnect();
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      try {
        this.socket = new WebSocket(this.url, 'obswebsocket.json');
      } catch (error) {
        fail(error);
        return;
      }

      this.socket.onmessage = async (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          fail(new Error('OBS sent an invalid WebSocket message.'));
          return;
        }

        try {
          if (message.op === OP_HELLO) {
            const hello = message.d || {};
            const identify = {
              rpcVersion: Math.min(Number(hello.rpcVersion) || 1, 1),
              eventSubscriptions: 0,
            };

            if (hello.authentication) {
              if (!this.password) {
                fail(new Error('OBS WebSocket requires a password.'));
                return;
              }
              identify.authentication = await createAuthenticationString(this.password, hello.authentication);
            }

            this.socket.send(JSON.stringify({ op: OP_IDENTIFY, d: identify }));
            return;
          }

          if (message.op === OP_IDENTIFIED) {
            this.identified = true;
            this.versionInfo = message.d || {};
            if (!settled) {
              settled = true;
              window.clearTimeout(timeout);
              resolve(this.versionInfo);
            }
            return;
          }

          if (message.op === OP_REQUEST_RESPONSE) {
            const response = message.d || {};
            const pending = this.pending.get(response.requestId);
            if (!pending) return;

            this.pending.delete(response.requestId);
            window.clearTimeout(pending.timeout);

            if (response.requestStatus?.result) {
              pending.resolve(response.responseData || {});
            } else {
              const comment = response.requestStatus?.comment;
              const code = response.requestStatus?.code;
              pending.reject(new Error(comment || `OBS request failed${code ? ` (${code})` : ''}.`));
            }
          }
        } catch (error) {
          fail(error);
        }
      };

      this.socket.onerror = () => {
        fail(new Error(`Could not connect to OBS at ${this.url}.`));
      };

      this.socket.onclose = (event) => {
        this.identified = false;
        for (const pending of this.pending.values()) {
          window.clearTimeout(pending.timeout);
          pending.reject(new Error(getCloseMessage(event)));
        }
        this.pending.clear();

        if (!settled) {
          fail(new Error(getCloseMessage(event)));
        }
      };
    });
  }

  disconnect() {
    this.identified = false;
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Ignore close errors.
      }
    }
    this.socket = null;
  }

  request(requestType, requestData = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.identified) {
      return Promise.reject(new Error('OBS WebSocket is not connected.'));
    }

    const requestId = createRequestId();
    const payload = {
      op: OP_REQUEST,
      d: {
        requestType,
        requestId,
        requestData,
      },
    };

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`OBS request timed out: ${requestType}`));
      }, this.timeoutMs);

      this.pending.set(requestId, { resolve, reject, timeout });
      this.socket.send(JSON.stringify(payload));
    });
  }

  async getSceneList() {
    return this.request('GetSceneList');
  }

  async getVideoSettings() {
    return this.request('GetVideoSettings');
  }

  async getInputKindList() {
    return this.request('GetInputKindList', { unversioned: true });
  }

  async getInputList() {
    return this.request('GetInputList');
  }

  async getVersion() {
    return this.request('GetVersion');
  }

  async getInputSettings(inputName) {
    return this.request('GetInputSettings', { inputName });
  }

  async createInput({ sceneName, inputName, inputKind, inputSettings, sceneItemEnabled = true }) {
    return this.request('CreateInput', {
      sceneName,
      inputName,
      inputKind,
      inputSettings,
      sceneItemEnabled,
    });
  }

  async setInputSettings({ inputName, inputSettings, overlay = true }) {
    return this.request('SetInputSettings', {
      inputName,
      inputSettings,
      overlay,
    });
  }

  async getSceneItemId({ sceneName, sourceName }) {
    return this.request('GetSceneItemId', {
      sceneName,
      sourceName,
    });
  }

  async createSceneItem({ sceneName, sourceName, sceneItemEnabled = true }) {
    return this.request('CreateSceneItem', {
      sceneName,
      sourceName,
      sceneItemEnabled,
    });
  }

  async pressInputPropertiesButton({ inputName, propertyName }) {
    return this.request('PressInputPropertiesButton', {
      inputName,
      propertyName,
    });
  }

  async setSceneItemTransform({ sceneName, sceneItemId, width, height, boundsType = 'OBS_BOUNDS_STRETCH' }) {
    return this.request('SetSceneItemTransform', {
      sceneName,
      sceneItemId,
      sceneItemTransform: {
        positionX: 0,
        positionY: 0,
        boundsType,
        boundsWidth: width,
        boundsHeight: height,
      },
    });
  }

  async setSceneItemLocked({ sceneName, sceneItemId, locked }) {
    return this.request('SetSceneItemLocked', {
      sceneName,
      sceneItemId,
      sceneItemLocked: locked,
    });
  }
}

export function isBrowserSourceKind(kind = '') {
  const normalized = String(kind).toLowerCase();
  return normalized === 'browser_source' || normalized === 'browser';
}

export function pickBrowserSourceKind(inputKinds = []) {
  if (inputKinds.includes('browser_source')) return 'browser_source';
  if (inputKinds.includes('browser')) return 'browser';
  return inputKinds.find((kind) => String(kind).toLowerCase().includes('browser')) || null;
}
