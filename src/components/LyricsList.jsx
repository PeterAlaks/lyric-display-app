import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { List, useDynamicRowHeight, useListRef } from 'react-window';
import { useLyricsState, useDarkModeState, useIsDesktopApp } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useToast from '../hooks/useToast';
import { ArrowRight, Copy, Link2, Redo, Undo, Ungroup, X } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import useContextMenuPosition from '../hooks/useContextMenuPosition';
import { STRUCTURE_TAG_PATTERNS, isNormalGroupCandidate } from '../../shared/lyricsParsing.js';
import useElectronListeners from '../hooks/LyricsList/useElectronListeners';

const DEFAULT_ROW_HEIGHT = 48;
const ROW_GAP = 8;
const VIRTUALIZATION_THRESHOLD = 200;
const HORIZONTAL_PADDING_PX = 16;

export default function LyricsList({
  searchQuery = '',
  highlightedLineIndex = null,
  onSelectLine,
  selectionMode = false,
  onEnterSelectionMode,
  onSelectionStateChange,
  onContextMenuApiReady,
  clickAwayIgnoreRefs = [],
}) {
  const listRef = useListRef();
  const {
    lyrics = [],
    lyricsSections = [],
    lineToSection = {},
    lyricsTimestamps = [],
    selectedLine,
    selectLine,
    setLyrics,
    setLyricsTimestamps
  } = useLyricsState();
  const { darkMode } = useDarkModeState();
  const isDesktopApp = useIsDesktopApp();
  const { emitLineUpdate, emitLyricsLoad, emitSplitNormalGroup } = useControlSocket();
  const { showToast } = useToast();
  const [hoveredLineIndex, setHoveredLineIndex] = useState(null);
  const [hoveredButtonIndex, setHoveredButtonIndex] = useState(null);
  const lastResetKeyRef = React.useRef(null);
  const suppressScrollResetRef = React.useRef(false);
  const historyMutationRef = React.useRef(false);
  const historySignatureRef = React.useRef(null);
  const selectionAnchorRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const contextMenuRef = React.useRef(null);
  const touchTimerRef = React.useRef(null);
  const touchStartPosRef = React.useRef(null);
  const longPressTriggeredRef = React.useRef(false);
  const prevSelectionModeRef = React.useRef(selectionMode);

  const [selectedIndices, setSelectedIndices] = useState(() => new Set());
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);
  const [contextMenuState, setContextMenuState] = useState({ visible: false, x: 0, y: 0, index: null, mode: 'line' });
  const [contextMenuDimensions, setContextMenuDimensions] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 0, height: typeof window !== 'undefined' ? window.innerHeight : 0 });

  const isStructureTagLine = useCallback((line) => {
    if (!line || typeof line !== 'string') return false;
    const trimmed = line.trim();
    if (!trimmed) return false;
    return STRUCTURE_TAG_PATTERNS.some((pattern) => pattern.test(trimmed));
  }, []);

  const sectionById = useMemo(() => {
    const map = new Map();
    (lyricsSections || []).forEach((section) => {
      if (section?.id) {
        map.set(section.id, section);
      }
    });
    return map;
  }, [lyricsSections]);

  const sectionStartLookup = useMemo(() => {
    const map = new Map();
    (lyricsSections || []).forEach((section) => {
      if (section && Number.isInteger(section.startLine)) {
        map.set(section.startLine, section.id);
      }
    });
    return map;
  }, [lyricsSections]);

  const activeSectionId = useMemo(() => {
    if (selectedLine == null) return null;
    return lineToSection[selectedLine] || null;
  }, [lineToSection, selectedLine]);

  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
    key: lyrics.length,
  });


  const getInitialRowHeight = useCallback((index) => {
    const line = lyrics[index];
    if (!line) return DEFAULT_ROW_HEIGHT;

    if (isStructureTagLine(line)) {
      return 8;
    }

    const hasSectionHeader = sectionStartLookup.has(index);

    if (line.type === 'group') {
      let height = 48;

      if (line.translation) {
        height += 24;
      }
      if (hasSectionHeader) height += 24;
      return height;
    }

    if (line.type === 'normal-group') {
      let height = 72;
      if (hasSectionHeader) height += 24;
      return height;
    }

    return DEFAULT_ROW_HEIGHT + (hasSectionHeader ? 24 : 0);
  }, [lyrics, sectionStartLookup, isStructureTagLine]);

  const rowHeightConfig = useMemo(() => ({
    ...dynamicRowHeight,
    getAverageRowHeight: () => {
      const averageContentHeight =
        dynamicRowHeight.getAverageRowHeight?.() ?? DEFAULT_ROW_HEIGHT;
      return averageContentHeight + ROW_GAP;
    },
    getRowHeight: (index) => {
      const measured = dynamicRowHeight.getRowHeight?.(index);
      const contentHeight = measured ?? getInitialRowHeight(index);
      return contentHeight + ROW_GAP;
    },
    observeRowElements: (elements) => {
      const cleanup = dynamicRowHeight.observeRowElements?.(elements);
      return typeof cleanup === 'function' ? cleanup : () => { };
    },
  }), [dynamicRowHeight, getInitialRowHeight]);

  const selectedIndicesArray = useMemo(() => Array.from(selectedIndices).sort((a, b) => a - b), [selectedIndices]);
  const hasSelection = selectedIndicesArray.length > 0;
  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;

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
    const x = event.clientX;
    const y = event.clientY;

    if (!selectedIndices.has(index)) {
      setSelection([index], index);
    }

    setContextMenuState({
      visible: true,
      x,
      y,
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
    if (!event.touches) {
      clearTouchTimer();
      return;
    }
    if (event.touches.length !== 1) {
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

  const handleLineClickPlain = useCallback(
    (index) => {
      if (onSelectLine) onSelectLine(index);
      else {
        selectLine(index);
        emitLineUpdate(index);
      }
    },
    [onSelectLine, selectLine, emitLineUpdate]
  );

  const isInputLike = (target) => {
    if (!target) return false;
    const tag = target.tagName;
    const editable = target.isContentEditable;
    return editable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  };

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
    handleLineClickPlain(index);
  }, [handleLineClickPlain, handleRangeSelection, selectedIndices, setSelection, closeContextMenu, isDesktopApp, selectionMode, toggleSelection]);

  const isGroupableLine = useCallback((line) => {
    if (typeof line !== 'string') return false;
    if (!line || !line.trim()) return false;
    if (isStructureTagLine(line)) return false;
    return isNormalGroupCandidate(line);
  }, [isStructureTagLine]);

  const canGroupSelected = useMemo(() => {
    if (selectedIndicesArray.length !== 2) return false;
    const [first, second] = selectedIndicesArray;
    if (second !== first + 1) return false;
    return isGroupableLine(lyrics[first]) && isGroupableLine(lyrics[second]);
  }, [isGroupableLine, lyrics, selectedIndicesArray]);

  const canUngroupSelected = useMemo(() => {
    if (selectedIndicesArray.length !== 1) return false;
    const line = lyrics[selectedIndicesArray[0]];
    return line?.type === 'normal-group';
  }, [lyrics, selectedIndicesArray]);

  const cloneLyrics = useCallback(() => lyrics.map((line) => (typeof line === 'string' ? line : { ...line })), [lyrics]);
  const cloneTimestamps = useCallback(
    () => (Array.isArray(lyricsTimestamps) ? [...lyricsTimestamps] : []),
    [lyricsTimestamps]
  );

  const takeSnapshot = useCallback(() => ({
    lyrics: cloneLyrics(),
    selectedLine,
    selection: selectedIndicesArray,
    timestamps: cloneTimestamps()
  }), [cloneLyrics, cloneTimestamps, selectedIndicesArray, selectedLine]);

  const pushHistorySnapshot = useCallback((snapshot) => {
    setHistoryPast((prev) => {
      const next = [...prev, snapshot];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
    setHistoryFuture([]);
  }, []);

  const remapSelectedLineAfterGroup = (current, firstIndex) => {
    if (current == null) return null;
    if (current === firstIndex || current === firstIndex + 1) return firstIndex;
    if (current > firstIndex + 1) return current - 1;
    return current;
  };

  const remapSelectedLineAfterUngroup = (current, groupIndex) => {
    if (current == null) return null;
    if (current === groupIndex) return groupIndex;
    if (current > groupIndex) return current + 1;
    return current;
  };

  const applySnapshot = useCallback((snapshot) => {
    historyMutationRef.current = true;
    suppressScrollResetRef.current = true;
    setLyrics(snapshot.lyrics);
    setLyricsTimestamps(snapshot.timestamps || []);
    if (emitLyricsLoad) emitLyricsLoad(snapshot.lyrics);
    selectLine(snapshot.selectedLine ?? null);
    setSelectedIndices(new Set(snapshot.selection || []));
    selectionAnchorRef.current = snapshot.selection?.[snapshot.selection.length - 1] ?? null;
  }, [emitLyricsLoad, selectLine, setLyrics, setLyricsTimestamps]);

  const handleUndo = useCallback(() => {
    setHistoryPast((past) => {
      if (!past.length) return past;
      const previous = past[past.length - 1];
      const current = takeSnapshot();
      setHistoryFuture((future) => [...future, current]);
      applySnapshot(previous);
      closeContextMenu();
      return past.slice(0, -1);
    });
  }, [applySnapshot, closeContextMenu, takeSnapshot]);

  const handleRedo = useCallback(() => {
    setHistoryFuture((future) => {
      if (!future.length) return future;
      const next = future[future.length - 1];
      const current = takeSnapshot();
      setHistoryPast((past) => [...past, current]);
      applySnapshot(next);
      closeContextMenu();
      return future.slice(0, -1);
    });
  }, [applySnapshot, closeContextMenu, takeSnapshot]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (isInputLike(event.target)) return;

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRedo, handleUndo]);

  useEffect(() => {
    const handleKeyClose = (event) => {
      if (event.key === 'Escape' && contextMenuState.visible) {
        closeContextMenu();
      }
    };
    window.addEventListener('keydown', handleKeyClose);
    return () => window.removeEventListener('keydown', handleKeyClose);
  }, [closeContextMenu, contextMenuState.visible]);

  useElectronListeners({ canUndo, canRedo, handleUndo, handleRedo });

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

  const buildGroup = useCallback((line1, line2, indexPrefix) => ({
    type: 'normal-group',
    id: `manual_group_${indexPrefix}_${Date.now()}`,
    line1,
    line2,
    displayText: `${line1}\n${line2}`,
    searchText: `${line1} ${line2}`,
    originalIndex: indexPrefix,
  }), []);

  const handleGroupSelected = useCallback(() => {
    if (!canGroupSelected) return;
    const [first, second] = selectedIndicesArray;
    const line1 = lyrics[first];
    const line2 = lyrics[second];
    if (!isGroupableLine(line1) || !isGroupableLine(line2)) return;

    const hasTimestampData = Array.isArray(lyricsTimestamps) && lyricsTimestamps.length > 0;
    const timestampsAligned = hasTimestampData && lyricsTimestamps.length === lyrics.length;
    const firstTimestamp = timestampsAligned ? lyricsTimestamps[first] : null;
    const secondTimestamp = timestampsAligned ? lyricsTimestamps[second] : null;
    const timestampsMatch = timestampsAligned && firstTimestamp === secondTimestamp;

    const snapshot = takeSnapshot();
    const grouped = buildGroup(line1, line2, first);
    const newLyrics = [...lyrics];
    newLyrics.splice(first, 2, grouped);
    let nextTimestamps = timestampsAligned ? [...lyricsTimestamps] : lyricsTimestamps;
    let disabledIntelligentAutoplay = false;

    if (timestampsAligned) {
      if (timestampsMatch) {
        nextTimestamps.splice(first, 2, firstTimestamp ?? null);
      } else {
        nextTimestamps = [];
        disabledIntelligentAutoplay = true;
      }
    }

    const nextSelectedLine = remapSelectedLineAfterGroup(selectedLine, first);

    pushHistorySnapshot(snapshot);
    historyMutationRef.current = true;
    suppressScrollResetRef.current = true;
    setLyrics(newLyrics);
    if (timestampsAligned || disabledIntelligentAutoplay) {
      setLyricsTimestamps(nextTimestamps);
    }
    if (emitLyricsLoad) emitLyricsLoad(newLyrics);

    if (typeof nextSelectedLine === 'number') {
      selectLine(nextSelectedLine);
      emitLineUpdate(nextSelectedLine);
    }

    setSelectedIndices(new Set([first]));
    selectionAnchorRef.current = first;
    closeContextMenu();

    if (disabledIntelligentAutoplay) {
      showToast({
        title: 'Intelligent autoplay disabled',
        message: 'Grouped lines had different timestamps. Timestamp-based autoplay is unavailable until you undo this grouping.',
        variant: 'warn',
      });
    } else {
      showToast({
        title: 'Lines grouped',
        message: 'Selected lines have been combined.',
        variant: 'success',
      });
    }
  }, [buildGroup, canGroupSelected, closeContextMenu, emitLyricsLoad, emitLineUpdate, isGroupableLine, lyrics, lyricsTimestamps, pushHistorySnapshot, selectedIndicesArray, selectedLine, selectLine, setLyrics, setLyricsTimestamps, showToast, takeSnapshot]);

  const performUngroup = useCallback((index) => {
    const line = lyrics[index];
    if (line?.type !== 'normal-group') return;

    const snapshot = takeSnapshot();
    const newLyrics = [...lyrics];
    newLyrics.splice(index, 1, line.line1, line.line2);
    const timestampsAligned = Array.isArray(lyricsTimestamps) && lyricsTimestamps.length === lyrics.length;
    const nextTimestamps = timestampsAligned ? [...lyricsTimestamps] : lyricsTimestamps;
    if (timestampsAligned) {
      const groupTimestamp = lyricsTimestamps[index];
      nextTimestamps.splice(index, 1, groupTimestamp ?? null, groupTimestamp ?? null);
    }
    const nextSelectedLine = remapSelectedLineAfterUngroup(selectedLine, index);

    pushHistorySnapshot(snapshot);
    historyMutationRef.current = true;
    suppressScrollResetRef.current = true;
    setLyrics(newLyrics);
    if (timestampsAligned) {
      setLyricsTimestamps(nextTimestamps);
    }

    if (emitSplitNormalGroup) {
      emitSplitNormalGroup({ index, line1: line.line1, line2: line.line2 });
    } else if (emitLyricsLoad) {
      emitLyricsLoad(newLyrics);
    }

    if (typeof nextSelectedLine === 'number') {
      setTimeout(() => {
        selectLine(nextSelectedLine);
        emitLineUpdate(nextSelectedLine);
      }, 0);
    }

    setSelectedIndices(new Set([index, index + 1]));
    selectionAnchorRef.current = index;
    closeContextMenu();
    setHoveredLineIndex(null);

    showToast({
      title: 'Group split',
      message: 'The grouped lines have been separated',
      variant: 'success',
    });
  }, [closeContextMenu, emitLyricsLoad, emitLineUpdate, emitSplitNormalGroup, lyrics, lyricsTimestamps, pushHistorySnapshot, remapSelectedLineAfterUngroup, selectedLine, selectLine, setLyrics, setLyricsTimestamps, showToast, takeSnapshot]);

  const handleSplitGroup = useCallback(
    (event, index) => {
      event.stopPropagation();
      performUngroup(index);
    },
    [performUngroup]
  );

  const getCopyTextForLine = useCallback((line) => {
    if (!line) return '';
    if (typeof line === 'string') return line;
    if (line.type === 'group') {
      return [line.mainLine, line.translation].filter(Boolean).join('\n');
    }
    if (line.type === 'normal-group') {
      return [line.line1, line.line2].filter(Boolean).join('\n');
    }
    return '';
  }, []);

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
    handleLineClickPlain(target);
    closeContextMenu();
  }, [closeContextMenu, handleLineClickPlain, selectedIndicesArray, setSelection]);

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

  const highlightSearchTerm = (text, searchTerm) => {
    if (!searchTerm || !text) return text;
    const regex = new RegExp(
      `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi'
    );
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <span
          key={i}
          className="bg-orange-200 text-orange-900 font-medium"
        >
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const getLineClassName = useCallback(
    (index, isVirtualized = false, isMultiSelected = false) => {
      const padding = 'p-3';
      let base = `${padding} rounded cursor-pointer transition-colors duration-150 select-none `;

      if (index === selectedLine) base += 'bg-blue-400 text-white';
      else if (index === highlightedLineIndex && searchQuery)
        base += 'bg-orange-200 text-orange-900 border-2 border-orange-400';
      else if (isMultiSelected)
        base += darkMode
          ? 'bg-blue-900/30 text-blue-50 ring-2 ring-blue-400/80'
          : 'bg-blue-50 text-blue-900 ring-2 ring-blue-400/80';
      else
        base += darkMode
          ? 'bg-gray-700 text-gray-100 hover:bg-gray-600'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
      return base;
    },
    [selectedLine, highlightedLineIndex, searchQuery, darkMode]
  );

  const renderLine = useCallback(
    (line, index) => {
      if (!line) return null;

      if (isStructureTagLine(line)) {
        return <div className="h-1" aria-hidden="true" />;
      }

      if (line.type === 'group') {
        return (
          <div className="space-y-1">
            <div className="font-medium">
              {highlightSearchTerm(line.mainLine, searchQuery)}
            </div>
            {line.translation && (
              <div
                className={`text-sm italic ${darkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}
              >
                {highlightSearchTerm(line.translation, searchQuery)}
              </div>
            )}
          </div>
        );
      }

      if (line.type === 'normal-group') {
        return (
          <div className="space-y-1">
            <div className="font-medium">
              {highlightSearchTerm(line.line1, searchQuery)}
            </div>
            {line.line2 && (
              <div
                className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}
              >
                {highlightSearchTerm(line.line2, searchQuery)}
              </div>
            )}
          </div>
        );
      }

      return highlightSearchTerm(line, searchQuery);
    },
    [darkMode, searchQuery, isStructureTagLine]
  );

  const getTooltipContent = useCallback((index, line) => {
    if (index === selectedLine) {
      return 'Currently displayed on output screens';
    }
    if (line?.type === 'group') {
      return 'Click to display this lyric with translation';
    }
    if (line?.type === 'normal-group') {
      return 'Grouped lines - click to display or use ungroup button to split';
    }
    return 'Click to display this lyric line on output screens';
  }, [selectedLine]);

  const rowPropsData = useMemo(
    () => ({
      lyrics,
      getLineClassName,
      renderLine,
      handleRowClick,
      handleSplitGroup,
      handleContextMenuOpen,
      handleRowTouchStart,
      handleRowTouchMove,
      handleRowTouchEnd,
      getTooltipContent,
      selectedLine,
      darkMode,
      hoveredLineIndex,
      setHoveredLineIndex,
      hoveredButtonIndex,
      setHoveredButtonIndex,
      sectionStartLookup,
      sectionById,
      activeSectionId,
      selectedIndices,
      isDesktopApp,
    }),
    [lyrics, getLineClassName, renderLine, handleRowClick, handleSplitGroup, handleContextMenuOpen, handleRowTouchStart, handleRowTouchMove, handleRowTouchEnd, getTooltipContent, selectedLine, darkMode, hoveredLineIndex, hoveredButtonIndex, sectionStartLookup, sectionById, activeSectionId, selectedIndices, isDesktopApp]
  );

  const itemCount = useMemo(() => lyrics.length, [lyrics]);
  const useVirtualized = itemCount > VIRTUALIZATION_THRESHOLD;
  const hasSections = (lyricsSections?.length || 0) > 0;

  const scrollToLineIndex = useCallback((lineIndex) => {
    if (lineIndex == null) return;

    if (useVirtualized) {
      if (listRef.current) {
        listRef.current.scrollToRow({
          index: lineIndex,
          align: 'center',
          behavior: 'smooth'
        });
      }
    } else {
      setTimeout(() => {
        const target = document.querySelector(`[data-line-index="${lineIndex}"]`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 10);
    }
  }, [useVirtualized, listRef]);

  const handleSectionJump = useCallback((section) => {
    if (!section || !Number.isInteger(section.startLine)) return;
    handleLineClickPlain(section.startLine);
    scrollToLineIndex(section.startLine);
  }, [handleLineClickPlain, scrollToLineIndex]);

  useEffect(() => {
    const key = `${lyrics.length}|${lyrics[0]?.id || (typeof lyrics[0] === 'string' ? lyrics[0] : '')}`;
    if (historySignatureRef.current === key) return;
    historySignatureRef.current = key;

    if (historyMutationRef.current) {
      historyMutationRef.current = false;
      return;
    }

    setHistoryPast([]);
    setHistoryFuture([]);
    setSelectedIndices(new Set());
    selectionAnchorRef.current = null;
  }, [lyrics]);

  useEffect(() => {
    if (!lyrics || lyrics.length === 0) return;
    const key = `${lyrics.length}|${lyrics[0]?.id || (typeof lyrics[0] === 'string' ? lyrics[0] : '')}`;

    if (suppressScrollResetRef.current) {
      suppressScrollResetRef.current = false;
      lastResetKeyRef.current = key;
      return;
    }

    if (lastResetKeyRef.current === key) return;
    lastResetKeyRef.current = key;

    window.dispatchEvent(new CustomEvent('reset-lyrics-scroll'));
  }, [lyrics]);

  const sectionChips = hasSections ? (
    <div
      className={`px-4 py-3.5 flex flex-wrap gap-2 sticky top-0 z-20 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
    >
      {lyricsSections.map((section) => {
        const isActive = section.id && section.id === activeSectionId;
        return (
          <button
            key={section.id}
            onClick={() => handleSectionJump(section)}
            className={`text-xs px-4 py-1 rounded-full border transition-colors ${isActive
              ? 'bg-blue-500 text-white border-blue-500'
              : darkMode
                ? 'bg-gray-800 text-gray-200 border-gray-700 hover:border-gray-500'
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
          >
            {(section.label || 'Section').toUpperCase()}
          </button>
        );
      })}
    </div>
  ) : null;

  // Virtualized row renderer
  const Row = useCallback(
    ({ index, style, lyrics, getLineClassName, renderLine, handleRowClick, handleSplitGroup, handleContextMenuOpen, handleRowTouchStart, handleRowTouchMove, handleRowTouchEnd, getTooltipContent, selectedLine, darkMode, hoveredLineIndex, setHoveredLineIndex, hoveredButtonIndex, setHoveredButtonIndex, sectionStartLookup, sectionById, activeSectionId, selectedIndices, isDesktopApp }) => {
      const line = lyrics[index];
      if (!line) return null;

      const sectionId = sectionStartLookup.get(index);
      const sectionLabel = sectionId ? sectionById.get(sectionId)?.label : null;
      const isActiveSection = sectionId && sectionId === activeSectionId;
      const isStructureLine = typeof line === 'string' && STRUCTURE_TAG_PATTERNS.some((pattern) => pattern.test(line.trim()));
      const isBatchSelected = selectedIndices?.has(index);

      const heightValue = style?.height;
      const adjustedStyle = {
        ...style,
        ...(heightValue != null
          ? {
            height: `calc(${typeof heightValue === 'number'
              ? `${heightValue}px`
              : heightValue} - ${ROW_GAP}px)`,
          }
          : {}),
        paddingLeft: `${HORIZONTAL_PADDING_PX}px`,
        paddingRight: `${HORIZONTAL_PADDING_PX}px`,
        boxSizing: 'border-box',
      };

      if (isStructureLine) {
        return <div data-line-index={index} style={adjustedStyle} className="pointer-events-none" />;
      }

      return (
        <div data-line-index={index} style={adjustedStyle}>
          {sectionLabel && (
            <div className={`text-xs font-semibold mb-3 flex items-center gap-2 ${isActiveSection ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-gray-300' : 'text-gray-600')}`}>
              <span className="uppercase tracking-wide">{sectionLabel.toUpperCase ? sectionLabel.toUpperCase() : sectionLabel}</span>
              <span className="h-px flex-1 bg-gray-300 opacity-60" />
            </div>
          )}
          {isDesktopApp ? (
            <Tooltip content={getTooltipContent(index, line)} side="top" sideOffset={8} align="start">
              <div
                className={`${getLineClassName(index, true, isBatchSelected)} relative`}
                onClick={(event) => handleRowClick(event, index)}
                onContextMenu={(event) => handleContextMenuOpen(event, index)}
                onTouchStart={(event) => handleRowTouchStart(event, index)}
                onTouchMove={handleRowTouchMove}
                onTouchEnd={handleRowTouchEnd}
                onMouseEnter={() => setHoveredLineIndex(index)}
                onMouseLeave={() => setHoveredLineIndex(null)}
              >
                {renderLine(line, index)}

                {/* Split button for normal groups (desktop only) */}
                {isDesktopApp && line?.type === 'normal-group' && hoveredLineIndex === index && (
                  <Tooltip content="Split this group into two separate lines" side="top" sideOffset={5}>
                    <button
                      onClick={(e) => handleSplitGroup(e, index)}
                      onMouseEnter={() => setHoveredButtonIndex(index)}
                      onMouseLeave={() => setHoveredButtonIndex(null)}
                      className={`absolute top-1.5 right-1.5 rounded-md shadow-sm flex items-center transition-all duration-200 ease-in-out ${hoveredButtonIndex === index ? 'p-1.5 gap-1.5' : 'p-1.5'
                        } ${index === selectedLine
                          ? 'bg-blue-500 hover:bg-blue-600 text-white border border-blue-400'
                          : darkMode
                            ? 'bg-gray-800 hover:bg-gray-900 text-gray-100 border border-gray-600'
                            : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
                        }`}
                    >
                      <Ungroup className="w-3.5 h-3.5 flex-shrink-0" />
                      <span
                        className={`text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out ${hoveredButtonIndex === index
                          ? 'max-w-[60px] opacity-100 ml-0'
                          : 'max-w-0 opacity-0'
                          }`}
                      >
                        Ungroup
                      </span>
                    </button>
                  </Tooltip>
                )}
              </div>
            </Tooltip>
          ) : (
            <div
              className={`${getLineClassName(index, true, isBatchSelected)} relative`}
              onClick={(event) => handleRowClick(event, index)}
              onContextMenu={(event) => handleContextMenuOpen(event, index)}
              onTouchStart={(event) => handleRowTouchStart(event, index)}
              onTouchMove={handleRowTouchMove}
              onTouchEnd={handleRowTouchEnd}
              onMouseEnter={() => setHoveredLineIndex(index)}
              onMouseLeave={() => setHoveredLineIndex(null)}
            >
              {renderLine(line, index)}

            </div>
          )}
        </div>
      );
    },
    []
  );

  useEffect(() => {
    const handleScrollToLine = (event) => {
      const { lineIndex } = event.detail;
      if (lineIndex == null) return;

      if (lyrics.length > VIRTUALIZATION_THRESHOLD) {
        if (listRef.current) {
          listRef.current.scrollToRow({
            index: lineIndex,
            align: 'center',
            behavior: 'smooth'
          });
        }
      } else {
        setTimeout(() => {
          const target = document.querySelector(`[data-line-index="${lineIndex}"]`);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
    };

    window.addEventListener('scroll-to-lyric-line', handleScrollToLine);
    return () => window.removeEventListener('scroll-to-lyric-line', handleScrollToLine);
  }, [lyrics.length]);

  const listContent = !useVirtualized ? (
    <div className={`space-y-2 pb-4 relative ${hasSections ? '' : 'pt-4'}`}>
      {sectionChips}
      {lyrics.map((line, i) => {
        const getTooltipContent = () => {
          if (i === selectedLine) {
            return 'Currently displayed on output screens';
          }
          if (line?.type === 'group') {
            return 'Click to display this lyric with translation';
          }
          if (line?.type === 'normal-group') {
            return 'Grouped lines - click to display or use ungroup button to split';
          }
          return 'Click to display this lyric line on output screens';
        };

        const sectionId = sectionStartLookup.get(i);
        const sectionLabel = sectionId ? sectionById.get(sectionId)?.label : null;
        const isActiveSection = sectionId && sectionId === activeSectionId;
        const isBatchSelected = selectedIndices.has(i);

        if (typeof line === 'string' && isStructureTagLine(line)) {
          return (
            <div key={line?.id || `line_${i}`} data-line-index={i} className="px-4 h-2 pointer-events-none" />
          );
        }

        return (
          <div key={line?.id || `line_${i}`} className="px-4">
            {sectionLabel && (
              <div className={`text-xs font-semibold mb-2 flex items-center gap-2 ${isActiveSection ? (darkMode ? 'text-green-400' : 'text-green-500') : (darkMode ? 'text-gray-300' : 'text-gray-600')}`}>
                <span className="uppercase tracking-wide">{sectionLabel.toUpperCase ? sectionLabel.toUpperCase() : sectionLabel}</span>
                <span className="h-px flex-1 bg-gray-300 opacity-60" />
              </div>
            )}
            {isDesktopApp ? (
              <Tooltip content={getTooltipContent()} side="top" sideOffset={8} align="start">
                <div
                  data-line-index={i}
                  className={`${getLineClassName(i, false, isBatchSelected)} relative`}
                  onClick={(event) => handleRowClick(event, i)}
                  onContextMenu={(event) => handleContextMenuOpen(event, i)}
                  onTouchStart={(event) => handleRowTouchStart(event, i)}
                  onTouchMove={handleRowTouchMove}
                  onTouchEnd={handleRowTouchEnd}
                  onMouseEnter={() => setHoveredLineIndex(i)}
                  onMouseLeave={() => setHoveredLineIndex(null)}
                >
                  {renderLine(line, i)}

                  {/* Split button for normal groups (desktop only) */}
                  {isDesktopApp && line?.type === 'normal-group' && hoveredLineIndex === i && (
                    <Tooltip content="Split this group into two separate lines" side="top" sideOffset={5}>
                      <button
                        onClick={(e) => handleSplitGroup(e, i)}
                        onMouseEnter={() => setHoveredButtonIndex(i)}
                        onMouseLeave={() => setHoveredButtonIndex(null)}
                        className={`absolute top-1.5 right-1.5 rounded-md shadow-sm flex items-center transition-all duration-200 ease-in-out ${hoveredButtonIndex === i ? 'p-1.5 gap-1.5' : 'p-1.5'
                          } ${i === selectedLine
                            ? 'bg-blue-500 hover:bg-blue-600 text-white border border-blue-400'
                            : darkMode
                              ? 'bg-gray-800 hover:bg-gray-900 text-gray-100 border-gray-600'
                              : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                          }`}
                      >
                        <Ungroup className="w-3.5 h-3.5 flex-shrink-0" />
                        <span
                          className={`text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out ${hoveredButtonIndex === i
                            ? 'max-w-[60px] opacity-100 ml-0'
                            : 'max-w-0 opacity-0'
                            }`}
                        >
                          Ungroup
                        </span>
                      </button>
                    </Tooltip>
                  )}
                </div>
              </Tooltip>
            ) : (
              <div
                data-line-index={i}
                className={`${getLineClassName(i, false, isBatchSelected)} relative`}
                onClick={(event) => handleRowClick(event, i)}
                onContextMenu={(event) => handleContextMenuOpen(event, i)}
                onTouchStart={(event) => handleRowTouchStart(event, i)}
                onTouchMove={handleRowTouchMove}
                onTouchEnd={handleRowTouchEnd}
                onMouseEnter={() => setHoveredLineIndex(i)}
                onMouseLeave={() => setHoveredLineIndex(null)}
              >
                {renderLine(line, i)}

                {isDesktopApp && line?.type === 'normal-group' && hoveredLineIndex === i && (
                  <button
                    onClick={(e) => handleSplitGroup(e, i)}
                    onMouseEnter={() => setHoveredButtonIndex(i)}
                    onMouseLeave={() => setHoveredButtonIndex(null)}
                    className={`absolute top-1.5 right-1.5 rounded-md shadow-sm flex items-center transition-all duration-200 ease-in-out ${hoveredButtonIndex === i ? 'p-1.5 gap-1.5' : 'p-1.5'
                      } ${i === selectedLine
                        ? 'bg-blue-500 hover:bg-blue-600 text-white border border-blue-400'
                        : darkMode
                          ? 'bg-gray-800 hover:bg-gray-900 text-gray-100 border-gray-600'
                          : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                      }`}
                  >
                    <Ungroup className="w-3.5 h-3.5 flex-shrink-0" />
                    <span
                      className={`text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out ${hoveredButtonIndex === i
                        ? 'max-w-[60px] opacity-100 ml-0'
                        : 'max-w-0 opacity-0'
                        }`}
                    >
                      Ungroup
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  ) : (
    <div className="flex-1 min-h-0 w-full h-full flex flex-col relative">
      {sectionChips}
      <div className="flex-1 min-h-0">
        <List
          listRef={listRef}
          rowCount={itemCount}
          rowHeight={rowHeightConfig}
          rowComponent={Row}
          rowProps={rowPropsData}
          style={{
            overflowY: 'auto',
            height: '100%',
            width: '100%',
            paddingTop: `${HORIZONTAL_PADDING_PX}px`,
            paddingBottom: `${HORIZONTAL_PADDING_PX}px`,
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 w-full h-full">
      {listContent}
      <ContextMenu
        ref={contextMenuRef}
        visible={contextMenuState.visible}
        position={contextMenuPosition}
        positioning="fixed"
        darkMode={darkMode}
        onMeasured={setContextMenuDimensions}
      >
        <ContextMenuItem
          onClick={handleSendSelectionToOutput}
          disabled={selectedIndicesArray.length !== 1}
          icon={<ArrowRight className="w-4 h-4" />}
          darkMode={darkMode}
        >
          Send to output
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleDeselectFromMenu}
          disabled={!hasSelection}
          icon={<X className="w-4 h-4" />}
          darkMode={darkMode}
        >
          Clear output
        </ContextMenuItem>
        <ContextMenuSeparator darkMode={darkMode} />
        <ContextMenuItem
          onClick={handleGroupSelected}
          disabled={!canGroupSelected}
          icon={<Link2 className="w-4 h-4" />}
          darkMode={darkMode}
        >
          Group
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            if (selectedIndicesArray.length === 1) {
              performUngroup(selectedIndicesArray[0]);
            } else {
              closeContextMenu();
            }
          }}
          disabled={!canUngroupSelected}
          icon={<Ungroup className="w-4 h-4" />}
          darkMode={darkMode}
        >
          Ungroup
        </ContextMenuItem>
        <ContextMenuSeparator darkMode={darkMode} />
        <ContextMenuItem
          onClick={handleCopySelection}
          disabled={!hasSelection}
          icon={<Copy className="w-4 h-4" />}
          darkMode={darkMode}
        >
          Copy
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleUndo}
          disabled={!canUndo}
          icon={<Undo className="w-4 h-4" />}
          darkMode={darkMode}
        >
          Undo
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleRedo}
          disabled={!canRedo}
          icon={<Redo className="w-4 h-4" />}
          darkMode={darkMode}
        >
          Redo
        </ContextMenuItem>
      </ContextMenu>
    </div>
  );
}