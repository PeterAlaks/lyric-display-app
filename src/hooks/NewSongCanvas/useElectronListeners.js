import { useEffect } from 'react';

/**
 * Custom hook to handle Electron menu undo/redo integration for NewSongCanvas
 * @param {Object} params
 * @param {boolean} params.canUndo - Whether undo is available
 * @param {boolean} params.canRedo - Whether redo is available
 * @param {Function} params.handleUndo - Undo handler function
 * @param {Function} params.handleRedo - Redo handler function
 */
const useElectronListeners = ({ canUndo, canRedo, handleUndo, handleRedo }) => {

  useEffect(() => {
    if (!window.electronAPI) return;

    const undoHandler = () => { if (canUndo) handleUndo(); };
    const redoHandler = () => { if (canRedo) handleRedo(); };

    const cleanupUndo = window.electronAPI.onMenuUndo(() => {
      undoHandler();
    });

    const cleanupRedo = window.electronAPI.onMenuRedo(() => {
      redoHandler();
    });

    window.addEventListener('menu-undo', undoHandler);
    window.addEventListener('menu-redo', redoHandler);

    return () => {
      if (cleanupUndo) cleanupUndo();
      if (cleanupRedo) cleanupRedo();
      window.removeEventListener('menu-undo', undoHandler);
      window.removeEventListener('menu-redo', redoHandler);
    };
  }, [canUndo, canRedo, handleUndo, handleRedo]);

  useEffect(() => {
    if (window.electronAPI?.notifyUndoRedoState) {
      window.electronAPI.notifyUndoRedoState(canUndo, canRedo);
    }
  }, [canUndo, canRedo]);
};

export default useElectronListeners;