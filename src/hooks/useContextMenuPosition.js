import { useMemo } from 'react';

const useContextMenuPosition = ({
  contextMenuState,
  contextMenuDimensions,
  containerSize,
  fallbackDimensions = { width: 192, height: 224, selectionWidth: 168, selectionHeight: 152 }
}) => {
  const fallbackMenuWidth = contextMenuState.mode === 'selection'
    ? (fallbackDimensions.selectionWidth || 168)
    : fallbackDimensions.width;
  const fallbackMenuHeight = contextMenuState.mode === 'selection'
    ? (fallbackDimensions.selectionHeight || 152)
    : fallbackDimensions.height;
  const menuWidth = contextMenuDimensions.width || fallbackMenuWidth;
  const menuHeight = contextMenuDimensions.height || fallbackMenuHeight;

  const contextMenuPosition = useMemo(() => {
    if (!contextMenuState.visible) return null;

    return {
      left: Math.max(
        8,
        Math.min(
          contextMenuState.x,
          containerSize.width > 0
            ? Math.max(8, containerSize.width - menuWidth - 8)
            : contextMenuState.x
        )
      ),
      top: Math.max(
        8,
        Math.min(
          contextMenuState.y,
          containerSize.height > 0
            ? Math.max(8, containerSize.height - menuHeight - 8)
            : contextMenuState.y
        )
      )
    };
  }, [
    containerSize.height,
    containerSize.width,
    contextMenuState.visible,
    contextMenuState.x,
    contextMenuState.y,
    menuHeight,
    menuWidth
  ]);

  return {
    contextMenuPosition,
    menuWidth,
    menuHeight
  };
};

export default useContextMenuPosition;