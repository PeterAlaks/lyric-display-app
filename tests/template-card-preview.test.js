import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateExpandedCardLayout,
  getOutputPreviewPositionStyle,
} from '../src/utils/templateCardPreview.js';

test('expanded template cards stay within the viewport while growing from their source card', () => {
  const layout = calculateExpandedCardLayout({
    sourceRect: { left: 720, top: 520, width: 250, height: 180 },
    viewportWidth: 1024,
    viewportHeight: 720,
  });

  assert.equal(layout.width, 620);
  assert.ok(layout.left >= 16);
  assert.ok(layout.top >= 16);
  assert.ok(layout.left + layout.width <= 1008);
  assert.ok(layout.top + layout.height <= 704);
  assert.ok(layout.initialScale > 0 && layout.initialScale < 1);
});

test('expanded template cards shrink responsively for compact viewports', () => {
  const layout = calculateExpandedCardLayout({
    sourceRect: { left: 24, top: 120, width: 210, height: 160 },
    viewportWidth: 480,
    viewportHeight: 520,
  });

  assert.ok(layout.width < 620);
  assert.ok(layout.height <= 488);
  assert.ok(layout.left >= 16);
  assert.ok(layout.top >= 16);
});

test('output template previews position lyrics along the vertical screen axis', () => {
  assert.deepEqual(getOutputPreviewPositionStyle('upper', true), {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    paddingTop: 32,
  });
  assert.deepEqual(getOutputPreviewPositionStyle('center', true), {
    flexDirection: 'column',
    justifyContent: 'center',
  });
  assert.deepEqual(getOutputPreviewPositionStyle('lower', true), {
    flexDirection: 'column',
    justifyContent: 'flex-end',
    paddingBottom: 32,
  });
});
