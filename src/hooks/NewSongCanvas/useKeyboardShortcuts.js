import { useEffect } from 'react';

export const useKeyboardShortcuts = ({
  handleBack,
  handleSave,
  handleSaveAndLoad,
  handleCleanup,
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [composeMode, editMode, handleBack, handleCleanup, handleSave, handleSaveAndLoad, hasUnsavedChanges, isContentEmpty, isTitleEmpty]);
};