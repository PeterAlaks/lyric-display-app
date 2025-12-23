import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useKeyboardShortcuts({
  isOpen,
  activeTab,
  showFullResults,
  suggestionResults,
  fullResults,
  onSelectResult,
  onPerformFullSearch,
}) {
  const [selectionIndex, setSelectionIndex] = useState(-1);
  const suggestionListRef = useRef(null);
  const fullResultsRef = useRef(null);

  const getActiveResults = useCallback(
    () => (showFullResults ? fullResults : suggestionResults),
    [showFullResults, suggestionResults, fullResults]
  );

  const scrollIntoView = useCallback(
    (index) => {
      const container = showFullResults ? fullResultsRef.current : suggestionListRef.current;
      if (!container) return;
      const rows = container.querySelectorAll('[data-result-row]');
      const target = rows?.[index];
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'nearest' });
      }
    },
    [showFullResults]
  );

  useEffect(() => {
    if (!isOpen) return;
    const list = getActiveResults() || [];
    if (!list.length) {
      if (selectionIndex !== -1) setSelectionIndex(-1);
      return;
    }
    if (selectionIndex >= list.length) {
      setSelectionIndex(list.length - 1);
    }
  }, [getActiveResults, isOpen, selectionIndex]);

  useEffect(() => {
    if (selectionIndex < 0) return;
    scrollIntoView(selectionIndex);
  }, [selectionIndex, scrollIntoView]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      const isArrowDown = event.key === 'ArrowDown';
      const isArrowUp = event.key === 'ArrowUp';
      const isEnter = event.key === 'Enter';

      if (activeTab !== 'libraries') {
        if (isArrowDown || isArrowUp || isEnter) {
          event.stopPropagation();
        }
        return;
      }

      const list = getActiveResults() || [];

      if (!isArrowDown && !isArrowUp && !isEnter) return;

      event.preventDefault();
      event.stopPropagation();

      if (isArrowDown) {
        setSelectionIndex((prev) => {
          const next = prev + 1;
          if (next >= list.length) return list.length - 1;
          return next < 0 ? 0 : next;
        });
        return;
      }

      if (isArrowUp) {
        setSelectionIndex((prev) => {
          const next = prev - 1;
          if (next < 0) return -1;
          return next;
        });
        return;
      }

      if (isEnter) {
        if (selectionIndex >= 0 && selectionIndex < list.length) {
          const item = list[selectionIndex];
          if (item) {
            onSelectResult?.(item);
            return;
          }
        }
        onPerformFullSearch?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, activeTab, getActiveResults, selectionIndex, onSelectResult, onPerformFullSearch]);

  const activeResults = useMemo(() => getActiveResults(), [getActiveResults]);

  return {
    selectionIndex,
    setSelectionIndex,
    activeResults,
    suggestionListRef,
    fullResultsRef,
  };
}