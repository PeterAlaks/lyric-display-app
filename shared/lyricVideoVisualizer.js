export const LYRIC_VIDEO_BACKGROUND_SOURCES = Object.freeze({
  STYLE: 'style',
  BUTTERCHURN: 'butterchurn',
});

export const BUTTERCHURN_QUALITY_LEVELS = Object.freeze({
  DRAFT: 'draft',
  BALANCED: 'balanced',
  HIGH: 'high',
});

export const DEFAULT_BUTTERCHURN_PRESET_ID = 'reaction-diffusion';

export const DEFAULT_LYRIC_VIDEO_VISUALIZER = Object.freeze({
  source: LYRIC_VIDEO_BACKGROUND_SOURCES.STYLE,
  presetId: DEFAULT_BUTTERCHURN_PRESET_ID,
  sensitivity: 1,
  dimming: 35,
  quality: BUTTERCHURN_QUALITY_LEVELS.BALANCED,
  seed: 4242,
});

const VALID_BACKGROUND_SOURCES = new Set(Object.values(LYRIC_VIDEO_BACKGROUND_SOURCES));
const VALID_QUALITY_LEVELS = new Set(Object.values(BUTTERCHURN_QUALITY_LEVELS));

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
  const quality = VALID_QUALITY_LEVELS.has(safeVisualizer.quality)
    ? safeVisualizer.quality
    : DEFAULT_LYRIC_VIDEO_VISUALIZER.quality;
  const presetId = typeof safeVisualizer.presetId === 'string' && safeVisualizer.presetId.trim()
    ? safeVisualizer.presetId.trim().slice(0, 120)
    : DEFAULT_LYRIC_VIDEO_VISUALIZER.presetId;

  return {
    source,
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
