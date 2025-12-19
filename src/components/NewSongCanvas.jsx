import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Scissors, Copy, ClipboardPaste, Wand2, Save, FolderOpen, Undo, Redo, ChevronRight } from 'lucide-react';
import { useLyricsState, useDarkModeState } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useFileUpload from '../hooks/useFileUpload';
import useDarkModeSync from '../hooks/useDarkModeSync';
import useEditorClipboard from '../hooks/NewSongCanvas/useEditorClipboard';
import useEditorHistory from '../hooks/NewSongCanvas/useEditorHistory';
import { useKeyboardShortcuts } from '../hooks/NewSongCanvas/useKeyboardShortcuts';
import useLrcEligibility from '../hooks/NewSongCanvas/useLrcEligibility';
import useFileSave from '../hooks/NewSongCanvas/useFileSave.js';
import useTimestampOperations from '../hooks/NewSongCanvas/useTimestampOperations';
import useLineOperations from '../hooks/NewSongCanvas/useLineOperations';
import useTitlePrefill from '../hooks/NewSongCanvas/useTitlePrefill';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from '@/components/ui/tooltip';
import { formatLyrics, reconstructEditableText } from '../utils/lyricsFormat';
import { processRawTextToLines } from '../utils/parseLyrics';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import useContextSubmenus from '../hooks/NewSongCanvas/useContextSubmenus';
import useLineMeasurements from '../hooks/NewSongCanvas/useLineMeasurements';
import useContextMenuPosition from '../hooks/NewSongCanvas/useContextMenuPosition';

const STANDARD_LRC_START_REGEX = /^\s*(\[\d{1,2}:\d{2}(?:\.\d{1,2})?\])+/;
const METADATA_OPTIONS = [
  { key: 'ti', label: 'Title [ti:]' },
  { key: 'ar', label: 'Artist [ar:]' },
  { key: 'al', label: 'Album [al:]' },
  { key: 'au', label: 'Author [au:]' },
  { key: 'lr', label: 'Lyricist [lr:]' },
  { key: 'length', label: 'Length [length:]' },
  { key: 'by', label: 'LRC Author [by:]' },
  { key: 'offset', label: 'Offset [offset:]' },
  { key: 're', label: 'Player/Editor [re:]' },
  { key: 'tool', label: 'Tool [tool:]' },
  { key: 've', label: 'Version [ve:]' },
  { key: '#', label: 'Comment [#]' },
];

