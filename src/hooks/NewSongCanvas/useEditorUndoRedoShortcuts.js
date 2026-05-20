import { useCallback, useEffect } from 'react';

export const useEditorUndoRedoShortcuts = ({
  lastKnownScrollRef,
  redo,
  setScrollTop,
  textareaRef,
  undo,
}) => {
  const restoreFromHistoryMeta = useCallback((meta, fallbackMeta = null) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionStart = typeof meta?.selectionStart === 'number'
      ? meta.selectionStart
      : (typeof fallbackMeta?.selectionStart === 'number' ? fallbackMeta.selectionStart : null);
    const selectionEnd = typeof meta?.selectionEnd === 'number'
      ? meta.selectionEnd
      : (typeof fallbackMeta?.selectionEnd === 'number'
        ? fallbackMeta.selectionEnd
        : selectionStart);
    const scrollTopValue = typeof meta?.scrollTop === 'number'
      ? meta.scrollTop
      : (typeof fallbackMeta?.scrollTop === 'number'
        ? fallbackMeta.scrollTop
        : lastKnownScrollRef.current);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      if (typeof scrollTopValue === 'number') {
        textareaRef.current.scrollTop = scrollTopValue;
        lastKnownScrollRef.current = scrollTopValue;
        setScrollTop(scrollTopValue);
      }
      try {
        textareaRef.current.focus({ preventScroll: true });
      } catch (err) {
        textareaRef.current.focus();
      }
      if (selectionStart !== null && selectionEnd !== null) {
        textareaRef.current.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  }, [lastKnownScrollRef, setScrollTop, textareaRef]);

  const handleUndo = useCallback(() => {
    const fallbackMeta = textareaRef.current ? {
      selectionStart: textareaRef.current.selectionStart,
      selectionEnd: textareaRef.current.selectionEnd,
      scrollTop: textareaRef.current.scrollTop
    } : { scrollTop: lastKnownScrollRef.current };

    const previousEntry = undo();
    if (previousEntry?.meta) {
      restoreFromHistoryMeta(previousEntry.meta, fallbackMeta);
    }
  }, [lastKnownScrollRef, restoreFromHistoryMeta, textareaRef, undo]);

  const handleRedo = useCallback(() => {
    const fallbackMeta = textareaRef.current ? {
      selectionStart: textareaRef.current.selectionStart,
      selectionEnd: textareaRef.current.selectionEnd,
      scrollTop: textareaRef.current.scrollTop
    } : { scrollTop: lastKnownScrollRef.current };

    const nextEntry = redo();
    if (nextEntry?.meta) {
      restoreFromHistoryMeta(nextEntry.meta, fallbackMeta);
    }
  }, [lastKnownScrollRef, redo, restoreFromHistoryMeta, textareaRef]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const usesModifier = event.ctrlKey || event.metaKey;
      if (!usesModifier) return;

      if (event.key === 'z' || event.key === 'Z') {
        if (event.shiftKey) {
          event.preventDefault();
          handleRedo();
        } else {
          event.preventDefault();
          handleUndo();
        }
      } else if (event.key === 'y' || event.key === 'Y') {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRedo, handleUndo]);

  return { handleRedo, handleUndo };
};
