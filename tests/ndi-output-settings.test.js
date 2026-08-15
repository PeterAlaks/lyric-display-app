import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getOutputDefaults,
  normalizeOutputConfig,
  normalizeOutputKey,
  normalizeOutputList,
} from '../main/ndi/outputSettings.js';

test('normalizes NDI output keys and custom output lists', () => {
  assert.equal(normalizeOutputKey('stage'), 'stage');
  assert.equal(normalizeOutputKey('Output3'), 'output3');
  assert.equal(normalizeOutputKey('../bad'), null);
  assert.deepEqual(normalizeOutputList(['output1', 'output2', 'output3', 'stage', 'bad']), ['output3']);
});

test('normalizes NDI output config without changing valid values', () => {
  const config = normalizeOutputConfig('output3', {
    enabled: true,
    resolution: 'custom',
    customWidth: 2560,
    customHeight: 1440,
    framerate: 60,
    sourceName: '  LyricDisplay   Clean Feed  ',
  });

  assert.deepEqual(config, {
    enabled: true,
    resolution: 'custom',
    customWidth: 2560,
    customHeight: 1440,
    framerate: 60,
    sourceName: 'LyricDisplay Clean Feed',
  });
});

test('clamps unsafe NDI output config to supported values', () => {
  const defaults = getOutputDefaults('output9');
  const config = normalizeOutputConfig('output9', {
    enabled: 1,
    resolution: '999p',
    customWidth: 99_999,
    customHeight: -1,
    framerate: 999,
    sourceName: '\n\t',
  });

  assert.equal(config.enabled, true);
  assert.equal(config.resolution, '1080p');
  assert.equal(config.customWidth, 7680);
  assert.equal(config.customHeight, 240);
  assert.equal(config.framerate, 30);
  assert.equal(config.sourceName, defaults.sourceName);
});
