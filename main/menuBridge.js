import { nativeTheme } from 'electron';

export function makeMenuAPI({ getMainWindow }) {
  let undoRedoState = { canUndo: false, canRedo: false };

  const updateUndoRedoState = (state = {}) => {
    undoRedoState = {
      canUndo: Boolean(state.canUndo),
      canRedo: Boolean(state.canRedo),
    };
  };

  const updateDarkModeMenu = () => {
    const win = getMainWindow?.();
    if (!win || win.isDestroyed()) return;

    try {
      win.webContents.executeJavaScript(`window.electronStore?.getDarkMode?.() || false`)
        .then((isDark) => { nativeTheme.themeSource = isDark ? 'dark' : 'light'; })
        .catch(() => { });
    } catch {
    }
  };

  const toggleDarkMode = () => {
    const win = getMainWindow?.();
    if (win && !win.isDestroyed()) {
      try { win.webContents.send('toggle-dark-mode'); } catch { }
      setTimeout(() => { updateDarkModeMenu(); }, 100);
    }
  };

  const createMenu = () => { };

  return {
    createMenu,
    updateDarkModeMenu,
    toggleDarkMode,
    updateUndoRedoState,
    getUndoRedoState: () => ({ ...undoRedoState }),
  };
}