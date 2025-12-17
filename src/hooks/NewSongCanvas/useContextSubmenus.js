import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

const SUBMENU_VERTICAL_PADDING = 8;
const FALLBACK_SUBMENU_MAX_HEIGHT = 320;

const useContextSubmenus = ({
  containerSize,
  contextMenuPosition,
  menuWidth,
  editorContainerRef,
  timestampSubmenuRef,
  metadataSubmenuRef,
  contextMenuVisible
}) => {
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const [submenuOffsets, setSubmenuOffsets] = useState({ timestamp: 0, metadata: 0 });
  const submenuCloseTimeoutRef = useRef(null);

  const cancelSubmenuClose = useCallback(() => {
    if (submenuCloseTimeoutRef.current) {
      window.clearTimeout(submenuCloseTimeoutRef.current);
      submenuCloseTimeoutRef.current = null;
    }
  }, []);

  const scheduleSubmenuClose = useCallback((delay = 180) => {
    cancelSubmenuClose();
    submenuCloseTimeoutRef.current = window.setTimeout(() => {
      setActiveSubmenu(null);
    }, delay);
  }, [cancelSubmenuClose]);

  const handleRootItemEnter = useCallback(() => {
    cancelSubmenuClose();
    setActiveSubmenu(null);
  }, [cancelSubmenuClose]);

  const handleContextMenuEnter = cancelSubmenuClose;
  const handleContextMenuLeave = useCallback((event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      scheduleSubmenuClose();
    }
  }, [scheduleSubmenuClose]);

  const handleSubmenuTriggerEnter = useCallback((submenuKey) => {
    cancelSubmenuClose();
    setActiveSubmenu(submenuKey);
  }, [cancelSubmenuClose]);

  const handleSubmenuTriggerLeave = scheduleSubmenuClose;
  const handleSubmenuPanelEnter = cancelSubmenuClose;
  const handleSubmenuPanelLeave = scheduleSubmenuClose;

  const submenuHorizontal = useMemo(() => {
    const submenuWidth = 200;

    if (!contextMenuPosition) {
      return 'right';
    }

    const availableRight = (containerSize.width || 0) - (contextMenuPosition.left + menuWidth);
    const availableLeft = contextMenuPosition.left;

    if (availableRight >= submenuWidth) return 'right';
    if (availableLeft >= submenuWidth) return 'left';
    return 'right';
  }, [containerSize.width, contextMenuPosition, menuWidth]);

  const submenuMaxHeight = useMemo(() => {
    const availableHeight = (containerSize.height || 0) - SUBMENU_VERTICAL_PADDING * 2;
    if (availableHeight > 0) {
      return Math.min(availableHeight, FALLBACK_SUBMENU_MAX_HEIGHT);
    }
    return FALLBACK_SUBMENU_MAX_HEIGHT;
  }, [containerSize.height]);

  const updateSubmenuOffset = useCallback((submenuKey, submenuElement) => {
    if (!submenuElement || !editorContainerRef.current) return;

    const containerRect = editorContainerRef.current.getBoundingClientRect();
    const triggerRect = submenuElement.parentElement?.getBoundingClientRect();

    if (!containerRect || !containerRect.height || !triggerRect) return;

    const parentOffsetTop = triggerRect.top - containerRect.top;
    const naturalHeight = submenuElement.scrollHeight || submenuElement.offsetHeight || submenuMaxHeight;
    const effectiveHeight = Math.min(naturalHeight, submenuMaxHeight);

    const minTop = SUBMENU_VERTICAL_PADDING - parentOffsetTop;
    const maxTop = containerRect.height - SUBMENU_VERTICAL_PADDING - effectiveHeight - parentOffsetTop;
    const clampedTop = Math.min(Math.max(0, minTop), maxTop);

    setSubmenuOffsets((current) => {
      const currentTop = current[submenuKey] ?? 0;
      if (currentTop === clampedTop) return current;
      return { ...current, [submenuKey]: clampedTop };
    });
  }, [editorContainerRef, submenuMaxHeight]);

  useLayoutEffect(() => {
    if (!contextMenuVisible) return;

    if (activeSubmenu === 'timestamp' && timestampSubmenuRef.current) {
      updateSubmenuOffset('timestamp', timestampSubmenuRef.current);
    }

    if (activeSubmenu === 'metadata' && metadataSubmenuRef.current) {
      updateSubmenuOffset('metadata', metadataSubmenuRef.current);
    }
  }, [
    activeSubmenu,
    contextMenuVisible,
    contextMenuPosition?.top,
    contextMenuPosition?.left,
    containerSize.height,
    updateSubmenuOffset,
    timestampSubmenuRef,
    metadataSubmenuRef
  ]);

  return {
    activeSubmenu,
    setActiveSubmenu,
    submenuOffsets,
    submenuHorizontal,
    submenuMaxHeight,
    handleRootItemEnter,
    handleContextMenuEnter,
    handleContextMenuLeave,
    handleSubmenuTriggerEnter,
    handleSubmenuTriggerLeave,
    handleSubmenuPanelEnter,
    handleSubmenuPanelLeave,
    cancelSubmenuClose
  };
};

export default useContextSubmenus;