import { useCallback } from 'react';

export const useCanvasNavigationActions = ({
  hasUnsavedChanges,
  navigate,
  showModal,
  showToast,
}) => {
  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      showToast({
        title: 'Unsaved changes',
        message: 'You have unsaved changes. Discard them?',
        variant: 'warn',
        duration: 0,
        dedupeKey: 'unsaved-changes',
        actions: [
          { label: 'Yes, discard', onClick: () => navigate('/') },
          { label: 'Cancel', onClick: () => { } },
        ],
      });
      return;
    }
    navigate('/');
  }, [hasUnsavedChanges, navigate, showToast]);

  const handleStartNewSong = useCallback(() => {
    const navigateToNew = () => navigate('/new-song?mode=new');

    if (hasUnsavedChanges) {
      showToast({
        title: 'Unsaved changes',
        message: 'You have unsaved changes. Discard them?',
        variant: 'warn',
        duration: 0,
        dedupeKey: 'unsaved-changes',
        actions: [
          { label: 'Yes, discard', onClick: navigateToNew },
          { label: 'Cancel', onClick: () => { } },
        ],
      });
      return;
    }

    navigateToNew();
  }, [hasUnsavedChanges, navigate, showToast]);

  const handleOpenLyrics = useCallback(async () => {
    try {
      if (window?.electronAPI?.loadLyricsFile) {
        const result = await window.electronAPI.loadLyricsFile();
        if (result?.success && result.content) {
          showModal({
            title: 'Load Lyrics File',
            description: `You've selected "${result.fileName || 'a lyrics file'}". Choose where to load it:`,
            body: 'Load into the Canvas Editor to edit the lyrics, or load into the Control Panel to display them on your outputs.',
            variant: 'info',
            size: 'sm',
            actions: [
              {
                label: 'Load into Canvas Editor',
                variant: 'default',
                value: 'canvas',
                onSelect: () => {
                  window.dispatchEvent(new CustomEvent('load-into-canvas', {
                    detail: {
                      content: result.content,
                      fileName: result.fileName,
                      filePath: result.filePath
                    }
                  }));
                }
              },
              {
                label: 'Load into Control Panel',
                variant: 'outline',
                value: 'control',
                onSelect: () => {
                  window.__pendingLyricsLoad = {
                    content: result.content,
                    fileName: result.fileName,
                    filePath: result.filePath
                  };
                  navigate('/');
                }
              }
            ]
          });
        }
      }
    } catch (error) {
      showToast({
        title: 'Load failed',
        message: error?.message || 'Could not load file',
        variant: 'error'
      });
    }
  }, [navigate, showModal, showToast]);

  const handleOpenPreferences = useCallback(() => {
    showModal({
      title: 'Preferences',
      headerDescription: 'Configure application settings and preferences',
      component: 'UserPreferences',
      variant: 'info',
      size: 'lg',
      actions: [],
      allowBackdropClose: false,
      customLayout: true
    });
  }, [showModal]);

  return { handleBack, handleOpenLyrics, handleOpenPreferences, handleStartNewSong };
};
