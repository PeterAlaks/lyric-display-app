import { useMemo } from 'react';

const useContextMenuPosition = ({
  contextMenuState,
  contextMenuDimensions,
  containerSize
}) => {
  const fallbackMenuWidth = contextMenuState.mode === 'selection' ? 168 : 192;
  const fallbackMenuHeight = contextMenuState.mode === 'selection' ? 152 : 224;
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
  }, [containerSize.height, containerSize.width, contextMenuState.visible, contextMenuState.x, contextMenuState.y, menuHeight, menuWidth]);

  return {
    contextMenuPosition,
    menuWidth,
    menuHeight
  };
};

export default useContextMenuPosition;