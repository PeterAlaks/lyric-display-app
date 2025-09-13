import { useMemo, useCallback } from 'react';
import useLyricsStore from '../context/LyricsStore';

const useSetlistActions = (emitSetlistAdd) => {
  const {
    isDesktopApp,
    lyrics,
    rawLyricsContent,
    lyricsFileName,
    setlistFiles,
    isSetlistFull,
  } = useLyricsStore();

  const hasLyrics = lyrics && lyrics.length > 0;

  const isFileAlreadyInSetlist = useCallback(() => {
    if (!lyricsFileName) return false;
    return setlistFiles.some(file => file.displayName === lyricsFileName);
  }, [setlistFiles, lyricsFileName]);

  const disabled = useMemo(() => (
    !isDesktopApp || !hasLyrics || !rawLyricsContent || !lyricsFileName || isSetlistFull() || isFileAlreadyInSetlist()
  ), [isDesktopApp, hasLyrics, rawLyricsContent, lyricsFileName, isSetlistFull, isFileAlreadyInSetlist]);

  const title = useMemo(() => {
    if (!isDesktopApp) return 'Only available on desktop app';
    if (isSetlistFull()) return 'Setlist is full (25 files maximum)';
    if (isFileAlreadyInSetlist()) return 'File already in setlist';
    return 'Add current file to setlist';
  }, [isDesktopApp, isSetlistFull, isFileAlreadyInSetlist]);

  const handleAddToSetlist = useCallback(() => {
    if (disabled) return;
    const fileData = [{
      name: `${lyricsFileName}.txt`,
      content: rawLyricsContent,
      lastModified: Date.now()
    }];
    emitSetlistAdd(fileData);
  }, [disabled, emitSetlistAdd, lyricsFileName, rawLyricsContent]);

  return { isFileAlreadyInSetlist, handleAddToSetlist, disabled, title };
};

export default useSetlistActions;

