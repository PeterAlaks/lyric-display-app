import { useCallback, useMemo } from 'react';
import { isNormalGroupCandidate } from '../../../shared/lyricsParsing.js';

export default function useLyricsListGrouping({
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
}) {
  const isGroupableLine = useCallback((line) => {
    const candidateLines = getNormalGroupLines(line);
    if (!candidateLines.length) return false;
    return candidateLines.every((entry) => (
      typeof entry === 'string' &&
      entry.trim().length > 0 &&
      !isStructureTagLine(entry) &&
      isNormalGroupCandidate(entry)
    ));
  }, [getNormalGroupLines, isStructureTagLine]);

  const canGroupSelected = useMemo(() => {
    if (selectedIndicesArray.length !== 2) return false;
    const [first, second] = selectedIndicesArray;
    if (second !== first + 1) return false;
    if (!isGroupableLine(lyrics[first]) || !isGroupableLine(lyrics[second])) return false;
    const selectedLineCount =
      getNormalGroupLines(lyrics[first]).length +
      getNormalGroupLines(lyrics[second]).length;
    return selectedLineCount >= 2 && selectedLineCount <= effectiveMaxLinesPerGroup;
  }, [effectiveMaxLinesPerGroup, getNormalGroupLines, isGroupableLine, lyrics, selectedIndicesArray]);

  const canUngroupSelected = useMemo(() => {
    if (selectedIndicesArray.length !== 1) return false;
    const line = lyrics[selectedIndicesArray[0]];
    return line?.type === 'normal-group';
  }, [lyrics, selectedIndicesArray]);

  const buildGroup = useCallback((lines, indexPrefix) => {
    const normalized = Array.isArray(lines)
      ? lines.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
      : [];
    return ({
      type: 'normal-group',
      id: `manual_group_${indexPrefix}_${Date.now()}`,
      lines: normalized,
      line1: normalized[0] || '',
      line2: normalized[1] || '',
      displayText: normalized.join('\n'),
      searchText: normalized.join(' '),
      originalIndex: indexPrefix,
    });
  }, []);

  const remapSelectedLineAfterGroup = (current, firstIndex) => {
    if (current == null) return null;
    if (current === firstIndex || current === firstIndex + 1) return firstIndex;
    if (current > firstIndex + 1) return current - 1;
    return current;
  };

  const remapSelectedLineAfterUngroup = (current, groupIndex, expandedLineCount) => {
    if (current == null) return null;
    if (current === groupIndex) return groupIndex;
    if (current > groupIndex) return current + Math.max(0, expandedLineCount - 1);
    return current;
  };

  const handleGroupSelected = useCallback(() => {
    if (!canGroupSelected) return;
    const [first, second] = selectedIndicesArray;
    const firstLines = getNormalGroupLines(lyrics[first]);
    const secondLines = getNormalGroupLines(lyrics[second]);
    const groupedLines = [...firstLines, ...secondLines];
    if (!isGroupableLine(lyrics[first]) || !isGroupableLine(lyrics[second])) return;
    if (groupedLines.length < 2 || groupedLines.length > effectiveMaxLinesPerGroup) return;

    const hasTimestampData = Array.isArray(lyricsTimestamps) && lyricsTimestamps.length > 0;
    const timestampsAligned = hasTimestampData && lyricsTimestamps.length === lyrics.length;
    const firstTimestamp = timestampsAligned ? lyricsTimestamps[first] : null;
    const secondTimestamp = timestampsAligned ? lyricsTimestamps[second] : null;
    const timestampsMatch = timestampsAligned && firstTimestamp === secondTimestamp;

    const snapshot = takeSnapshot();
    const grouped = buildGroup(groupedLines, first);
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
    tutorialMutationRef.current = true;
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
  }, [buildGroup, canGroupSelected, closeContextMenu, effectiveMaxLinesPerGroup, emitLyricsLoad, emitLineUpdate, getNormalGroupLines, historyMutationRef, isGroupableLine, lyrics, lyricsTimestamps, pushHistorySnapshot, selectedIndicesArray, selectedLine, selectLine, selectionAnchorRef, setLyrics, setLyricsTimestamps, setSelectedIndices, showToast, suppressScrollResetRef, takeSnapshot, tutorialMutationRef]);

  const performUngroup = useCallback((index) => {
    const line = lyrics[index];
    if (line?.type !== 'normal-group') return;
    const groupLines = getNormalGroupLines(line);
    if (groupLines.length < 2) return;

    const snapshot = takeSnapshot();
    const newLyrics = [...lyrics];
    newLyrics.splice(index, 1, ...groupLines);
    const timestampsAligned = Array.isArray(lyricsTimestamps) && lyricsTimestamps.length === lyrics.length;
    const nextTimestamps = timestampsAligned ? [...lyricsTimestamps] : lyricsTimestamps;
    if (timestampsAligned) {
      const groupTimestamp = lyricsTimestamps[index];
      nextTimestamps.splice(index, 1, ...groupLines.map(() => groupTimestamp ?? null));
    }
    const nextSelectedLine = remapSelectedLineAfterUngroup(selectedLine, index, groupLines.length);

    pushHistorySnapshot(snapshot);
    historyMutationRef.current = true;
    suppressScrollResetRef.current = true;
    tutorialMutationRef.current = true;
    setLyrics(newLyrics);
    if (timestampsAligned) {
      setLyricsTimestamps(nextTimestamps);
    }

    if (emitSplitNormalGroup) {
      emitSplitNormalGroup({
        index,
        lines: groupLines,
        line1: groupLines[0] || '',
        line2: groupLines[1] || '',
      });
    } else if (emitLyricsLoad) {
      emitLyricsLoad(newLyrics);
    }

    if (typeof nextSelectedLine === 'number') {
      setTimeout(() => {
        selectLine(nextSelectedLine);
        emitLineUpdate(nextSelectedLine);
      }, 0);
    }

    const expandedRange = Array.from({ length: groupLines.length }, (_, offset) => index + offset);
    setSelectedIndices(new Set(expandedRange));
    selectionAnchorRef.current = index;
    closeContextMenu();
    setHoveredLineIndex(null);

    showToast({
      title: 'Group split',
      message: 'The grouped lines have been separated',
      variant: 'success',
    });
  }, [closeContextMenu, emitLineUpdate, emitLyricsLoad, emitSplitNormalGroup, getNormalGroupLines, historyMutationRef, lyrics, lyricsTimestamps, pushHistorySnapshot, selectedLine, selectLine, selectionAnchorRef, setHoveredLineIndex, setLyrics, setLyricsTimestamps, setSelectedIndices, showToast, suppressScrollResetRef, takeSnapshot, tutorialMutationRef]);

  const handleSplitGroup = useCallback(
    (event, index) => {
      event.stopPropagation();
      performUngroup(index);
    },
    [performUngroup]
  );

  return {
    canGroupSelected,
    canUngroupSelected,
    handleGroupSelected,
    performUngroup,
    handleSplitGroup,
  };
}
