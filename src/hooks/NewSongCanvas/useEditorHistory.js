import { useCallback, useRef, useState } from 'react';

const MAX_HISTORY_ENTRIES = 200;
const MAX_HISTORY_CHARS = 200_000;
const COALESCE_WINDOW_MS = 750;

const normalizeContent = (value) => (value ?? '').toString();

const buildMeta = (meta = {}) => {
  const selectionStart = typeof meta.selectionStart === 'number' ? meta.selectionStart : null;
  const selectionEnd = typeof meta.selectionEnd === 'number' ? meta.selectionEnd : selectionStart;
  const scrollTop = typeof meta.scrollTop === 'number' ? meta.scrollTop : null;

  return {
    selectionStart,
    selectionEnd,
    scrollTop,
    timestamp: typeof meta.timestamp === 'number' ? meta.timestamp : Date.now(),
    coalesceKey: meta.coalesceKey ?? null,
  };
};

const resolveUpdate = (update, prevContent) => {
  if (typeof update === 'function') {
    return normalizeContent(update(prevContent));
  }
  return normalizeContent(update);
};

const useEditorHistory = (initialContent = '') => {
  const initialEntry = { content: normalizeContent(initialContent), meta: buildMeta() };
  const [content, setContent] = useState(initialEntry.content);
  const historyRef = useRef([initialEntry]);
  const historyIndexRef = useRef(0);
  const totalCharCountRef = useRef(initialEntry.content.length);
  const isUndoRedoRef = useRef(false);

  const pruneHistory = useCallback(() => {
    while (
      historyRef.current.length > MAX_HISTORY_ENTRIES
      || totalCharCountRef.current > MAX_HISTORY_CHARS
    ) {
      const removed = historyRef.current.shift();
      totalCharCountRef.current -= removed?.content?.length ?? 0;
      historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
    }
  }, []);

  const pushHistory = useCallback((newContent, meta = {}) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
    }

    const entryMeta = buildMeta(meta);
    const truncatedHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    const lastEntry = truncatedHistory[truncatedHistory.length - 1];

    const isSameContent = lastEntry?.content === newContent;
    if (isSameContent) {
      historyRef.current = truncatedHistory;
      historyIndexRef.current = truncatedHistory.length - 1;
      return;
    }

    const shouldCoalesce = Boolean(
      lastEntry
      && entryMeta.coalesceKey
      && entryMeta.coalesceKey === lastEntry.meta?.coalesceKey
      && typeof lastEntry.meta?.timestamp === 'number'
      && entryMeta.timestamp - lastEntry.meta.timestamp <= COALESCE_WINDOW_MS
    );

    if (shouldCoalesce) {
      totalCharCountRef.current -= lastEntry?.content?.length ?? 0;
      truncatedHistory[truncatedHistory.length - 1] = { content: newContent, meta: entryMeta };
    } else {
      truncatedHistory.push({ content: newContent, meta: entryMeta });
    }

    totalCharCountRef.current += newContent.length;
    historyRef.current = truncatedHistory;
    historyIndexRef.current = truncatedHistory.length - 1;
    pruneHistory();
  }, [pruneHistory]);

  const setContentWithHistory = useCallback((update, meta) => {
    setContent((prevContent) => {
      const resolved = resolveUpdate(update, prevContent);
      pushHistory(resolved, meta);
      return resolved;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      isUndoRedoRef.current = true;
      historyIndexRef.current -= 1;
      const previousEntry = historyRef.current[historyIndexRef.current];
      setContent(previousEntry.content);
      return previousEntry;
    }
    return null;
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      isUndoRedoRef.current = true;
      historyIndexRef.current += 1;
      const nextEntry = historyRef.current[historyIndexRef.current];
      setContent(nextEntry.content);
      return nextEntry;
    }
    return null;
  }, []);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const resetHistory = useCallback((newContent = '') => {
    const normalized = normalizeContent(newContent);
    const resetEntry = { content: normalized, meta: buildMeta() };
    historyRef.current = [resetEntry];
    historyIndexRef.current = 0;
    totalCharCountRef.current = normalized.length;
    isUndoRedoRef.current = false;
    setContent(resetEntry.content);
  }, []);

  return {
    content,
    setContent: setContentWithHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
  };
};

export default useEditorHistory;