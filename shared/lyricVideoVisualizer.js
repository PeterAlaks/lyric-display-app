export const LYRIC_VIDEO_BACKGROUND_SOURCES = Object.freeze({
  COLOR: 'color',
  MEDIA: 'media',
  BUTTERCHURN: 'butterchurn',
  // Kept as an API alias for projects created before the background controls
  // were split into explicit Colour, Media, and Visualizer sources.
  STYLE: 'color',
});

export const BUTTERCHURN_PRESET_MODES = Object.freeze({
  SINGLE: 'single',
  RANDOM: 'random',
});

export const BUTTERCHURN_QUALITY_LEVELS = Object.freeze({
  DRAFT: 'draft',
  BALANCED: 'balanced',
  HIGH: 'high',
});

// The normal fullscreen output has no audio source yet, so its first preset must
// create visible content from time-based motion alone instead of waiting for a beat.
export const DEFAULT_BUTTERCHURN_PRESET_ID = 'stained-glass';

export const DEFAULT_LYRIC_VIDEO_VISUALIZER = Object.freeze({
  source: LYRIC_VIDEO_BACKGROUND_SOURCES.COLOR,
  presetMode: BUTTERCHURN_PRESET_MODES.SINGLE,
  presetId: DEFAULT_BUTTERCHURN_PRESET_ID,
  sensitivity: 1,
  dimming: 35,
  quality: BUTTERCHURN_QUALITY_LEVELS.BALANCED,
  seed: 4242,
});

const VALID_BACKGROUND_SOURCES = new Set(Object.values(LYRIC_VIDEO_BACKGROUND_SOURCES));
const VALID_QUALITY_LEVELS = new Set(Object.values(BUTTERCHURN_QUALITY_LEVELS));
const VALID_PRESET_MODES = new Set(Object.values(BUTTERCHURN_PRESET_MODES));

const clampNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const normalizeLyricVideoVisualizer = (visualizer = {}) => {
  const safeVisualizer = visualizer && typeof visualizer === 'object' ? visualizer : {};
  const source = VALID_BACKGROUND_SOURCES.has(safeVisualizer.source)
    ? safeVisualizer.source
    : DEFAULT_LYRIC_VIDEO_VISUALIZER.source;
  const presetMode = VALID_PRESET_MODES.has(safeVisualizer.presetMode)
    ? safeVisualizer.presetMode
    : DEFAULT_LYRIC_VIDEO_VISUALIZER.presetMode;
  const quality = VALID_QUALITY_LEVELS.has(safeVisualizer.quality)
    ? safeVisualizer.quality
    : DEFAULT_LYRIC_VIDEO_VISUALIZER.quality;
  const presetId = typeof safeVisualizer.presetId === 'string' && safeVisualizer.presetId.trim()
    ? safeVisualizer.presetId.trim().slice(0, 120)
    : DEFAULT_LYRIC_VIDEO_VISUALIZER.presetId;

  return {
    source,
    presetMode,
    presetId,
    sensitivity: clampNumber(
      safeVisualizer.sensitivity,
      DEFAULT_LYRIC_VIDEO_VISUALIZER.sensitivity,
      0.25,
      3
    ),
    dimming: clampNumber(
      safeVisualizer.dimming,
      DEFAULT_LYRIC_VIDEO_VISUALIZER.dimming,
      0,
      90
    ),
    quality,
    seed: Math.round(clampNumber(
      safeVisualizer.seed,
      DEFAULT_LYRIC_VIDEO_VISUALIZER.seed,
      1,
      2_147_483_647
    )),
  };
};

export const isButterchurnBackground = (visualizer = {}) => (
  normalizeLyricVideoVisualizer(visualizer).source === LYRIC_VIDEO_BACKGROUND_SOURCES.BUTTERCHURN
);
