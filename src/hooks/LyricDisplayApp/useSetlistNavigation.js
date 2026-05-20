import { useCallback } from 'react';

export const useSetlistNavigation = ({
  emitSetlistLoad,
  hasLyrics,
  lyricsFileName,
  setlistFiles,
  showToast,
}) => {
  const handleNavigateSetlistPrevious = useCallback(() => {
    if (!hasLyrics || setlistFiles.length === 0) {
      showToast({
        title: 'No files in setlist',
        message: 'Add songs to your setlist to use navigation',
        variant: 'info'
      });
      return;
    }

    const currentIndex = setlistFiles.findIndex(file => file.displayName === lyricsFileName);
    if (currentIndex === -1) {
      showToast({
        title: 'Not in setlist',
        message: 'Current song is not in the setlist',
        variant: 'info'
      });
      return;
    }

    const previousIndex = currentIndex > 0 ? currentIndex - 1 : setlistFiles.length - 1;
    const previousFile = setlistFiles[previousIndex];

    if (previousFile) {
      emitSetlistLoad(previousFile.id);
    }
  }, [emitSetlistLoad, hasLyrics, lyricsFileName, setlistFiles, showToast]);

  const handleNavigateSetlistNext = useCallback(() => {
    if (!hasLyrics || setlistFiles.length === 0) {
      showToast({
        title: 'No files in setlist',
        message: 'Add songs to your setlist to use navigation',
        variant: 'info'
      });
      return;
    }

    const currentIndex = setlistFiles.findIndex(file => file.displayName === lyricsFileName);
    if (currentIndex === -1) {
      showToast({
        title: 'Not in setlist',
        message: 'Current song is not in the setlist',
        variant: 'info'
      });
      return;
    }

    const nextIndex = currentIndex < setlistFiles.length - 1 ? currentIndex + 1 : 0;
    const nextFile = setlistFiles[nextIndex];

    if (nextFile) {
      emitSetlistLoad(nextFile.id);
    }
  }, [emitSetlistLoad, hasLyrics, lyricsFileName, setlistFiles, showToast]);

  return { handleNavigateSetlistPrevious, handleNavigateSetlistNext };
};
