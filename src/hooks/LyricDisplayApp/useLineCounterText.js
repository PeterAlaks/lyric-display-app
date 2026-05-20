import { useMemo } from 'react';
import { STRUCTURE_TAG_PATTERNS } from '../../../shared/lyricsParsing.js';

export const useLineCounterText = ({ hasLyrics, lyrics, selectedLine }) => useMemo(() => {
  if (!hasLyrics) return '';
  const isTag = (line) => typeof line === 'string' && STRUCTURE_TAG_PATTERNS.some((p) => p.test(line.trim()));
  const contentLineCount = lyrics.reduce((n, line) => n + (isTag(line) ? 0 : 1), 0);
  if (selectedLine !== null && selectedLine !== undefined) {
    let contentPos = 0;
    for (let i = 0; i <= selectedLine; i++) {
      if (!isTag(lyrics[i])) contentPos++;
    }
    return `Line ${contentPos} of ${contentLineCount} loaded lyric lines`;
  }
  return `${contentLineCount} loaded lyric ${contentLineCount === 1 ? 'line' : 'lines'}`;
}, [hasLyrics, lyrics, selectedLine]);
