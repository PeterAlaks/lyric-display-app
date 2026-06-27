import { getLineDisplayText, getLineOutputText } from './parseLyrics';

const LEGACY_BLANK_MARKERS = new Set([
  '\u00e2\u2122\u00aa',
  '\u266a',
]);

const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  return LEGACY_BLANK_MARKERS.has(text.trim()) ? '' : text;
};

export const getLyricVideoLineDisplayText = (line) =>
  sanitizeText(getLineDisplayText(line));

export const getLyricVideoLineOutputText = (line, target = 'output') =>
  sanitizeText(getLineOutputText(line, target));
