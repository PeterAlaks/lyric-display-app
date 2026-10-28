// Screen sizes offered wherever an output is previewed.
export const OUTPUT_PREVIEW_RESOLUTIONS = [
  { label: '1920x1080 (Full HD)', width: 1920, height: 1080 },
  { label: '1280x720 (HD)', width: 1280, height: 720 },
  { label: '1024x768 (XGA)', width: 1024, height: 768 },
  { label: '1366x768 (WXGA)', width: 1366, height: 768 },
  { label: '1440x900 (WXGA+)', width: 1440, height: 900 },
  { label: '1600x900 (HD+)', width: 1600, height: 900 },
];

/**
 * A screen-relative length for an output frame. Output windows pass no viewport and keep real
 * vw/vh units; previews pass the screen size they draw so the same layout resolves in pixels.
 */
export const toViewportLength = (viewport, unit, amount) => (
  viewport ? `${((unit === 'vw' ? viewport.width : viewport.height) * amount) / 100}px` : `${amount}${unit}`
);

/** Where an output puts its lyrics, as fractions of the screen (0 = top/left, 1 = bottom/right). */
export const getLyricsPreviewAnchor = (settings = {}) => ({
  x: settings.textAlign === 'left' ? 0 : settings.textAlign === 'right' ? 1 : 0.5,
  y: settings.lyricsPosition === 'upper' ? 0 : settings.lyricsPosition === 'center' ? 0.5 : 1,
});

/**
 * Scale and offset for drawing an output inside a preview box at a zoom level, keeping the
 * anchor point (normally where the lyrics sit) at the same place in the box as on the screen.
 */
export const placeZoomedOutputPreview = ({ boxWidth, boxHeight, resolution, zoom = 1, anchor }) => {
  const scale = (boxWidth / resolution.width) * zoom;
  // Rounded so a frame that exactly fills the box sits at 0, not a float sliver (or -0) off it.
  const offset = (spare, fraction) => Math.round(spare * fraction * 100) / 100 || 0;
  return {
    scale,
    left: offset(boxWidth - resolution.width * scale, anchor.x),
    top: offset(boxHeight - resolution.height * scale, anchor.y),
  };
};

export const formatOutputLabel = (outputKey, { uppercase = false } = {}) => {
  if (!outputKey) return '';

  if (outputKey === 'stage') {
    return uppercase ? 'STAGE' : 'Stage';
  }

  if (outputKey === 'time') {
    return uppercase ? 'TIME' : 'Time';
  }

  if (outputKey === 'lyric-video-studio') {
    return uppercase ? 'LYRIC VIDEO STUDIO' : 'Lyric Video Studio';
  }

  if (outputKey === 'preview') {
    return uppercase ? 'PREVIEW' : 'Preview';
  }

  const match = /^output(\d+)$/i.exec(String(outputKey));
  if (match) {
    const num = match[1];
    return uppercase ? `OUTPUT ${num}` : `Output ${num}`;
  }

  const fallback = String(outputKey);
  return uppercase ? fallback.toUpperCase() : fallback;
};
