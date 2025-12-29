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

    win.webContents
      .executeJavaScript(`window.electronStore?.getDarkMode?.() || false`)
      .then((isDark) => {
        nativeTheme.themeSource = isDark ? 'dark' : 'light';
      })
      .catch((error) => {
        console.warn('Failed to update dark mode:', error);
      });
  };

  const toggleDarkMode = () => {
    const win = getMainWindow?.();
    if (!win || win.isDestroyed()) return;

    try {
      win.webContents.send('toggle-dark-mode');
      setTimeout(updateDarkModeMenu, 100);
    } catch (error) {
      console.warn('Failed to toggle dark mode:', error);
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