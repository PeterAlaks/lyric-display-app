import { STRUCTURE_TAG_PATTERNS } from '../../shared/lyricsParsing.js';

export const isStructureTagLyricLine = (line) => {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  if (!trimmed) return false;
  return STRUCTURE_TAG_PATTERNS.some((pattern) => pattern.test(trimmed));
};

export const findNavigableLyricLineIndex = (
  lyrics,
  startIndex,
  direction = 1,
  { skipSectionTitles = false } = {}
) => {
  if (!Array.isArray(lyrics) || lyrics.length === 0) return null;

  const step = direction < 0 ? -1 : 1;
  let index = Math.min(lyrics.length - 1, Math.max(0, Number(startIndex) || 0));

  while (index >= 0 && index < lyrics.length) {
    if (!skipSectionTitles || !isStructureTagLyricLine(lyrics[index])) {
      return index;
    }
    index += step;
  }

  return null;
};
