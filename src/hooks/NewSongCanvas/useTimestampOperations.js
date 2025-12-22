import { useCallback } from 'react';

const STANDARD_LRC_PLACEHOLDER = '[00:00.00]';
const STANDARD_LRC_CAPTURE_REGEX = /^\s*\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/;

/**
 * Hook for timestamp insertion operations
 * @param {Object} params
 * @param {React.RefObject} params.textareaRef - Reference to textarea element
 * @param {Function} params.setContent - Content setter function
 * @param {Function} params.closeContextMenu - Function to close context menu
 * @param {Function} params.setSelectedLineIndex - Function to set selected line
 * @param {Function} params.getLineStartOffset - Function to get line start offset
 * @param {Object} params.contextMenuState - Current context menu state
 * @param {React.RefObject} params.lastKnownScrollRef - Reference to last known scroll position
 * @returns {Object} - Timestamp operation handlers
 */
const useTimestampOperations = ({
  textareaRef,
  setContent,
  closeContextMenu,
  setSelectedLineIndex,
  getLineStartOffset,
  contextMenuState,
  lastKnownScrollRef
}) => {
  const insertStandardTimestampAtLine = useCallback((lineIndex) => {
    if (lineIndex === null || lineIndex === undefined) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const segments = textarea.value.split('\n');
    const safeIndex = Math.max(0, Math.min(lineIndex, segments.length - 1));
    const lineText = segments[safeIndex] ?? '';
    const leadingMatch = lineText.match(/^\s*/);
    const leadingWhitespace = leadingMatch ? leadingMatch[0] : '';
    const afterLeading = lineText.slice(leadingWhitespace.length);
    const timestampMatch = afterLeading.match(/^((\[\d{1,2}:\d{2}(?:\.\d{1,2})?\])+)(\s*)/);
    const existingBlock = timestampMatch ? timestampMatch[1] : '';
    const remainder = timestampMatch ? afterLeading.slice(timestampMatch[0].length) : afterLeading;
    const cleanedRemainder = remainder.replace(/^\s*/, '');

    const newLine = `${leadingWhitespace}${existingBlock}${STANDARD_LRC_PLACEHOLDER}${cleanedRemainder ? ` ${cleanedRemainder}` : ' '}`;
    segments[safeIndex] = newLine;
    const newContent = segments.join('\n');

    const lineStart = getLineStartOffset(segments, safeIndex);
    const caretStart = lineStart + leadingWhitespace.length + existingBlock.length + 1;
    const caretEnd = caretStart + 2;
    const currentScroll = textarea.scrollTop;

    textarea.value = newContent;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(caretStart, caretEnd);
    textarea.scrollTop = currentScroll;

    setContent(newContent, {
      selectionStart: caretStart,
      selectionEnd: caretEnd,
      scrollTop: currentScroll,
      timestamp: Date.now(),
      coalesceKey: 'timestamp'
    });
    lastKnownScrollRef.current = currentScroll;
    setSelectedLineIndex(safeIndex);
    closeContextMenu();
  }, [closeContextMenu, getLineStartOffset, setContent, textareaRef, setSelectedLineIndex, lastKnownScrollRef]);

  const insertEnhancedTimestampAtCursor = useCallback((lineIndex) => {
    if (lineIndex === null || lineIndex === undefined) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const segments = textarea.value.split('\n');
    const safeIndex = Math.max(0, Math.min(lineIndex, segments.length - 1));
    const lineText = segments[safeIndex] ?? '';
    const baseMatch = lineText.match(STANDARD_LRC_CAPTURE_REGEX);
    if (!baseMatch) return;

    const minutes = String(baseMatch[1] ?? '0').padStart(2, '0');
    const seconds = String(baseMatch[2] ?? '0').padStart(2, '0');
    const hundredths = (baseMatch[3] ?? '0').slice(0, 2).padEnd(2, '0');
    const tag = `<${minutes}:${seconds}.${hundredths}>`;

    const fallbackOffset = getLineStartOffset(segments, safeIndex) + (lineText?.length ?? 0);
    const currentOffset = typeof contextMenuState.cursorOffset === 'number'
      ? contextMenuState.cursorOffset
      : (textarea.selectionStart ?? fallbackOffset);

    const lineStart = getLineStartOffset(segments, safeIndex);
    const relativeOffset = Math.max(0, Math.min((currentOffset ?? fallbackOffset) - lineStart, lineText.length));

    const before = lineText.slice(0, relativeOffset);
    const after = lineText.slice(relativeOffset);
    segments[safeIndex] = `${before}${tag}${after}`;
    const newContent = segments.join('\n');

    const caretStart = lineStart + before.length + 7;
    const caretEnd = caretStart + 2;
    const currentScroll = textarea.scrollTop;

    textarea.value = newContent;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(caretStart, caretEnd);
    textarea.scrollTop = currentScroll;

    setContent(newContent, {
      selectionStart: caretStart,
      selectionEnd: caretEnd,
      scrollTop: currentScroll,
      timestamp: Date.now(),
      coalesceKey: 'timestamp'
    });
    lastKnownScrollRef.current = currentScroll;
    setSelectedLineIndex(safeIndex);
    closeContextMenu();
  }, [closeContextMenu, contextMenuState.cursorOffset, getLineStartOffset, setContent, textareaRef, setSelectedLineIndex, lastKnownScrollRef]);

  const insertMetadataTagAtCursor = useCallback((lineIndex, key) => {
    if (lineIndex === null || lineIndex === undefined) return;
    if (!key) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const segments = textarea.value.split('\n');
    const safeIndex = Math.max(0, Math.min(lineIndex, segments.length - 1));
    const lineText = segments[safeIndex] ?? '';
    const tag = `[${key}:]`;

    const fallbackOffset = getLineStartOffset(segments, safeIndex) + (lineText?.length ?? 0);
    const currentOffset = typeof contextMenuState.cursorOffset === 'number'
      ? contextMenuState.cursorOffset
      : (textarea.selectionStart ?? fallbackOffset);

    const lineStart = getLineStartOffset(segments, safeIndex);
    const relativeOffset = Math.max(0, Math.min((currentOffset ?? fallbackOffset) - lineStart, lineText.length));

    const before = lineText.slice(0, relativeOffset);
    const after = lineText.slice(relativeOffset);
    segments[safeIndex] = `${before}${tag}${after}`;
    const newContent = segments.join('\n');

    const caretPos = lineStart + before.length + key.length + 2;
    const currentScroll = textarea.scrollTop;

    textarea.value = newContent;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(caretPos, caretPos);
    textarea.scrollTop = currentScroll;

    setContent(newContent, {
      selectionStart: caretPos,
      selectionEnd: caretPos,
      scrollTop: currentScroll,
      timestamp: Date.now(),
      coalesceKey: 'metadata'
    });
    lastKnownScrollRef.current = currentScroll;
    setSelectedLineIndex(safeIndex);
    closeContextMenu();
  }, [closeContextMenu, contextMenuState.cursorOffset, getLineStartOffset, setContent, textareaRef, setSelectedLineIndex, lastKnownScrollRef]);

  return {
    insertStandardTimestampAtLine,
    insertEnhancedTimestampAtCursor,
    insertMetadataTagAtCursor
  };
};

export default useTimestampOperations;