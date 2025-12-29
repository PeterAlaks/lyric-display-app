import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_MENU_CONFIG = {
  file: { count: 7, sub: [2] },
  edit: { count: 7, sub: [] },
  view: { count: 7, sub: [] },
  window: { count: 5, sub: [] },
  help: { count: 8, sub: [] },
};

const PINNED_REASONS = new Set(['click', 'keyboard']);
const CLOSE_DELAY_MS = 200;

const useTopMenuState = ({
  barRef,
  topMenuOrder,
  menuConfig = DEFAULT_MENU_CONFIG,
  keyHandlerLookup,
}) => {
  const [openMenu, setOpenMenu] = useState(null);
  const [openReason, setOpenReason] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const activeIndexRef = useRef(activeIndex);
  const menuContainerRefs = useRef({});
  const menuRefs = useRef({});
  const closeTimerRef = useRef(null);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const isPinnedOpen = PINNED_REASONS.has(openReason);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleCloseMenu = useCallback((id, { force = false, toMenu = null } = {}) => {
    if (isPinnedOpen && !force) return;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpenMenu((prev) => {
        if (!prev || (id && !(prev === id || prev.startsWith(id)))) return prev;
        setActiveIndex(-1);
        setOpenReason(null);
        return toMenu;
      });
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer, isPinnedOpen]);

  const resetMenuState = useCallback(() => {
    setActiveIndex(-1);
    setOpenReason(null);
  }, []);

  const closeMenu = useCallback(() => {
    clearCloseTimer();
    setOpenMenu(null);
    resetMenuState();
  }, [clearCloseTimer, resetMenuState]);

  const openMenuAndFocus = useCallback((id, reason = 'hover') => {
    clearCloseTimer();
    setOpenMenu(id);
    setActiveIndex(-1);
    setOpenReason(reason);
  }, [clearCloseTimer]);

  const toggleMenu = useCallback((id) => {
    clearCloseTimer();
    setOpenMenu((prev) => {
      const isClosing = prev === id;
      setActiveIndex(-1);
      setOpenReason(isClosing ? null : 'click');
      return isClosing ? null : id;
    });
  }, [clearCloseTimer]);

  const registerItemRef = useCallback((menuId, index, el) => {
    if (!menuRefs.current[menuId]) {
      menuRefs.current[menuId] = [];
    }
    menuRefs.current[menuId][index] = el;
  }, []);

  const focusIndex = useCallback((menuId, index) => {
    menuRefs.current?.[menuId]?.[index]?.focus?.();
  }, []);

  const ensureReason = useCallback((reason) => {
    setOpenReason((prev) => prev ?? reason);
  }, []);

  const createMenuKeyHandler = useCallback(({
    menuId,
    itemCount,
    submenuIndexes = [],
    openSubmenu,
  }) => (event) => {
    if (!itemCount || itemCount <= 0) return false;

    const currentIndex = activeIndexRef.current;
    const { key } = event;
    let handled = false;

    // Vertical navigation
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      let nextIndex;

      if (currentIndex === -1) {
        nextIndex = key === 'ArrowUp' ? itemCount - 1 : 0;
      } else {
        switch (key) {
          case 'ArrowDown':
            nextIndex = (currentIndex + 1) % itemCount;
            break;
          case 'ArrowUp':
            nextIndex = (currentIndex - 1 + itemCount) % itemCount;
            break;
          case 'Home':
            nextIndex = 0;
            break;
          case 'End':
            nextIndex = itemCount - 1;
            break;
        }
      }

      setActiveIndex(nextIndex);
      focusIndex(menuId, nextIndex);
      ensureReason('keyboard');
      handled = true;
    }
    else if (key === 'Enter') {
      const targetIndex = currentIndex >= 0 ? currentIndex : 0;

      if (submenuIndexes?.includes(targetIndex) && openSubmenu) {
        ensureReason('keyboard');
        openSubmenu();
      } else {
        menuRefs.current?.[menuId]?.[targetIndex]?.click?.();
      }
      handled = true;
    }
    else if (key === 'Escape') {
      closeMenu();
      handled = true;
    }
    else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (key === 'ArrowRight' && submenuIndexes?.includes(currentIndex) && openSubmenu) {
        ensureReason('keyboard');
        openSubmenu();
      } else {
        const currentIdx = topMenuOrder.indexOf(menuId);
        const offset = key === 'ArrowLeft' ? -1 : 1;
        const nextId = topMenuOrder[(currentIdx + offset + topMenuOrder.length) % topMenuOrder.length];
        openMenuAndFocus(nextId, 'keyboard');
        setActiveIndex(-1);
      }
      handled = true;
    }

    return handled;
  }, [closeMenu, ensureReason, focusIndex, openMenuAndFocus, topMenuOrder]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (barRef?.current && !barRef.current.contains(event.target)) {
        closeMenu();
      }
    };

    const handleKeyDown = (event) => {
      if (!openMenu) return;

      const handler = keyHandlerLookup?.(openMenu);
      if (handler && handler(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [barRef, closeMenu, keyHandlerLookup, openMenu]);

  return {
    openMenu,
    setOpenMenu,
    openReason,
    setOpenReason,
    isPinnedOpen,
    activeIndex,
    setActiveIndex,
    activeIndexRef,
    menuContainerRefs,
    menuRefs,
    registerItemRef,
    focusIndex,
    openMenuAndFocus,
    toggleMenu,
    closeMenu,
    scheduleCloseMenu,
    clearCloseTimer,
    createMenuKeyHandler,
    ensureReason,
    menuConfig,
  };
};

export default useTopMenuState;