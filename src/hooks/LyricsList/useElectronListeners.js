import { useEffect } from 'react';

/**
 * Custom hook to handle Electron menu undo/redo integration for LyricsList
 * @param {Object} params
 * @param {boolean} params.canUndo - Whether undo is available
 * @param {boolean} params.canRedo - Whether redo is available
 * @param {Function} params.handleUndo - Undo handler function
 * @param {Function} params.handleRedo - Redo handler function
 */
const useElectronListeners = ({ canUndo, canRedo, handleUndo, handleRedo }) => {

  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanupUndo = window.electronAPI.onMenuUndo(() => {
      if (canUndo) handleUndo();
    });

    const cleanupRedo = window.electronAPI.onMenuRedo(() => {
      if (canRedo) handleRedo();
    });

    return () => {
      if (cleanupUndo) cleanupUndo();
      if (cleanupRedo) cleanupRedo();
    };
  }, [canUndo, canRedo, handleUndo, handleRedo]);

  useEffect(() => {
    if (window.electronAPI?.notifyUndoRedoState) {
      window.electronAPI.notifyUndoRedoState(canUndo, canRedo);
    }
  }, [canUndo, canRedo]);
};

export default useElectronListeners;