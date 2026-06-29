import React from 'react';
import { createPortal } from 'react-dom';
import { List, useListRef } from 'react-window';
import { Input } from "@/components/ui/input";
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { FEATURED_FONTS } from '../constants/fonts';
import { logWarn } from '../utils/logger';
import { cn } from '@/lib/utils';

const normalizeFontName = (font) => (typeof font === 'string' ? font.replace(/["']/g, '').trim() : '');
const getFontPreviewFamily = (font) => {
  const normalized = normalizeFontName(font);
  if (!normalized) return undefined;
  const escaped = normalized.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
};
const DROPDOWN_MAX_HEIGHT = 320;
const FONT_ROW_HEIGHT = 36;
const LABEL_ROW_HEIGHT = 30;
const DIVIDER_ROW_HEIGHT = 16;
const HELPER_ROW_HEIGHT = 28;
const SCROLL_PADDING_PX = 4;
const ANIMATION_DURATION = 220;
const FONT_LOAD_TIMEOUT_MS = 5000;

const sortAndDeduplicate = (fonts) => Array.from(
  new Set(
    (fonts || [])
      .map(normalizeFontName)
      .filter(Boolean)
  )
).sort((a, b) => a.localeCompare(b));

let cachedSystemFonts = null;
let cachedSystemFontPromise = null;

const withTimeout = (promise, timeoutMs, message) => {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

const loadSystemFonts = async () => {
  if (Array.isArray(cachedSystemFonts)) {
    return { fonts: cachedSystemFonts, ok: true };
  }
  if (cachedSystemFontPromise) return cachedSystemFontPromise;

  if (typeof window === 'undefined' || !window.electronAPI?.getSystemFonts) {
    cachedSystemFonts = [];
    return { fonts: cachedSystemFonts, ok: true };
  }

  cachedSystemFontPromise = withTimeout(
    window.electronAPI.getSystemFonts(),
    FONT_LOAD_TIMEOUT_MS,
    `System font request timed out after ${FONT_LOAD_TIMEOUT_MS}ms`
  )
    .then((result) => {
      if (result?.success === false) {
        throw new Error(result.error || 'System font request failed');
      }
      const fontsPayload = Array.isArray(result) ? result : result?.fonts;
      cachedSystemFonts = sortAndDeduplicate(fontsPayload);
      return { fonts: cachedSystemFonts, ok: true };
    })
    .catch((error) => {
      logWarn('Failed to fetch system fonts', error?.message || error);
      return {
        fonts: Array.isArray(cachedSystemFonts) ? cachedSystemFonts : [],
        ok: Array.isArray(cachedSystemFonts)
      };
    })
    .finally(() => {
      cachedSystemFontPromise = null;
    });

  return cachedSystemFontPromise;
};

const FontSelect = ({
  value,
  onChange,
  darkMode,
  placeholder = 'Select font',
  triggerClassName = '',
  containerClassName = ''
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [installedFonts, setInstalledFonts] = React.useState([]);
  const [loadingFonts, setLoadingFonts] = React.useState(false);
  const [fontLoadFailed, setFontLoadFailed] = React.useState(false);
  const [fontsLoaded, setFontsLoaded] = React.useState(false);
  const [menuState, setMenuState] = React.useState('closed');
  const searchInputRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const [menuCoords, setMenuCoords] = React.useState(null);
  const closeTimerRef = React.useRef(null);
  const animationFrameRef = React.useRef(null);
  const listRef = useListRef();
  const activeFontIndexRef = React.useRef(null);
  const isMenuVisible = menuState !== 'closed';
  const isMenuInteractive = menuState === 'open' || menuState === 'opening';
  const isMenuExiting = menuState === 'closing';
  const computeMenuPosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const triggerWidth = rect.width;
    const dropdownWidth = Math.max(triggerWidth, 320);
    const menuHeight = menuRef.current?.offsetHeight || DROPDOWN_MAX_HEIGHT;
    const gap = 6;
    const minTop = 8;

    let left = rect.left;
    left = Math.min(left, window.innerWidth - dropdownWidth - 8);
    left = Math.max(8, left);

    const aboveTop = rect.top - menuHeight - gap;
    const belowTop = rect.bottom + gap;
    let top = aboveTop >= minTop ? aboveTop : belowTop;

    const maxTop = window.innerHeight - menuHeight - gap;
    if (top > maxTop) top = maxTop;
    if (top < minTop) top = minTop;

    setMenuCoords((prev) => {
      const next = { left, top, width: dropdownWidth };
      if (prev && prev.left === next.left && prev.top === next.top && prev.width === next.width) {
        return prev;
      }
      return next;
    });
  }, []);
  const clearAnimationTimers = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);
  const openMenu = React.useCallback(() => {
    if (menuState === 'open' || menuState === 'opening') return;
    clearAnimationTimers();
    setMenuState('opening');
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      setMenuState('open');
    });
  }, [clearAnimationTimers, menuState]);
  const closeMenu = React.useCallback(() => {
    if (menuState === 'closed' || menuState === 'closing') return;
    clearAnimationTimers();
    setMenuState('closing');
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setMenuState('closed');
    }, ANIMATION_DURATION);
  }, [clearAnimationTimers, menuState]);

  const isDesktopApp = typeof window !== 'undefined' && Boolean(window.electronAPI?.getSystemFonts);
  const featuredFontsSet = React.useMemo(
    () => new Set(FEATURED_FONTS.map((font) => normalizeFontName(font).toLowerCase())),
    []
  );
  const normalizedValue = normalizeFontName(value);

  React.useEffect(() => {
    if (!isDesktopApp || !isMenuVisible || fontsLoaded) return undefined;

    let mounted = true;
    setFontLoadFailed(false);
    setLoadingFonts(true);

    loadSystemFonts()
      .then((result) => {
        if (mounted) {
          const fonts = result?.fonts || [];
          setInstalledFonts(fonts);
          setFontsLoaded(Boolean(result?.ok));
          setFontLoadFailed(!result?.ok);
        }
      })
      .catch(() => {
        if (mounted) {
          setInstalledFonts([]);
          setFontsLoaded(false);
          setFontLoadFailed(true);
        }
      })
      .finally(() => {
        if (mounted) setLoadingFonts(false);
      });

    return () => { mounted = false; };
  }, [fontsLoaded, isDesktopApp, isMenuVisible]);

  const filterFonts = React.useCallback((list) => {
    if (!searchTerm.trim()) return list;
    const needle = searchTerm.toLowerCase();
    return list.filter((font) => font.toLowerCase().includes(needle));
  }, [searchTerm]);

  const installedOnly = React.useMemo(() => {
    const cleaned = (installedFonts || [])
      .map(normalizeFontName)
      .filter(Boolean)
      .filter((font) => !featuredFontsSet.has(font.toLowerCase()));

    if (
      normalizedValue &&
      !featuredFontsSet.has(normalizedValue.toLowerCase()) &&
      !cleaned.some((font) => font.toLowerCase() === normalizedValue.toLowerCase())
    ) {
      cleaned.unshift(normalizedValue);
    }

    return cleaned;
  }, [installedFonts, featuredFontsSet, normalizedValue]);

  const visibleFeaturedFonts = filterFonts(FEATURED_FONTS);
  const visibleInstalledFonts = filterFonts(installedOnly);

  React.useEffect(() => {
    if (isMenuInteractive && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isMenuInteractive]);

  React.useLayoutEffect(() => {
    if (!isMenuVisible) return undefined;

    const raf = requestAnimationFrame(computeMenuPosition);

    const handleClickOutside = (event) => {
      if (menuRef.current && menuRef.current.contains(event.target)) return;
      if (containerRef.current && containerRef.current.contains(event.target)) return;
      closeMenu();
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    const handleFocusIn = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      if (triggerRef.current?.contains(event.target)) return;
      closeMenu();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', computeMenuPosition);
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('blur', closeMenu);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', computeMenuPosition);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('blur', closeMenu);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    closeMenu,
    computeMenuPosition,
    isMenuVisible,
    loadingFonts,
    visibleFeaturedFonts.length,
    visibleInstalledFonts.length
  ]);

  React.useEffect(() => {
    if (menuState === 'closed') {
      setSearchTerm('');
      activeFontIndexRef.current = null;
    }
  }, [menuState]);

  React.useEffect(() => () => {
    clearAnimationTimers();
  }, [clearAnimationTimers]);

  React.useEffect(() => {
    if (!isMenuVisible) return undefined;

    const blockOutsideScroll = (event) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const opts = { passive: false, capture: true };
    window.addEventListener('wheel', blockOutsideScroll, opts);
    window.addEventListener('touchmove', blockOutsideScroll, opts);

    return () => {
      window.removeEventListener('wheel', blockOutsideScroll, opts);
      window.removeEventListener('touchmove', blockOutsideScroll, opts);
    };
  }, [isMenuVisible]);

  const handleSelect = React.useCallback((font) => {
    onChange(font);
    closeMenu();
  }, [closeMenu, onChange]);

  const labelClasses = `px-3 pt-3 pb-2 text-[11px] font-semibold tracking-wide uppercase ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;
  const helperTextClasses = `px-3 pb-2 text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;

  const listItems = React.useMemo(() => {
    const items = [{ type: 'label', text: 'Featured Fonts' }];

    if (visibleFeaturedFonts.length) {
      visibleFeaturedFonts.forEach((font) => {
        items.push({ type: 'font', font });
      });
    } else {
      items.push({ type: 'empty', text: 'No matching featured fonts' });
    }

    items.push({ type: 'divider' });
    items.push({ type: 'label', text: 'Installed Fonts' });

    if (!isDesktopApp) {
      items.push({ type: 'helper', text: 'System fonts are available in the desktop app' });
    } else if (loadingFonts) {
      items.push({ type: 'helper', text: 'Loading installed fonts...' });
    } else if (fontLoadFailed) {
      items.push({ type: 'helper', text: 'Installed fonts unavailable. Reopen to retry.' });
    }

    if (isDesktopApp && !loadingFonts && !fontLoadFailed) {
      if (visibleInstalledFonts.length) {
        visibleInstalledFonts.forEach((font) => {
          items.push({ type: 'font', font });
        });
      } else {
        items.push({ type: 'empty', text: 'No installed fonts found' });
      }
    }

    return items;
  }, [visibleFeaturedFonts, isDesktopApp, loadingFonts, fontLoadFailed, visibleInstalledFonts]);

  const listItemsRef = React.useRef(listItems);
  React.useEffect(() => {
    listItemsRef.current = listItems;
  }, [listItems]);

  const findFirstFontIndex = React.useCallback(() => (
    listItemsRef.current.findIndex((item) => item.type === 'font')
  ), []);

  const findLastFontIndex = React.useCallback(() => {
    const items = listItemsRef.current;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i]?.type === 'font') {
        return i;
      }
    }
    return -1;
  }, []);

  const focusFontAtIndex = React.useCallback((targetIndex) => {
    const items = listItemsRef.current;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    if (items[targetIndex]?.type !== 'font') return;

    activeFontIndexRef.current = targetIndex;
    listRef.current?.scrollToRow?.({ index: targetIndex, align: 'auto' });

    requestAnimationFrame(() => {
      const button = menuRef.current?.querySelector(`[data-font-index="${targetIndex}"]`);
      if (button) {
        button.focus();
      }
    });
  }, [listRef, menuRef]);

  React.useEffect(() => {
    if (!isMenuInteractive) return;
    const items = listItemsRef.current;
    const currentIndex = activeFontIndexRef.current;

    if (currentIndex == null) return;

    const ensureIndex = (idx) => {
      if (idx == null || idx < 0 || idx >= items.length) return findFirstFontIndex();
      return items[idx]?.type === 'font' ? idx : findFirstFontIndex();
    };

    const targetIndex = ensureIndex(currentIndex);
    if (typeof targetIndex === 'number' && targetIndex >= 0) {
      requestAnimationFrame(() => focusFontAtIndex(targetIndex));
    }
  }, [listItems, isMenuInteractive, findFirstFontIndex, focusFontAtIndex]);

  const getNextFontIndex = React.useCallback((currentIndex, delta) => {
    const items = listItemsRef.current;
    let idx = currentIndex + delta;
    while (idx >= 0 && idx < items.length) {
      if (items[idx]?.type === 'font') {
        return idx;
      }
      idx += delta;
    }
    return -1;
  }, []);

  const stopNavigationEvent = React.useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.nativeEvent?.stopImmediatePropagation) {
      event.nativeEvent.stopImmediatePropagation();
    }
  }, []);

  const handleMenuKeyDown = React.useCallback((event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      stopNavigationEvent(event);
    }
  }, [stopNavigationEvent]);

  const handleFontItemKeyDown = React.useCallback((event, index) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    stopNavigationEvent(event);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = getNextFontIndex(index, delta);

    if (nextIndex >= 0) {
      focusFontAtIndex(nextIndex);
    } else if (searchInputRef.current) {
      searchInputRef.current.focus();
      activeFontIndexRef.current = null;
    }
  }, [focusFontAtIndex, getNextFontIndex, searchInputRef, stopNavigationEvent]);

  const handleSearchKeyDown = React.useCallback((event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Escape') {
      stopNavigationEvent(event);
    } else {
      event.stopPropagation();
    }

    if (event.key === 'Escape') {
      closeMenu();
      return;
    }

    if (event.key === 'ArrowDown') {
      const firstFontIndex = findFirstFontIndex();
      if (firstFontIndex >= 0) {
        focusFontAtIndex(firstFontIndex);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      const lastFontIndex = findLastFontIndex();
      if (lastFontIndex >= 0) {
        focusFontAtIndex(lastFontIndex);
      }
    }
  }, [closeMenu, findFirstFontIndex, findLastFontIndex, focusFontAtIndex]);

  const handleToggleMenu = React.useCallback(() => {
    if (menuState === 'closed' || menuState === 'closing') {
      openMenu();
    } else {
      closeMenu();
    }
  }, [closeMenu, menuState, openMenu]);

  const renderFontItem = React.useCallback((font, index) => (
    <button
      key={font}
      type="button"
      data-font-index={index}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        handleSelect(font);
      }}
      onClick={(event) => {
        if (event.detail === 0) {
          handleSelect(font);
        }
      }}
      onKeyDown={(event) => handleFontItemKeyDown(event, index)}
      onFocus={() => { activeFontIndexRef.current = index; }}
      style={{ contain: 'layout paint style' }}
      className={cn(
        'w-full text-left flex items-center justify-between gap-2 px-3 py-1.5 text-xs leading-5 rounded-r-md rounded-l-none truncate focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
        darkMode
          ? 'text-gray-200 hover:bg-gray-600 hover:text-white focus:bg-gray-600 focus:text-white'
          : 'text-gray-800 hover:bg-gray-100 focus:bg-gray-200',
        normalizedValue && normalizedValue.toLowerCase() === font.toLowerCase()
          ? (darkMode ? 'bg-gray-600' : 'bg-gray-100')
          : ''
      )}
    >
      <span
        className="truncate"
        title={font}
        style={{
          fontFamily: getFontPreviewFamily(font),
          fontSynthesis: 'none',
        }}
      >
        {font}
      </span>
      {normalizedValue && normalizedValue.toLowerCase() === font.toLowerCase() && (
        <Check className="w-4 h-4 shrink-0" />
      )}
    </button>
  ), [darkMode, handleSelect, normalizedValue, handleFontItemKeyDown]);

  const getRowHeight = React.useCallback((index, { items }) => {
    const item = items[index];
    if (!item) return FONT_ROW_HEIGHT;
    switch (item.type) {
      case 'label':
        return LABEL_ROW_HEIGHT;
      case 'divider':
        return DIVIDER_ROW_HEIGHT;
      case 'helper':
      case 'empty':
        return HELPER_ROW_HEIGHT;
      case 'font':
      default:
        return FONT_ROW_HEIGHT;
    }
  }, []);

  const rowPropsData = React.useMemo(() => ({
    items: listItems,
    renderFontItem,
    labelClasses,
    helperTextClasses,
    darkMode
  }), [listItems, renderFontItem, labelClasses, helperTextClasses, darkMode]);

  const VirtualRow = React.useCallback(
    ({
      index,
      style,
      ariaAttributes,
      items,
      renderFontItem,
      labelClasses,
      helperTextClasses,
      darkMode
    }) => {
      const item = items[index];
      if (!item) return null;

      const rowStyle = { ...style, width: '100%' };

      switch (item.type) {
        case 'label':
          return (
            <div style={rowStyle} {...ariaAttributes}>
              <div className={cn(
                labelClasses,
                darkMode ? 'bg-gray-700 text-gray-400' : 'bg-white text-gray-500'
              )} style={{
                marginRight: `-${SCROLL_PADDING_PX}px`,
                width: `calc(100% + ${SCROLL_PADDING_PX}px)`
              }}>
                {item.text}
              </div>
            </div>
          );
        case 'divider':
          return (
            <div style={rowStyle} {...ariaAttributes} className="py-2">
              <div className={cn('h-px w-full', darkMode ? 'bg-gray-600/60' : 'bg-gray-200')} />
            </div>
          );
        case 'helper':
          return (
            <div style={rowStyle} {...ariaAttributes}>
              <div className={helperTextClasses}>{item.text}</div>
            </div>
          );
        case 'empty':
          return (
            <div style={rowStyle} {...ariaAttributes}>
              <div className={`px-3 py-2 text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {item.text}
              </div>
            </div>
          );
        case 'font':
        default:
          return (
            <div style={rowStyle} {...ariaAttributes}>
              {renderFontItem(item.font, index)}
            </div>
          );
      }
    },
    [labelClasses, helperTextClasses, darkMode, renderFontItem]
  );

  const [stickyLabel, setStickyLabel] = React.useState(listItems[0]?.type === 'label' ? listItems[0].text : '');

  const handleRowsRendered = React.useCallback(({ startIndex }) => {
    const start = typeof startIndex === 'number' ? startIndex : 0;
    let current = '';
    for (let i = start; i >= 0; i -= 1) {
      const item = listItems[i];
      if (item?.type === 'label') {
        current = item.text;
        break;
      }
    }
    setStickyLabel((prev) => (prev === current ? prev : current));
  }, [listItems]);

  React.useEffect(() => {
    const firstLabel = listItems.find((item) => item.type === 'label');
    setStickyLabel(firstLabel?.text || '');
  }, [listItems]);

  const containerClasses = containerClassName || 'relative flex-1 min-w-0';
  const panelStateClass = isMenuExiting || menuState === 'opening'
    ? 'translate-y-8 opacity-0 scale-95'
    : 'translate-y-0 opacity-100 scale-100';

  return (
    <div className={cn(containerClasses)} ref={containerRef}>
      <button
        type="button"
        onClick={handleToggleMenu}
        className={cn(
          'flex h-9 min-w-0 items-center justify-between whitespace-nowrap rounded-md border px-3 py-2 text-xs leading-5 shadow-sm',
          triggerClassName || 'w-full',
          darkMode
            ? 'border-gray-600 bg-gray-700 text-gray-200'
            : 'border-gray-300 bg-white text-gray-800'
        )}
        onKeyDown={handleMenuKeyDown}
        style={{ outline: 'none' }}
        ref={triggerRef}
      >
        <span className="min-w-0 flex-1 truncate text-left" title={value || placeholder}>{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>

      {isMenuVisible && createPortal(
        <div
          ref={menuRef}
          onKeyDown={handleMenuKeyDown}
          className={cn(
            'fixed z-[2100] rounded-md border shadow-lg transition-all duration-200 ease-out transform',
            panelStateClass,
            darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300 text-gray-800'
          )}
          style={{
            width: menuCoords?.width || triggerRef.current?.getBoundingClientRect()?.width || '100%',
            left: menuCoords?.left ?? triggerRef.current?.getBoundingClientRect()?.left ?? 0,
            top: menuCoords?.top ?? (triggerRef.current?.getBoundingClientRect()?.bottom ?? 0) + 6
          }}
        >
          <div className={cn(
            'p-3 pb-3 border-b rounded-t-md',
            darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
          )}>
            <div className="relative">
              <Search
                className={cn(
                  'pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2',
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                )}
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search fonts"
                onFocus={() => { activeFontIndexRef.current = null; }}
                className={cn(
                  'h-9 rounded-full pl-9 pr-9 text-xs shadow-none placeholder:text-xs focus-visible:outline-none focus-visible:ring-0',
                  darkMode
                    ? 'border-gray-600 bg-gray-800/85 text-white placeholder:text-gray-400 focus-visible:border-gray-300'
                    : 'border-gray-300 bg-gray-50 text-gray-800 placeholder:text-gray-500 focus-visible:border-gray-400'
                )}
                onKeyDown={handleSearchKeyDown}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className={cn(
                    'absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1',
                    darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'
                  )}
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <List
            className={cn(
              'max-h-80 overflow-y-auto pr-1 pb-2',
              darkMode
                ? 'scrollbar-thumb-gray-500 scrollbar-track-gray-700'
                : 'scrollbar-thumb-gray-500 scrollbar-track-gray-200',
              'scrollbar-thin'
            )}
            style={{
              maxHeight: `${DROPDOWN_MAX_HEIGHT}px`,
              scrollbarGutter: 'stable',
              width: '100%',
              overflowX: 'hidden'
            }}
            defaultHeight={DROPDOWN_MAX_HEIGHT}
            listRef={listRef}
            rowCount={listItems.length}
            rowHeight={getRowHeight}
            rowComponent={VirtualRow}
            rowProps={rowPropsData}
            onRowsRendered={handleRowsRendered}
          >
            {stickyLabel && (
              <div
                className={cn(
                  labelClasses,
                  'sticky top-0 z-20 pointer-events-none block w-full',
                  darkMode ? 'bg-gray-700 text-gray-400' : 'bg-white text-gray-500'
                )}
                style={{
                  left: 0,
                  right: `-${SCROLL_PADDING_PX}px`,
                  width: `calc(100% + ${SCROLL_PADDING_PX}px)`
                }}
                aria-hidden="true"
              >
                {stickyLabel}
              </div>
            )}
          </List>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FontSelect;
