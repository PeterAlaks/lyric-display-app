import { useState, useRef, useCallback } from 'react';

export const useDragAndDrop = ({
  handleFileUpload,
  handleMultipleFileUpload,
  loadSetlist,
  clearSearch,
  trackAction,
  showToast
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragFileCount, setDragFileCount] = useState(0);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current++;

    if (dragCounterRef.current === 1) {
      const fileCount = e.dataTransfer?.items?.length || e.dataTransfer?.files?.length || 0;
      setDragFileCount(fileCount);
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      setIsDragging(false);
      setDragFileCount(0);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current = 0;
    setIsDragging(false);
    setDragFileCount(0);

    const files = Array.from(e.dataTransfer.files || []);

    if (files.length === 0) return;

    const setlistFiles = files.filter(f => f.name.toLowerCase().endsWith('.ldset'));

    if (setlistFiles.length > 1) {
      showToast({
        title: 'Multiple setlist files',
        message: 'You can only load one setlist file at a time.',
        variant: 'warn'
      });
      return;
    }

    if (setlistFiles.length === 1) {
      await loadSetlist(setlistFiles[0]);
      return;
    }

    const lyricFiles = files.filter(f => {
      const name = f.name.toLowerCase();
      return name.endsWith('.txt') || name.endsWith('.lrc');
    });

    if (lyricFiles.length === 0) {
      showToast({
        title: 'No valid files',
        message: 'Please drop .txt, .lrc, or .ldset files.',
        variant: 'warn'
      });
      return;
    }

    if (lyricFiles.length === 1) {
      const success = await handleFileUpload(lyricFiles[0]);
      if (success) {
        clearSearch();
        trackAction('song_loaded');
      }
      return;
    }

    await handleMultipleFileUpload(lyricFiles);
  }, [handleFileUpload, handleMultipleFileUpload, loadSetlist, clearSearch, trackAction, showToast]);

  return {
    isDragging,
    dragFileCount,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop
  };
};