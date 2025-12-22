import { useCallback, useRef, useState } from 'react';

const useEditorHistory = (initialContent = '') => {
  const [content, setContent] = useState(initialContent);
  const historyRef = useRef([initialContent]);
  const historyIndexRef = useRef(0);
  const isUndoRedoRef = useRef(false);

  const pushHistory = useCallback((newContent) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
    }

    const truncatedHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    const lastEntry = truncatedHistory[truncatedHistory.length - 1];

    if (lastEntry === newContent) {
      historyRef.current = truncatedHistory;
      return;
    }

    truncatedHistory.push(newContent);
    historyRef.current = truncatedHistory;
    historyIndexRef.current = truncatedHistory.length - 1;

    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      historyIndexRef.current -= 1;
    }
  }, []);

  const setContentWithHistory = useCallback((newContent) => {
    setContent(newContent);
    pushHistory(newContent);
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      isUndoRedoRef.current = true;
      historyIndexRef.current -= 1;
      const previousContent = historyRef.current[historyIndexRef.current];
      setContent(previousContent);
      return previousContent;
    }
    return null;
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      isUndoRedoRef.current = true;
      historyIndexRef.current += 1;
      const nextContent = historyRef.current[historyIndexRef.current];
      setContent(nextContent);
      return nextContent;
    }
    return null;
  }, []);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const resetHistory = useCallback((newContent = '') => {
    historyRef.current = [newContent];
    historyIndexRef.current = 0;
    isUndoRedoRef.current = false;
    setContent(newContent);
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