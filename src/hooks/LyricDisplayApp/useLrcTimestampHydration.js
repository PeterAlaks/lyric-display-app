import { useEffect } from 'react';
import { hasValidTimestamps } from '../../utils/timestampHelpers';
import { parseLrcContent } from '../../../shared/lyricsParsing.js';

export const useLrcTimestampHydration = ({
  hasLyrics,
  lyrics,
  lyricsTimestamps,
  rawLyricsContent,
  setLineToSection,
  setLyricsEnhancedTimestamps = () => { },
  setLyricsSections,
  setLyricsTimestamps,
}) => {
  useEffect(() => {
    if (!hasLyrics) return;
    if (hasValidTimestamps(lyricsTimestamps)) return;
    if (!rawLyricsContent) return;

    const looksLikeLrc = /[\[<]\d{1,2}:\d{2}(?:\.\d{1,3})?[\]>]/.test(rawLyricsContent);
    if (!looksLikeLrc) return;

    try {
      const parsed = parseLrcContent(rawLyricsContent);
      const lengthsMatch = Array.isArray(parsed?.processedLines) && parsed.processedLines.length === lyrics.length;

      if (lengthsMatch && Array.isArray(parsed.timestamps) && parsed.timestamps.length > 0) {
        setLyricsTimestamps(parsed.timestamps);
        setLyricsEnhancedTimestamps(parsed.enhancedTimestamps || []);
        if (parsed.sections && parsed.lineToSection) {
          setLyricsSections(parsed.sections);
          setLineToSection(parsed.lineToSection);
        }
      }
    } catch (err) {
      console.warn('Failed to regenerate timestamps from stored lyrics:', err);
    }
  }, [hasLyrics, lyrics, lyricsTimestamps, rawLyricsContent, setLineToSection, setLyricsEnhancedTimestamps, setLyricsSections, setLyricsTimestamps]);
};
