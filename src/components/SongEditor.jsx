import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import useLyricsStore from '../context/LyricsStore';
import { useControlSocket } from '../context/ControlSocketProvider';
import { useDarkModeState, useLyricsState, useOutputSettings } from '../hooks/useStoreSelectors';
import useDarkModeSync from '../hooks/useDarkModeSync';
import useFileUpload from '../hooks/useFileUpload';
import useFileSave from '../hooks/NewSongCanvas/useFileSave.js';
import useModal from '../hooks/useModal';
import useToast from '../hooks/useToast';
import { useKeyboardShortcuts } from '../hooks/NewSongCanvas/useKeyboardShortcuts';
import { useCanvasNavigationActions } from '../hooks/NewSongCanvas/useCanvasNavigationActions';
import useElectronListeners from '../hooks/NewSongCanvas/useElectronListeners';
import { buildSongSectionOptions } from '../constants/songCanvas';
import { formatLyrics } from '../utils/lyricsFormat';
import { applyTextCasing } from '../utils/textCasing';
import { isStructureTag } from '../../shared/lyricsParsing/structureTags.js';
import {
  isLdsongContent,
  ldsongDocumentToLyrics,
  ldsongDocumentToPlainText,
  parseLdsongDocument,
  serializeLdsongDocument,
} from '../../shared/lyricsParsing/ldsong.js';
import { stripLyricImportExtension } from '../../shared/lyricImportRegistry.js';
import { extractFirstValidLine, isUsableLyricsTitle, UNTITLED_LYRICS_TITLE } from '../utils/titlePrefill';
import {
  addEditorLine,
  addEditorSection,
  addEditorSlide,
  createEditorDocument,
  duplicateEditorLine,
  getEditorPlayOrder,
  getEditorSlideIssues,
  importLyricsIntoEditor,
  insertLiteralLinesIntoEditor,
  isEditorDocumentEmpty,
  isSongSizedPaste,
  mapEditorLines,
  mergeEditorSlideWithPrevious,
  moveEditorLine,
  moveEditorSection,
  removeEditorLine,
  removeEditorSection,
  removeEditorSlide,
  splitEditorSectionAtSlide,
  splitEditorSlide,
  toLdsongDocument,
  updateEditorLine,
  updateEditorMetadata,
  updateEditorSection,
  writePreferredSongEditor,
} from '../utils/songDocumentEditing.js';
import SongCanvasHeader from './NewSongCanvas/SongCanvasHeader';
import EditorModeSwitcher from './SongEditor/EditorModeSwitcher';
import SongEditorSection from './SongEditor/SongEditorSection';
import SongEditorSidebar from './SongEditor/SongEditorSidebar';

const HISTORY_LIMIT = 100;
const QUICK_SECTIONS = ['Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Tag'];

