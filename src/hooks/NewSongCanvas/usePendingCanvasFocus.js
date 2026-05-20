import { useEffect } from 'react';

export const usePendingCanvasFocus = ({
  lastKnownScrollRef,
  lineOffsets,
  lines,
  pendingFocus,
  setPendingFocus,
  setSelectedLineIndex,
  textareaRef,
}) => {
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
  }, [lastKnownScrollRef, lineOffsets, lines, pendingFocus, setPendingFocus, setSelectedLineIndex, textareaRef]);
};
