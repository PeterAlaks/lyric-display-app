import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { getLyricsPreviewAnchor, placeZoomedOutputPreview, toViewportLength } from '../src/utils/outputLabels.js';

const rendererSource = fs.readFileSync(
  new URL('../src/components/output/LyricVisualFrame.jsx', import.meta.url),
  'utf8'
);
const outputPageSource = fs.readFileSync(
  new URL('../src/pages/OutputPage.jsx', import.meta.url),
  'utf8'
);
const modalProviderSource = fs.readFileSync(
  new URL('../src/components/modal/ModalProvider.jsx', import.meta.url),
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
  assert.match(rendererSource, /if \(!fullScreenMode \|\| !renderBackgroundLayer\) return null/);
  assert.match(rendererSource, /fullScreenBackgroundType === 'color'[\s\S]*?kind: 'color'/);
  assert.match(rendererSource, /const kind = backgroundMediaIsVideo \? 'video' : 'image'/);
  assert.match(rendererSource, /image\.decode\(\)[\s\S]*?reportReadyAfterPaint/);
  assert.match(rendererSource, /video\.readyState >= 2[\s\S]*?reportReadyAfterPaint/);
  assert.match(rendererSource, /desiredFullScreenBackground[\s\S]*?&& !incomingIsReady/);
  assert.match(rendererSource, /backgroundState\.incomingReady[\s\S]*?<FullScreenBackgroundLayer/);
  assert.match(rendererSource, /\{renderFullScreenBackground\(\)\}/);
  assert.doesNotMatch(rendererSource, /\{shouldRenderFullScreenBackgroundLayer && fullScreenBackgroundType === 'color' && \(/);
});

test('fullscreen colour and media share the bounded background opacity layer', () => {
  assert.match(rendererSource, /fullScreenBackgroundOpacity = 10/);
  assert.match(rendererSource, /clamp\(parsedFullScreenBackgroundOpacity, 0, 10\) \/ 10/);
  assert.match(rendererSource, /opacity: fullScreenBackgroundStrength/);
});

test('output visibility keeps the visual frame mounted so selected media remains warm', () => {
  assert.match(outputPageSource, /animate=\{isOutputActive \? 'visible' : 'hidden'\}/);
  assert.match(outputPageSource, /active=\{isOutputActive\}/);
  assert.match(outputPageSource, /retainBackgroundLayerWhenInactive/);
  assert.doesNotMatch(outputPageSource, /\{isOutputActive && \(/);
});

test('output template previews receive the output they are configuring', () => {
  assert.match(
    modalProviderSource,
    /<OutputTemplatesModal(?:(?!\/>)[\s\S])*outputKey=\{modal\.outputKey\}/
  );
});

test('full-screen element sizes against its frame so scaled previews match the output', () => {
  assert.doesNotMatch(rendererSource, /\d*vw`|100vw|100vh/);
  assert.match(rendererSource, /width: `\$\{scale\}%`/);
});

test('control-window previews draw lyric outputs directly from the shared output frame', () => {
  const previewModalSource = fs.readFileSync(
    new URL('../src/components/PreviewOutputsModal.jsx', import.meta.url),
    'utf8'
  );
  assert.match(outputPageSource, /export function OutputFrame\(/);
  assert.match(outputPageSource, /<OutputFrame[\s\S]*?onAutosizeChange=\{handleAutosizeChange\}/);
  assert.doesNotMatch(previewModalSource, /createPreviewUrl\('output[12]'\)/);
  assert.doesNotMatch(previewModalSource, /createPreviewUrl\(previewCustomOutputId\)/);
  assert.match(previewModalSource, /<OutputFrame outputId="output1" preview \/>/);
  assert.doesNotMatch(previewModalSource, /<iframe|createPreviewUrl/);
  assert.match(previewModalSource, /<StageOutputFrame preview readControlState viewport=\{stageResolution\} \/>/);
  assert.match(previewModalSource, /<TimeOutputFrame viewport=\{timeResolution\} \/>/);
});

test('the projected preview grid draws its feeds directly instead of embedding output pages', () => {
  const previewPageSource = fs.readFileSync(new URL('../src/pages/Preview.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(previewPageSource, /<iframe|createPreviewUrl/);
  assert.match(previewPageSource, /<StageOutputFrame preview viewport=\{resolution\} \/>/);
  assert.match(previewPageSource, /<TimeOutputFrame viewport=\{resolution\} \/>/);
  assert.match(previewPageSource, /<OutputFrame outputId=\{itemId\} preview \/>/);
});

test('stage and time frames size screen-relative layout from the viewport they are given', () => {
  for (const file of ['Stage.jsx', 'TimeDisplay.jsx']) {
    const source = fs.readFileSync(new URL(`../src/pages/${file}`, import.meta.url), 'utf8');
    const frameStart = source.search(/export function (Stage|Time)OutputFrame\(/);
    const pageStart = source.search(/\nconst (Stage|TimeDisplay) = \(\) =>/);
    assert.ok(frameStart > 0 && pageStart > frameStart, file);
    // Only the frame code is checked; the window page shell may use the window freely.
    const frameSource = source.slice(0, pageStart);
    assert.doesNotMatch(frameSource, /\d(vh|vw)\b|w-screen|h-screen/, file);
    assert.match(frameSource, /toViewportLength\(viewport/, file);
  }
});

test('viewport lengths keep real units on outputs and resolve to pixels for previews', () => {
  assert.equal(toViewportLength(null, 'vh', 7), '7vh');
  assert.equal(toViewportLength(null, 'vw', 82), '82vw');
  assert.equal(toViewportLength({ width: 1920, height: 1080 }, 'vh', 7), '75.6px');
  assert.equal(toViewportLength({ width: 1280, height: 720 }, 'vw', 1), '12.8px');
});

test('zoomed previews stay anchored on where each output places its lyrics', () => {
  assert.deepEqual(getLyricsPreviewAnchor({}), { x: 0.5, y: 1 });
  assert.deepEqual(getLyricsPreviewAnchor({ lyricsPosition: 'upper', textAlign: 'left' }), { x: 0, y: 0 });
  assert.deepEqual(getLyricsPreviewAnchor({ lyricsPosition: 'center', textAlign: 'right' }), { x: 1, y: 0.5 });

  const resolution = { width: 1920, height: 1080 };
  // At 1x the frame fills the box exactly.
  assert.deepEqual(
    placeZoomedOutputPreview({ boxWidth: 320, boxHeight: 180, resolution, zoom: 1, anchor: { x: 0.5, y: 1 } }),
    { scale: 320 / 1920, left: 0, top: 0 },
  );
  // At 2x, lower-third lyrics keep the bottom edge in view, centred horizontally.
  const lower = placeZoomedOutputPreview({ boxWidth: 320, boxHeight: 180, resolution, zoom: 2, anchor: { x: 0.5, y: 1 } });
  assert.equal(lower.left, -160);
  assert.equal(lower.top, -180);
  const upperLeft = placeZoomedOutputPreview({ boxWidth: 320, boxHeight: 180, resolution, zoom: 2, anchor: { x: 0, y: 0 } });
  assert.equal(upperLeft.left, 0);
  assert.equal(upperLeft.top, 0);
});

test('lazy modals open at full size: bodies load before the modal is revealed', () => {
  assert.doesNotMatch(modalProviderSource, /^const \w+ = React\.lazy\(/m);
  assert.match(modalProviderSource, /const \[ready\] = useState\(\(\) => Boolean\(Loaded\)\)/);
  assert.match(modalProviderSource, /awaitingContent: Boolean\(unloadedBody\)/);
  assert.match(modalProviderSource, /revealModal\(id, unloadedBody\)/);
  assert.match(modalProviderSource, /if \(modal\.awaitingContent\) return null;/);
});
