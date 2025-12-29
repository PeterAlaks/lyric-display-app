import { useCallback, useEffect, useRef, useState } from 'react';

const useSubmenuListNavigation = ({
  submenuId,
  parentMenuId,
  openMenu,
  setOpenMenu,
  topMenuOrder,
  focusParentItem,
  setOpenReason,
}) => {
  const [submenuIndex, setSubmenuIndex] = useState(-1);
  const [shouldFocusSubmenu, setShouldFocusSubmenu] = useState(false);

  const submenuIndexRef = useRef(submenuIndex);
  const submenuRefs = useRef([]);

  useEffect(() => {
    submenuIndexRef.current = submenuIndex;
  }, [submenuIndex]);

  const resetSubmenuRefs = useCallback(() => {
    submenuRefs.current = [];
  }, []);

  const registerSubmenuItemRef = useCallback((index) => (el) => {
    if (!submenuRefs.current) submenuRefs.current = [];
    submenuRefs.current[index] = el;
  }, []);

  const getFocusableItems = useCallback(() => (
    (submenuRefs.current || []).filter((el) => el && !el.disabled)
  ), []);

  const syncIndexFromFocus = useCallback(() => {
    const focusable = getFocusableItems();
    const active = document.activeElement;
    const idx = focusable.findIndex((el) => el === active);
    if (idx >= 0) {
      submenuIndexRef.current = idx;
      setSubmenuIndex(idx);
    }
    return idx;
  }, [getFocusableItems]);

  const focusSubmenuIndex = useCallback((index = 0) => {
    const focusable = getFocusableItems();
    if (!focusable.length) {
      setSubmenuIndex(-1);
      submenuIndexRef.current = -1;
      return;
    }
    const bounded = ((index % focusable.length) + focusable.length) % focusable.length;
    submenuIndexRef.current = bounded;
    setSubmenuIndex(bounded);
    requestAnimationFrame(() => {
      focusable[bounded]?.focus?.();
    });
  }, [getFocusableItems]);

  const closeSubmenuToParent = useCallback(() => {
    setOpenMenu(parentMenuId);
    setShouldFocusSubmenu(false);
    submenuIndexRef.current = -1;
    setSubmenuIndex(-1);
  }, [parentMenuId, setOpenMenu]);

  const openSubmenu = useCallback((focusFirst = false, reason) => {
    setOpenMenu(submenuId);
    if (reason) setOpenReason?.(reason);
    setShouldFocusSubmenu(focusFirst);
    if (focusFirst) {
      focusSubmenuIndex(0);
    } else {
      submenuIndexRef.current = -1;
      setSubmenuIndex(-1);
    }
  }, [focusSubmenuIndex, setOpenMenu, setOpenReason, submenuId]);

  useEffect(() => {
    if (openMenu === submenuId) {
      if (shouldFocusSubmenu) {
        focusSubmenuIndex(0);
      }
    } else {
      setShouldFocusSubmenu(false);
      setSubmenuIndex(-1);
      submenuIndexRef.current = -1;
      resetSubmenuRefs();
    }
  }, [focusSubmenuIndex, openMenu, resetSubmenuRefs, shouldFocusSubmenu, submenuId]);

  const handleSubmenuKeyDown = useCallback((event) => {
    const focusable = getFocusableItems();
    if (submenuIndexRef.current === -1) {
      syncIndexFromFocus();
    }
    const currentIndex = submenuIndexRef.current;
    const count = focusable.length;
    let handled = false;

    if (count === 0) {
      setSubmenuIndex(-1);
      if (['Escape', 'ArrowRight', 'ArrowLeft'].includes(event.key)) {
        closeSubmenuToParent();
        if (event.key === 'ArrowLeft' || event.key === 'Escape') {
          focusParentItem?.();
        } else if (event.key === 'ArrowRight') {
          const nextId = topMenuOrder[(topMenuOrder.indexOf(parentMenuId) + 1) % topMenuOrder.length];
          setOpenMenu(nextId);
        }
        handled = true;
      } else if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(event.key)) {
        // No submenu items: swallow navigation to avoid leaking to app shortcuts.
        handled = true;
      }
      return handled;
    }

    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      let next = currentIndex;
      if (event.key === 'ArrowDown') next = (currentIndex + 1 + count) % count;
      if (event.key === 'ArrowUp') next = (currentIndex - 1 + count) % count;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = count - 1;
      if (currentIndex === -1) {
        next = event.key === 'ArrowUp' ? count - 1 : 0;
      }
      focusSubmenuIndex(next);
      handled = true;
    } else if (event.key === 'Enter') {
      const targetIdx = currentIndex >= 0 ? currentIndex : 0;
      focusable[targetIdx]?.click?.();
      handled = true;
    } else if (['Escape', 'ArrowRight', 'ArrowLeft'].includes(event.key)) {
      if (event.key === 'ArrowLeft') {
        closeSubmenuToParent();
        focusParentItem?.();
      } else if (event.key === 'ArrowRight') {
        const nextId = topMenuOrder[(topMenuOrder.indexOf(parentMenuId) + 1) % topMenuOrder.length];
        setOpenMenu(nextId);
      } else {
        closeSubmenuToParent();
        focusParentItem?.();
      }
      handled = true;
    }
    return handled;
  }, [closeSubmenuToParent, focusParentItem, focusSubmenuIndex, getFocusableItems, parentMenuId, setOpenMenu, syncIndexFromFocus, topMenuOrder]);

  return {
    submenuIndex,
    setSubmenuIndex,
    shouldFocusSubmenu,
    setShouldFocusSubmenu,
    resetSubmenuRefs,
    registerSubmenuItemRef,
    focusSubmenuIndex,
    openSubmenu,
    closeSubmenuToParent,
    handleSubmenuKeyDown,
    submenuRefs,
  };
};

export default useSubmenuListNavigation;