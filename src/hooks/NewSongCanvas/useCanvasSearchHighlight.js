import { useCallback, useEffect } from 'react';

export const useCanvasSearchHighlight = ({
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
}) => {
  const updateSearchHighlight = useCallback((shouldScroll) => {
    if (!searchBarVisible || !matches || matches.length === 0) {
      setSearchHighlightRect(null);
      return;
    }
    const textarea = textareaRef.current;
    const measurementContainer = measurementContainerRef.current;
    if (!textarea || !measurementContainer) {
      setSearchHighlightRect(null);
      return;
    }

    const safeIndex = Math.max(0, Math.min(currentMatchIndex, matches.length - 1));
    const match = matches[safeIndex];
    const lineIndex = lineOffsets.findIndex(({ start, end }) => match.start >= start && match.start <= end);
    if (lineIndex === -1) {
      setSearchHighlightRect(null);
      return;
    }

    const lineNode = measurementRefs.current[lineIndex];
    const spanNode = lineNode?.querySelector('span');
    const textNode = spanNode?.firstChild;
    const lineText = lines[lineIndex] ?? '';

    if (!textNode || typeof textNode.textContent !== 'string') {
      setSearchHighlightRect(null);
      return;
    }

    const lineStart = lineOffsets[lineIndex]?.start ?? 0;
    const colStart = Math.max(0, Math.min(lineText.length, match.start - lineStart));
    const colEnd = Math.max(colStart, Math.min(lineText.length, colStart + (match.end - match.start)));

    const range = document.createRange();
    range.setStart(textNode, colStart);
    range.setEnd(textNode, colEnd);
    const rangeRect = range.getBoundingClientRect();
    const containerRect = measurementContainer.getBoundingClientRect();

    const scrollY = textarea.scrollTop || 0;
    const top = rangeRect.top - containerRect.top - scrollY;
    const left = rangeRect.left - containerRect.left;
    const height = rangeRect.height || spanNode.offsetHeight || 0;
    const width = rangeRect.width || 0;

    if (height === 0 || width === 0) {
      setSearchHighlightRect(null);
      return;
    }

    setSearchHighlightRect({ top, left, height, width });

    if (!shouldScroll) return;

    const viewHeight = textarea.clientHeight || 0;
    const paddingTop = editorPadding.top || 0;
    const buffer = 8;
    const scrollMax = Math.max(0, textarea.scrollHeight - viewHeight);
    const targetTopAbsolute = rangeRect.top - containerRect.top - paddingTop - buffer;
    const targetCenter = targetTopAbsolute + height / 2;
    const desiredScroll = Math.max(0, Math.min(scrollMax, targetCenter - viewHeight / 2));

    const viewStart = scrollY;
    const viewEnd = scrollY + viewHeight;
    const targetTopView = targetTopAbsolute;
    const targetBottomView = targetTopAbsolute + height + buffer * 2;

    let nextScroll = null;
    if (targetTopView < viewStart || targetBottomView > viewEnd) {
      nextScroll = desiredScroll;
    }

    if (nextScroll !== null) {
      textarea.scrollTo({ top: nextScroll, behavior: 'smooth' });
      lastKnownScrollRef.current = nextScroll;
      setScrollTop(nextScroll);
    }
  }, [currentMatchIndex, editorPadding.top, lastKnownScrollRef, lineOffsets, lines, matches, measurementContainerRef, measurementRefs, searchBarVisible, setScrollTop, setSearchHighlightRect, textareaRef]);

  useEffect(() => {
    updateSearchHighlight(true);
  }, [updateSearchHighlight]);

  useEffect(() => {
    if (highlightUpdateFrameRef.current) {
      cancelAnimationFrame(highlightUpdateFrameRef.current);
    }
    highlightUpdateFrameRef.current = requestAnimationFrame(() => {
      updateSearchHighlight(false);
      highlightUpdateFrameRef.current = null;
    });
    return () => {
      if (highlightUpdateFrameRef.current) {
        cancelAnimationFrame(highlightUpdateFrameRef.current);
        highlightUpdateFrameRef.current = null;
      }
    };
  }, [highlightUpdateFrameRef, scrollTop, updateSearchHighlight]);
};
