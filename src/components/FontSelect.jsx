import React from 'react';
import { createPortal } from 'react-dom';
import { Input } from "@/components/ui/input";
import { ChevronDown, Check } from 'lucide-react';
import { FEATURED_FONTS } from '../constants/fonts';
import { logWarn } from '../utils/logger';
import { cn } from '@/lib/utils';

const normalizeFontName = (font) => (typeof font === 'string' ? font.replace(/["']/g, '').trim() : '');

const sortAndDeduplicate = (fonts) => Array.from(
  new Set(
    (fonts || [])
      .map(normalizeFontName)
      .filter(Boolean)
  )
).sort((a, b) => a.localeCompare(b));

let cachedSystemFonts = null;
let cachedSystemFontPromise = null;

const loadSystemFonts = async () => {
  if (cachedSystemFonts) return cachedSystemFonts;
  if (cachedSystemFontPromise) return cachedSystemFontPromise;

  if (typeof window === 'undefined' || !window.electronAPI?.getSystemFonts) {
    cachedSystemFonts = [];
    return cachedSystemFonts;
  }

  cachedSystemFontPromise = window.electronAPI.getSystemFonts()
    .then((result) => {
      const fontsPayload = Array.isArray(result) ? result : result?.fonts;
      cachedSystemFonts = sortAndDeduplicate(fontsPayload);
      return cachedSystemFonts;
    })
    .catch((error) => {
      logWarn('Failed to fetch system fonts', error?.message || error);
      cachedSystemFonts = [];
      return cachedSystemFonts;
    })
    .finally(() => {
      cachedSystemFontPromise = null;
    });

  return cachedSystemFontPromise;
};

const FontSelect = ({ value, onChange, darkMode, placeholder = 'Select font' }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [installedFonts, setInstalledFonts] = React.useState([]);
  const [loadingFonts, setLoadingFonts] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const searchInputRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const [menuCoords, setMenuCoords] = React.useState(null);

  const isDesktopApp = typeof window !== 'undefined' && Boolean(window.electronAPI?.getSystemFonts);

  const featuredFonts = React.useMemo(() => FEATURED_FONTS, []);
  const featuredFontsSet = React.useMemo(
    () => new Set(featuredFonts.map((font) => normalizeFontName(font).toLowerCase())),
    [featuredFonts]
  );
  const normalizedValue = normalizeFontName(value);

  React.useEffect(() => {
    if (!isDesktopApp) return undefined;

    let mounted = true;
    setLoadingFonts(true);

    loadSystemFonts()
      .then((fonts) => {
        if (mounted) setInstalledFonts(fonts || []);
      })
      .catch(() => {
        if (mounted) setInstalledFonts([]);
      })
      .finally(() => {
        if (mounted) setLoadingFonts(false);
      });

    return () => { mounted = false; };
  }, [isDesktopApp]);

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

  const visibleFeaturedFonts = filterFonts(featuredFonts);
  const visibleInstalledFonts = filterFonts(installedOnly);

  React.useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;

    const computePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const triggerWidth = rect.width;
      const dropdownWidth = Math.max(triggerWidth, 320);
      const menuHeight = menuRef.current?.offsetHeight || 320;
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
    };

    const raf = requestAnimationFrame(computePosition);

    const handleClickOutside = (event) => {
      if (menuRef.current && menuRef.current.contains(event.target)) return;
      if (containerRef.current && containerRef.current.contains(event.target)) return;
      setOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', computePosition);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', computePosition);
    };
  }, [open]);

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const triggerWidth = rect.width;
    const dropdownWidth = Math.max(triggerWidth, 320);
    const menuHeight = menuRef.current.offsetHeight || 0;
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
  }, [open, visibleFeaturedFonts, visibleInstalledFonts, loadingFonts]);

  React.useEffect(() => {
    if (!open) {
      setSearchTerm('');
    }
  }, [open]);

  const handleSelect = (font) => {
    onChange(font);
    setOpen(false);
  };

  const renderEmptyState = (text) => (
    <div className={`px-3 py-2 text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{text}</div>
  );

  const renderFontItem = (font) => (
    <button
      key={font}
      type="button"
      onClick={() => handleSelect(font)}
      style={{ fontFamily: font }}
      className={cn(
        'w-full text-left flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md transition-colors truncate',
        darkMode
          ? 'text-gray-200 hover:bg-gray-600 focus:bg-gray-600'
          : 'text-gray-800 hover:bg-gray-100 focus:bg-gray-200',
        normalizedValue && normalizedValue.toLowerCase() === font.toLowerCase()
          ? (darkMode ? 'bg-gray-600' : 'bg-gray-100')
          : ''
      )}
    >
      <span className="truncate" title={font}>{font}</span>
      {normalizedValue && normalizedValue.toLowerCase() === font.toLowerCase() && (
        <Check className="w-4 h-4 flex-shrink-0" />
      )}
    </button>
  );

  const labelClasses = `px-3 pt-3 pb-2 text-[11px] font-semibold tracking-wide uppercase ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;
  const helperTextClasses = `px-3 pb-2 text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;

  return (
    <div className="relative flex-1 min-w-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-9 items-center justify-between whitespace-nowrap rounded-md border px-3 py-2 text-sm shadow-sm w-full truncate',
          darkMode
            ? 'border-gray-600 bg-gray-700 text-gray-200'
            : 'border-gray-300 bg-white text-gray-800'
        )}
        ref={triggerRef}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className={cn(
            'fixed z-[2100] rounded-md border shadow-lg',
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
              <Input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search fonts"
                className={cn(
                  'h-9 pr-9 text-sm placeholder:text-sm focus-visible:ring-1 focus-visible:border-gray-400 focus-visible:ring-gray-400',
                  darkMode
                    ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus-visible:border-gray-300 focus-visible:ring-gray-300/70'
                    : 'bg-white border-gray-300 text-gray-800 placeholder:text-gray-500'
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setOpen(false);
                  }
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className={cn(
                    'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded',
                    darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'
                  )}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div
            className={cn(
              'max-h-80 overflow-y-auto pr-1 pb-2',
              darkMode
                ? 'scrollbar-thumb-gray-500 scrollbar-track-gray-700'
                : 'scrollbar-thumb-gray-500 scrollbar-track-gray-200',
              'scrollbar-thin'
            )}
            style={{ scrollbarGutter: 'stable' }}
          >
            <div className={cn(
              labelClasses,
              'sticky top-0 z-10',
              darkMode ? 'bg-gray-700 text-gray-400' : 'bg-white text-gray-500'
            )}>Featured Fonts</div>
            {visibleFeaturedFonts.length
              ? visibleFeaturedFonts.map(renderFontItem)
              : renderEmptyState('No matching featured fonts')}

            <div className={cn('my-2 h-px', darkMode ? 'bg-gray-600/60' : 'bg-gray-200')} />

            <div className={cn(
              labelClasses,
              'sticky top-0 z-10',
              darkMode ? 'bg-gray-700 text-gray-400' : 'bg-white text-gray-500'
            )}>Installed Fonts</div>
            {!isDesktopApp && <div className={helperTextClasses}>System fonts are available in the desktop app</div>}
            {isDesktopApp && loadingFonts && <div className={helperTextClasses}>Loading installed fonts...</div>}
            {isDesktopApp && !loadingFonts && (
              visibleInstalledFonts.length
                ? visibleInstalledFonts.map(renderFontItem)
                : renderEmptyState('No installed fonts found')
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FontSelect;