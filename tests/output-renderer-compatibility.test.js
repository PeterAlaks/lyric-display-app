import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const rendererSource = fs.readFileSync(
  new URL('../src/components/output/LyricVisualFrame.jsx', import.meta.url),
  'utf8'
);

test('output positioning uses an explicitly anchored full-frame layer', () => {
  assert.match(rendererSource, /data-lyric-position-layer="true"/);
  assert.match(rendererSource, /position: 'absolute',[\s\S]*?top: 0,[\s\S]*?right: 0,[\s\S]*?bottom: 0,[\s\S]*?left: 0/);
  assert.match(rendererSource, /justifyContent,/);
});

test('output frame avoids isolated paint containment for CEF browser inputs', () => {
  assert.doesNotMatch(rendererSource, /contain:\s*'layout style paint'/);
  assert.doesNotMatch(rendererSource, /isolation:\s*'isolate'/);
});

test('fullscreen colour uses a dedicated viewport layer', () => {
  assert.match(rendererSource, /data-lyric-background-color="true"/);
  assert.match(rendererSource, /background: fullScreenBackgroundColorValue/);
  assert.match(rendererSource, /background: frameFallbackBackground/);
});
