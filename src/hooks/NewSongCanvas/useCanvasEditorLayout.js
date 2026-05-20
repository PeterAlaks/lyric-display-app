import { useEffect, useLayoutEffect, useMemo } from 'react';

export const useCanvasEditorLayout = ({
  content,
  contextMenuRef,
  contextMenuVisible,
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
}) => {
  useEffect(() => {
    measurementRefs.current = measurementRefs.current.slice(0, lines.length);
  }, [lines.length, measurementRefs]);

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
  }, [content, lastKnownScrollRef, pendingScrollRestoreRef, textareaRef]);

  useLayoutEffect(() => {
    if (!textareaRef.current) return;
    const styles = window.getComputedStyle(textareaRef.current);
    setEditorPadding({
      top: parseFloat(styles.paddingTop) || 0,
      right: parseFloat(styles.paddingRight) || 0,
      bottom: parseFloat(styles.paddingBottom) || 0,
      left: parseFloat(styles.paddingLeft) || 0,
    });
  }, [darkMode, setEditorPadding, textareaRef]);

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
  }, [editorContainerRef, setContainerSize]);

  useLayoutEffect(() => {
    if (!contextMenuVisible || !contextMenuRef.current) return;
    const rect = contextMenuRef.current.getBoundingClientRect();
    setContextMenuDimensions({ width: rect.width, height: rect.height });
  }, [contextMenuRef, contextMenuVisible, setContextMenuDimensions]);

  return { lineOffsets };
};
