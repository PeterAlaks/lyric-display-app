import { BRACKET_PAIRS, NORMAL_GROUP_CONFIG } from './constants.js';
import { getEffectiveGroupingConfig } from './runtimeConfig.js';
import { isStructureTag } from './structureTags.js';

function isPlaceholderLine(line) {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();

  return /^\[\s*[\?\*\.~\u2026]+\s*\]$/.test(trimmed) || /^\[\s*\.{3,}\s*\]$/.test(trimmed);
}

/**
 * Determine if a lyric line should be treated as a translation line based on bracket delimiters.
 * Excludes section tags and placeholder lines.
 */
export function isTranslationLine(line) {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  if (trimmed.length <= 2) return false;

  if (isStructureTag(trimmed)) return false;
  if (isPlaceholderLine(trimmed)) return false;

  return BRACKET_PAIRS.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
}

/**
 * Check if a line is eligible for normal grouping (not bracketed, within character limit).
 */
export function isNormalGroupCandidate(line, config = null) {
  if (!line || typeof line !== 'string') return false;

  const effectiveConfig = config || getEffectiveGroupingConfig();
  if (!effectiveConfig.enableAutoLineGrouping) return false;

  const trimmed = line.trim();
  if (trimmed.length === 0 || isTranslationLine(trimmed)) return false;

  const maxLength = effectiveConfig.maxLineLength ?? NORMAL_GROUP_CONFIG.MAX_LINE_LENGTH;
  return trimmed.length <= maxLength;
}

/**
 * Manual grouping uses the configured limits without treating the automatic-grouping toggle as a UI lockout.
 */
export function isManualNormalGroupCandidate(line, config = null) {
  return isNormalGroupCandidate(line, {
    ...(config || getEffectiveGroupingConfig()),
    enableAutoLineGrouping: true,
  });
}
