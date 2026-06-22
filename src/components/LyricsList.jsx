import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { List, useListRef } from 'react-window';
import { useLyricsState, useDarkModeState, useIsDesktopApp } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useToast from '../hooks/useToast';
import useStageOnlyTutorial from '../hooks/LyricsList/useStageOnlyTutorial';
import useSectionNavigation from '../hooks/LyricsList/useSectionNavigation';
import useLyricsListHistory from '../hooks/LyricsList/useLyricsListHistory';
import useLyricsListSelection from '../hooks/LyricsList/useLyricsListSelection';
import useLyricsListGrouping from '../hooks/LyricsList/useLyricsListGrouping';
import useLyricsListRows from '../hooks/LyricsList/useLyricsListRows';
import LyricRow from './LyricsList/LyricRow';
import SectionChips from './LyricsList/SectionChips';
import LyricsListContextMenu from './LyricsList/LyricsListContextMenu';
import { HORIZONTAL_PADDING_PX, VIRTUALIZATION_THRESHOLD } from './LyricsList/layout';

export default function LyricsList({
  searchQuery = '',
  highlightedLineIndex = null,
  onSelectLine,
  selectionMode = false,
  onEnterSelectionMode,
  onSelectionStateChange,
  onContextMenuApiReady,
  clickAwayIgnoreRefs = [],
  maxLinesPerGroup = 2,
  density = 'default',
}) {
  const compact = density === 'dock' || density === 'compact';
  const forceDarkMode = density === 'dock';
  const listRef = useListRef();
  const {
    lyrics = [],
    lyricsSections = [],
    lineToSection = {},
    lyricsTimestamps = [],
    selectedLine,
    lyricsFileName,
    selectLine,
    setLyrics,
    setLyricsTimestamps
  } = useLyricsState();
  const { darkMode: storedDarkMode } = useDarkModeState();
  const darkMode = forceDarkMode ? true : storedDarkMode;
  const isDesktopApp = useIsDesktopApp();
  const { emitLineUpdate, emitLyricsLoad, emitSplitNormalGroup } = useControlSocket();
  const { showToast } = useToast();
  const [hoveredLineIndex, setHoveredLineIndex] = useState(null);
  const [hoveredButtonIndex, setHoveredButtonIndex] = useState(null);
  const lastResetKeyRef = React.useRef(null);
  const suppressScrollResetRef = React.useRef(false);

  const {
    stageOnlyTutorial,
    tutorialMutationRef,
    handleStageOnlyTutorialVisible,
    handleStageOnlyTutorialOpenChange,
    handleNeverShowTutorialPopovers,
  } = useStageOnlyTutorial({ lyrics, lyricsFileName });

  const {
    isStructureTagLine,
    effectiveMaxLinesPerGroup,
    getNormalGroupLines,
    sectionById,
    sectionStartLookup,
    activeSectionId,
    rowHeightConfig,
    getLineClassName,
  } = useLyricsListRows({
    lyrics,
    lyricsSections,
    lineToSection,
    selectedLine,
    maxLinesPerGroup,
    highlightedLineIndex,
    searchQuery,
    darkMode,
    density,
  });

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

  const {
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
  } = useLyricsListSelection({
    lyrics,
    selectedLine,
    isDesktopApp,
    selectionMode,
    onEnterSelectionMode,
    onSelectionStateChange,
    onContextMenuApiReady,
    clickAwayIgnoreRefs,
    onLineSelect: handleLineClickPlain,
    selectLine,
    emitLineUpdate,
    getNormalGroupLines,
    showToast,
  });

  const {
    canUndo,
    canRedo,
    historyMutationRef,
    takeSnapshot,
    pushHistorySnapshot,
    handleUndo,
    handleRedo,
  } = useLyricsListHistory({
    lyrics,
    lyricsTimestamps,
    selectedLine,
    selectedIndicesArray,
    setLyrics,
    setLyricsTimestamps,
    selectLine,
    emitLyricsLoad,
    setSelectedIndices,
    selectionAnchorRef,
    suppressScrollResetRef,
    tutorialMutationRef,
    closeContextMenu,
  });

  const {
    canGroupSelected,
    canUngroupSelected,
    handleGroupSelected,
    performUngroup,
    handleSplitGroup,
  } = useLyricsListGrouping({
    lyrics,
    lyricsTimestamps,
    selectedLine,
    selectedIndicesArray,
    effectiveMaxLinesPerGroup,
    getNormalGroupLines,
    isStructureTagLine,
    takeSnapshot,
    pushHistorySnapshot,
    historyMutationRef,
    suppressScrollResetRef,
    tutorialMutationRef,
    setLyrics,
    setLyricsTimestamps,
    setSelectedIndices,
    selectionAnchorRef,
    selectLine,
    emitLineUpdate,
    emitLyricsLoad,
    emitSplitNormalGroup,
    closeContextMenu,
    setHoveredLineIndex,
    showToast,
  });

  const rowPropsData = useMemo(
    () => ({
      lyrics,
      virtualized: true,
      getLineClassName,
      handleRowClick,
      handleSplitGroup,
      handleContextMenuOpen,
      handleRowTouchStart,
      handleRowTouchMove,
      handleRowTouchEnd,
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
      stageOnlyTutorial,
      handleStageOnlyTutorialVisible,
      handleStageOnlyTutorialOpenChange,
      handleNeverShowTutorialPopovers,
      searchQuery,
      isStructureTagLine,
      getNormalGroupLines,
      density,
    }),
    [lyrics, getLineClassName, handleRowClick, handleSplitGroup, handleContextMenuOpen, handleRowTouchStart, handleRowTouchMove, handleRowTouchEnd, selectedLine, darkMode, hoveredLineIndex, hoveredButtonIndex, sectionStartLookup, sectionById, activeSectionId, selectedIndices, isDesktopApp, stageOnlyTutorial, handleStageOnlyTutorialVisible, handleStageOnlyTutorialOpenChange, handleNeverShowTutorialPopovers, searchQuery, isStructureTagLine, getNormalGroupLines, density]
  );

  const itemCount = useMemo(() => lyrics.length, [lyrics]);
  const useVirtualized = itemCount > VIRTUALIZATION_THRESHOLD;
  const hasSections = (lyricsSections?.length || 0) > 0;

  const {
    sectionChipsContainerRef,
    sectionChipsScrollerRef,
    handleSectionJump,
  } = useSectionNavigation({
    listRef,
    useVirtualized,
    onLineSelect: handleLineClickPlain,
  });

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
    <SectionChips
      darkMode={darkMode}
      sections={lyricsSections}
      activeSectionId={activeSectionId}
      onSectionJump={handleSectionJump}
      containerRef={sectionChipsContainerRef}
      scrollerRef={sectionChipsScrollerRef}
      density={density}
    />
  ) : null;

  const listContent = !useVirtualized ? (
    <div className={`${compact ? 'space-y-1 pb-2' : 'space-y-2 pb-4'} relative ${hasSections ? '' : compact ? 'pt-2' : 'pt-4'}`}>
      {sectionChips}
      {lyrics.map((line, i) => (
        <LyricRow
          key={line?.id || `line_${i}`}
          index={i}
          line={line}
          virtualized={false}
          getLineClassName={getLineClassName}
          handleRowClick={handleRowClick}
          handleSplitGroup={handleSplitGroup}
          handleContextMenuOpen={handleContextMenuOpen}
          handleRowTouchStart={handleRowTouchStart}
          handleRowTouchMove={handleRowTouchMove}
          handleRowTouchEnd={handleRowTouchEnd}
          selectedLine={selectedLine}
          darkMode={darkMode}
          hoveredLineIndex={hoveredLineIndex}
          setHoveredLineIndex={setHoveredLineIndex}
          hoveredButtonIndex={hoveredButtonIndex}
          setHoveredButtonIndex={setHoveredButtonIndex}
          sectionStartLookup={sectionStartLookup}
          sectionById={sectionById}
          activeSectionId={activeSectionId}
          selectedIndices={selectedIndices}
          isDesktopApp={isDesktopApp}
          stageOnlyTutorial={stageOnlyTutorial}
          handleStageOnlyTutorialVisible={handleStageOnlyTutorialVisible}
          handleStageOnlyTutorialOpenChange={handleStageOnlyTutorialOpenChange}
          handleNeverShowTutorialPopovers={handleNeverShowTutorialPopovers}
          searchQuery={searchQuery}
          isStructureTagLine={isStructureTagLine}
          getNormalGroupLines={getNormalGroupLines}
          density={density}
        />
      ))}
    </div>
  ) : (
    <div className="flex-1 min-h-0 w-full h-full flex flex-col relative">
      {sectionChips}
      <div className="flex-1 min-h-0">
        <List
          listRef={listRef}
          rowCount={itemCount}
          rowHeight={rowHeightConfig}
          rowComponent={LyricRow}
          rowProps={rowPropsData}
          style={{
            overflowY: 'auto',
            height: '100%',
            width: '100%',
            paddingTop: compact ? '8px' : `${HORIZONTAL_PADDING_PX}px`,
            paddingBottom: compact ? '8px' : `${HORIZONTAL_PADDING_PX}px`,
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 w-full h-full">
      {listContent}
      <LyricsListContextMenu
        ref={contextMenuRef}
        visible={contextMenuState.visible}
        position={contextMenuPosition}
        darkMode={darkMode}
        onMeasured={setContextMenuDimensions}
        selectedIndicesArray={selectedIndicesArray}
        hasSelection={hasSelection}
        canGroupSelected={canGroupSelected}
        canUngroupSelected={canUngroupSelected}
        canUndo={canUndo}
        canRedo={canRedo}
        onSendSelectionToOutput={handleSendSelectionToOutput}
        onDeselectFromMenu={handleDeselectFromMenu}
        onGroupSelected={handleGroupSelected}
        onUngroupSelected={() => {
            if (selectedIndicesArray.length === 1) {
              performUngroup(selectedIndicesArray[0]);
            } else {
              closeContextMenu();
            }
          }}
        onCopySelection={handleCopySelection}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    </div>
  );
}
