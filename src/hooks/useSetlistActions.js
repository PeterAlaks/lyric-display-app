import { useMemo, useCallback } from 'react';
import { useLyricsFileName, useSetlistState, useIsDesktopApp } from './useStoreSelectors';
import useLyricsStore from '../context/LyricsStore';
import useToast from './useToast';

const useSetlistActions = (emitSetlistAdd) => {
  const isDesktopApp = useIsDesktopApp();
  const lyricsFileName = useLyricsFileName();
  const { setlistFiles, isSetlistFull } = useSetlistState();

  const hasLyrics = useLyricsStore((state) => state.lyrics && state.lyrics.length > 0);
  const rawLyricsContent = useLyricsStore((state) => state.rawLyricsContent);
  const { showToast } = useToast();

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
    if (disabled) {
      if (!isDesktopApp) {
        showToast({ title: 'Not available', message: 'Only available on desktop app', variant: 'warn' });
        return;
      }
      if (isSetlistFull()) {
        showToast({ title: 'Setlist full', message: '25 files maximum reached', variant: 'warn' });
        return;
      }
      if (isFileAlreadyInSetlist()) {
        showToast({ title: 'Already in setlist', message: lyricsFileName, variant: 'info' });
        return;
      }
      if (!hasLyrics || !rawLyricsContent || !lyricsFileName) {
        showToast({ title: 'No file loaded', message: 'Load lyrics before adding to setlist', variant: 'warn' });
        return;
      }
      return;
    }

    const fileData = [{
      name: `${lyricsFileName}.txt`,
      content: rawLyricsContent,
      lastModified: Date.now()
    }];
    emitSetlistAdd(fileData);
    showToast({ title: 'Added to setlist', message: `${lyricsFileName}`, variant: 'success' });
  }, [disabled, emitSetlistAdd, lyricsFileName, rawLyricsContent, isDesktopApp, isSetlistFull, isFileAlreadyInSetlist, hasLyrics, showToast]);

  return { isFileAlreadyInSetlist, handleAddToSetlist, disabled, title };
};

export default useSetlistActions;
