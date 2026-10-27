import { useCallback } from 'react';
import { getAdjacentSetlistItem } from '../../../shared/setlistNavigation.js';

export const useSetlistNavigation = ({
  emitSetlistLoad,
  hasLyrics,
  lyricsFileName,
  setlistItemId = null,
  setlistFiles,
  showToast,
}) => {
  const navigate = useCallback((direction) => {
    if (!hasLyrics || setlistFiles.length === 0) {
      showToast({
        title: 'No files in setlist',
        message: 'Add songs to your setlist to use navigation',
        variant: 'info'
      });
      return false;
    }

    const { currentIndex, item, atBoundary } = getAdjacentSetlistItem(
      setlistFiles,
      { setlistItemId, lyricsFileName },
      direction,
    );

    if (currentIndex === -1) {
      showToast({
        title: 'Not in setlist',
        message: 'Current song is not in the setlist',
        variant: 'info'
      });
      return false;
    }

    if (atBoundary) {
      showToast({
        title: direction > 0 ? 'End of setlist' : 'Start of setlist',
        message: direction > 0 ? 'This is the last song in the setlist.' : 'This is the first song in the setlist.',
        variant: 'info'
      });
      return false;
    }

    emitSetlistLoad(item.id);
    return true;
  }, [emitSetlistLoad, hasLyrics, lyricsFileName, setlistFiles, setlistItemId, showToast]);

  const handleNavigateSetlistPrevious = useCallback(() => navigate(-1), [navigate]);
  const handleNavigateSetlistNext = useCallback(() => navigate(1), [navigate]);

  return { handleNavigateSetlistPrevious, handleNavigateSetlistNext };
};
