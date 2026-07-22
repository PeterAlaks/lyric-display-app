import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { normalizeNumberPreferenceValue } from '../src/hooks/UserPreferencesModal/numberPreferenceValues.js';
import {
  RELOAD_LYRICS_WITH_CURRENT_PARSER_EVENT,
  requestLyricsReloadWithCurrentParser,
} from '../src/utils/lyricsReloadEvents.js';

test('numeric preference values normalize spinner, typed, and transient input consistently', () => {
  const integerOptions = { min: 20, max: 100, fallbackValue: 45, parse: 'int' };
  assert.equal(normalizeNumberPreferenceValue('61', integerOptions), 61);
  assert.equal(normalizeNumberPreferenceValue('101', integerOptions), 100);
  assert.equal(normalizeNumberPreferenceValue('', integerOptions), null);
  assert.equal(normalizeNumberPreferenceValue('', integerOptions, true), 45);

  const floatOptions = { min: 1, max: 10, fallbackValue: 2, parse: 'float' };
  assert.equal(normalizeNumberPreferenceValue('2.5', floatOptions), 2.5);
});

test('shared numeric and time inputs preserve active drafts until focus leaves', async () => {
  const [inputSource, timePickerSource] = await Promise.all([
    readFile(new URL('../src/components/ui/input.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ui/time-picker.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(inputSource, /value=\{numberDraft === null \? value : numberDraft\}/);
  assert.match(inputSource, /setNumberDraft\(null\)[\s\S]*onBlur\?\.\(event\)/);
  assert.equal((timePickerSource.match(/onBlur=\{normalizeParts\}/g) || []).length, 2);
});

test('every numeric field in User Preferences uses the shared change-and-blur persistence props', async () => {
  const paths = [
    '../src/components/UserPreferencesModal.jsx',
    '../src/components/UserPreferencesModal/AdvancedPreferencesSection.jsx',
    '../src/components/UserPreferencesModal/ExternalControlPreferencesSection.jsx',
  ];

  const sources = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
  const numericInputs = sources.flatMap((source) => source
    .split('<Input')
    .slice(1)
    .map((fragment) => fragment.split('/>')[0])
    .filter((fragment) => fragment.includes('type="number"')));

  assert.ok(numericInputs.length >= 16);
  numericInputs.forEach((input) => {
    assert.match(input, /getNumberPreferenceInputProps\(/);
  });
});

test('the parser-settings toast reload request uses the shared browser event', () => {
  const dispatched = [];
  const originalWindow = globalThis.window;
  globalThis.window = { dispatchEvent: (event) => dispatched.push(event) };

  try {
    requestLyricsReloadWithCurrentParser();
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }

  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, RELOAD_LYRICS_WITH_CURRENT_PARSER_EVENT);
});

test('Live Safety uses the preferences autosave status while keeping its realtime request immediate', async () => {
  const [modalSource, bridgeSource, persistenceSource, layoutSource] = await Promise.all([
    readFile(new URL('../src/components/UserPreferencesModal.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/hooks/useLiveSafetyBridge.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/hooks/UserPreferencesModal/usePreferencesPersistence.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/UserPreferencesModal/UserPreferencesLayout.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(modalSource, /updatePreference\('general', 'liveSafetyMode', checked\);\s*setLiveSafetyEnabled\(checked, \{ persistPreference: false \}\);/);
  assert.match(bridgeSource, /\{ persistPreference = true \}/);
  assert.match(bridgeSource, /persistPreference && window\.electronAPI\?\.preferences\?\.set/);
  assert.match(persistenceSource, /setSaveError\(true\)/);
  assert.match(layoutSource, /Settings could not be saved/);
});
