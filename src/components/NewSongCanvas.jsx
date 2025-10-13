import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Scissors, Copy, ClipboardPaste, Wand2, Save, FolderOpen, Undo, Redo } from 'lucide-react';
import { useLyricsState, useDarkModeState } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useFileUpload from '../hooks/useFileUpload';
import useDarkModeSync from '../hooks/useDarkModeSync';
import useEditorClipboard from '../hooks/useEditorClipboard';
import useEditorHistory from '../hooks/useEditorHistory';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLyrics, reconstructEditableText } from '../utils/lyricsFormat';
import { processRawTextToLines } from '../utils/parseLyrics';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';

const BRACKET_PAIRS = {
  '(': ')',
  '{': '}',
  '[': ']',
  '<': '>'
};

const NewSongCanvas = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") || "new";
  const editMode = mode === "edit";
  const composeMode = mode === "compose";
  const isController = composeMode;

  const { darkMode, setDarkMode } = useDarkModeState();
  const { lyrics, lyricsFileName, rawLyricsContent, setRawLyricsContent } = useLyricsState();

  const { emitLyricsDraftSubmit } = useControlSocket();

  const handleFileUpload = useFileUpload();
  const textareaRef = useRef(null);
  const baseContentRef = useRef('');
  const baseTitleRef = useRef('');

  const { content, setContent, undo, redo, canUndo, canRedo } = useEditorHistory('');
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState('');
  const editorContainerRef = useRef(null);
  const measurementContainerRef = useRef(null);
  const measurementRefs = useRef([]);
  const toolbarRef = useRef(null);
  const contextMenuRef = useRef(null);
  const touchLongPressTimeoutRef = useRef(null);
  const touchStartPositionRef = useRef(null);
  const touchMovedRef = useRef(false);
  const pendingScrollRestoreRef = useRef(null);
  const lastKnownScrollRef = useRef(0);

  const [scrollTop, setScrollTop] = useState(0);
  const [lineMetrics, setLineMetrics] = useState([]);
  const [editorPadding, setEditorPadding] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedLineIndex, setSelectedLineIndex] = useState(null);
  const [contextMenuState, setContextMenuState] = useState({ visible: false, x: 0, y: 0, lineIndex: null, mode: 'line' });
  const [toolbarDimensions, setToolbarDimensions] = useState({ width: 0, height: 0 });
  const [contextMenuDimensions, setContextMenuDimensions] = useState({ width: 0, height: 0 });
  const [pendingFocus, setPendingFocus] = useState(null);

  const closeContextMenu = useCallback(() => {
    setContextMenuState({ visible: false, x: 0, y: 0, lineIndex: null, mode: 'line' });
  }, []);

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
    if (rawLyricsContent) {
      setContent(rawLyricsContent);
    } else if (lyrics && lyrics.length > 0) {
      const text = reconstructEditableText(lyrics);
      setContent(text);
    } else {
      setContent('');
    }
    setFileName(lyricsFileName || '');
    setTitle(lyricsFileName || '');

    const nextContent = rawLyricsContent
      ? rawLyricsContent
      : (lyrics && lyrics.length > 0)
        ? reconstructEditableText(lyrics)
        : '';
    baseContentRef.current = nextContent || '';
    baseTitleRef.current = (lyricsFileName || '') || '';
  }, [editMode, lyrics, lyricsFileName, rawLyricsContent]);

  useEffect(() => {
    if (editMode) return;
    setContent('');
    setFileName('');
    setTitle('');
    baseContentRef.current = '';
    baseTitleRef.current = '';
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

    window.addEventListener('draft-submitted', handleDraftSubmitted);
    window.addEventListener('draft-error', handleDraftError);

    return () => {
      window.removeEventListener('draft-submitted', handleDraftSubmitted);
      window.removeEventListener('draft-error', handleDraftError);
    };
  }, [showToast]);

  const { handleCut, handleCopy, handlePaste, handleCleanup, handleTextareaPaste } = useEditorClipboard({ content, setContent, textareaRef });

  const lines = useMemo(() => content.split('\n'), [content]);

  const isLineWrappedWithTranslation = useCallback((rawLine) => {
    const trimmed = (rawLine ?? '').trim();
    if (trimmed.length < 2) return false;
    const ending = BRACKET_PAIRS[trimmed[0]];
    return Boolean(ending && trimmed.endsWith(ending));
  }, []);

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
    if (!measurementContainerRef.current) {
      setLineMetrics([]);
      return;
    }
    const metrics = measurementRefs.current.map((node) => {
      if (!node) return null;
      const widthNode = node.firstElementChild || node;
      const width = Math.max(
        widthNode ? widthNode.scrollWidth : 0,
        widthNode ? widthNode.offsetWidth : 0
      );
      return {
        top: node.offsetTop,
        height: node.offsetHeight,
        width,
      };
    });
    setLineMetrics(metrics);
  }, [content, containerSize]);

  useLayoutEffect(() => {
    if (selectedLineIndex === null || !toolbarRef.current) return;
    const rect = toolbarRef.current.getBoundingClientRect();
    setToolbarDimensions({ width: rect.width, height: rect.height });
  }, [selectedLineIndex]);

  useLayoutEffect(() => {
    if (!contextMenuState.visible || !contextMenuRef.current) return;
    const rect = contextMenuRef.current.getBoundingClientRect();
    setContextMenuDimensions({ width: rect.width, height: rect.height });
  }, [contextMenuState.visible]);

  useEffect(() => {
    return () => {
      clearTouchLongPress();
    };
  }, [clearTouchLongPress]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedLineIndex(null);
        closeContextMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeContextMenu]);

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

  const handleBack = () => {
    const hasChanges = (content || '') !== (baseContentRef.current || '') || (title || '') !== (baseTitleRef.current || '');
    if (hasChanges) {
      showToast({
        title: 'Unsaved changes',
        message: 'You have unsaved changes. Discard them?',
        variant: 'warn',
        duration: 0,
        actions: [
          { label: 'Yes, discard', onClick: () => navigate('/') },
          { label: 'Cancel', onClick: () => { } },
        ],
      });
      return;
    }
    navigate('/');
  };

  const handleSave = async () => {
    if (!content.trim() || !title.trim()) {
      showModal({
        title: 'Missing song details',
        description: 'Enter both a song title and lyrics before saving.',
        variant: 'warn',
        dismissLabel: 'Will do',
      });
      return;
    }

    if (window.electronAPI && window.electronAPI.showSaveDialog) {
      try {
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: (title && `${title}.txt`) || fileName || 'untitled.txt',
          filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });

        if (!result.canceled) {
          await window.electronAPI.writeFile(result.filePath, content);
          const baseName = result.filePath.split(/[\\/]/).pop().replace(/\.txt$/i, '');
          setFileName(baseName);
          setTitle(baseName);
          baseContentRef.current = content;
          baseTitleRef.current = baseName;
        }
      } catch (err) {
        console.error('Failed to save file:', err);
        showModal({
          title: 'Save failed',
          description: 'We could not save the lyric file. Please try again.',
          variant: 'error',
          dismissLabel: 'Close',
        });
      }
    } else {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (title && `${title}.txt`) || fileName || 'lyrics.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      baseContentRef.current = content;
      baseTitleRef.current = title || fileName || 'lyrics';
    }
  };

  const handleSaveAndLoad = async () => {
    if (!content.trim() || !title.trim()) {
      showModal({
        title: 'Missing song details',
        description: 'Enter both a song title and lyrics before saving and loading.',
        variant: 'warn',
        dismissLabel: 'Got it',
      });
      return;
    }

    if (window.electronAPI && window.electronAPI.showSaveDialog) {
      try {
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: (title && `${title}.txt`) || fileName || 'untitled.txt',
          filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });

        if (!result.canceled) {
          await window.electronAPI.writeFile(result.filePath, content);
          const baseName = result.filePath.split(/[\\/]/).pop().replace(/\.txt$/i, '');

          const blob = new Blob([content], { type: 'text/plain' });
          const file = new File([blob], `${baseName}.txt`, { type: 'text/plain' });

          setRawLyricsContent(content);
          await handleFileUpload(file, { rawText: content });
          try {
            if (window.electronAPI?.addRecentFile) {
              await window.electronAPI.addRecentFile(result.filePath);
            }
          } catch { }

          navigate('/');
        }
      } catch (err) {
        console.error('Failed to save and load file:', err);
        showModal({
          title: 'Save and load failed',
          description: 'We could not save and reload the lyrics. Please try again.',
          variant: 'error',
          dismissLabel: 'Close',
        });
      }
    } else {
      try {
        const baseName = title || fileName || 'lyrics';
        const blob = new Blob([content], { type: 'text/plain' });
        const file = new File([blob], `${baseName}.txt`, { type: 'text/plain' });

        setRawLyricsContent(content);
        await handleFileUpload(file, { rawText: content });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        baseContentRef.current = content;
        navigate('/');
      } catch (err) {
        console.error('Failed to process lyrics:', err);
        showModal({
          title: 'Processing error',
          description: 'We could not process the lyrics. Please try again.',
          variant: 'error',
          dismissLabel: 'Close',
        });
      }
    }
  };

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

  const focusLine = useCallback((lineIndex) => {
    if (lineIndex === null || lineIndex === undefined) return;
    setPendingFocus({ type: 'line', lineIndex });
  }, []);

  const focusInsideBrackets = useCallback((lineIndex) => {
    if (lineIndex === null || lineIndex === undefined) return;
    setPendingFocus({ type: 'translation', lineIndex });
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

    setContent(newContent);
    lastKnownScrollRef.current = currentScroll;
    setSelectedLineIndex(lineIndex + 1);
    closeContextMenu();
  }, [closeContextMenu, isLineWrappedWithTranslation, lines, focusLine]);

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
      setContent((prev) => {
        const segments = prev.split('\n');
        const safeIndex = Math.max(0, Math.min(lineIndex, segments.length - 1));
        const lineToDuplicate = segments[safeIndex] ?? '';
        segments.splice(safeIndex + 1, 0, '', lineToDuplicate);
        return segments.join('\n');
      });
    });
    focusLine(lineIndex + 2);
    closeContextMenu();
  }, [closeContextMenu, focusLine, preserveTextareaScroll, setContent]);

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
      setContextMenuState({
        visible: true,
        x: safeX,
        y: safeY,
        lineIndex: selectionLineIndex,
        mode: 'selection'
      });
      return;
    }

    const relativeY = rawY + scrollTop;
    const lineIndex = findLineIndexByPosition(relativeY);
    if (lineIndex === null) return;

    const offsets = lineOffsets[lineIndex];
    if (offsets && textarea) {
      textarea.focus();
      textarea.setSelectionRange(offsets.start, offsets.end);
    }

    setSelectedLineIndex(lineIndex);
    setContextMenuState({
      visible: true,
      x: safeX,
      y: safeY,
      lineIndex,
      mode: 'line'
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

  const handleCleanupFromContext = useCallback(() => {
    handleCleanup();
    closeContextMenu();
  }, [closeContextMenu, handleCleanup]);

  const isContentEmpty = !content.trim();
  const isTitleEmpty = !title.trim();

  const fallbackLineHeight = 24;
  const selectedMetric = selectedLineIndex !== null ? lineMetrics[selectedLineIndex] : null;
  const selectedLineText = selectedLineIndex !== null ? (lines[selectedLineIndex] ?? '') : '';
  const selectedLineHasContent = selectedLineText.trim().length > 0;
  const selectedLineIsWrapped = selectedLineHasContent && isLineWrappedWithTranslation(selectedLineText);
  const highlightTop = selectedMetric ? selectedMetric.top - scrollTop : null;
  const highlightHeight = selectedMetric ? Math.max(selectedMetric.height || 0, fallbackLineHeight) : fallbackLineHeight;
  const highlightVisible = Boolean(
    selectedMetric &&
    selectedLineHasContent &&
    highlightTop !== null &&
    containerSize.height > 0 &&
    highlightTop + highlightHeight > 0 &&
    highlightTop < containerSize.height
  );

  const contentWidth = Math.max(containerSize.width - editorPadding.left - editorPadding.right, 0);
  const toolbarHeight = toolbarDimensions.height || 36;
  const toolbarWidth = toolbarDimensions.width || 200;

  const toolbarAnchorX = selectedMetric ? editorPadding.left + Math.min(selectedMetric.width + 12, contentWidth) : 0;
  let toolbarLeft = toolbarAnchorX - toolbarWidth;
  if (toolbarLeft < editorPadding.left) {
    toolbarLeft = editorPadding.left;
  }
  if (toolbarLeft + toolbarWidth > editorPadding.left + contentWidth) {
    toolbarLeft = Math.max(editorPadding.left, editorPadding.left + contentWidth - toolbarWidth);
  }
  let toolbarTop = 0;
  if (selectedMetric) {
    const lineTop = selectedMetric.top - scrollTop;
    const lineHeight = Math.max(selectedMetric.height || 0, fallbackLineHeight);
    const lineBottom = lineTop + lineHeight;
    const desiredAbove = lineTop - toolbarHeight - 8;
    const minTop = editorPadding.top + 8;
    const maxTop = containerSize.height > 0 ? containerSize.height - toolbarHeight - 8 : null;

    if (desiredAbove < minTop) {
      toolbarTop = lineBottom + 8;
    } else {
      toolbarTop = desiredAbove;
    }

    if (maxTop !== null && toolbarTop > maxTop) {
      toolbarTop = Math.max(minTop, maxTop);
    } else if (toolbarTop < minTop) {
      toolbarTop = minTop;
    }
  }
  const toolbarWithinBounds = containerSize.height <= 0 || (toolbarTop < containerSize.height && toolbarTop + toolbarHeight > 0);
  const toolbarVisible = Boolean(
    highlightVisible &&
    selectedLineIndex !== null &&
    !contextMenuState.visible &&
    toolbarWithinBounds
  );
  const canAddTranslationOnSelectedLine = selectedLineHasContent && !selectedLineIsWrapped;

  const fallbackMenuWidth = contextMenuState.mode === 'selection' ? 168 : 192;
  const fallbackMenuHeight = contextMenuState.mode === 'selection' ? 152 : 192;
  const menuWidth = contextMenuDimensions.width || fallbackMenuWidth;
  const menuHeight = contextMenuDimensions.height || fallbackMenuHeight;
  const contextMenuPosition = contextMenuState.visible ? {
    left: Math.max(
      8,
      Math.min(
        contextMenuState.x,
        containerSize.width > 0
          ? Math.max(8, containerSize.width - menuWidth - 8)
          : contextMenuState.x
      )
    ),
    top: Math.max(
      8,
      Math.min(
        contextMenuState.y,
        containerSize.height > 0
          ? Math.max(8, containerSize.height - menuHeight - 8)
          : contextMenuState.y
      )
    )
  } : null;

  const contextMenuLineText = contextMenuState.lineIndex !== null ? (lines[contextMenuState.lineIndex] ?? '') : '';
  const contextMenuLineHasContent = contextMenuLineText.trim().length > 0;
  const contextMenuLineIsWrapped = contextMenuLineHasContent && isLineWrappedWithTranslation(contextMenuLineText);
  const canAddTranslationInContextMenu = contextMenuState.mode === 'line' && contextMenuLineHasContent && !contextMenuLineIsWrapped;


  return (
    <div className={`flex flex-col h-screen font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Fixed Header */}
      <div className={`shadow-sm border-b p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        {/* Mobile Layout - Two Rows */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-3">
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
            <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {composeMode ? "Compose Lyrics" : editMode ? "Edit Song Canvas" : "New Song Canvas"}
            </h1>
            <div className="w-[72px]"></div>
          </div>

          {/* Row 1: Undo, Redo, Cut, Copy, Paste, Cleanup */}
          <div className="flex items-center justify-center gap-1 mb-3">
            <Button onClick={handleUndo} disabled={!canUndo} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Undo (Ctrl+Z)">
              <Undo className="w-4 h-4" />
            </Button>
            <Button onClick={handleRedo} disabled={!canRedo} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Redo (Ctrl+Shift+Z)">
              <Redo className="w-4 h-4" />
            </Button>
            <Button onClick={handleCut} disabled={isContentEmpty} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Cut">
              <Scissors className="w-4 h-4" />
            </Button>
            <Button onClick={handleCopy} disabled={isContentEmpty} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Copy">
              <Copy className="w-4 h-4" />
            </Button>
            <Button onClick={handlePaste} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Paste">
              <ClipboardPaste className="w-4 h-4" />
            </Button>
            <Button onClick={handleCleanup} disabled={isContentEmpty} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Cleanup">
              <Wand2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Row 2: Title and Action Button */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={65}
              placeholder="Enter song title..."
              className={`flex-1 px-3 py-1.5 rounded-md ${darkMode
                ? "bg-gray-700 text-gray-200 placeholder-gray-400 border-gray-600"
                : "bg-white text-gray-900 placeholder-gray-400 border-gray-300"
                }`}
            />
            {composeMode ? (
              <Button
                onClick={handleLoadDraft}
                disabled={isContentEmpty || isTitleEmpty}
                className="whitespace-nowrap bg-gradient-to-r from-blue-400 to-purple-600 text-white hover:from-blue-500 hover:to-purple-700"
                size="sm"
              >
                <FolderOpen className="w-4 h-4 mr-1" /> Load
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSave}
                  disabled={isContentEmpty || isTitleEmpty}
                  variant="ghost"
                  size="sm"
                  title="Save"
                >
                  <Save className="w-4 h-4" />
                </Button>
                <Button
                  onClick={handleSaveAndLoad}
                  disabled={isContentEmpty || isTitleEmpty}
                  className="whitespace-nowrap bg-gradient-to-r from-blue-400 to-purple-600 text-white"
                  size="sm"
                >
                  <FolderOpen className="w-4 h-4 mr-1" /> Save & Load
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Desktop Layout - Original Single Row */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between mb-4">
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
            <h1 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {composeMode ? "Compose Lyrics" : editMode ? "Edit Song Canvas" : "New Song Canvas"}
            </h1>
            <div className="w-[72px]"></div>
          </div>
          {/* Desktop Toolbar */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={handleUndo} disabled={!canUndo} variant="ghost"
              className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Undo (Ctrl+Z)">
              <Undo className="w-4 h-4" />
            </Button>
            <Button onClick={handleRedo} disabled={!canRedo} variant="ghost"
              className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`} title="Redo (Ctrl+Shift+Z)">
              <Redo className="w-4 h-4" />
            </Button>
            <div className={`w-px h-6 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>

            {/* Responsive Cut/Copy/Paste/Cleanup*/}
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleCut} disabled={isContentEmpty} variant="ghost"
                className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''} hidden lg:flex`}>
                <Scissors className="w-4 h-4" /> Cut
              </Button>
              <Button onClick={handleCopy} disabled={isContentEmpty} variant="ghost"
                className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''} hidden lg:flex`}>
                <Copy className="w-4 h-4" /> Copy
              </Button>
              <Button onClick={handlePaste} variant="ghost"
                className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''} hidden lg:flex`}>
                <ClipboardPaste className="w-4 h-4" /> Paste
              </Button>
              <Button onClick={handleCleanup} disabled={isContentEmpty} variant="ghost"
                className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''} hidden lg:flex`}>
                <Wand2 className="w-4 h-4" /> Cleanup
              </Button>

              {/* Icon-only versions appear below lg */}
              <div className="flex lg:hidden gap-1">
                <Button onClick={handleCut} disabled={isContentEmpty} variant="ghost" size="sm" title="Cut">
                  <Scissors className="w-4 h-4" />
                </Button>
                <Button onClick={handleCopy} disabled={isContentEmpty} variant="ghost" size="sm" title="Copy">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button onClick={handlePaste} variant="ghost" size="sm" title="Paste">
                  <ClipboardPaste className="w-4 h-4" />
                </Button>
                <Button onClick={handleCleanup} disabled={isContentEmpty} variant="ghost" size="sm" title="Cleanup">
                  <Wand2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className={`w-px h-6 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>

            {/* Title Input */}
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={65}
              placeholder="Enter song title..."
              className={`px-3 py-1.5 rounded-md flex-shrink min-w-[100px] max-w-sm ${darkMode
                ? "bg-gray-700 text-gray-200 placeholder-gray-400 border-gray-600"
                : "bg-white text-gray-900 placeholder-gray-400 border-gray-300"
                }`}
            />

            {!composeMode && (
              <Button
                onClick={handleSave}
                disabled={isContentEmpty || isTitleEmpty}
                variant="ghost"
                className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}
              >
                <Save className="w-4 h-4" /> Save
              </Button>
            )}
            <Button
              onClick={composeMode ? handleLoadDraft : handleSaveAndLoad}
              disabled={isContentEmpty || isTitleEmpty}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-400 to-purple-600 text-white rounded-md font-medium hover:from-blue-500 hover:to-purple-700"
            >
              <FolderOpen className="w-4 h-4" /> {composeMode ? 'Load Draft' : 'Save and Load'}
            </Button>
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
            onPaste={handleTextareaPaste}
            onScroll={handleTextareaScroll}
            onClick={handleTextareaSelect}
            onKeyDown={handleTextareaKeyDown}
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
                      handleCopyLine(selectedLineIndex);
                    }
                  }}
                >
                  Copy Line
                </button>
              </div>
            )}

            {contextMenuState.visible && contextMenuPosition && (
              <div
                ref={contextMenuRef}
                className={`pointer-events-auto absolute z-30 w-44 rounded-lg border py-1 text-sm shadow-lg ${darkMode ? 'bg-gray-800 text-gray-100 border-gray-700' : 'bg-white text-gray-800 border-gray-200'}`}
                style={{
                  top: contextMenuPosition.top,
                  left: contextMenuPosition.left
                }}
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
                    >
                      Cleanup
                    </button>
                  </>
                ) : (
                  <>
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
                    >
                      Copy Line
                    </button>
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
                          handleDuplicateLine(contextMenuState.lineIndex);
                        }
                      }}
                    >
                      Duplicate Line
                    </button>
                    <button
                      type="button"
                      className={`flex w-full items-center px-3 py-2 text-left transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleCleanupFromContext();
                      }}
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
