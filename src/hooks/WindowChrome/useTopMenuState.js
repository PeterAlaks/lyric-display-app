import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_MENU_CONFIG = {
  file: { count: 7, sub: [2] },
  edit: { count: 7, sub: [] },
  view: { count: 7, sub: [] },
  window: { count: 5, sub: [] },
  help: { count: 8, sub: [] },
};

const PINNED_REASONS = new Set(['click', 'keyboard']);

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
        if (!prev) return prev;
        if (id && !(prev === id || prev.startsWith(id))) return prev;
        setActiveIndex(-1);
        setOpenReason(null);
        return toMenu;
      });
    }, 200);
  }, [clearCloseTimer, isPinnedOpen]);

  const closeMenu = useCallback(() => {
    clearCloseTimer();
    setOpenMenu(null);
    setActiveIndex(-1);
    setOpenReason(null);
  }, [clearCloseTimer]);

  const openMenuAndFocus = useCallback((id, reason = 'hover') => {
    clearCloseTimer();
    setOpenMenu(id);
    setActiveIndex(-1);
    setOpenReason(reason);
  }, [clearCloseTimer]);

  const toggleMenu = useCallback((id) => {
    clearCloseTimer();
    setOpenMenu((prev) => {
      const next = prev === id ? null : id;
      setActiveIndex(-1);
      setOpenReason(next ? 'click' : null);
      return next;
    });
  }, [clearCloseTimer]);

  const registerItemRef = useCallback((menuId, index, el) => {
    if (!menuRefs.current[menuId]) menuRefs.current[menuId] = [];
    menuRefs.current[menuId][index] = el;
  }, []);

  const focusIndex = useCallback((menuId, index) => {
    const ref = menuRefs.current?.[menuId]?.[index];
    ref?.focus?.();
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
    let handled = false;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      let nextIndex = currentIndex;
      if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1 + itemCount) % itemCount;
      if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + itemCount) % itemCount;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = itemCount - 1;
      if (currentIndex === -1) {
        nextIndex = event.key === 'ArrowUp' ? itemCount - 1 : 0;
      }
      setActiveIndex(nextIndex);
      focusIndex(menuId, nextIndex);
      ensureReason('keyboard');
      handled = true;
    } else if (event.key === 'Enter') {
      const targetIndex = currentIndex >= 0 ? currentIndex : 0;
      if (submenuIndexes?.includes(targetIndex) && typeof openSubmenu === 'function') {
        ensureReason('keyboard');
        openSubmenu();
      } else {
        const ref = menuRefs.current?.[menuId]?.[targetIndex];
        ref?.click?.();
      }
      handled = true;
    } else if (event.key === 'Escape') {
      closeMenu();
      handled = true;
    } else if (event.key === 'ArrowLeft') {
      const currentIdx = topMenuOrder.indexOf(menuId);
      const prevId = topMenuOrder[(currentIdx - 1 + topMenuOrder.length) % topMenuOrder.length];
      openMenuAndFocus(prevId, 'keyboard');
      setActiveIndex(-1);
      handled = true;
    } else if (event.key === 'ArrowRight') {
      if (submenuIndexes?.includes(currentIndex) && typeof openSubmenu === 'function') {
        ensureReason('keyboard');
        openSubmenu();
      } else {
        const currentIdx = topMenuOrder.indexOf(menuId);
        const nextId = topMenuOrder[(currentIdx + 1) % topMenuOrder.length];
        openMenuAndFocus(nextId, 'keyboard');
        setActiveIndex(-1);
      }
      handled = true;
    }
    return handled;
  }, [closeMenu, ensureReason, focusIndex, openMenuAndFocus, topMenuOrder]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!barRef?.current) return;
      if (!barRef.current.contains(event.target)) {
        closeMenu();
      }
    };
    const stopNavKeys = (event) => {
      if (!openMenu) return;
      const handler = typeof keyHandlerLookup === 'function'
        ? keyHandlerLookup(openMenu)
        : null;
      if (!handler) return;
      const handled = handler(event);
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', stopNavKeys, true);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', stopNavKeys, true);
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