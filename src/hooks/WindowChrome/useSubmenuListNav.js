import { useCallback, useEffect, useRef, useState } from 'react';

const useSubMenuListNav = ({
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
    if (!submenuRefs.current) {
      submenuRefs.current = [];
    }
    submenuRefs.current[index] = el;
  }, []);

  const getFocusableItems = useCallback(() =>
    submenuRefs.current.filter((el) => el && !el.disabled)
    , []);

  const syncIndexFromFocus = useCallback(() => {
    const focusable = getFocusableItems();
    const idx = focusable.findIndex((el) => el === document.activeElement);

    if (idx >= 0) {
      submenuIndexRef.current = idx;
      setSubmenuIndex(idx);
    }
    return idx;
  }, [getFocusableItems]);

  const focusSubmenuIndex = useCallback((index = 0) => {
    const focusable = getFocusableItems();

    if (!focusable.length) {
      submenuIndexRef.current = -1;
      setSubmenuIndex(-1);
      return;
    }

    const bounded = ((index % focusable.length) + focusable.length) % focusable.length;
    submenuIndexRef.current = bounded;
    setSubmenuIndex(bounded);

    requestAnimationFrame(() => {
      focusable[bounded]?.focus?.();
    });
  }, [getFocusableItems]);

  const resetSubmenuIndex = useCallback(() => {
    submenuIndexRef.current = -1;
    setSubmenuIndex(-1);
  }, []);

  const closeSubmenuToParent = useCallback(() => {
    setOpenMenu(parentMenuId);
    setShouldFocusSubmenu(false);
    resetSubmenuIndex();
  }, [parentMenuId, setOpenMenu, resetSubmenuIndex]);

  const openSubmenu = useCallback((focusFirst = false, reason) => {
    setOpenMenu(submenuId);
    setOpenReason?.(reason);
    setShouldFocusSubmenu(focusFirst);

    if (focusFirst) {
      focusSubmenuIndex(0);
    } else {
      resetSubmenuIndex();
    }
  }, [focusSubmenuIndex, setOpenMenu, setOpenReason, submenuId, resetSubmenuIndex]);

  useEffect(() => {
    if (openMenu === submenuId) {
      if (shouldFocusSubmenu) {
        focusSubmenuIndex(0);
      }
    } else {
      setShouldFocusSubmenu(false);
      resetSubmenuIndex();
      resetSubmenuRefs();
    }
  }, [focusSubmenuIndex, openMenu, resetSubmenuRefs, resetSubmenuIndex, shouldFocusSubmenu, submenuId]);

  const handleSubmenuKeyDown = useCallback((event) => {
    const focusable = getFocusableItems();
    const { key } = event;

    if (submenuIndexRef.current === -1) {
      syncIndexFromFocus();
    }

    const currentIndex = submenuIndexRef.current;
    const count = focusable.length;
    let handled = false;

    // Handle empty submenu
    if (count === 0) {
      resetSubmenuIndex();

      if (['Escape', 'ArrowRight', 'ArrowLeft'].includes(key)) {
        closeSubmenuToParent();

        if (key === 'ArrowLeft' || key === 'Escape') {
          focusParentItem?.();
        } else if (key === 'ArrowRight') {
          const parentIdx = topMenuOrder.indexOf(parentMenuId);
          const nextId = topMenuOrder[(parentIdx + 1) % topMenuOrder.length];
          setOpenMenu(nextId);
        }
        handled = true;
      } else if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(key)) {
        handled = true;
      }
      return handled;
    }

    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      let next;

      if (currentIndex === -1) {
        next = key === 'ArrowUp' ? count - 1 : 0;
      } else {
        switch (key) {
          case 'ArrowDown':
            next = (currentIndex + 1) % count;
            break;
          case 'ArrowUp':
            next = (currentIndex - 1 + count) % count;
            break;
          case 'Home':
            next = 0;
            break;
          case 'End':
            next = count - 1;
            break;
        }
      }

      focusSubmenuIndex(next);
      handled = true;
    }
    else if (key === 'Enter') {
      const targetIdx = currentIndex >= 0 ? currentIndex : 0;
      focusable[targetIdx]?.click?.();
      handled = true;
    }
    else if (['Escape', 'ArrowRight', 'ArrowLeft'].includes(key)) {
      closeSubmenuToParent();

      if (key === 'ArrowLeft' || key === 'Escape') {
        focusParentItem?.();
      } else if (key === 'ArrowRight') {
        const parentIdx = topMenuOrder.indexOf(parentMenuId);
        const nextId = topMenuOrder[(parentIdx + 1) % topMenuOrder.length];
        setOpenMenu(nextId);
      }
      handled = true;
    }

    return handled;
  }, [closeSubmenuToParent, focusParentItem, focusSubmenuIndex, getFocusableItems, parentMenuId, resetSubmenuIndex, setOpenMenu, syncIndexFromFocus, topMenuOrder]);

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

export default useSubMenuListNav;