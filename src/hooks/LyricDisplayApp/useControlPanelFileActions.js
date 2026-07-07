import { useCallback } from 'react';

export const useControlPanelFileActions = ({
  clearSearch,
  fileInputRef,
  handleFileUpload,
  isAuthenticated,
  loadSetlist,
  navigate,
  setOnlineLyricsModalOpen,
  setSetlistModalOpen,
  showToast,
  trackAction,
}) => {
  const openFileDialog = useCallback(async () => {
    if (!isAuthenticated) {
      showToast({
        title: 'Authentication Required',
        message: 'Please wait for authentication to complete before loading files.',
        variant: 'warning'
      });
      return;
    }

    try {
      if (window?.electronAPI?.loadLyricsFile) {
        const result = await window.electronAPI.loadLyricsFile();
        if (result && result.success && result.content) {
          const payload = { content: result.content, fileName: result.fileName, filePath: result.filePath, fileType: result.fileType };
          window.dispatchEvent(new CustomEvent('lyrics-opened', { detail: payload }));
          trackAction('song_loaded');
          return;
        }
        if (result && result.canceled) return;
      }
    } catch { }
    fileInputRef.current?.click();
  }, [fileInputRef, isAuthenticated, showToast, trackAction]);

  const handleCreateNewSong = useCallback(() => {
    navigate('/new-song?mode=new');
  }, [navigate]);

  const handleEditLyrics = useCallback(() => {
    navigate('/new-song?mode=edit');
  }, [navigate]);

  const handleOpenSetlist = useCallback(() => {
    setSetlistModalOpen(true);
  }, [setSetlistModalOpen]);

  const handleOpenOnlineLyricsSearch = useCallback(() => {
    setOnlineLyricsModalOpen(true);
  }, [setOnlineLyricsModalOpen]);

  const handleOpenTimerControl = useCallback(async () => {
    if (window?.electronAPI?.display?.openTimerControlWindow) {
      const result = await window.electronAPI.display.openTimerControlWindow();
      if (!result?.success) {
        showToast({
          title: 'Timer unavailable',
          message: result?.error || 'Could not open the timer control window.',
          variant: 'error',
        });
      }
      return;
    }

    navigate('/timer-control');
  }, [navigate, showToast]);

  const handleCloseOnlineLyricsSearch = useCallback(() => {
    setOnlineLyricsModalOpen(false);
  }, [setOnlineLyricsModalOpen]);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.ldset')) {
      await loadSetlist(file);
      return;
    }

    const success = await handleFileUpload(file);
    if (success) {
      clearSearch();
      trackAction('song_loaded');
    }
  }, [clearSearch, handleFileUpload, loadSetlist, trackAction]);

  return {
    handleCloseOnlineLyricsSearch,
    handleCreateNewSong,
    handleEditLyrics,
    handleFileChange,
    handleOpenOnlineLyricsSearch,
    handleOpenSetlist,
    handleOpenTimerControl,
    openFileDialog,
  };
};
