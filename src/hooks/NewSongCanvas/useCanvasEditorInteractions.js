import { useCallback } from 'react';

export const useCanvasEditorInteractions = ({
  clearContextSubmenu,
  clearTouchLongPress,
  closeContextMenu,
  content,
  contextMenuDimensions,
  editorContainerRef,
  focusLine,
  handleAddTranslation,
  handleCleanup,
  handleDuplicateLine,
  lastKnownScrollRef,
  lineMetrics,
  lineOffsets,
  lines,
  scrollTop,
  setContent,
  setPendingFocus,
  setScrollTop,
  setSelectedLineIndex,
  setContextMenuState,
  textareaRef,
  touchLongPressTimeoutRef,
  touchMovedRef,
  touchStartPositionRef,
}) => {
  const findLineIndexByPosition = useCallback((yPosition) => {
    if (!lineMetrics.length) return null;
    for (let index = 0; index < lineMetrics.length; index += 1) {
      const metric = lineMetrics[index];
      if (!metric) continue;
      const start = metric.top;
      const end = metric.top + Math.max(metric.height, 1);
      if (yPosition >= start && yPosition <= end) {
        return index;
      }
    }
    return null;
  }, [lineMetrics]);

  const focusInsideBrackets = useCallback((lineIndex) => {
    if (lineIndex === null || lineIndex === undefined) return;
    setPendingFocus({ type: 'translation', lineIndex });
  }, [setPendingFocus]);

  const getLineIndexFromOffset = useCallback((offset) => {
    if (offset <= 0) return 0;
    const value = content.slice(0, offset);
    const index = value.split('\n').length - 1;
    return Math.max(0, Math.min(lines.length - 1, index));
  }, [content, lines.length]);

  const handleTextareaScroll = useCallback((event) => {
    const currentScrollTop = event.target.scrollTop;
    setScrollTop(currentScrollTop);
    lastKnownScrollRef.current = currentScrollTop;
    setSelectedLineIndex(null);
    closeContextMenu();
  }, [closeContextMenu, lastKnownScrollRef, setScrollTop, setSelectedLineIndex]);

  const handleContentChange = useCallback((event) => {
    const {
      value,
      selectionStart,
      selectionEnd,
      scrollTop: currentScrollTop
    } = event.target;
    const safeScroll = typeof currentScrollTop === 'number' ? currentScrollTop : lastKnownScrollRef.current;
    lastKnownScrollRef.current = safeScroll;
    if (typeof safeScroll === 'number') {
      setScrollTop(safeScroll);
    }
    setContent(value, {
      selectionStart,
      selectionEnd,
      scrollTop: safeScroll,
      timestamp: Date.now(),
      coalesceKey: 'typing'
    });
  }, [lastKnownScrollRef, setContent, setScrollTop]);

  const handleTextareaSelect = useCallback(() => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const lineIndex = getLineIndexFromOffset(start);
    setSelectedLineIndex(lineIndex);
  }, [getLineIndexFromOffset, setSelectedLineIndex, textareaRef]);

  const handleTextareaKeyDown = useCallback((event) => {
    if (!textareaRef.current) return;
    const usesModifier = event.ctrlKey || event.metaKey;
    if (!usesModifier || event.altKey) return;

    const key = (event.key || '').toLowerCase();
    const start = textareaRef.current.selectionStart ?? 0;
    const lineIndex = getLineIndexFromOffset(start);

    if (key === 'd') {
      event.preventDefault();
      handleDuplicateLine(lineIndex);
    } else if (key === 't') {
      event.preventDefault();
      handleAddTranslation(lineIndex);
    } else if (key === 'l') {
      event.preventDefault();
      closeContextMenu();
      focusLine(lineIndex);
    }
  }, [closeContextMenu, focusLine, getLineIndexFromOffset, handleAddTranslation, handleDuplicateLine, textareaRef]);

  const handleCanvasContextMenu = useCallback((event) => {
    event.preventDefault();
    if (!editorContainerRef.current) return;
    const rect = editorContainerRef.current.getBoundingClientRect();
    const textarea = textareaRef.current;
    const previousCursorOffset = textarea ? textarea.selectionStart : null;
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;
    const hasSelection = Boolean(
      textarea &&
      textarea.selectionStart !== textarea.selectionEnd
    );
    const fallbackWidth = hasSelection ? 168 : 192;
    const fallbackHeight = hasSelection ? 152 : 192;
    const menuWidth = contextMenuDimensions.width || fallbackWidth;
    const menuHeight = contextMenuDimensions.height || fallbackHeight;
    const safeX = Math.max(8, Math.min(rawX, Math.max(8, rect.width - menuWidth - 8)));
    const safeY = Math.max(8, Math.min(rawY, Math.max(8, rect.height - menuHeight - 8)));

    if (hasSelection) {
      const selectionLineIndex = textarea ? getLineIndexFromOffset(textarea.selectionStart) : null;
      clearContextSubmenu();
      setContextMenuState({
        visible: true,
        x: safeX,
        y: safeY,
        lineIndex: selectionLineIndex,
        mode: 'selection',
        cursorOffset: previousCursorOffset
      });
      return;
    }

    const relativeY = rawY + scrollTop;
    const lineIndex = findLineIndexByPosition(relativeY);
    if (lineIndex === null) return;

    const offsets = lineOffsets[lineIndex];
    if (offsets && textarea) {
      try {
        textarea.focus({ preventScroll: true });
      } catch (err) {
        textarea.focus();
      }
    }

    setSelectedLineIndex(lineIndex);
    clearContextSubmenu();
    setContextMenuState({
      visible: true,
      x: safeX,
      y: safeY,
      lineIndex,
      mode: 'line',
      cursorOffset: previousCursorOffset ?? (offsets ? offsets.start : null)
    });
  }, [clearContextSubmenu, contextMenuDimensions.height, contextMenuDimensions.width, editorContainerRef, findLineIndexByPosition, getLineIndexFromOffset, lineOffsets, scrollTop, setContextMenuState, setSelectedLineIndex, textareaRef]);

  const handleTouchStart = useCallback((event) => {
    if (!event.touches || event.touches.length !== 1) {
      clearTouchLongPress();
      return;
    }
    const touch = event.touches[0];
    clearTouchLongPress();
    touchMovedRef.current = false;
    touchStartPositionRef.current = {
      clientX: touch.clientX,
      clientY: touch.clientY
    };
    touchLongPressTimeoutRef.current = window.setTimeout(() => {
      if (touchMovedRef.current) return;
      const coords = touchStartPositionRef.current;
      if (!coords) return;
      clearTouchLongPress();
      const syntheticEvent = {
        preventDefault: () => { },
        stopPropagation: () => { },
        clientX: coords.clientX,
        clientY: coords.clientY
      };
      handleCanvasContextMenu(syntheticEvent);
      touchStartPositionRef.current = null;
    }, 550);
  }, [clearTouchLongPress, handleCanvasContextMenu, touchLongPressTimeoutRef, touchMovedRef, touchStartPositionRef]);

  const handleTouchMove = useCallback((event) => {
    if (!touchStartPositionRef.current || !event.touches || event.touches.length !== 1) {
      clearTouchLongPress();
      touchStartPositionRef.current = null;
      return;
    }
    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPositionRef.current.clientX);
    const deltaY = Math.abs(touch.clientY - touchStartPositionRef.current.clientY);
    if (deltaX > 10 || deltaY > 10) {
      touchMovedRef.current = true;
      clearTouchLongPress();
      touchStartPositionRef.current = null;
    }
  }, [clearTouchLongPress, touchMovedRef, touchStartPositionRef]);

  const handleTouchEnd = useCallback(() => {
    clearTouchLongPress();
    touchStartPositionRef.current = null;
  }, [clearTouchLongPress, touchStartPositionRef]);

  const handleTouchCancel = useCallback(() => {
    clearTouchLongPress();
    touchStartPositionRef.current = null;
  }, [clearTouchLongPress, touchStartPositionRef]);

  const handleAddDefaultTags = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const defaultTags = '[ti:Song Title]\n[ar:Song Artist]\n[al:Song Album]\n[by:LRC Author]\n[length:00:00]\n\n';
    const currentContent = textarea.value;
    const newContent = defaultTags + currentContent;
    const currentScroll = textarea.scrollTop;

    textarea.value = newContent;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(0, 0);
    textarea.scrollTop = currentScroll;

    setContent(newContent, {
      selectionStart: 0,
      selectionEnd: 0,
      scrollTop: currentScroll,
      timestamp: Date.now(),
      coalesceKey: 'metadata'
    });
    lastKnownScrollRef.current = currentScroll;
    closeContextMenu();
  }, [closeContextMenu, lastKnownScrollRef, setContent, textareaRef]);

  const handleCleanupFromContext = useCallback(() => {
    handleCleanup();
    closeContextMenu();
  }, [closeContextMenu, handleCleanup]);

  const isCursorAtEligiblePosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return false;

    const cursorPos = textarea.selectionStart;
    const lineIndex = getLineIndexFromOffset(cursorPos);
    const lineText = lines[lineIndex] ?? '';
    const lineOffset = lineOffsets[lineIndex];

    if (!lineOffset) return false;

    if (lineText.trim().length === 0) return true;

    if (cursorPos === lineOffset.start) return true;

    if (cursorPos === lineOffset.end) return true;

    return false;
  }, [getLineIndexFromOffset, lineOffsets, lines, textareaRef]);

  const insertSectionAtCursor = useCallback((sectionName) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const lineIndex = getLineIndexFromOffset(cursorPos);
    const lineText = lines[lineIndex] ?? '';
    const lineOffset = lineOffsets[lineIndex];

    if (!lineOffset) return;

    const sectionTag = `[${sectionName}]`;
    const currentScroll = textarea.scrollTop;

    let newContent;
    let newCursorPos;

    if (lineText.trim().length === 0) {
      const beforeLine = content.substring(0, lineOffset.start);
      const afterLine = content.substring(lineOffset.end);
      newContent = beforeLine + sectionTag + '\n' + afterLine;
      newCursorPos = lineOffset.start + sectionTag.length + 1;
    } else if (cursorPos === lineOffset.start) {
      const beforeLine = content.substring(0, lineOffset.start);
      const afterLine = content.substring(lineOffset.start);
      newContent = beforeLine + sectionTag + '\n\n' + afterLine;
      newCursorPos = lineOffset.start + sectionTag.length + 1;
    } else if (cursorPos === lineOffset.end) {
      const beforeLine = content.substring(0, lineOffset.end);
      const afterLine = content.substring(lineOffset.end);
      newContent = beforeLine + '\n' + sectionTag + '\n' + afterLine;
      newCursorPos = lineOffset.end + 1 + sectionTag.length + 1;
    } else {
      return;
    }

    setContent(newContent, {
      selectionStart: newCursorPos,
      selectionEnd: newCursorPos,
      scrollTop: currentScroll,
      timestamp: Date.now(),
      coalesceKey: 'section'
    });

    lastKnownScrollRef.current = currentScroll;

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus({ preventScroll: true });
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.scrollTop = currentScroll;
      }
    });

    closeContextMenu();
  }, [closeContextMenu, content, getLineIndexFromOffset, lastKnownScrollRef, lineOffsets, lines, setContent, textareaRef]);

  return {
    focusInsideBrackets,
    getLineIndexFromOffset,
    handleAddDefaultTags,
    handleCanvasContextMenu,
    handleCleanupFromContext,
    handleContentChange,
    handleTextareaKeyDown,
    handleTextareaScroll,
    handleTextareaSelect,
    handleTouchCancel,
    handleTouchEnd,
    handleTouchMove,
    handleTouchStart,
    insertSectionAtCursor,
    isCursorAtEligiblePosition,
  };
};
