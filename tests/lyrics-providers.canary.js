import assert from 'node:assert/strict';
import test from 'node:test';
import { searchAllProviders } from '../main/lyricsProviders/index.js';

const CANARY_TIMEOUT_MS = 20000;

test('lyrics providers canary returns a strong LRCLIB result for a known query', {
  timeout: CANARY_TIMEOUT_MS,
}, async () => {
  const response = await searchAllProviders('Way Maker Sinach', {
    limit: 5,
    skipCache: true,
    mode: 'full',
  });

  assert.ok(response.results.length > 0, 'expected at least one live provider result');
  assert.ok(
    response.results.some((item) =>
      item.provider === 'lrclib'
      && /way\s*maker/i.test(item.title || '')
      && /sinach/i.test(item.artist || '')
    ),
    'expected LRCLIB to return Way Maker by Sinach',
  );
});

test('lyrics providers canary exposes provider health metadata', {
  timeout: CANARY_TIMEOUT_MS,
}, async () => {
  const response = await searchAllProviders('Amazing Grace John Newton', {
    limit: 5,
    skipCache: true,
    mode: 'full',
  });

  assert.ok(Array.isArray(response.meta?.providers));
  assert.ok(response.meta.providers.length > 0);
  assert.ok(response.meta.providers.every((provider) => typeof provider.id === 'string'));
});
