import { useEffect } from 'react';

export const useResetLyricsScroll = (lyricsContainerRef) => {
  useEffect(() => {
    const handleResetScroll = () => {
      if (lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTop = 0;
      }
    };

    window.addEventListener('reset-lyrics-scroll', handleResetScroll);
    return () => window.removeEventListener('reset-lyrics-scroll', handleResetScroll);
  }, [lyricsContainerRef]);
};
