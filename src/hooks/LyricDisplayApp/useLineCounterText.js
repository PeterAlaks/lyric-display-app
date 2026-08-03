import { useMemo } from 'react';
import { isStructureTag } from '../../../shared/lyricsParsing.js';
import useLyricsStore from '../../context/LyricsStore';

export const useLineCounterText = ({ hasLyrics, lyrics, selectedLine }) => {
  const sectionTagPhrases = useLyricsStore(
    (state) => state.lyricsParsingOptions.groupingConfig.sectionTagPhrases,
  );

  return useMemo(() => {
    if (!hasLyrics) return '';
    const isTag = (line) => typeof line === 'string' && isStructureTag(line, sectionTagPhrases);
    const contentLineCount = lyrics.reduce((n, line) => n + (isTag(line) ? 0 : 1), 0);
    if (selectedLine !== null && selectedLine !== undefined) {
      let contentPos = 0;
      for (let i = 0; i <= selectedLine; i++) {
        if (!isTag(lyrics[i])) contentPos++;
      }
      return `Line ${contentPos} of ${contentLineCount} loaded lyric lines`;
    }
    return `${contentLineCount} loaded lyric ${contentLineCount === 1 ? 'line' : 'lines'}`;
  }, [hasLyrics, lyrics, sectionTagPhrases, selectedLine]);
};