// Undo history for the whole document. Typing in one line coalesces into a single step.
function useDocumentHistory(initialDocument) {
  const [history, setHistory] = useState(() => ({ past: [], present: initialDocument, future: [], lastKey: null, lastAt: 0 }));

  const commit = useCallback((nextDocument, { coalesceKey = null } = {}) => {
    setHistory((current) => {
      if (nextDocument === current.present) return current;
      const now = Date.now();
      const coalesce = coalesceKey && coalesceKey === current.lastKey && now - current.lastAt < 1200;
      return {
        past: coalesce ? current.past : [...current.past, current.present].slice(-HISTORY_LIMIT),
        present: nextDocument,
        future: [],
        lastKey: coalesceKey,
        lastAt: now,
      };
    });
  }, []);

  const reset = useCallback((nextDocument) => {
    setHistory({ past: [], present: nextDocument, future: [], lastKey: null, lastAt: 0 });
  }, []);

  const undo = useCallback(() => setHistory((current) => (current.past.length === 0 ? current : {
    past: current.past.slice(0, -1),
    present: current.past[current.past.length - 1],
    future: [current.present, ...current.future],
    lastKey: null,
    lastAt: 0,
  })), []);

  const redo = useCallback(() => setHistory((current) => (current.future.length === 0 ? current : {
    past: [...current.past, current.present],
    present: current.future[0],
    future: current.future.slice(1),
    lastKey: null,
    lastAt: 0,
  })), []);

  return {
    document: history.present,
    commit,
    reset,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

const nextSectionLabel = (document, base) => {
  const labels = new Set(document.sections.map((section) => section.label.trim().toLowerCase()));
  if (base === 'Verse') {
    let number = 1;
    while (labels.has(`verse ${number}`)) number += 1;
    return `Verse ${number}`;
  }
  if (!labels.has(base.toLowerCase())) return base;
  let number = 2;
  while (labels.has(`${base.toLowerCase()} ${number}`)) number += 1;
  return `${base} ${number}`;
};

// Same cleanup options the classic canvas uses, applied one line at a time so structure is untouched.
const getCleanupOptions = () => {
  const state = useLyricsStore.getState();
  return {
    capitalizeFirst: state.formattingCapitalizeFirstLetter,
    capitalizeReligious: state.formattingCapitalizeReligiousTerms,
    capitalizedWords: state.formattingCapitalizedWords,
    normalizeTypographic: state.formattingNormalizeTypographicChars,
    enableSplitting: false,
    groupingConfig: state.lyricsParsingOptions.groupingConfig,
  };
};

const cleanLineText = (text, options) => formatLyrics(text, options)
  .split('\n')
  .map((part) => part.trim())
  .filter(Boolean)
  .join(' ');

const findLineContext = (document, lineId) => {
  if (!lineId) return null;
  for (const section of document.sections) {
    for (const slide of section.slides) {
      const lineIndex = slide.lines.findIndex((line) => line.id === lineId);
      if (lineIndex !== -1) return { section, slide, line: slide.lines[lineIndex], lineIndex };
    }
  }
  return null;
};

const startingDocument = () => addEditorSection(createEditorDocument(), { label: 'Verse 1' });

const SongEditor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'new';
  const editMode = mode === 'edit';

  const { darkMode, setDarkMode } = useDarkModeState();
  useDarkModeSync(darkMode, setDarkMode);
  const { showToast } = useToast();
  const { showModal } = useModal();
  const { lyricsFileName, lyricsSource, rawLyricsContent, songMetadata: storedMetadata, setRawLyricsContent, setSongMetadata, setPendingSavedVersion } = useLyricsState();
  const { updateSetlistItem } = useControlSocket();
  const handleFileUpload = useFileUpload();
  const parsingOptions = useLyricsStore((state) => state.lyricsParsingOptions);
  const sectionTagPhrases = parsingOptions.groupingConfig.sectionTagPhrases;
  const { settings: output1Settings } = useOutputSettings('output1');

  const initial = useMemo(() => startingDocument(), []);
  const { document, commit, reset, undo, redo, canUndo, canRedo } = useDocumentHistory(initial.document);
  const [title, setTitle] = useState(UNTITLED_LYRICS_TITLE);
  const [fileName, setFileName] = useState('');
  const [currentFilePath, setCurrentFilePath] = useState('');
  const [saveVersion, setSaveVersion] = useState(0);
  const [nameRequestSectionId, setNameRequestSectionId] = useState(null);
  const [selectedSlideId, setSelectedSlideId] = useState(initial.slideId);
  const [pendingFocus, setPendingFocus] = useState(mode === 'new' ? initial.lineId : null);
  const baseContentRef = useRef('');
  const baseTitleRef = useRef(UNTITLED_LYRICS_TITLE);
  const inputRefs = useRef(new Map());
  const [activeLineId, setActiveLineId] = useState(initial.lineId);
  const activeSetlistItemId = editMode ? lyricsSource?.setlistItemId || null : null;

  const ldsongDocument = useMemo(() => {
    const saved = toLdsongDocument(document);
    const metadata = { ...saved.metadata };
    if (isUsableLyricsTitle(title)) metadata.title = title.trim();
    else delete metadata.title;
    return { ...saved, metadata };
  }, [document, title]);
  const isContentEmpty = isEditorDocumentEmpty(document);
  const content = useMemo(
    () => (isContentEmpty ? '' : serializeLdsongDocument(ldsongDocument)),
    [isContentEmpty, ldsongDocument],
  );
  const hasUnsavedChanges = useMemo(
    () => content !== (baseContentRef.current || '') || (title || '') !== (baseTitleRef.current || ''),
    [content, title, saveVersion],
  );
  const songMetadataForSave = useMemo(() => ({
    ...ldsongDocument.metadata,
    artists: ldsongDocument.metadata.artists || [],
    origin: 'LyricDisplay Song',
    filePath: currentFilePath || null,
  }), [currentFilePath, ldsongDocument.metadata]);

  const prefillTitle = useCallback((nextDocument) => {
    setTitle((current) => {
      if (isUsableLyricsTitle(current)) return current;
      if (nextDocument.metadata?.title) return nextDocument.metadata.title;
      const firstLine = nextDocument.sections.flatMap((section) => section.slides)
        .flatMap((slide) => slide.lines)
        .find((line) => line.role === 'lyric' && line.text.trim());
      return firstLine ? extractFirstValidLine(firstLine.text, { sectionTagPhrases }) || current : current;
    });
  }, [sectionTagPhrases]);

  const loadSongFile = useCallback(({ content: fileContent, fileName: loadedName, filePath }) => {
    if (!fileContent) return;
    const baseName = loadedName ? stripLyricImportExtension(loadedName) : '';
    const structured = isLdsongContent(fileContent) || /\.ldsong$/i.test(loadedName || '');

    if (structured) {
      const { document: parsed, error } = parseLdsongDocument(fileContent);
      if (error) {
        showModal({ title: 'Song can’t be opened', description: error, variant: 'warn', dismissLabel: 'Close' });
        return;
      }
      const nextDocument = createEditorDocument(parsed);
      const nextTitle = parsed.metadata.title || baseName || UNTITLED_LYRICS_TITLE;
      reset(nextDocument);
      setTitle(nextTitle);
      setFileName(baseName);
      setCurrentFilePath(filePath || '');
      baseTitleRef.current = nextTitle;
      baseContentRef.current = serializeLdsongDocument({
        ...toLdsongDocument(nextDocument),
        metadata: { ...toLdsongDocument(nextDocument).metadata, title: nextTitle },
      });
      setSaveVersion((version) => version + 1);
      return;
    }

    // Other formats are converted once for review; the original file is never overwritten.
    const nextDocument = importLyricsIntoEditor(createEditorDocument(), fileContent, { parsingOptions });
    reset(nextDocument);
    setTitle(baseName || nextDocument.metadata.title || UNTITLED_LYRICS_TITLE);
    setFileName('');
    setCurrentFilePath(filePath || '');
    baseContentRef.current = '';
    baseTitleRef.current = UNTITLED_LYRICS_TITLE;
    if (!baseName) prefillTitle(nextDocument);
  }, [parsingOptions, prefillTitle, reset, showModal]);

  // Load the song this editor was opened for: a handed-over file, the loaded song, or a conversion.
  useEffect(() => {
    const pending = window.__pendingStructuredSongLoad || window.__pendingCanvasLyricsLoad;
    delete window.__pendingStructuredSongLoad;
    delete window.__pendingCanvasLyricsLoad;

    if (pending?.content) {
      loadSongFile(pending);
    } else if (editMode && rawLyricsContent) {
      loadSongFile({
        content: rawLyricsContent,
        fileName: lyricsSource?.fileName || `${lyricsFileName || 'lyrics'}.${lyricsSource?.fileType || 'txt'}`,
        filePath: lyricsSource?.filePath || storedMetadata?.filePath || '',
      });
    } else if (mode === 'convert' && location.state?.convertText) {
      loadSongFile({
        content: location.state.convertText,
        fileName: location.state.title ? `${location.state.title}.txt` : '',
        filePath: location.state.sourcePath || '',
      });
    }
    // Runs once per navigation; the route remounts this editor for each new location.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleLoadIntoCanvas = (event) => loadSongFile(event.detail || {});
    window.addEventListener('load-into-canvas', handleLoadIntoCanvas);
    return () => window.removeEventListener('load-into-canvas', handleLoadIntoCanvas);
  }, [loadSongFile]);

  useEffect(() => {
    if (!pendingFocus) return;
    const input = inputRefs.current.get(pendingFocus);
    if (input) {
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
      setPendingFocus(null);
    }
  }, [document, pendingFocus]);

  const registerInput = useCallback((lineId, element) => {
    if (element) inputRefs.current.set(lineId, element);
    else inputRefs.current.delete(lineId);
  }, []);

  const orderedLineIds = useMemo(
    () => document.sections.flatMap((section) => section.slides.flatMap((slide) => slide.lines.map((line) => line.id))),
    [document],
  );

  const applyPastedText = useCallback((text, { lineId = null, forceLayout = false } = {}) => {
    const value = String(text || '');
    if (!value.trim()) return;
    const sectionId = lineId
      ? document.sections.find((section) => section.slides.some((slide) => slide.lines.some((line) => line.id === lineId)))?.id
      : null;

    if (forceLayout || isSongSizedPaste(value) || !lineId) {
      const replacesStarter = isEditorDocumentEmpty(document);
      const nextDocument = importLyricsIntoEditor(document, value, {
        parsingOptions,
        afterSectionId: sectionId,
      });
      commit(nextDocument);
      if (replacesStarter) prefillTitle(nextDocument);
      return;
    }

    commit(insertLiteralLinesIntoEditor(document, lineId, value));
  }, [commit, document, parsingOptions, prefillTitle]);

  // Pasting outside a field lays a whole song out; fields handle their own pastes.
  useEffect(() => {
    const handleWindowPaste = (event) => {
      if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const text = event.clipboardData?.getData('text/plain');
      if (!text?.trim()) return;
      event.preventDefault();
      applyPastedText(text, { forceLayout: true });
    };
    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [applyPastedText]);

  const handlePasteButton = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) {
        showToast({ title: 'Clipboard is empty', message: 'Copy some lyrics first, then paste them here.', variant: 'info' });
        return;
      }
      applyPastedText(text, { forceLayout: true });
    } catch {
      showToast({ title: 'Paste unavailable', message: 'Press Ctrl+V (Cmd+V on Mac) to paste your lyrics instead.', variant: 'info' });
    }
  }, [applyPastedText, showToast]);

  const handleLinePaste = useCallback((event, line) => {
    const text = event.clipboardData?.getData('text/plain') || '';
    if (!/\r?\n/.test(text)) return;
    event.preventDefault();
    applyPastedText(text, { lineId: line.id });
  }, [applyPastedText]);

  const handleLineChange = useCallback((lineId, patch, { coalesce = false } = {}) => {
    commit(updateEditorLine(document, lineId, patch), { coalesceKey: coalesce ? `line:${lineId}` : null });
  }, [commit, document]);

  const handleAddLine = useCallback((afterLineId, role = 'lyric') => {
    const result = addEditorLine(document, { afterLineId, role });
    commit(result.document);
    setPendingFocus(result.lineId);
  }, [commit, document]);

  const handleLineKeyDown = useCallback((event, line) => {
    const modifier = event.ctrlKey || event.metaKey;
    const index = orderedLineIds.indexOf(line.id);

    if (event.key === 'Enter' && (event.shiftKey || modifier)) {
      event.preventDefault();
      const result = splitEditorSlide(document, line.id);
      commit(result.document);
      setPendingFocus(result.lineId);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleAddLine(line.id, 'lyric');
    } else if (event.key === 'Backspace' && !line.text && !modifier) {
      event.preventDefault();
      commit(removeEditorLine(document, line.id));
      setPendingFocus(orderedLineIds[index - 1] || orderedLineIds[index + 1] || null);
    } else if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault();
      setPendingFocus(orderedLineIds[index - 1]);
    } else if (event.key === 'ArrowDown' && index < orderedLineIds.length - 1) {
      event.preventDefault();
      setPendingFocus(orderedLineIds[index + 1]);
    } else if (modifier && !event.shiftKey && (event.key === 't' || event.key === 'T')) {
      event.preventDefault();
      handleAddLine(line.id, 'translation');
    } else if (modifier && event.key === '/') {
      event.preventDefault();
      commit(updateEditorLine(document, line.id, { role: line.role === 'stage' ? 'lyric' : 'stage' }));
    }
  }, [commit, document, handleAddLine, orderedLineIds]);

  const handleLabelChange = useCallback((sectionId, label) => {
    const previous = document.sections.find((section) => section.id === sectionId)?.label || '';
    let nextDocument = updateEditorSection(document, sectionId, { label, repeat: false });
    if (nextDocument.arrangement && previous.trim()) {
      nextDocument = {
        ...nextDocument,
        arrangement: nextDocument.arrangement.map((entry) => (entry === previous ? label : entry)),
      };
    }
    commit(nextDocument, { coalesceKey: `label:${sectionId}` });
  }, [commit, document]);

  const handleAddSection = useCallback((base) => {
    const result = addEditorSection(document, { label: nextSectionLabel(document, base) });
    commit(result.document);
    setPendingFocus(result.lineId);
    setSelectedSlideId(result.slideId);
  }, [commit, document]);

  const handleAddSectionTitle = useCallback(async (phrase) => {
    const nextPhrases = [...(sectionTagPhrases || []), phrase];
    try {
      const result = await window.electronAPI?.preferences?.set?.('parsing.sectionTagPhrases', nextPhrases);
      if (result && result.success === false) throw new Error(result.error);
      showToast({ title: 'Section title added', message: `“${phrase}” is now recognized as a section.`, variant: 'success' });
    } catch {
      showToast({ title: 'Couldn’t add section title', message: 'Add it in Preferences > Lyrics Parsing > Section titles.', variant: 'warn' });
    }
  }, [sectionTagPhrases, showToast]);

  const handleInsertSection = useCallback((label) => {
    const context = findLineContext(document, activeLineId);
    // Like the classic canvas: on a slide's first line the section starts there; otherwise it follows.
    if (context && context.lineIndex === 0) {
      const slideIndex = context.section.slides.findIndex((slide) => slide.id === context.slide.id);
      const result = splitEditorSectionAtSlide(document, context.slide.id, label);
      commit(result.document);
      if (slideIndex === 0 && context.section.label.trim() && context.section.label.trim() !== label) {
        showToast({ title: 'Section renamed', message: `“${context.section.label.trim()}” is now “${label}”.`, variant: 'info' });
      }
      setPendingFocus(context.line.id);
      return;
    }
    const result = addEditorSection(document, { label, afterSectionId: context?.section.id || null });
    commit(result.document);
    setPendingFocus(result.lineId);
    setSelectedSlideId(result.slideId);
  }, [activeLineId, commit, document, showToast]);

  const handleStartSectionAtSlide = useCallback((slideId) => {
    const section = document.sections.find((entry) => entry.slides.some((slide) => slide.id === slideId));
    if (!section) return;
    if (section.slides[0].id === slideId) {
      setNameRequestSectionId(section.id);
      return;
    }
    const result = splitEditorSectionAtSlide(document, slideId, '');
    commit(result.document);
    setNameRequestSectionId(result.sectionId);
  }, [commit, document]);

  const activeContext = useMemo(() => findLineContext(document, activeLineId), [activeLineId, document]);
  const activeLine = activeContext?.line || null;
  const getActiveInput = () => (activeLineId ? inputRefs.current.get(activeLineId) : null);

  const handleCleanup = useCallback(() => {
    const options = getCleanupOptions();
    const nextDocument = mapEditorLines(document, (line) => {
      if (line.role === 'stage' || !line.text.trim()) return line;
      const text = cleanLineText(line.text, options);
      return text === line.text ? line : { ...line, text };
    });
    const changed = JSON.stringify(nextDocument.sections) !== JSON.stringify(document.sections);
    if (changed) commit(nextDocument);
    showToast({
      title: changed ? 'Lyrics cleaned up' : 'Already clean',
      message: changed ? 'Capitalization and punctuation were tidied. Undo with Ctrl+Z.' : 'Nothing needed tidying.',
      variant: changed ? 'success' : 'info',
    });
  }, [commit, document, showToast]);

  const handleChangeSelectionCase = useCallback((casing) => {
    if (!activeLine) return;
    const input = inputRefs.current.get(activeLine.id);
    const start = input?.selectionStart ?? 0;
    const end = input?.selectionEnd ?? 0;
    const hasSelection = end > start;
    const text = hasSelection
      ? activeLine.text.slice(0, start) + applyTextCasing(activeLine.text.slice(start, end), casing) + activeLine.text.slice(end)
      : applyTextCasing(activeLine.text, casing);
    commit(updateEditorLine(document, activeLine.id, { text }));
    requestAnimationFrame(() => {
      const target = inputRefs.current.get(activeLine.id);
      if (!target) return;
      target.focus();
      if (hasSelection) target.setSelectionRange(start, end);
    });
  }, [activeLine, commit, document]);

  const readActiveSelection = () => {
    const input = getActiveInput();
    if (!input || !activeLine) return null;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    return end > start ? { start, end, text: activeLine.text.slice(start, end) } : null;
  };

  const writeClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      showToast({ title: 'Copy unavailable', message: 'Press Ctrl+C (Cmd+C on Mac) instead.', variant: 'info' });
      return false;
    }
  }, [showToast]);

  const handleCopy = async () => {
    const selection = readActiveSelection();
    if (selection) await writeClipboard(selection.text);
  };

  const handleCut = async () => {
    const selection = readActiveSelection();
    if (!selection || !(await writeClipboard(selection.text))) return;
    commit(updateEditorLine(document, activeLine.id, {
      text: activeLine.text.slice(0, selection.start) + activeLine.text.slice(selection.end),
    }));
    setPendingFocus(activeLine.id);
  };

  const handleToolbarPaste = async () => {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      showToast({ title: 'Paste unavailable', message: 'Press Ctrl+V (Cmd+V on Mac) to paste instead.', variant: 'info' });
      return;
    }
    if (!text?.trim()) {
      showToast({ title: 'Clipboard is empty', message: 'Copy some lyrics first, then paste them here.', variant: 'info' });
      return;
    }
    const input = getActiveInput();
    if (activeLine && input && !/\r?\n/.test(text.trim())) {
      const start = input.selectionStart ?? activeLine.text.length;
      const end = input.selectionEnd ?? start;
      commit(updateEditorLine(document, activeLine.id, {
        text: activeLine.text.slice(0, start) + text.trim() + activeLine.text.slice(end),
      }));
      setPendingFocus(activeLine.id);
      return;
    }
    applyPastedText(text, activeLine ? { lineId: activeLine.id } : { forceLayout: true });
  };

  const handleDeleteActiveLine = () => {
    if (!activeLine) return;
    const index = orderedLineIds.indexOf(activeLine.id);
    commit(removeEditorLine(document, activeLine.id));
    setPendingFocus(orderedLineIds[index - 1] || orderedLineIds[index + 1] || null);
  };

  const handleDuplicateActiveLine = () => {
    if (!activeLine) return;
    const result = duplicateEditorLine(document, activeLine.id);
    commit(result.document);
    setPendingFocus(result.lineId);
  };

  const handleMoveActiveLine = (delta) => {
    if (!activeLine) return;
    commit(moveEditorLine(document, activeLine.id, delta));
    setPendingFocus(activeLine.id);
  };

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
    lrcEligibility: { eligible: false, reason: '' },
    baseContentRef,
    baseTitleRef,
    existingFilePath: currentFilePath,
    songMetadata: songMetadataForSave,
    setSongMetadata,
    setPendingSavedVersion,
    setSaveVersion,
    activeSetlistItemId,
    updateSetlistItem,
    editMode,
    saveAndLoadDestination: 'control',
    documentFormat: 'ldsong',
  });

  const { handleBack, handleOpenLyrics, handleOpenPreferences, handleStartNewSong } = useCanvasNavigationActions({
    hasUnsavedChanges,
    navigate,
    showModal,
    showToast,
    returnPath: '/',
    newSongPath: '/new-song?mode=new&editor=structured',
  });

  const handleSwitchEditor = useCallback((kind) => {
    if (kind !== 'classic') return;
    if (!editMode) writePreferredSongEditor('classic');
    window.__pendingCanvasLyricsLoad = isContentEmpty ? null : {
      content: ldsongDocumentToPlainText(ldsongDocument),
      fileName: `${isUsableLyricsTitle(title) ? title.trim() : UNTITLED_LYRICS_TITLE}.txt`,
      filePath: null,
    };
    navigate('/new-song?mode=new&editor=classic');
  }, [editMode, isContentEmpty, ldsongDocument, navigate, title]);

  useKeyboardShortcuts({
    handleBack,
    handleSave,
    handleSaveAndLoad,
    handleCleanup,
    handleStartNewSong,
    handleOpenSearchBar: null,
    handleOpenReplaceBar: null,
    handleOpenLyrics,
    handleOpenPreferences,
    isContentEmpty,
    isTitleEmpty: !isUsableLyricsTitle(title),
    composeMode: false,
    editMode,
    hasUnsavedChanges,
  });

  useElectronListeners({ canUndo, canRedo, handleUndo: undo, handleRedo: redo });

  useEffect(() => {
    const handleUndoKeys = (event) => {
      if (!(event.ctrlKey || event.metaKey) || (event.key !== 'z' && event.key !== 'Z' && event.key !== 'y' && event.key !== 'Y')) return;
      // The title keeps the browser's own undo; it is not part of the song history.
      if (event.target?.closest?.('#lyrics-file-name')) return;
      event.preventDefault();
      if (event.key === 'y' || event.key === 'Y' || event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', handleUndoKeys);
    return () => window.removeEventListener('keydown', handleUndoKeys);
  }, [redo, undo]);

  const sectionOptions = useMemo(() => buildSongSectionOptions(sectionTagPhrases), [sectionTagPhrases]);
  const sectionLabelOptions = useMemo(() => sectionOptions.map((option) => option.label), [sectionOptions]);
  const maxLines = output1Settings?.maxLinesEnabled ? Number(output1Settings.maxLines) || 4 : 4;
  const getSlideIssues = useCallback((slide) => getEditorSlideIssues(slide, { maxLines }), [maxLines]);
  const selectedSlide = useMemo(
    () => document.sections.flatMap((section) => section.slides).find((slide) => slide.id === selectedSlideId) || null,
    [document, selectedSlideId],
  );
  const sectionLabels = useMemo(
    () => [...new Set(document.sections.map((section) => section.label.trim()).filter(Boolean))],
    [document],
  );
  const issues = useMemo(() => {
    const slideCount = document.sections.reduce((count, section) => (
      count + section.slides.filter((slide) => getSlideIssues(slide).length > 0).length
    ), 0);
    const structural = isContentEmpty ? [] : ldsongDocumentToLyrics(ldsongDocument).warnings;
    return [
      ...new Set(structural),
      ...(slideCount > 0 ? [`${slideCount} slide${slideCount === 1 ? '' : 's'} may not fit on screen; see the notes on each slide.`] : []),
    ];
  }, [document, getSlideIssues, isContentEmpty, ldsongDocument]);

  const isTitleEmpty = !isUsableLyricsTitle(title);
  const saveTooltip = (action) => {
    if (isContentEmpty && isTitleEmpty) return `Choose a song title and add lyrics content to ${action}`;
    if (isTitleEmpty) return `Replace Untitled Lyrics with a song title to ${action}`;
    if (isContentEmpty) return `Add lyrics content to ${action}`;
    return action === 'save' ? 'Save as a LyricDisplay Song (.ldsong)' : 'Save and load into the control panel';
  };
  const toolbarGhostClass = darkMode
    ? 'bg-transparent text-gray-300 hover:bg-blue-500/10 hover:text-blue-300 active:bg-blue-500/15 focus-visible:bg-blue-500/10 focus-visible:text-blue-300 focus-visible:ring-1 focus-visible:ring-blue-500/60'
    : 'bg-transparent text-gray-600 hover:bg-blue-50 hover:text-blue-600 active:bg-blue-100 focus-visible:bg-blue-50 focus-visible:text-blue-600 focus-visible:ring-1 focus-visible:ring-blue-500/30';
  const activeLineHasContent = Boolean(activeLine?.text.trim());

  return (
    <div className={`flex h-full flex-col font-sans ${darkMode
      ? 'dark bg-[radial-gradient(circle_at_top,#1c1c20_0%,#18181b_46%,#0c0c0e_100%)] text-gray-100'
      : 'bg-[radial-gradient(circle_at_top,#ffffff_0%,#fafafa_55%,#eef2ff_100%)] text-gray-900'
      }`}>
      <SongCanvasHeader
        editorSwitcher={<EditorModeSwitcher value="structured" onChange={handleSwitchEditor} darkMode={darkMode} />}
        activeLineHasContent={activeLineHasContent}
        activeLineHasTimestamp={false}
        activeLineIndex={activeLine ? orderedLineIds.indexOf(activeLine.id) : null}
        activeLineIsStageOnly={activeLine?.role === 'stage'}
        canAddTranslationOnActiveLine={activeLine?.role === 'lyric' && activeLineHasContent}
        canMoveActiveLineDown={Boolean(activeContext) && activeContext.lineIndex < activeContext.slide.lines.length - 1}
        canMoveActiveLineUp={Boolean(activeContext) && activeContext.lineIndex > 0}
        canRedo={canRedo}
        canUndo={canUndo}
        composeMode={false}
        darkMode={darkMode}
        editMode={editMode}
        getSaveAndLoadButtonTooltip={() => saveTooltip('load')}
        getSaveButtonTooltip={() => saveTooltip('save')}
        handleAddTranslationAtActiveLine={() => activeLine && handleAddLine(activeLine.id, 'translation')}
        handleBack={handleBack}
        handleCleanup={handleCleanup}
        handleChangeSelectionCase={handleChangeSelectionCase}
        handleCopy={handleCopy}
        handleCopyActiveLine={() => activeLine && writeClipboard(activeLine.text)}
        handleCut={handleCut}
        handleDeleteActiveLine={handleDeleteActiveLine}
        handleDuplicateActiveLine={handleDuplicateActiveLine}
        handleMoveActiveLineDown={() => handleMoveActiveLine(1)}
        handleMoveActiveLineUp={() => handleMoveActiveLine(-1)}
        handlePaste={handleToolbarPaste}
        handleRedo={redo}
        handleSave={handleSave}
        handleSaveAndLoad={handleSaveAndLoad}
        handleStartNewSong={handleStartNewSong}
        handleTitleBlur={() => { if (!title.trim()) setTitle(UNTITLED_LYRICS_TITLE); }}
        handleTitleChange={(event) => setTitle(event.target.value)}
        handleToggleStageOnlyActiveLine={() => activeLine && commit(updateEditorLine(document, activeLine.id, { role: activeLine.role === 'stage' ? 'lyric' : 'stage' }))}
        handleUndo={undo}
        hasUnsavedChanges={hasUnsavedChanges}
        hasTextSelection={activeLineHasContent}
        insertSectionAtCursor={handleInsertSection}
        isContentEmpty={isContentEmpty}
        isCursorAtEligiblePosition={() => true}
        isTitleEmpty={isTitleEmpty}
        isTitlePrefilled={false}
        showModal={showModal}
        songSections={sectionOptions}
        structured
        title={title}
        toolbarGhostClass={toolbarGhostClass}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_20rem] md:p-5">
        <main className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          {document.sections.length === 0 && (
            <div className={`rounded-xl border border-dashed px-6 py-10 text-center ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-300 text-gray-500'}`}>
              <p className={`text-base font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Start your song</p>
              <p className="mt-1 text-sm">Add a section and type, or paste lyrics you’ve copied from anywhere.</p>
              <div className="mt-4 flex justify-center gap-2">
                <button type="button" onClick={() => handleAddSection('Verse')} className="rounded-lg bg-blue-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-400">Add Verse 1</button>
                <button type="button" onClick={handlePasteButton} className={`rounded-lg border px-3.5 py-2 text-sm font-medium ${darkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-300 hover:bg-white'}`}>Paste lyrics</button>
              </div>
            </div>
          )}

          {document.sections.map((section, index) => (
            <SongEditorSection
              key={section.id}
              section={section}
              index={index}
              total={document.sections.length}
              darkMode={darkMode}
              sectionOptions={sectionLabelOptions}
              openNameRequested={nameRequestSectionId === section.id}
              onNameOpenHandled={() => setNameRequestSectionId(null)}
              isLabelRecognized={!section.label.trim() || isStructureTag(`[${section.label.trim()}]`, sectionTagPhrases)}
              selectedSlideId={selectedSlideId}
              getSlideIssues={getSlideIssues}
              registerInput={registerInput}
              onLabelChange={handleLabelChange}
              onAddSectionTitle={handleAddSectionTitle}
              onMove={(sectionId, delta) => commit(moveEditorSection(document, sectionId, delta))}
              onRemove={(sectionId) => commit(removeEditorSection(document, sectionId))}
              onAddSlide={(sectionId) => {
                const result = addEditorSlide(document, sectionId);
                commit(result.document);
                setPendingFocus(result.lineId);
              }}
              onAddLine={handleAddLine}
              onLineChange={handleLineChange}
              onLineKeyDown={handleLineKeyDown}
              onLinePaste={handleLinePaste}
              onLineFocus={(line, slide) => {
                setActiveLineId(line.id);
                setSelectedSlideId(slide.id);
              }}
              onStartSectionAtSlide={handleStartSectionAtSlide}
              onRemoveLine={(lineId) => commit(removeEditorLine(document, lineId))}
              onMergeSlide={(slideId) => commit(mergeEditorSlideWithPrevious(document, slideId))}
              onRemoveSlide={(slideId) => commit(removeEditorSlide(document, slideId))}
            />
          ))}

          <div className="flex flex-wrap items-center gap-1.5 pb-2">
            <span className={`mr-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Add section</span>
            {QUICK_SECTIONS.map((base) => (
              <button
                key={base}
                type="button"
                onClick={() => handleAddSection(base)}
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium ${darkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'}`}
              >
                <Plus className="h-3 w-3" /> {base}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleAddSection('')}
              className={`inline-flex items-center gap-1 rounded-md border border-dashed px-2.5 py-1 text-xs font-medium ${darkMode ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-300 text-gray-500 hover:bg-gray-100'}`}
            >
              <Plus className="h-3 w-3" /> Other
            </button>
          </div>

          <p className={`pb-4 text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Enter adds a line · Shift+Enter starts a new slide · Ctrl+T adds a translation · Ctrl+/ marks a stage-only note · Backspace on an empty line removes it
          </p>
        </main>

        <SongEditorSidebar
          darkMode={darkMode}
          metadata={document.metadata}
          onMetadataChange={(patch) => commit(updateEditorMetadata(document, patch), { coalesceKey: `metadata:${Object.keys(patch).join(',')}` })}
          playOrder={getEditorPlayOrder(document)}
          hasCustomOrder={Boolean(document.arrangement?.length)}
          sectionLabels={sectionLabels}
          onPlayOrderChange={(order) => commit({ ...document, arrangement: order && order.length > 0 ? order : null })}
          selectedSlide={selectedSlide}
          issues={issues}
        />
      </div>
    </div>
  );
};

export default SongEditor;
