import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCanvasFloatingToolbarPreference, useLyricsState, useDarkModeState } from '../hooks/useStoreSelectors';
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
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import useContextSubmenus from '../hooks/useContextSubmenus';
import useLineMeasurements from '../hooks/NewSongCanvas/useLineMeasurements';
import useContextMenuPosition from '../hooks/useContextMenuPosition';
import useCanvasSearch from '../hooks/NewSongCanvas/useCanvasSearch';
import useElectronListeners from '../hooks/NewSongCanvas/useElectronListeners';
import { useCanvasDismissalEffects } from '../hooks/NewSongCanvas/useCanvasDismissalEffects';
import { useCanvasEditorInteractions } from '../hooks/NewSongCanvas/useCanvasEditorInteractions';
import { useCanvasEditorLayout } from '../hooks/NewSongCanvas/useCanvasEditorLayout';
import { useCanvasLoadLifecycle } from '../hooks/NewSongCanvas/useCanvasLoadLifecycle';
import { useCanvasNavigationActions } from '../hooks/NewSongCanvas/useCanvasNavigationActions';
import { useCanvasSearchHighlight } from '../hooks/NewSongCanvas/useCanvasSearchHighlight';
import { useDraftEvents } from '../hooks/NewSongCanvas/useDraftEvents';
import { useDraftLoader } from '../hooks/NewSongCanvas/useDraftLoader';
import { useEditorUndoRedoShortcuts } from '../hooks/NewSongCanvas/useEditorUndoRedoShortcuts';
import { usePendingCanvasFocus } from '../hooks/NewSongCanvas/usePendingCanvasFocus';
import { STANDARD_LRC_START_REGEX } from '../constants/songCanvas';
import CanvasContextMenu from './NewSongCanvas/CanvasContextMenu';
import CanvasFloatingToolbar from './NewSongCanvas/CanvasFloatingToolbar';
import CanvasMeasurementLayer from './NewSongCanvas/CanvasMeasurementLayer';
import CanvasSearchPanel from './NewSongCanvas/CanvasSearchPanel';
import SongCanvasHeader from './NewSongCanvas/SongCanvasHeader';