const NewSongCanvas = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") || "new";
  const editMode = mode === "edit";
  const composeMode = mode === "compose";
  const isController = composeMode;

  const { darkMode, setDarkMode } = useDarkModeState();
  const { lyrics, lyricsFileName, rawLyricsContent, songMetadata, setRawLyricsContent, setSongMetadata, setPendingSavedVersion } = useLyricsState();

  const { emitLyricsDraftSubmit } = useControlSocket();

  const handleFileUpload = useFileUpload();
  const textareaRef = useRef(null);
  const baseContentRef = useRef('');
  const baseTitleRef = useRef('');
  const loadSignatureRef = useRef(null);

  const { content, setContent, undo, redo, canUndo, canRedo } = useEditorHistory('');
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState('');
  const editorContainerRef = useRef(null);
  const measurementRefs = useRef([]);
  const contextMenuRef = useRef(null);
  const timestampSubmenuRef = useRef(null);
  const metadataSubmenuRef = useRef(null);
  const touchLongPressTimeoutRef = useRef(null);
  const touchStartPositionRef = useRef(null);
  const touchMovedRef = useRef(false);
  const pendingScrollRestoreRef = useRef(null);
  const lastKnownScrollRef = useRef(0);

  const [scrollTop, setScrollTop] = useState(0);
  const [editorPadding, setEditorPadding] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedLineIndex, setSelectedLineIndex] = useState(null);
  const [contextMenuState, setContextMenuState] = useState({ visible: false, x: 0, y: 0, lineIndex: null, mode: 'line', cursorOffset: null });
  const [contextMenuDimensions, setContextMenuDimensions] = useState({ width: 0, height: 0 });
  const [pendingFocus, setPendingFocus] = useState(null);

  const lines = useMemo(() => content.split('\n'), [content]);
  const isContentEmpty = !content.trim();
  const isTitleEmpty = !title.trim();
  const hasUnsavedChanges = React.useMemo(() => {
    return (content || '') !== (baseContentRef.current || '') || (title || '') !== (baseTitleRef.current || '');
  }, [content, title]);

  const { contextMenuPosition, menuWidth } = useContextMenuPosition({
    contextMenuState,
    contextMenuDimensions,
    containerSize
  });

  const {
    activeSubmenu,
    setActiveSubmenu,
    submenuOffsets,
    submenuHorizontal,
    submenuMaxHeight,
    handleRootItemEnter,
    handleContextMenuEnter,
    handleContextMenuLeave,
    handleSubmenuTriggerEnter,
    handleSubmenuTriggerLeave,
    handleSubmenuPanelEnter,
    handleSubmenuPanelLeave,
    cancelSubmenuClose
  } = useContextSubmenus({
    containerSize,
    contextMenuPosition,
    menuWidth,
    editorContainerRef,
    timestampSubmenuRef,
    metadataSubmenuRef,
    contextMenuVisible: contextMenuState.visible
  });

  const closeContextMenu = useCallback(() => {
    setActiveSubmenu(null);
    setContextMenuState({ visible: false, x: 0, y: 0, lineIndex: null, mode: 'line', cursorOffset: null });
    cancelSubmenuClose();
  }, [cancelSubmenuClose, setActiveSubmenu]);

  const clearTouchLongPress = useCallback(() => {
    if (touchLongPressTimeoutRef.current !== null) {
      window.clearTimeout(touchLongPressTimeoutRef.current);
      touchLongPressTimeoutRef.current = null;
    }
    touchMovedRef.current = false;
  }, []);

  const preserveTextareaScroll = useCallback((updater) => {
    if (typeof updater !== 'function') return;
    const textarea = textareaRef.current;
    const currentScroll = textarea ? textarea.scrollTop : null;
    pendingScrollRestoreRef.current = currentScroll;
    if (typeof currentScroll === 'number') {
      lastKnownScrollRef.current = currentScroll;
    }
    updater();
  }, []);

  const getLineStartOffset = useCallback((segments, targetIndex) => {
    if (!Array.isArray(segments) || targetIndex <= 0) return 0;
    let offset = 0;
    const cappedIndex = Math.max(0, Math.min(targetIndex, segments.length - 1));
    for (let i = 0; i < cappedIndex; i += 1) {
      offset += (segments[i]?.length ?? 0) + 1;
    }
    return offset;
  }, []);

  useDarkModeSync(darkMode, setDarkMode);
  const { showToast } = useToast();
  const { showModal } = useModal();

  React.useEffect(() => {
    if (window.electronAPI) {
      const handleNavigateToNewSong = () => {
        if (!editMode) {
          setContent('');
          setFileName('');
          setTitle('');
        } else {
          navigate('/new-song?mode=new');
        }
      };

      window.electronAPI.onNavigateToNewSong(handleNavigateToNewSong);

      return () => {
        window.electronAPI.removeAllListeners('navigate-to-new-song');
      };
    }
  }, [editMode, navigate, setRawLyricsContent]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!editMode) return;

    const nextContent = rawLyricsContent
      ? rawLyricsContent
      : (lyrics && lyrics.length > 0)
        ? reconstructEditableText(lyrics)
        : '';
    const nextTitle = lyricsFileName || '';
    const loadSignature = `${nextTitle}::${nextContent}`;
    if (loadSignatureRef.current !== loadSignature) {
      setContent(nextContent);
      setFileName(nextTitle);
      setTitle(nextTitle);
      baseContentRef.current = nextContent || '';
      baseTitleRef.current = nextTitle || '';
      loadSignatureRef.current = loadSignature;
    }
  }, [editMode, lyrics, lyricsFileName, rawLyricsContent]);

  useEffect(() => {
    if (editMode) return;
    setContent('');
    setFileName('');
    setTitle('');
    baseContentRef.current = '';
    baseTitleRef.current = '';
    loadSignatureRef.current = null;
  }, [editMode]);

  React.useEffect(() => {
    const handleDraftSubmitted = (event) => {
      showToast({
        title: 'Draft submitted',
        message: `"${event.detail?.title}" sent for approval`,
        variant: 'success'
      });
    };

    const handleDraftError = (event) => {
      showToast({
        title: 'Draft submission failed',
        message: event.detail?.message || 'Could not send draft',
        variant: 'error'
      });
    };

    const handleDraftRejected = (event) => {
      const { title, reason } = event.detail;
      showModal({
        title: 'Draft Rejected',
        headerDescription: `Your draft "${title}" was rejected by the control panel`,
        description: reason || 'No reason provided',
        variant: 'error',
        dismissLabel: 'Understood',
      });
    };

    window.addEventListener('draft-submitted', handleDraftSubmitted);
    window.addEventListener('draft-error', handleDraftError);
    window.addEventListener('draft-rejected', handleDraftRejected);

    return () => {
      window.removeEventListener('draft-submitted', handleDraftSubmitted);
      window.removeEventListener('draft-error', handleDraftError);
      window.removeEventListener('draft-rejected', handleDraftRejected);
    };
  }, [showToast, showModal]);

  const { handleCut, handleCopy, handlePaste, handleCleanup, handleTextareaPaste } = useEditorClipboard({ content, setContent, textareaRef, showToast });

  const lrcEligibility = useLrcEligibility(content);

  const focusLine = useCallback((lineIndex) => {
    if (lineIndex === null || lineIndex === undefined) return;
    setPendingFocus({ type: 'line', lineIndex });
  }, []);

  const { handleSave, handleSaveAndLoad } = useFileSave({
    content,
    title,
    fileName,
    setFileName,
    setTitle,
    setRawLyricsContent,
    handleFileUpload,
    showModal,
    showToast,
    lrcEligibility,
    baseContentRef,
    baseTitleRef,
    existingFilePath: songMetadata?.filePath,
    songMetadata,
    setSongMetadata,
    setPendingSavedVersion,
    editMode
  });

  const { insertStandardTimestampAtLine, insertEnhancedTimestampAtCursor, insertMetadataTagAtCursor } = useTimestampOperations({
    textareaRef,
    setContent,
    closeContextMenu,
    setSelectedLineIndex,
    getLineStartOffset,
    contextMenuState,
    lastKnownScrollRef
  });

  const { handleAddTranslation, handleCopyLine, handleDuplicateLine, isLineWrappedWithTranslation } = useLineOperations({
    lines,
    textareaRef,
    setContent,
    closeContextMenu,
    focusLine,
    preserveTextareaScroll,
    showToast,
    lastKnownScrollRef,
    setSelectedLineIndex
  });

  const selectedLineText = selectedLineIndex !== null ? (lines[selectedLineIndex] ?? '') : '';
  const selectedLineHasContent = selectedLineText.trim().length > 0;
  const selectedLineIsWrapped = selectedLineHasContent && isLineWrappedWithTranslation(selectedLineText);

  const {
    measurementContainerRef,
    toolbarRef,
    lineMetrics,
    toolbarTop,
    toolbarLeft,
    highlightVisible,
    highlightTop,
    highlightHeight,
    toolbarVisible,
    canAddTranslationOnSelectedLine,
    selectedMetric
  } = useLineMeasurements({
    content,
    containerSize,
    editorPadding,
    lines,
    measurementRefs,
    selectedLineIndex,
    selectedLineHasContent,
    selectedLineIsWrapped,
    scrollTop,
    contextMenuVisible: contextMenuState.visible
  });

  useEffect(() => {
    measurementRefs.current = measurementRefs.current.slice(0, lines.length);
  }, [lines.length]);

  const lineOffsets = useMemo(() => {
    const offsets = [];
    let cursor = 0;
    lines.forEach((line, index) => {
      const safeLine = line ?? '';
      const start = cursor;
      const end = start + safeLine.length;
      offsets.push({ start, end });
      if (index < lines.length - 1) {
        cursor = end + 1;
      } else {
        cursor = end;
      }
    });
    return offsets;
  }, [lines]);

  useLayoutEffect(() => {
    if (pendingScrollRestoreRef.current === null) return;
    const restoreValue = pendingScrollRestoreRef.current;
    if (textareaRef.current && typeof restoreValue === 'number') {
      textareaRef.current.scrollTop = restoreValue;
      lastKnownScrollRef.current = restoreValue;
    }
    pendingScrollRestoreRef.current = null;
  }, [content]);

  useLayoutEffect(() => {
    if (!textareaRef.current) return;
    const styles = window.getComputedStyle(textareaRef.current);
    setEditorPadding({
      top: parseFloat(styles.paddingTop) || 0,
      right: parseFloat(styles.paddingRight) || 0,
      bottom: parseFloat(styles.paddingBottom) || 0,
      left: parseFloat(styles.paddingLeft) || 0,
    });
  }, [darkMode]);

  useEffect(() => {
    if (!editorContainerRef.current) return;
    const element = editorContainerRef.current;

    const updateSize = () => {
      setContainerSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
      }
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!contextMenuState.visible || !contextMenuRef.current) return;
    const rect = contextMenuRef.current.getBoundingClientRect();
    setContextMenuDimensions({ width: rect.width, height: rect.height });
  }, [contextMenuState.visible]);

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
  }, [hasUnsavedChanges, showToast, navigate]);

  useEffect(() => {
    return () => {
      clearTouchLongPress();
      cancelSubmenuClose();
    };
  }, [clearTouchLongPress, cancelSubmenuClose]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (contextMenuState.visible || selectedLineIndex !== null) {
          setSelectedLineIndex(null);
          closeContextMenu();
        } else {
          handleBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeContextMenu, contextMenuState.visible, selectedLineIndex, handleBack]);

  useEffect(() => {
    const handleMouseDown = (event) => {
      if (!editorContainerRef.current) return;
      if (!editorContainerRef.current.contains(event.target)) {
        setSelectedLineIndex(null);
        closeContextMenu();
      } else if (
        contextMenuState.visible &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target)
      ) {
        closeContextMenu();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [closeContextMenu, contextMenuState.visible]);

  useEffect(() => {
    if (!pendingFocus || !textareaRef.current) return;

    const attemptFocus = () => {
      if (!textareaRef.current) return false;
      const offsets = lineOffsets[pendingFocus.lineIndex];
      const lineText = lines[pendingFocus.lineIndex] ?? '';
      if (!offsets) {
        return false;
      }

      const previousScroll = typeof lastKnownScrollRef.current === 'number'
        ? lastKnownScrollRef.current
        : textareaRef.current.scrollTop;

      try {
        textareaRef.current.focus({ preventScroll: true });
      } catch (err) {
        textareaRef.current.focus();
      }

      if (pendingFocus.type === 'line') {
        textareaRef.current.setSelectionRange(offsets.start, offsets.end);
      } else if (pendingFocus.type === 'translation') {
        const openIndex = lineText.indexOf('(');
        const cursorPosition = openIndex >= 0 ? offsets.start + openIndex + 1 : offsets.end;
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }

      if (typeof previousScroll === 'number') {
        textareaRef.current.scrollTop = previousScroll;
        lastKnownScrollRef.current = previousScroll;
      }

      setSelectedLineIndex(pendingFocus.lineIndex ?? null);
      setPendingFocus(null);
      return true;
    };

    let completed = false;
    const run = () => {
      if (completed) return;
      completed = attemptFocus();
    };

    const animationFrame = requestAnimationFrame(run);
    const timeout = window.setTimeout(run, 75);
    return () => {
      completed = true;
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
    };
  }, [pendingFocus, lineOffsets, lines]);

  const handleLoadDraft = useCallback(async () => {
    if (!content.trim() || !title.trim()) {
      showModal({
        title: 'Missing details',
        description: 'Enter both a song title and lyrics before loading.',
        variant: 'warn',
        dismissLabel: 'Got it',
      });
      return;
    }

    try {
      const cleanedText = formatLyrics(content);
      const processedLines = processRawTextToLines(cleanedText);

      const success = emitLyricsDraftSubmit({
        title: title.trim(),
        rawText: content,
        processedLines
      });

      if (!success) {
        showToast({
          title: 'Submission failed',
          message: 'Could not send draft. Check connection.',
          variant: 'error'
        });
        return;
      }

      setTimeout(() => {
        setContent('');
        setTitle('');
        baseContentRef.current = '';
        baseTitleRef.current = '';
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error('Draft submission error:', err);
      showModal({
        title: 'Submission error',
        description: 'Could not submit draft. Please try again.',
        variant: 'error',
        dismissLabel: 'Close',
      });
    }
  }, [content, title, emitLyricsDraftSubmit, showToast, showModal, navigate]);

  const handleUndo = useCallback(() => {
    const previousContent = undo();
    if (previousContent !== null && textareaRef.current) {
      const currentScroll = lastKnownScrollRef.current;
      requestAnimationFrame(() => {
        if (textareaRef.current && typeof currentScroll === 'number') {
          textareaRef.current.scrollTop = currentScroll;
        }
      });
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    const nextContent = redo();
    if (nextContent !== null && textareaRef.current) {
      const currentScroll = lastKnownScrollRef.current;
      requestAnimationFrame(() => {
        if (textareaRef.current && typeof currentScroll === 'number') {
          textareaRef.current.scrollTop = currentScroll;
        }
      });
    }
  }, [redo]);

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
  }, [handleUndo, handleRedo]);

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
  }, []);

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
  }, [closeContextMenu]);

  const handleTextareaSelect = useCallback(() => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const lineIndex = getLineIndexFromOffset(start);
    setSelectedLineIndex(lineIndex);
  }, [getLineIndexFromOffset]);

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
  }, [closeContextMenu, focusLine, getLineIndexFromOffset, handleAddTranslation, handleDuplicateLine]);

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
      const selectionLineIndex = selectedLineIndex ?? (textarea ? getLineIndexFromOffset(textarea.selectionStart) : null);
      setActiveSubmenu(null);
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
    setActiveSubmenu(null);
    setContextMenuState({
      visible: true,
      x: safeX,
      y: safeY,
      lineIndex,
      mode: 'line',
      cursorOffset: previousCursorOffset ?? (offsets ? offsets.start : null)
    });
  }, [contextMenuDimensions.height, contextMenuDimensions.width, findLineIndexByPosition, getLineIndexFromOffset, lineOffsets, scrollTop, selectedLineIndex]);

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
  }, [clearTouchLongPress, handleCanvasContextMenu]);

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
  }, [clearTouchLongPress]);

  const handleTouchEnd = useCallback(() => {
    clearTouchLongPress();
    touchStartPositionRef.current = null;
  }, [clearTouchLongPress]);

  const handleTouchCancel = useCallback(() => {
    clearTouchLongPress();
    touchStartPositionRef.current = null;
  }, [clearTouchLongPress]);

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

    setContent(newContent);
    lastKnownScrollRef.current = currentScroll;
    closeContextMenu();
  }, [closeContextMenu, setContent]);

  const handleCleanupFromContext = useCallback(() => {
    handleCleanup();
    closeContextMenu();
  }, [closeContextMenu, handleCleanup]);

  const {
    isTitlePrefilled,
    handleContentKeyDown,
    handleContentPaste,
    handleTitleChange
  } = useTitlePrefill(content, title, setTitle, editMode, textareaRef);

  const getSaveButtonTooltip = () => {
    if (isContentEmpty && isTitleEmpty) {
      return "Enter a song title and add lyrics content to save";
    }
    if (isTitleEmpty) {
      return "Enter a song title to save";
    }
    if (isContentEmpty) {
      return "Add lyrics content to save";
    }
    return composeMode ? "Submit draft for approval" : "Save lyrics file to disk";
  };

  const getSaveAndLoadButtonTooltip = () => {
    if (isContentEmpty && isTitleEmpty) {
      return "Enter a song title and add lyrics content to load";
    }
    if (isTitleEmpty) {
      return "Enter a song title to load";
    }
    if (isContentEmpty) {
      return "Add lyrics content to load";
    }
    return composeMode ? "Submit draft for approval" : "Save file and load into control panel";
  };

  useKeyboardShortcuts({
    handleBack,
    handleSave,
    handleSaveAndLoad: composeMode ? handleLoadDraft : handleSaveAndLoad,
    handleCleanup,
    isContentEmpty,
    isTitleEmpty,
    composeMode,
    editMode,
    hasUnsavedChanges
  });

  const contextMenuLineText = contextMenuState.lineIndex !== null ? (lines[contextMenuState.lineIndex] ?? '') : '';
  const contextMenuLineHasContent = contextMenuLineText.trim().length > 0;
  const contextMenuLineIsWrapped = contextMenuLineHasContent && isLineWrappedWithTranslation(contextMenuLineText);
  const canAddTranslationInContextMenu = contextMenuState.mode === 'line' && contextMenuLineHasContent && !contextMenuLineIsWrapped;
  const contextMenuLineHasTimestamp = STANDARD_LRC_START_REGEX.test(contextMenuLineText.trim());


  return (
    <div className={`flex flex-col h-screen font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Fixed Header */}
      <div className={`shadow-sm border-b p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        {/* Mobile Layout - Two Rows */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-3">
            <Tooltip content="Return to control panel" side="right">
              <button
                onClick={handleBack}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </Tooltip>

            {/* Title and Help Button */}
            <div className="flex items-center gap-2">
              <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {composeMode ? "Create Lyrics" : editMode ? "Edit Song Canvas" : "New Song Canvas"}
              </h1>
              <button
                onClick={() => {
                  showModal({
                    title: 'Song Canvas Help',
                    headerDescription: 'Professional lyrics editor with powerful formatting tools',
                    component: 'SongCanvasHelp',
                    variant: 'info',
                    size: 'large',
                    dismissLabel: 'Got it'
                  });
                }}
                className={`p-1.5 rounded-lg transition-colors ${darkMode
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                title="Song Canvas Help"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>

            <div className="w-[72px]"></div>
          </div>

          {/* Row 1: Undo, Redo, Cut, Copy, Paste, Cleanup */}
          <div className="flex items-center justify-center gap-1 mb-3">
            <Tooltip content="Undo last change" side="top">
              <Button onClick={handleUndo} disabled={!canUndo} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Undo (Ctrl+Z)">
                <Undo className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Redo last undone change" side="top">
              <Button onClick={handleRedo} disabled={!canRedo} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Redo (Ctrl+Shift+Z)">
                <Redo className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Cut selected text" side="top">
              <Button onClick={handleCut} disabled={isContentEmpty} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Cut">
                <Scissors className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Copy selected text" side="top">
              <Button onClick={handleCopy} disabled={isContentEmpty} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Copy">
                <Copy className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Paste from clipboard" side="top">
              <Button onClick={handlePaste} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Paste">
                <ClipboardPaste className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Auto-format and clean up lyrics" side="top">
              <Button onClick={handleCleanup} disabled={isContentEmpty} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Cleanup">
                <Wand2 className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>

          {/* Row 2: Title and Action Button */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={title}
              onChange={handleTitleChange}
              maxLength={65}
              placeholder="Enter song title..."
              className={`flex-1 px-3 py-1.5 rounded-md ${isTitlePrefilled ? 'italic' : ''
                } ${darkMode
                  ? `bg-gray-700 placeholder-gray-400 border-gray-600 ${isTitlePrefilled ? 'text-gray-400' : 'text-gray-200'}`
                  : `bg-white placeholder-gray-400 border-gray-300 ${isTitlePrefilled ? 'text-gray-500' : 'text-gray-900'}`
                }`}
            />
            {composeMode ? (
              <Tooltip content={getSaveAndLoadButtonTooltip()} side="left">
                <span className="inline-block">
                  <Button
                    onClick={handleLoadDraft}
                    disabled={isContentEmpty || isTitleEmpty}
                    className="whitespace-nowrap bg-gradient-to-r from-blue-400 to-purple-600 text-white hover:from-blue-500 hover:to-purple-700"
                    size="sm"
                  >
                    <FolderOpen className="w-4 h-4 mr-1" /> Load
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <>
                <Tooltip content={getSaveButtonTooltip()} side="left">
                  <span className="inline-block">
                    <Button
                      onClick={handleSave}
                      disabled={isContentEmpty || isTitleEmpty || (editMode && !hasUnsavedChanges)}
                      variant="ghost"
                      size="sm"
                      title="Save"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip content={getSaveAndLoadButtonTooltip()} side="left">
                  <span className="inline-block">
                    <Button
                      onClick={handleSaveAndLoad}
                      disabled={isContentEmpty || isTitleEmpty || (editMode && !hasUnsavedChanges)}
                      className="whitespace-nowrap bg-gradient-to-r from-blue-400 to-purple-600 text-white"
                      size="sm"
                    >
                      <FolderOpen className="w-4 h-4 mr-1" /> Save & Load
                    </Button>
                  </span>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        {/* Desktop Layout - Original Single Row */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between mb-4">
            <Tooltip content="Return to control panel" side="right">
              <button
                onClick={handleBack}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </Tooltip>

            {/* Title and Help Button */}
            <div className="flex items-center gap-2">
              <h1 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {composeMode ? "Compose Lyrics" : editMode ? "Edit Song Canvas" : "New Song Canvas"}
              </h1>
              <button
                onClick={() => {
                  showModal({
                    title: 'Song Canvas Help',
                    headerDescription: 'Professional lyrics editor with powerful formatting tools',
                    component: 'SongCanvasHelp',
                    variant: 'info',
                    size: 'large',
                    dismissLabel: 'Got it'
                  });
                }}
                className={`p-1.5 rounded-lg transition-colors ${darkMode
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                title="Song Canvas Help"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            <div className="w-[72px]"></div>
          </div>
          {/* Desktop Toolbar */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Tooltip content={<span>Undo last change - <strong>Ctrl+Z</strong></span>} side="bottom">
              <Button onClick={handleUndo} disabled={!canUndo} variant="ghost"
                className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}>
                <Undo className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content={<span>Redo last undone change - <strong>Ctrl+Shift+Z</strong></span>} side="bottom">
              <Button onClick={handleRedo} disabled={!canRedo} variant="ghost"
                className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}>
                <Redo className="w-4 h-4" />
              </Button>
            </Tooltip>
            <div className={`w-px h-6 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>

            {/* Responsive Cut/Copy/Paste/Cleanup*/}
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip content="Cut selected text" side="bottom">
                <Button onClick={handleCut} disabled={isContentEmpty} variant="ghost"
                  className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''} hidden lg:flex`}>
                  <Scissors className="w-4 h-4" /> Cut
                </Button>
              </Tooltip>
              <Tooltip content="Copy selected text" side="bottom">
                <Button onClick={handleCopy} disabled={isContentEmpty} variant="ghost"
                  className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''} hidden lg:flex`}>
                  <Copy className="w-4 h-4" /> Copy
                </Button>
              </Tooltip>
              <Tooltip content="Paste from clipboard" side="bottom">
                <Button onClick={handlePaste} variant="ghost"
                  className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''} hidden lg:flex`}>
                  <ClipboardPaste className="w-4 h-4" /> Paste
                </Button>
              </Tooltip>
              <Tooltip content="Auto-format and clean up lyrics" side="bottom">
                <Button onClick={handleCleanup} disabled={isContentEmpty} variant="ghost"
                  className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''} hidden lg:flex`}>
                  <Wand2 className="w-4 h-4" /> Cleanup
                </Button>
              </Tooltip>

              {/* Icon-only versions appear below lg */}
              <div className="flex lg:hidden gap-1">
                <Tooltip content="Cut" side="bottom">
                  <Button onClick={handleCut} disabled={isContentEmpty} variant="ghost" size="sm" title="Cut">
                    <Scissors className="w-4 h-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Copy" side="bottom">
                  <Button onClick={handleCopy} disabled={isContentEmpty} variant="ghost" size="sm" title="Copy">
                    <Copy className="w-4 h-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Paste" side="bottom">
                  <Button onClick={handlePaste} variant="ghost" size="sm" title="Paste">
                    <ClipboardPaste className="w-4 h-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Cleanup" side="bottom">
                  <Button onClick={handleCleanup} disabled={isContentEmpty} variant="ghost" size="sm" title="Cleanup">
                    <Wand2 className="w-4 h-4" />
                  </Button>
                </Tooltip>
              </div>
            </div>

            <div className={`w-px h-6 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>

            {/* Title Input */}
            <Input
              type="text"
              value={title}
              onChange={handleTitleChange}
              maxLength={65}
              placeholder="Enter song title..."
              className={`px-3 py-1.5 rounded-md flex-shrink min-w-[100px] max-w-sm ${isTitlePrefilled ? 'italic' : ''
                } ${darkMode
                  ? `bg-gray-700 placeholder-gray-400 border-gray-600 ${isTitlePrefilled ? 'text-gray-400' : 'text-gray-200'}`
                  : `bg-white placeholder-gray-400 border-gray-300 ${isTitlePrefilled ? 'text-gray-500' : 'text-gray-900'}`
                }`}
            />

            {!composeMode && (
              <Tooltip content={getSaveButtonTooltip()} side="bottom">
                <span className="inline-block">
                  <Button
                    onClick={handleSave}
                    disabled={isContentEmpty || isTitleEmpty || (editMode && !hasUnsavedChanges)}
                    variant="ghost"
                    className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}
                  >
                    <Save className="w-4 h-4" /> Save
                  </Button>
                </span>
              </Tooltip>
            )}
            <Tooltip content={getSaveAndLoadButtonTooltip()} side="bottom">
              <span className="inline-block">
                <Button
                  onClick={composeMode ? handleLoadDraft : handleSaveAndLoad}
                  disabled={isContentEmpty || isTitleEmpty || (editMode && !hasUnsavedChanges)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-400 to-purple-600 text-white rounded-md font-medium hover:from-blue-500 hover:to-purple-700"
                >
                  <FolderOpen className="w-4 h-4" /> {composeMode ? 'Load Draft' : 'Save and Load'}
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6">
        <div
          ref={editorContainerRef}
          className={`relative h-full rounded-lg border ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
          onContextMenu={handleCanvasContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={(e) => {
              handleTextareaPaste(e);
              handleContentPaste();
            }}
            onScroll={handleTextareaScroll}
            onClick={handleTextareaSelect}
            onKeyDown={(e) => {
              handleTextareaKeyDown(e);
              handleContentKeyDown(e, textareaRef);
            }}
            onKeyUp={handleTextareaSelect}
            onSelect={handleTextareaSelect}
            placeholder="Start typing your lyrics here, or paste existing content..."
            className={`w-full h-full p-6 rounded-lg resize-none outline-none font-mono text-base leading-relaxed ${darkMode
              ? 'bg-gray-800 text-gray-200 placeholder-gray-500'
              : 'bg-white text-gray-900 placeholder-gray-400'
              }`}
            spellCheck={false}
          />

          <div className="pointer-events-none absolute inset-0 z-10">
            {highlightVisible && (
              <div
                className="absolute rounded-sm bg-blue-500/10 transition-opacity duration-150 dark:bg-blue-400/15"
                style={{
                  top: highlightTop,
                  height: highlightHeight,
                  left: editorPadding.left,
                  right: editorPadding.right
                }}
              />
            )}

            {toolbarVisible && selectedMetric && (
              <div
                ref={toolbarRef}
                className={`pointer-events-auto absolute flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium shadow-sm transition-all duration-150 ${darkMode ? 'bg-gray-800 text-gray-100 border-gray-700' : 'bg-white text-gray-700 border-gray-200'}`}
                style={{
                  top: toolbarTop,
                  left: toolbarLeft
                }}
              >
                {canAddTranslationOnSelectedLine && (
                  <>
                    <button
                      type="button"
                      className={`rounded-sm px-2 py-1 transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700 focus-visible:bg-gray-700' : 'hover:bg-gray-100 focus-visible:bg-gray-100'}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (selectedLineIndex !== null) {
                          handleAddTranslation(selectedLineIndex);
                        }
                      }}
                    >
                      Add Translation
                    </button>
                    <div className={`h-4 w-px ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                  </>
                )}
                <button
                  type="button"
                  className={`rounded-sm px-2 py-1 transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700 focus-visible:bg-gray-700' : 'hover:bg-gray-100 focus-visible:bg-gray-100'}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (selectedLineIndex !== null) {
                      insertStandardTimestampAtLine(selectedLineIndex);
                    }
                  }}
                >
                  Add Timestamp
                </button>
              </div>
            )}

            {contextMenuState.visible && contextMenuPosition && (
              <div
                ref={contextMenuRef}
                className={`pointer-events-auto absolute z-30 w-44 rounded-lg border py-1 text-[13px] shadow-lg ${darkMode ? 'bg-gray-800 text-gray-100 border-gray-700' : 'bg-white text-gray-800 border-gray-200'}`}
                style={{
                  top: contextMenuPosition.top,
                  left: contextMenuPosition.left
                }}
                onMouseEnter={handleContextMenuEnter}
                onMouseLeave={handleContextMenuLeave}
              >
                {contextMenuState.mode === 'selection' ? (
                  <>
                    <button
                      type="button"
                      className={`flex w-full items-center px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      onClick={async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        await handleCut();
                        closeContextMenu();
                      }}
                      onMouseEnter={handleRootItemEnter}
                    >
                      Cut
                    </button>
                    <button
                      type="button"
                      className={`flex w-full items-center px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      onClick={async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        await handleCopy();
                        closeContextMenu();
                      }}
                      onMouseEnter={handleRootItemEnter}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className={`flex w-full items-center px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      onClick={async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        await handlePaste();
                        closeContextMenu();
                      }}
                      onMouseEnter={handleRootItemEnter}
                    >
                      Paste
                    </button>
                    <button
                      type="button"
                      className={`flex w-full items-center px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleCleanupFromContext();
                      }}
                      onMouseEnter={handleRootItemEnter}
                    >
                      Cleanup
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className="relative"
                      onMouseEnter={() => handleSubmenuTriggerEnter('timestamp')}
                      onFocus={() => handleSubmenuTriggerEnter('timestamp')}
                      onMouseLeave={handleSubmenuTriggerLeave}
                    >
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setActiveSubmenu('timestamp');
                        }}
                      >
                        <span>Add Timestamp</span>
                        <ChevronRight className={`h-4 w-4 ${submenuHorizontal === 'left' ? 'transform rotate-180' : ''}`} />
                      </button>
                      {activeSubmenu === 'timestamp' && (
                        <div
                          ref={timestampSubmenuRef}
                          className={`absolute ${submenuHorizontal === 'right' ? 'left-[calc(100%+8px)]' : 'right-[calc(100%+8px)]'} z-40 w-48 rounded-lg border py-1 text-[13px] shadow-lg ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-800'} overflow-y-auto`}
                          style={{
                            top: submenuOffsets.timestamp ?? 0,
                            maxHeight: submenuMaxHeight
                          }}
                          onMouseEnter={handleSubmenuPanelEnter}
                          onMouseLeave={handleSubmenuPanelLeave}
                        >
                          <button
                            type="button"
                            className={`flex w-full items-center px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (contextMenuState.lineIndex !== null) {
                                insertStandardTimestampAtLine(contextMenuState.lineIndex);
                              }
                            }}
                          >
                            Standard Timestamp
                          </button>
                          <button
                            type="button"
                            className={`flex w-full items-center px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${!contextMenuLineHasTimestamp ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!contextMenuLineHasTimestamp}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (contextMenuState.lineIndex !== null && contextMenuLineHasTimestamp) {
                                insertEnhancedTimestampAtCursor(contextMenuState.lineIndex);
                              }
                            }}
                          >
                            Enhanced Timestamp
                          </button>
                        </div>
                      )}
                    </div>
                    {contextMenuState.lineIndex !== null && canAddTranslationInContextMenu && (
                      <button
                        type="button"
                        className={`flex w-full items-center px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (contextMenuState.lineIndex !== null) {
                            handleAddTranslation(contextMenuState.lineIndex);
                          }
                        }}
                        onMouseEnter={handleRootItemEnter}
                      >
                        Add Translation
                      </button>
                    )}
                    <button
                      type="button"
                      className={`flex w-full items-center px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (contextMenuState.lineIndex !== null) {
                          handleCopyLine(contextMenuState.lineIndex);
                        }
                      }}
                      onMouseEnter={handleRootItemEnter}
                    >
                      Copy Line
                    </button>
                    <button
                      type="button"
                      className={`flex w-full items-center px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (contextMenuState.lineIndex !== null) {
                          handleDuplicateLine(contextMenuState.lineIndex);
                        }
                      }}
                      onMouseEnter={handleRootItemEnter}
                    >
                      Duplicate Line
                    </button>
                    <div
                      className="relative"
                      onMouseEnter={() => handleSubmenuTriggerEnter('metadata')}
                      onFocus={() => handleSubmenuTriggerEnter('metadata')}
                      onMouseLeave={handleSubmenuTriggerLeave}
                    >
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setActiveSubmenu('metadata');
                        }}
                      >
                        <span>Add Metadata</span>
                        <ChevronRight className={`h-4 w-4 ${submenuHorizontal === 'left' ? 'transform rotate-180' : ''}`} />
                      </button>
                      {activeSubmenu === 'metadata' && (
                        <div
                          ref={metadataSubmenuRef}
                          className={`absolute ${submenuHorizontal === 'right' ? 'left-[calc(100%+8px)]' : 'right-[calc(100%+8px)]'} z-40 w-52 rounded-lg border py-1 text-[13px] shadow-lg ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-800'} overflow-y-auto`}
                          style={{
                            top: submenuOffsets.metadata ?? 0,
                            maxHeight: submenuMaxHeight
                          }}
                          onMouseEnter={handleSubmenuPanelEnter}
                          onMouseLeave={handleSubmenuPanelLeave}
                        >
                          <button
                            type="button"
                            className={`flex w-full items-center px-3 py-2 text-left font-semibold transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700 bg-gray-750' : 'hover:bg-gray-100 bg-gray-50'}`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleAddDefaultTags();
                            }}
                          >
                            Add Default Tags
                          </button>
                          <div className={`my-1 h-px ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                          {METADATA_OPTIONS.map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              className={`flex w-full items-center px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (contextMenuState.lineIndex !== null) {
                                  insertMetadataTagAtCursor(contextMenuState.lineIndex, option.key);
                                }
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`flex w-full items-center px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleCleanupFromContext();
                      }}
                      onMouseEnter={handleRootItemEnter}
                    >
                      Cleanup
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div
            ref={measurementContainerRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre-wrap break-words font-mono text-base leading-relaxed opacity-0"
            style={{
              paddingTop: `${editorPadding.top}px`,
              paddingRight: `${editorPadding.right}px`,
              paddingBottom: `${editorPadding.bottom}px`,
              paddingLeft: `${editorPadding.left}px`
            }}
          >
            {lines.map((line, index) => (
              <div
                key={index}
                ref={(node) => {
                  measurementRefs.current[index] = node;
                }}
              >
                <span className="inline-block whitespace-pre-wrap break-words">
                  {line.length > 0 ? line : '\u00A0'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewSongCanvas;