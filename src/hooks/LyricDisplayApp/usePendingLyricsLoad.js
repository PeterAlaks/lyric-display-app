import { useEffect } from 'react';

export const usePendingLyricsLoad = (processLoadedLyrics) => {
  useEffect(() => {
    if (window.__pendingLyricsLoad) {
      const pendingData = window.__pendingLyricsLoad;
      delete window.__pendingLyricsLoad;

      processLoadedLyrics(pendingData);
    }
  }, [processLoadedLyrics]);
};
