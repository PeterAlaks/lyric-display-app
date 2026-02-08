import { useEffect } from 'react';

export const useKeyboardShortcuts = ({
  handleBack,
  handleSave,
  handleSaveAndLoad,
  handleCleanup,
  handleStartNewSong,
  handleOpenSearchBar,
  handleOpenReplaceBar,
  handleOpenLyrics,
  handleOpenPreferences,
  isContentEmpty,
  isTitleEmpty,
  composeMode,
  editMode = false,
  hasUnsavedChanges = true
}) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const activeElement = document.activeElement;
      const isTypingInTextarea = activeElement && activeElement.tagName === 'TEXTAREA';
      const isTypingInInput = activeElement && activeElement.tagName === 'INPUT';

      if (event.key === 'Backspace' && !isTypingInInput && !isTypingInTextarea) {
        event.preventDefault();
        handleBack();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'f' || event.key === 'F')) {
        event.preventDefault();
        if (handleOpenSearchBar) {
          handleOpenSearchBar();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'h' || event.key === 'H')) {
        event.preventDefault();
        if (handleOpenReplaceBar) {
          handleOpenReplaceBar();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S') && !event.shiftKey) {
        if (!composeMode && !isContentEmpty && !isTitleEmpty && (!editMode || hasUnsavedChanges)) {
          event.preventDefault();
          handleSave();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'l' || event.key === 'L')) {
        if (!isContentEmpty && !isTitleEmpty && (!editMode || hasUnsavedChanges)) {
          event.preventDefault();
          handleSaveAndLoad();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'c' || event.key === 'C')) {
        if (!isContentEmpty) {
          event.preventDefault();
          handleCleanup();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'n' || event.key === 'N')) {
        if (handleStartNewSong) {
          event.preventDefault();
          handleStartNewSong();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'o' || event.key === 'O')) {
        if (handleOpenLyrics) {
          event.preventDefault();
          handleOpenLyrics();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'i' || event.key === 'I')) {
        if (isTypingInInput || isTypingInTextarea) return;
        if (handleOpenPreferences) {
          event.preventDefault();
          handleOpenPreferences();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [composeMode, editMode, handleBack, handleCleanup, handleOpenLyrics, handleOpenReplaceBar, handleOpenSearchBar, handleSave, handleSaveAndLoad, handleStartNewSong, handleOpenPreferences, hasUnsavedChanges, isContentEmpty, isTitleEmpty]);
};