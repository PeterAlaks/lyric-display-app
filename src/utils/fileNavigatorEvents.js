export const OPEN_FILE_NAVIGATOR_EVENT = 'lyricdisplay:open-file-navigator';
export const OPEN_FILE_SAVE_NAVIGATOR_EVENT = 'lyricdisplay:open-file-save-navigator';

export function canUseFileNavigator() {
  return Boolean(window?.electronAPI?.fileNavigator?.getState);
}

export function openFileNavigator({ destination, maxSelections } = {}) {
  if (!canUseFileNavigator()) return false;
  window.dispatchEvent(new CustomEvent(OPEN_FILE_NAVIGATOR_EVENT, {
    detail: { destination, maxSelections },
  }));
  return true;
}

export function saveWithFileNavigator({
  suggestedName,
  extension,
  availableExtensions,
  initialDirectory = null,
} = {}) {
  if (!canUseFileNavigator() || !window.electronAPI?.fileNavigator?.prepareSave) {
    return Promise.resolve({ unavailable: true });
  }

  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(OPEN_FILE_SAVE_NAVIGATOR_EVENT, {
      detail: {
        suggestedName,
        extension,
        availableExtensions,
        initialDirectory,
        onComplete: resolve,
      },
    }));
  });
}
