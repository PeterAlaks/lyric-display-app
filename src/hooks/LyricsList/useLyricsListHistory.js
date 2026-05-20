import { useCallback, useEffect, useRef, useState } from 'react';
import useElectronListeners from './useElectronListeners';

const isInputLike = (target) => {
  if (!target) return false;
  const tag = target.tagName;
  const editable = target.isContentEditable;
  return editable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export default function useLyricsListHistory({
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
}) {
  const historyMutationRef = useRef(false);
  const historySignatureRef = useRef(null);
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);

  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;

  const cloneLyrics = useCallback(
    () => lyrics.map((line) => (typeof line === 'string' ? line : { ...line })),
    [lyrics]
  );

  const cloneTimestamps = useCallback(
    () => (Array.isArray(lyricsTimestamps) ? [...lyricsTimestamps] : []),
    [lyricsTimestamps]
  );

  const takeSnapshot = useCallback(() => ({
    lyrics: cloneLyrics(),
    selectedLine,
    selection: selectedIndicesArray,
    timestamps: cloneTimestamps()
  }), [cloneLyrics, cloneTimestamps, selectedIndicesArray, selectedLine]);

  const pushHistorySnapshot = useCallback((snapshot) => {
    setHistoryPast((prev) => {
      const next = [...prev, snapshot];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
    setHistoryFuture([]);
  }, []);

  const remapSelectedLineFromSnapshot = useCallback((snapshot) => {
    if (snapshot.selectedLine === undefined) return null;
    if (snapshot.selectedLine === null) return null;
    return snapshot.selectedLine;
  }, []);

  const applySnapshot = useCallback((snapshot) => {
    historyMutationRef.current = true;
    suppressScrollResetRef.current = true;
    tutorialMutationRef.current = true;
    setLyrics(snapshot.lyrics);
    setLyricsTimestamps(snapshot.timestamps || []);
    if (emitLyricsLoad) emitLyricsLoad(snapshot.lyrics);
    const nextSelected = remapSelectedLineFromSnapshot(snapshot);
    selectLine(nextSelected);
    setSelectedIndices(new Set(snapshot.selection || []));
    selectionAnchorRef.current = snapshot.selection?.[snapshot.selection.length - 1] ?? null;
  }, [emitLyricsLoad, remapSelectedLineFromSnapshot, selectLine, selectionAnchorRef, setLyrics, setLyricsTimestamps, setSelectedIndices, suppressScrollResetRef, tutorialMutationRef]);

  const handleUndo = useCallback(() => {
    setHistoryPast((past) => {
      if (!past.length) return past;
      const previous = past[past.length - 1];
      const current = takeSnapshot();
      setHistoryFuture((future) => [...future, current]);
      applySnapshot(previous);
      closeContextMenu();
      return past.slice(0, -1);
    });
  }, [applySnapshot, closeContextMenu, takeSnapshot]);

  const handleRedo = useCallback(() => {
    setHistoryFuture((future) => {
      if (!future.length) return future;
      const next = future[future.length - 1];
      const current = takeSnapshot();
      setHistoryPast((past) => [...past, current]);
      applySnapshot(next);
      closeContextMenu();
      return future.slice(0, -1);
    });
  }, [applySnapshot, closeContextMenu, takeSnapshot]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (isInputLike(event.target)) return;

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRedo, handleUndo]);

  useElectronListeners({ canUndo, canRedo, handleUndo, handleRedo });

  useEffect(() => {
    const key = `${lyrics.length}|${lyrics[0]?.id || (typeof lyrics[0] === 'string' ? lyrics[0] : '')}`;
    if (historySignatureRef.current === key) return;
    historySignatureRef.current = key;

    if (historyMutationRef.current) {
      historyMutationRef.current = false;
      return;
    }

    setHistoryPast([]);
    setHistoryFuture([]);
    setSelectedIndices(new Set());
    selectionAnchorRef.current = null;
  }, [lyrics, selectionAnchorRef, setSelectedIndices]);

  return {
    canUndo,
    canRedo,
    historyMutationRef,
    takeSnapshot,
    pushHistorySnapshot,
    handleUndo,
    handleRedo,
  };
}
