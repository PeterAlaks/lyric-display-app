import { useLayoutEffect, useMemo, useRef, useState } from 'react';

const useLineMeasurements = ({
  content,
  containerSize,
  editorPadding,
  lines,
  measurementRefs,
  selectedLineIndex,
  selectedLineHasContent,
  selectedLineIsWrapped,
  scrollTop,
  contextMenuVisible
}) => {
  const measurementContainerRef = useRef(null);
  const [lineMetrics, setLineMetrics] = useState([]);
  const [toolbarDimensions, setToolbarDimensions] = useState({ width: 0, height: 0 });

  const fallbackLineHeight = 24;
  const selectedMetric = selectedLineIndex !== null ? lineMetrics[selectedLineIndex] : null;
  const highlightTop = selectedMetric ? selectedMetric.top - scrollTop : null;
  const highlightHeight = selectedMetric ? Math.max(selectedMetric.height || 0, fallbackLineHeight) : fallbackLineHeight;

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
  }, [content, containerSize, measurementRefs]);

  const toolbarRef = useRef(null);
  useLayoutEffect(() => {
    if (selectedLineIndex === null || !toolbarRef.current) return;
    const rect = toolbarRef.current.getBoundingClientRect();
    setToolbarDimensions({ width: rect.width, height: rect.height });
  }, [selectedLineIndex]);

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
  const highlightVisible = Boolean(
    selectedMetric &&
    selectedLineIndex !== null &&
    highlightTop !== null &&
    containerSize.height > 0 &&
    highlightTop + highlightHeight > 0 &&
    highlightTop < containerSize.height
  );
  const toolbarVisible = Boolean(
    highlightVisible &&
    selectedLineIndex !== null &&
    !contextMenuVisible &&
    toolbarWithinBounds
  );
  const canAddTranslationOnSelectedLine = selectedLineHasContent && !selectedLineIsWrapped;

  return {
    measurementContainerRef,
    measurementRefs,
    lineMetrics,
    toolbarRef,
    toolbarTop,
    toolbarLeft,
    highlightVisible,
    highlightTop,
    highlightHeight,
    toolbarVisible,
    canAddTranslationOnSelectedLine,
    selectedMetric
  };
};

export default useLineMeasurements;