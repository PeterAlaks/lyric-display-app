import { BRACKET_PAIRS } from './constants.js';
import { isStructureTag } from './structureTags.js';

/**
 * Check if a line contains only placeholder or metadata content (not a real translation).
 * Examples: [?], [...], [*], [~], etc.
 * @param {string} line
 * @returns {boolean}
 */
function isPlaceholderLine(line) {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();

  return /^\[\s*[\?\*\.~\u2026]+\s*\]$/.test(trimmed) || /^\[\s*\.{3,}\s*\]$/.test(trimmed);
}

/**
 * Determine if a lyric line should be treated as a translation line based on bracket delimiters.
 * Excludes section tags and placeholder lines.
 * @param {string} line
 * @returns {boolean}
 */
export function isTranslationLine(line) {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  if (trimmed.length <= 2) return false;

  if (isStructureTag(trimmed)) return false;
  if (isPlaceholderLine(trimmed)) return false;

  return BRACKET_PAIRS.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
}
