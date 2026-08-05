import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const rendererSource = fs.readFileSync(
  new URL('../src/components/output/LyricVisualFrame.jsx', import.meta.url),
  'utf8'
);
const outputPageSource = fs.readFileSync(
  new URL('../src/pages/OutputPage.jsx', import.meta.url),
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
  assert.match(rendererSource, /value: fullScreenBackgroundColorValue/);
  assert.match(rendererSource, /background: background\.value/);
  assert.match(rendererSource, /background: frameFallbackBackground/);
});

test('fullscreen paint and decoded media changes share the readiness-aware transition layer', () => {
  assert.match(rendererSource, /fullScreenBackgroundType === 'color'[\s\S]*?kind: 'color'/);
  assert.match(rendererSource, /const kind = backgroundMediaIsVideo \? 'video' : 'image'/);
  assert.match(rendererSource, /image\.decode\(\)[\s\S]*?reportReadyAfterPaint/);
  assert.match(rendererSource, /video\.readyState >= 2[\s\S]*?reportReadyAfterPaint/);
  assert.match(rendererSource, /desiredFullScreenBackground[\s\S]*?&& !incomingIsReady/);
  assert.match(rendererSource, /backgroundState\.incomingReady[\s\S]*?<FullScreenBackgroundLayer/);
  assert.match(rendererSource, /\{renderFullScreenBackground\(\)\}/);
  assert.doesNotMatch(rendererSource, /\{shouldRenderFullScreenBackgroundLayer && fullScreenBackgroundType === 'color' && \(/);
});

test('output visibility keeps the visual frame mounted so selected media remains warm', () => {
  assert.match(outputPageSource, /animate=\{isOutputActive \? 'visible' : 'hidden'\}/);
  assert.match(outputPageSource, /active=\{isOutputActive\}/);
  assert.match(outputPageSource, /retainBackgroundLayerWhenInactive/);
  assert.doesNotMatch(outputPageSource, /\{isOutputActive && \(/);
});
