import { NORMAL_GROUP_CONFIG, STRUCTURE_TAGS_CONFIG } from './constants.js';

const DEFAULT_SPLIT_CONFIG = {
  TARGET_LENGTH: 60,
  MIN_LENGTH: 40,
  MAX_LENGTH: 80,
  OVERFLOW_TOLERANCE: 15,
};

const clampInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  const candidate = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, candidate));
};

const readSplitValue = (config, canonicalKey, preferenceKey) => (
  config?.[canonicalKey] ?? config?.[preferenceKey]
);

const normalizeBoolean = (value, fallback) => (
  typeof value === 'boolean' ? value : fallback
);

export function normalizeLineSplittingConfig(config = {}) {
  const maxLength = clampInteger(
    readSplitValue(config, 'MAX_LENGTH', 'maxLength'),
    DEFAULT_SPLIT_CONFIG.MAX_LENGTH,
    50,
    150
  );
  const requestedMin = clampInteger(
    readSplitValue(config, 'MIN_LENGTH', 'minLength'),
    DEFAULT_SPLIT_CONFIG.MIN_LENGTH,
    20,
    80
  );
  const minLength = Math.min(requestedMin, maxLength);
  const targetLength = clampInteger(
    readSplitValue(config, 'TARGET_LENGTH', 'targetLength'),
    DEFAULT_SPLIT_CONFIG.TARGET_LENGTH,
    minLength,
    maxLength
  );

  return {
    TARGET_LENGTH: targetLength,
    MIN_LENGTH: minLength,
    MAX_LENGTH: maxLength,
    OVERFLOW_TOLERANCE: clampInteger(
      readSplitValue(config, 'OVERFLOW_TOLERANCE', 'overflowTolerance'),
      DEFAULT_SPLIT_CONFIG.OVERFLOW_TOLERANCE,
      5,
      30
    ),
  };
}

export function normalizeLyricsGroupingConfig(config = {}) {
  return {
    enableAutoLineGrouping: normalizeBoolean(config?.enableAutoLineGrouping, NORMAL_GROUP_CONFIG.ENABLED),
    enableTranslationGrouping: normalizeBoolean(config?.enableTranslationGrouping, true),
    maxLineLength: clampInteger(
      config?.maxLineLength,
      NORMAL_GROUP_CONFIG.MAX_LINE_LENGTH,
      20,
      100
    ),
    maxLinesPerGroup: clampInteger(
      config?.maxLinesPerGroup,
      NORMAL_GROUP_CONFIG.MAX_LINES_PER_GROUP,
      2,
      12
    ),
    enableCrossBlankLineGrouping: normalizeBoolean(
      config?.enableCrossBlankLineGrouping,
      NORMAL_GROUP_CONFIG.CROSS_BLANK_LINE_GROUPING
    ),
    structureTagMode: ['isolate', 'strip', 'keep'].includes(config?.structureTagMode)
      ? config.structureTagMode
      : STRUCTURE_TAGS_CONFIG.MODE,
  };
}

export function normalizeLyricsParsingOptions(options = {}) {
  return {
    enableSplitting: normalizeBoolean(options?.enableSplitting ?? options?.enabled, true),
    splitConfig: normalizeLineSplittingConfig(options?.splitConfig || options),
    groupingConfig: normalizeLyricsGroupingConfig(options?.groupingConfig || {}),
  };
}

export function mergeLyricsParsingOptions(base = {}, overrides = {}) {
  return normalizeLyricsParsingOptions({
    ...base,
    ...overrides,
    splitConfig: {
      ...(base?.splitConfig || {}),
      ...(overrides?.splitConfig || {}),
    },
    groupingConfig: {
      ...(base?.groupingConfig || {}),
      ...(overrides?.groupingConfig || {}),
    },
  });
}

/**
 * Convert persisted parsing preferences into the options consumed by the
 * shared lyric parsers. Both Electron file loading and realtime setlist
 * loading use this mapper so their defaults cannot drift apart.
 *
 * @param {object} parsingConfig
 * @returns {{ enableSplitting: boolean, splitConfig: object, groupingConfig: object }}
 */
export function buildLyricsParsingOptions(parsingConfig = {}) {
  const splitConfig = parsingConfig?.splitConfig || {};
  const normalGroupConfig = parsingConfig?.normalGroupConfig || {};
  const structureTagsConfig = parsingConfig?.structureTagsConfig || {};

  return normalizeLyricsParsingOptions({
    enableSplitting: parsingConfig?.enableSplitting ?? true,
    splitConfig: normalizeLineSplittingConfig({
      TARGET_LENGTH: splitConfig.TARGET_LENGTH ?? DEFAULT_SPLIT_CONFIG.TARGET_LENGTH,
      MIN_LENGTH: splitConfig.MIN_LENGTH ?? DEFAULT_SPLIT_CONFIG.MIN_LENGTH,
      MAX_LENGTH: splitConfig.MAX_LENGTH ?? DEFAULT_SPLIT_CONFIG.MAX_LENGTH,
      OVERFLOW_TOLERANCE: splitConfig.OVERFLOW_TOLERANCE ?? DEFAULT_SPLIT_CONFIG.OVERFLOW_TOLERANCE,
    }),
    groupingConfig: normalizeLyricsGroupingConfig({
      enableAutoLineGrouping: normalGroupConfig.ENABLED ?? NORMAL_GROUP_CONFIG.ENABLED,
      enableTranslationGrouping: parsingConfig?.enableTranslationGrouping ?? true,
      maxLineLength: normalGroupConfig.MAX_LINE_LENGTH ?? NORMAL_GROUP_CONFIG.MAX_LINE_LENGTH,
      maxLinesPerGroup: normalGroupConfig.MAX_LINES_PER_GROUP ?? NORMAL_GROUP_CONFIG.MAX_LINES_PER_GROUP,
      enableCrossBlankLineGrouping: normalGroupConfig.CROSS_BLANK_LINE_GROUPING ?? NORMAL_GROUP_CONFIG.CROSS_BLANK_LINE_GROUPING,
      structureTagMode: structureTagsConfig.MODE ?? STRUCTURE_TAGS_CONFIG.MODE,
    }),
  });
}
