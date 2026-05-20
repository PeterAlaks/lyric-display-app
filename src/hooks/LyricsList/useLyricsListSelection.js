import React, { useCallback, useEffect, useMemo, useState } from 'react';
import useContextMenuPosition from '../useContextMenuPosition';

export default function useLyricsListSelection({
  lyrics,
  selectedLine,
  isDesktopApp,
  selectionMode,
  onEnterSelectionMode,
  onSelectionStateChange,
  onContextMenuApiReady,
  clickAwayIgnoreRefs,
  onLineSelect,
  selectLine,
  emitLineUpdate,
  getNormalGroupLines,
  showToast,
}) {
  const selectionAnchorRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const contextMenuRef = React.useRef(null);
  const touchTimerRef = React.useRef(null);
  const touchStartPosRef = React.useRef(null);
  const longPressTriggeredRef = React.useRef(false);
  const prevSelectionModeRef = React.useRef(selectionMode);

  const [selectedIndices, setSelectedIndices] = useState(() => new Set());
  const [contextMenuState, setContextMenuState] = useState({ visible: false, x: 0, y: 0, index: null, mode: 'line' });
  const [contextMenuDimensions, setContextMenuDimensions] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 0, height: typeof window !== 'undefined' ? window.innerHeight : 0 });

  const selectedIndicesArray = useMemo(() => Array.from(selectedIndices).sort((a, b) => a - b), [selectedIndices]);
  const hasSelection = selectedIndicesArray.length > 0;

  useEffect(() => {
    if (!onSelectionStateChange) return;
    onSelectionStateChange({
      totalSelected: selectedIndices.size,
      totalLines: lyrics.length,
      hasSelection: selectedIndices.size > 0,
    });
  }, [lyrics.length, onSelectionStateChange, selectedIndices]);

  const { contextMenuPosition } = useContextMenuPosition({
    contextMenuState,
    contextMenuDimensions,
    containerSize,
    fallbackDimensions: { width: 192, height: 224 }
  });

  useEffect(() => {
    const updateSize = () => setContainerSize({ width: window.innerWidth, height: window.innerHeight });
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuState({ visible: false, x: 0, y: 0, index: null, mode: 'line' });
  }, []);

  useEffect(() => {
    if (!contextMenuState.visible) return;
    const handleClickAway = (event) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(event.target)) return;
      closeContextMenu();
    };
    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [contextMenuState.visible, closeContextMenu]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!containerRef.current) return;

      const isInsideContainer = containerRef.current.contains(event.target);
      const isInsideIgnored = (clickAwayIgnoreRefs || []).some((ref) => {
        const node = ref?.current;
        return node && node.contains && node.contains(event.target);
      });

      if (isInsideContainer || isInsideIgnored) return;

      setSelectedIndices(new Set());
      selectionAnchorRef.current = null;
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [clickAwayIgnoreRefs]);

  const setSelection = useCallback((nextIndices, anchor) => {
    setSelectedIndices(new Set(nextIndices instanceof Set ? Array.from(nextIndices) : nextIndices));
    if (anchor !== undefined) {
      selectionAnchorRef.current = anchor;
    }
  }, []);

  const toggleSelection = useCallback((index) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelection(next, index);
  }, [selectedIndices, setSelection]);

  const handleRangeSelection = useCallback((index) => {
    const anchor = selectionAnchorRef.current ?? selectedLine ?? index;
    const start = Math.min(anchor, index);
    const end = Math.max(anchor, index);
    const range = [];
    for (let i = start; i <= end; i += 1) range.push(i);
    setSelection(range, anchor);
  }, [selectedLine, setSelection]);

  const handleContextMenuOpen = useCallback((event, index) => {
    if (longPressTriggeredRef.current) {
      event?.preventDefault?.();
      return;
    }

    if (!isDesktopApp) {
      const nativeEvent = event?.nativeEvent;
      if (event?.touches || nativeEvent?.touches || nativeEvent?.pointerType === 'touch') {
        return;
      }
    }

    event.preventDefault();

    if (!selectedIndices.has(index)) {
      setSelection([index], index);
    }

    setContextMenuState({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      index,
      mode: 'line'
    });
  }, [isDesktopApp, selectedIndices, setSelection]);

  const clearTouchTimer = useCallback(() => {
    if (touchTimerRef.current) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTouchTimer(), [clearTouchTimer]);

  const handleLongPress = useCallback((index) => {
    if (isDesktopApp) return;
    longPressTriggeredRef.current = true;
    touchStartPosRef.current = null;
    onEnterSelectionMode?.(index);
    setSelection([index], index);
    closeContextMenu();
  }, [closeContextMenu, isDesktopApp, onEnterSelectionMode, setSelection]);

  const handleRowTouchStart = useCallback((event, index) => {
    longPressTriggeredRef.current = false;
    if (!event.touches || event.touches.length !== 1) {
      clearTouchTimer();
      return;
    }

    const touch = event.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, index };
    clearTouchTimer();
    touchTimerRef.current = window.setTimeout(() => {
      handleLongPress(index);
      touchTimerRef.current = null;
    }, 450);
  }, [clearTouchTimer, handleLongPress]);

  const handleRowTouchMove = useCallback((event) => {
    if (!touchStartPosRef.current || !event.touches || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - touchStartPosRef.current.x;
    const dy = touch.clientY - touchStartPosRef.current.y;
    if (Math.hypot(dx, dy) > 10) {
      clearTouchTimer();
      touchStartPosRef.current = null;
    }
  }, [clearTouchTimer]);

  const handleRowTouchEnd = useCallback(() => {
    clearTouchTimer();
    touchStartPosRef.current = null;
  }, [clearTouchTimer]);

  const handleRowClick = useCallback((event, index) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (!isDesktopApp && selectionMode) {
      toggleSelection(index);
      closeContextMenu();
      return;
    }

    if (event?.shiftKey) {
      handleRangeSelection(index);
      closeContextMenu();
      return;
    }

    if (event?.ctrlKey || event?.metaKey) {
      const next = new Set(selectedIndices);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      setSelection(next, index);
      closeContextMenu();
      return;
    }

    selectionAnchorRef.current = index;
    setSelectedIndices(new Set([index]));
    closeContextMenu();
    onLineSelect(index);
  }, [closeContextMenu, handleRangeSelection, isDesktopApp, onLineSelect, selectedIndices, selectionMode, setSelection, toggleSelection]);

  useEffect(() => {
    const handleKeyClose = (event) => {
      if (event.key === 'Escape' && contextMenuState.visible) {
        closeContextMenu();
      }
    };
    window.addEventListener('keydown', handleKeyClose);
    return () => window.removeEventListener('keydown', handleKeyClose);
  }, [closeContextMenu, contextMenuState.visible]);

  useEffect(() => {
    if (!contextMenuState.visible) return;

    const preventScroll = (event) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(event.target)) {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });
    return () => {
      window.removeEventListener('wheel', preventScroll, { passive: false });
      window.removeEventListener('touchmove', preventScroll, { passive: false });
    };
  }, [contextMenuState.visible]);

  const getCopyTextForLine = useCallback((line) => {
    if (!line) return '';
    if (typeof line === 'string') return line;
    if (line.type === 'group') {
      return [line.mainLine, line.translation].filter(Boolean).join('\n');
    }
    if (line.type === 'normal-group') {
      return getNormalGroupLines(line).join('\n');
    }
    return '';
  }, [getNormalGroupLines]);

  const handleCopySelection = useCallback(async () => {
    if (!hasSelection) {
      closeContextMenu();
      return;
    }

    const text = selectedIndicesArray
      .map((i) => getCopyTextForLine(lyrics[i]))
      .filter(Boolean)
      .join('\n');

    try {
      if (text) {
        await navigator.clipboard.writeText(text);
        showToast({ title: 'Copied', message: 'Selected lines copied', variant: 'success' });
      }
    } catch (err) {
      showToast({ title: 'Copy failed', message: 'Unable to access clipboard', variant: 'error' });
    }

    closeContextMenu();
  }, [closeContextMenu, getCopyTextForLine, hasSelection, lyrics, selectedIndicesArray, showToast]);

  const handleSendSelectionToOutput = useCallback(() => {
    if (selectedIndicesArray.length !== 1) {
      closeContextMenu();
      return;
    }
    const target = selectedIndicesArray[0];
    setSelection([target], target);
    onLineSelect(target);
    closeContextMenu();
  }, [closeContextMenu, onLineSelect, selectedIndicesArray, setSelection]);

  const clearSelection = useCallback(() => {
    setSelectedIndices(new Set());
    selectionAnchorRef.current = null;
  }, []);

  const selectAllLines = useCallback(() => {
    if (!lyrics || !lyrics.length) {
      clearSelection();
      return;
    }
    const allIndices = lyrics.map((_, i) => i);
    setSelection(allIndices, 0);
  }, [clearSelection, lyrics, setSelection]);

  const openContextMenuForSelection = useCallback((anchorEl) => {
    const targetIndex = selectedIndicesArray[0] ?? selectedLine ?? null;
    if (targetIndex == null) return;

    const rect = anchorEl?.getBoundingClientRect?.();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.bottom + 8 : window.innerHeight / 2;

    if (!selectedIndices.size) {
      setSelection([targetIndex], targetIndex);
    }
    setContextMenuState({
      visible: true,
      x,
      y,
      index: targetIndex,
      mode: 'line'
    });
  }, [selectedIndices.size, selectedIndicesArray, selectedLine, setSelection]);

  useEffect(() => {
    if (!isDesktopApp && prevSelectionModeRef.current && !selectionMode) {
      clearSelection();
      longPressTriggeredRef.current = false;
    }
    prevSelectionModeRef.current = selectionMode;
  }, [clearSelection, isDesktopApp, selectionMode]);

  useEffect(() => {
    if (!onContextMenuApiReady) return;
    onContextMenuApiReady({
      clearSelection,
      selectAll: selectAllLines,
      openContextMenuForSelection,
    });
    return () => onContextMenuApiReady(null);
  }, [clearSelection, onContextMenuApiReady, openContextMenuForSelection, selectAllLines]);

  const handleDeselectFromMenu = useCallback(() => {
    selectLine(null);
    emitLineUpdate(null);
    closeContextMenu();
  }, [closeContextMenu, emitLineUpdate, selectLine]);

  return {
    containerRef,
    contextMenuRef,
    selectedIndices,
    setSelectedIndices,
    selectedIndicesArray,
    hasSelection,
    selectionAnchorRef,
    contextMenuState,
    contextMenuPosition,
    setContextMenuDimensions,
    closeContextMenu,
    handleContextMenuOpen,
    handleRowTouchStart,
    handleRowTouchMove,
    handleRowTouchEnd,
    handleRowClick,
    handleCopySelection,
    handleSendSelectionToOutput,
    handleDeselectFromMenu,
  };
}
