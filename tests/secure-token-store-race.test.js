import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readSecureToken,
  writeSecureToken,
} from '../src/utils/secureTokenStore.js';

test('a late secure-token read cannot replace a newer in-memory token', async () => {
  let resolveRead;
  const pendingRead = new Promise((resolve) => {
    resolveRead = resolve;
  });
  const storedValues = [];

  globalThis.window = {
    electronAPI: {
      tokenStore: {
        get: () => pendingRead,
        set: async (value) => {
          storedValues.push(value);
        },
      },
    },
  };

  const tokenKey = {
    clientType: 'desktop-race-test',
    deviceId: `device-${Date.now()}`,
  };
  const staleRead = readSecureToken(tokenKey);

  await writeSecureToken({
    ...tokenKey,
    token: 'new-token',
    expiresAt: 12345,
  });

  resolveRead({
    ...tokenKey,
    token: 'old-token',
    expiresAt: 1,
  });

  const resolvedValue = await staleRead;
  assert.equal(resolvedValue.token, 'new-token');
  assert.equal((await readSecureToken(tokenKey)).token, 'new-token');
  assert.equal(storedValues.at(0).token, 'new-token');

  delete globalThis.window;
});
