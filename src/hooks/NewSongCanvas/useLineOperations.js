import { useCallback } from 'react';

const BRACKET_PAIRS = {
  '(': ')',
  '{': '}',
  '[': ']',
  '<': '>'
};

/**
 * Hook for line manipulation operations (add translation, copy, duplicate)
 * @param {Object} params
 * @param {Array<string>} params.lines - Array of content lines
 * @param {React.RefObject} params.textareaRef - Reference to textarea element
 * @param {Function} params.setContent - Content setter function
 * @param {Function} params.closeContextMenu - Function to close context menu
 * @param {Function} params.focusLine - Function to focus a specific line
 * @param {Function} params.preserveTextareaScroll - Function to preserve scroll position
 * @param {Function} params.showToast - Toast notification function
 * @param {React.RefObject} params.lastKnownScrollRef - Reference to last known scroll position
 * @param {Function} params.setSelectedLineIndex - Function to set selected line
 * @returns {Object} - Line operation handlers
 */
const useLineOperations = ({
  lines,
  textareaRef,
  setContent,
  closeContextMenu,
  focusLine,
  preserveTextareaScroll,
  showToast,
  lastKnownScrollRef,
  setSelectedLineIndex
}) => {
  const isLineWrappedWithTranslation = useCallback((rawLine) => {
    const trimmed = (rawLine ?? '').trim();
    if (trimmed.length < 2) return false;
    const ending = BRACKET_PAIRS[trimmed[0]];
    return Boolean(ending && trimmed.endsWith(ending));
  }, []);

  const handleAddTranslation = useCallback((lineIndex) => {
    if (lineIndex === null || lineIndex === undefined) return;
    const lineText = lines[lineIndex] ?? '';
    if (isLineWrappedWithTranslation(lineText)) {
      focusLine(lineIndex);
      closeContextMenu();
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    const currentContent = textarea.value;
    const currentScroll = textarea.scrollTop;
    const segments = currentContent.split('\n');
    const safeIndex = Math.max(0, Math.min(lineIndex, segments.length - 1));

    let newCursorPos = 0;
    for (let i = 0; i <= safeIndex; i++) {
      newCursorPos += segments[i].length + 1;
    }
    newCursorPos += 1;

    segments.splice(safeIndex + 1, 0, '()');
    const newContent = segments.join('\n');

    textarea.value = newContent;
    textarea.focus();
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.scrollTop = currentScroll;

    setContent(newContent, {
      selectionStart: newCursorPos,
      selectionEnd: newCursorPos,
      scrollTop: currentScroll,
      timestamp: Date.now(),
      coalesceKey: 'structure'
    });
    lastKnownScrollRef.current = currentScroll;
    setSelectedLineIndex(lineIndex + 1);
    closeContextMenu();
  }, [closeContextMenu, isLineWrappedWithTranslation, lines, focusLine, textareaRef, setContent, lastKnownScrollRef, setSelectedLineIndex]);

  const handleCopyLine = useCallback(async (lineIndex) => {
    const lineText = lines[lineIndex] ?? '';
    try {
      await navigator.clipboard.writeText(lineText);
      showToast({
        title: 'Line copied',
        message: 'Lyric line copied to clipboard.',
        variant: 'success'
      });
    } catch (err) {
      console.error('Failed to copy line:', err);
      showToast({
        title: 'Copy failed',
        message: 'Unable to copy the selected line.',
        variant: 'error'
      });
    }
    focusLine(lineIndex);
    closeContextMenu();
  }, [closeContextMenu, focusLine, lines, showToast]);

  const handleDuplicateLine = useCallback((lineIndex) => {
    preserveTextareaScroll(() => {
      const currentScroll = textareaRef.current?.scrollTop ?? lastKnownScrollRef.current ?? 0;
      setContent((prev) => {
        const segments = prev.split('\n');
        const safeIndex = Math.max(0, Math.min(lineIndex, segments.length - 1));
        const lineToDuplicate = segments[safeIndex] ?? '';
        segments.splice(safeIndex + 1, 0, '', lineToDuplicate);
        return segments.join('\n');
      }, {
        selectionStart: null,
        selectionEnd: null,
        scrollTop: currentScroll,
        timestamp: Date.now(),
        coalesceKey: 'structure'
      });
    });
    focusLine(lineIndex + 2);
    closeContextMenu();
  }, [closeContextMenu, focusLine, preserveTextareaScroll, setContent]);

  return {
    handleAddTranslation,
    handleCopyLine,
    handleDuplicateLine,
    isLineWrappedWithTranslation
  };
};

export default useLineOperations;