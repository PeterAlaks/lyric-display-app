export const RELOAD_LYRICS_WITH_CURRENT_PARSER_EVENT = 'lyrics-reload-with-current-parser-requested';

export const requestLyricsReloadWithCurrentParser = () => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new Event(RELOAD_LYRICS_WITH_CURRENT_PARSER_EVENT));
};
