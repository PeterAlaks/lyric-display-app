const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function buildLyricsSyncPayload(storeState = {}, fallbackLyrics = []) {
  const lyrics = Array.isArray(storeState.lyrics) && storeState.lyrics.length > 0
    ? storeState.lyrics
    : fallbackLyrics;
  const rawLyricsContent = typeof storeState.rawLyricsContent === 'string'
    ? storeState.rawLyricsContent
    : '';
  const lyricsSource = isPlainObject(storeState.lyricsSource)
    ? storeState.lyricsSource
    : null;
  const songMetadata = isPlainObject(storeState.songMetadata)
    ? storeState.songMetadata
    : null;

  return {
    lyrics,
    fileName: storeState.lyricsFileName || '',
    rawLyricsContent,
    lyricsSource,
    songMetadata,
    lyricsTimestamps: Array.isArray(storeState.lyricsTimestamps) ? storeState.lyricsTimestamps : [],
    lyricsEnhancedTimestamps: Array.isArray(storeState.lyricsEnhancedTimestamps) ? storeState.lyricsEnhancedTimestamps : [],
    sections: Array.isArray(storeState.lyricsSections) ? storeState.lyricsSections : [],
    lineToSection: isPlainObject(storeState.lineToSection) ? storeState.lineToSection : {},
  };
}
