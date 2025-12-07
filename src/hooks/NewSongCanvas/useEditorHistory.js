import { useCallback, useRef, useState } from 'react';

const useEditorHistory = (initialContent = '') => {
  const [content, setContent] = useState(initialContent);
  const historyRef = useRef([initialContent]);
  const historyIndexRef = useRef(0);
  const isUndoRedoRef = useRef(false);

  const pushHistory = useCallback((newContent) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);

    historyRef.current.push(newContent);
    historyIndexRef.current += 1;

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

  return {
    content,
    setContent: setContentWithHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};

export default useEditorHistory;