const NewSongCanvas = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") || "new";
  const editMode = mode === "edit";
  const composeMode = mode === "compose";

  const { darkMode, setDarkMode } = useDarkModeState();
  const showCanvasFloatingToolbar = useCanvasFloatingToolbarPreference();
  const { lyrics, lyricsFileName, rawLyricsContent, songMetadata, setRawLyricsContent, setSongMetadata, setPendingSavedVersion } = useLyricsState();

  const { emitLyricsDraftSubmit } = useControlSocket();

  const handleFileUpload = useFileUpload();
  const textareaRef = useRef(null);
  const baseContentRef = useRef('');
  const baseTitleRef = useRef('');
  const loadSignatureRef = useRef(null);

  const { content, setContent, undo, redo, canUndo, canRedo, resetHistory } = useEditorHistory('');
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState('');
  const [saveVersion, setSaveVersion] = useState(0);
  const [currentFilePath, setCurrentFilePath] = useState('');
  const editorContainerRef = useRef(null);
  const measurementRefs = useRef([]);
  const contextMenuRef = useRef(null);
  const timestampSubmenuRef = useRef(null);
  const metadataSubmenuRef = useRef(null);
  const sectionSubmenuRef = useRef(null);
  const touchLongPressTimeoutRef = useRef(null);
  const touchStartPositionRef = useRef(null);
  const touchMovedRef = useRef(false);
  const pendingScrollRestoreRef = useRef(null);
  const lastKnownScrollRef = useRef(0);
  const highlightUpdateFrameRef = useRef(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [editorPadding, setEditorPadding] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedLineIndex, setSelectedLineIndex] = useState(null);
  const [contextMenuState, setContextMenuState] = useState({ visible: false, x: 0, y: 0, lineIndex: null, mode: 'line', cursorOffset: null });
  const [contextMenuDimensions, setContextMenuDimensions] = useState({ width: 0, height: 0 });
  const [pendingFocus, setPendingFocus] = useState(null);
  const [searchHighlightRect, setSearchHighlightRect] = useState(null);
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const sectionDropdownRef = useRef(null);

  const lines = useMemo(() => content.split('\n'), [content]);
  const isContentEmpty = !content.trim();
  const isTitleEmpty = !title.trim();
  const hasUnsavedChanges = React.useMemo(() => {
    return (content || '') !== (baseContentRef.current || '') || (title || '') !== (baseTitleRef.current || '');
  }, [content, title, saveVersion]);

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
    triggerContainerRef: editorContainerRef,
    submenuRefs: { timestamp: timestampSubmenuRef, metadata: metadataSubmenuRef, section: sectionSubmenuRef },
    contextMenuVisible: contextMenuState.visible
  });

  const {
    closeSearchBar,
    currentMatchIndex,
    handleClearSearch,
    handleNextMatch,
    handlePreviousMatch,
    handleReplaceAll,
    handleReplaceCurrent,
    handleReplaceValueChange,
    handleSearchInputChange,
    openReplaceBar,
    openSearchBar,
    replaceInputRef,
    replaceValue,
    matches,
    searchBarVisible,
    searchExpanded,
    searchInputRef,
    searchQuery,
    toggleSearchExpansion,
    totalMatches,
  } = useCanvasSearch({ content, setContent, textareaRef });

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

  useCanvasLoadLifecycle({
    baseContentRef,
    baseTitleRef,
    editMode,
    loadSignatureRef,
    lyrics,
    lyricsFileName,
    navigate,
    rawLyricsContent,
    resetHistory,
    setCurrentFilePath,
    setFileName,
    setTitle,
    showToast,
    songMetadata,
    textareaRef,
  });

  useDraftEvents({ showModal, showToast });

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
    existingFilePath: currentFilePath || songMetadata?.filePath,
    songMetadata,
    setSongMetadata,
    setPendingSavedVersion,
    setSaveVersion,
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

  const { lineOffsets } = useCanvasEditorLayout({
    content,
    contextMenuRef,
    contextMenuVisible: contextMenuState.visible,
    darkMode,
    editorContainerRef,
    lastKnownScrollRef,
    lines,
    measurementRefs,
    pendingScrollRestoreRef,
    setContainerSize,
    setContextMenuDimensions,
    setEditorPadding,
    textareaRef,
  });

  const { handleBack, handleOpenLyrics, handleOpenPreferences, handleStartNewSong } = useCanvasNavigationActions({
    hasUnsavedChanges,
    navigate,
    showModal,
    showToast,
  });

  useEffect(() => {
    return () => {
      clearTouchLongPress();
      cancelSubmenuClose();
    };
  }, [clearTouchLongPress, cancelSubmenuClose]);

  useCanvasSearchHighlight({
    currentMatchIndex,
    editorPadding,
    highlightUpdateFrameRef,
    lastKnownScrollRef,
    lineOffsets,
    lines,
    matches,
    measurementContainerRef,
    measurementRefs,
    scrollTop,
    searchBarVisible,
    setScrollTop,
    setSearchHighlightRect,
    textareaRef,
  });

  useCanvasDismissalEffects({
    closeContextMenu,
    closeSearchBar,
    contextMenuRef,
    contextMenuVisible: contextMenuState.visible,
    editorContainerRef,
    handleBack,
    searchBarVisible,
    sectionDropdownOpen,
    sectionDropdownRef,
    selectedLineIndex,
    setSectionDropdownOpen,
    setSelectedLineIndex,
  });

  usePendingCanvasFocus({
    lastKnownScrollRef,
    lineOffsets,
    lines,
    pendingFocus,
    setPendingFocus,
    setSelectedLineIndex,
    textareaRef,
  });

  const handleLoadDraft = useDraftLoader({
    baseContentRef,
    baseTitleRef,
    content,
    emitLyricsDraftSubmit,
    navigate,
    resetHistory,
    setTitle,
    showModal,
    showToast,
    title,
  });

  const { handleRedo, handleUndo } = useEditorUndoRedoShortcuts({
    lastKnownScrollRef,
    redo,
    setScrollTop,
    textareaRef,
    undo,
  });

  const {
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
  } = useCanvasEditorInteractions({
    clearContextSubmenu: () => setActiveSubmenu(null),
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
    setContextMenuState,
    setPendingFocus,
    setScrollTop,
    setSelectedLineIndex,
    textareaRef,
    touchLongPressTimeoutRef,
    touchMovedRef,
    touchStartPositionRef,
  });

  const handleSearchButtonClick = useCallback(() => {
    if (searchBarVisible) {
      closeSearchBar();
    } else {
      openSearchBar();
    }
  }, [closeSearchBar, openSearchBar, searchBarVisible]);

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

  const toolbarGhostClass = darkMode
    ? 'bg-transparent text-gray-300 hover:bg-blue-500/10 hover:text-blue-300 active:bg-blue-500/15 focus-visible:bg-blue-500/10 focus-visible:text-blue-300 focus-visible:ring-1 focus-visible:ring-blue-500/60'
    : 'bg-transparent text-gray-600 hover:bg-blue-50 hover:text-blue-600 active:bg-blue-100 focus-visible:bg-blue-50 focus-visible:text-blue-600 focus-visible:ring-1 focus-visible:ring-blue-500/30';

  useKeyboardShortcuts({
    handleBack,
    handleSave,
    handleSaveAndLoad: composeMode ? handleLoadDraft : handleSaveAndLoad,
    handleCleanup,
    handleStartNewSong,
    handleOpenSearchBar: openSearchBar,
    handleOpenReplaceBar: openReplaceBar,
    handleOpenLyrics,
    handleOpenPreferences,
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

  useElectronListeners({ canUndo, canRedo, handleUndo, handleRedo });

  return (
    <div className={`flex flex-col h-full font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <SongCanvasHeader
        canRedo={canRedo}
        canUndo={canUndo}
        composeMode={composeMode}
        darkMode={darkMode}
        editMode={editMode}
        getSaveAndLoadButtonTooltip={getSaveAndLoadButtonTooltip}
        getSaveButtonTooltip={getSaveButtonTooltip}
        handleBack={handleBack}
        handleCleanup={handleCleanup}
        handleCopy={handleCopy}
        handleCut={handleCut}
        handleLoadDraft={handleLoadDraft}
        handlePaste={handlePaste}
        handleRedo={handleRedo}
        handleSave={handleSave}
        handleSaveAndLoad={handleSaveAndLoad}
        handleSearchButtonClick={handleSearchButtonClick}
        handleStartNewSong={handleStartNewSong}
        handleTitleChange={handleTitleChange}
        handleUndo={handleUndo}
        hasUnsavedChanges={hasUnsavedChanges}
        insertSectionAtCursor={insertSectionAtCursor}
        isContentEmpty={isContentEmpty}
        isCursorAtEligiblePosition={isCursorAtEligiblePosition}
        isTitleEmpty={isTitleEmpty}
        isTitlePrefilled={isTitlePrefilled}
        searchBarVisible={searchBarVisible}
        sectionDropdownOpen={sectionDropdownOpen}
        sectionDropdownRef={sectionDropdownRef}
        setSectionDropdownOpen={setSectionDropdownOpen}
        showModal={showModal}
        showToast={showToast}
        title={title}
        toolbarGhostClass={toolbarGhostClass}
      />

      {/* Main Content Area */}
      <div className="flex-1 pt-4 px-5 pb-5">
        <div
          ref={editorContainerRef}
          className={`relative h-full overflow-hidden rounded-lg border transition-colors ${darkMode ? 'border-gray-800 bg-gray-800' : 'border-gray-200 bg-white'}`}
          onContextMenu={handleCanvasContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
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
            className={`w-full h-full resize-none rounded-2xl p-5 outline-none font-mono text-base leading-relaxed ${darkMode
              ? 'bg-gray-800 text-gray-200 placeholder-gray-600'
              : 'bg-white text-gray-900 placeholder-gray-400'
              }`}
            spellCheck={false}
          />

          {searchBarVisible && (
            <CanvasSearchPanel
              closeSearchBar={closeSearchBar}
              currentMatchIndex={currentMatchIndex}
              darkMode={darkMode}
              handleClearSearch={handleClearSearch}
              handleNextMatch={handleNextMatch}
              handlePreviousMatch={handlePreviousMatch}
              handleReplaceAll={handleReplaceAll}
              handleReplaceCurrent={handleReplaceCurrent}
              handleReplaceValueChange={handleReplaceValueChange}
              handleSearchInputChange={handleSearchInputChange}
              replaceInputRef={replaceInputRef}
              replaceValue={replaceValue}
              searchExpanded={searchExpanded}
              searchInputRef={searchInputRef}
              searchQuery={searchQuery}
              toggleSearchExpansion={toggleSearchExpansion}
              totalMatches={totalMatches}
            />
          )}

          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            {searchHighlightRect && (
              <div
                className="absolute rounded-sm bg-yellow-200/60 dark:bg-yellow-300/50 transition-opacity duration-150"
                style={{
                  top: searchHighlightRect.top,
                  height: searchHighlightRect.height,
                  left: searchHighlightRect.left,
                  width: searchHighlightRect.width
                }}
              />
            )}
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

            {showCanvasFloatingToolbar && (
              <CanvasFloatingToolbar
                canAddTranslationOnSelectedLine={canAddTranslationOnSelectedLine}
                darkMode={darkMode}
                handleAddTranslation={handleAddTranslation}
                insertStandardTimestampAtLine={insertStandardTimestampAtLine}
                selectedLineIndex={selectedLineIndex}
                selectedMetric={selectedMetric}
                toolbarLeft={toolbarLeft}
                toolbarRef={toolbarRef}
                toolbarTop={toolbarTop}
                toolbarVisible={toolbarVisible}
              />
            )}

            <CanvasContextMenu
              activeSubmenu={activeSubmenu}
              canAddTranslationInContextMenu={canAddTranslationInContextMenu}
              closeContextMenu={closeContextMenu}
              contextMenuLineHasTimestamp={contextMenuLineHasTimestamp}
              contextMenuPosition={contextMenuPosition}
              contextMenuRef={contextMenuRef}
              contextMenuState={contextMenuState}
              darkMode={darkMode}
              handleAddDefaultTags={handleAddDefaultTags}
              handleAddTranslation={handleAddTranslation}
              handleCleanupFromContext={handleCleanupFromContext}
              handleContextMenuEnter={handleContextMenuEnter}
              handleContextMenuLeave={handleContextMenuLeave}
              handleCopy={handleCopy}
              handleCopyLine={handleCopyLine}
              handleCut={handleCut}
              handleDuplicateLine={handleDuplicateLine}
              handlePaste={handlePaste}
              handleRootItemEnter={handleRootItemEnter}
              handleSubmenuPanelEnter={handleSubmenuPanelEnter}
              handleSubmenuPanelLeave={handleSubmenuPanelLeave}
              handleSubmenuTriggerEnter={handleSubmenuTriggerEnter}
              handleSubmenuTriggerLeave={handleSubmenuTriggerLeave}
              insertEnhancedTimestampAtCursor={insertEnhancedTimestampAtCursor}
              insertMetadataTagAtCursor={insertMetadataTagAtCursor}
              insertSectionAtCursor={insertSectionAtCursor}
              insertStandardTimestampAtLine={insertStandardTimestampAtLine}
              isCursorAtEligiblePosition={isCursorAtEligiblePosition}
              metadataSubmenuRef={metadataSubmenuRef}
              sectionSubmenuRef={sectionSubmenuRef}
              setActiveSubmenu={setActiveSubmenu}
              setContextMenuDimensions={setContextMenuDimensions}
              submenuHorizontal={submenuHorizontal}
              submenuMaxHeight={submenuMaxHeight}
              submenuOffsets={submenuOffsets}
              timestampSubmenuRef={timestampSubmenuRef}
            />
          </div>

          <CanvasMeasurementLayer
            editorPadding={editorPadding}
            lines={lines}
            measurementContainerRef={measurementContainerRef}
            measurementRefs={measurementRefs}
          />
        </div>
      </div>
    </div>
  );
};

export default NewSongCanvas;
