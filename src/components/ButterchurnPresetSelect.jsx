import React from 'react';
import { createPortal } from 'react-dom';
import { List, useListRef } from 'react-window';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import {
  BUTTERCHURN_PRESET_GROUPS,
  BUTTERCHURN_PRESET_OPTIONS,
} from '../utils/butterchurnPresets.js';

const MENU_GAP = 6;
const VIEWPORT_PADDING = 8;
const MENU_MAX_HEIGHT = 420;
const LIST_MAX_HEIGHT = 340;
const PRESET_ROW_HEIGHT = 48;
const LABEL_ROW_HEIGHT = 30;
const EMPTY_ROW_HEIGHT = 80;
const SCROLL_PADDING_PX = 4;

export default function ButterchurnPresetSelect({
  value,
  onChange,
  darkMode = false,
  triggerClassName = '',
}) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [menuPosition, setMenuPosition] = React.useState(null);
  const [stickyLabel, setStickyLabel] = React.useState('');
  const triggerRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const searchInputRef = React.useRef(null);
  const activePresetIndexRef = React.useRef(null);
  const listRef = useListRef();
  const menuId = React.useId();

  const selectedOption = React.useMemo(
    () => BUTTERCHURN_PRESET_OPTIONS.find((option) => option.id === value),
    [value]
  );

  const filteredOptions = React.useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return BUTTERCHURN_PRESET_OPTIONS;

    const groupLabels = new Map(
      BUTTERCHURN_PRESET_GROUPS.map((group) => [group.id, group.label.toLowerCase()])
    );
    return BUTTERCHURN_PRESET_OPTIONS.filter((option) => (
      option.label.toLowerCase().includes(needle)
      || option.author.toLowerCase().includes(needle)
      || groupLabels.get(option.group)?.includes(needle)
    ));
  }, [searchTerm]);

  const listItems = React.useMemo(() => {
    const items = [];
    BUTTERCHURN_PRESET_GROUPS.forEach((group) => {
      const options = filteredOptions.filter((option) => option.group === group.id);
      if (options.length === 0) return;
      items.push({ type: 'label', text: group.label });
      options.forEach((option) => items.push({ type: 'preset', option }));
    });
    if (items.length === 0) {
      items.push({ type: 'empty', text: 'No presets match your search.' });
    }
    return items;
  }, [filteredOptions]);

  const listItemsRef = React.useRef(listItems);
  React.useEffect(() => {
    listItemsRef.current = listItems;
    const firstLabel = listItems.find((item) => item.type === 'label');
    setStickyLabel(firstLabel?.text || '');
  }, [listItems]);

  const computeMenuPosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const availableWidth = Math.max(240, window.innerWidth - (VIEWPORT_PADDING * 2));
    const width = Math.min(Math.max(rect.width, 380), availableWidth);
    const measuredHeight = menuRef.current?.offsetHeight || MENU_MAX_HEIGHT;
    const height = Math.min(measuredHeight, window.innerHeight - (VIEWPORT_PADDING * 2));
    const belowTop = rect.bottom + MENU_GAP;
    const aboveTop = rect.top - height - MENU_GAP;
    const top = belowTop + height <= window.innerHeight - VIEWPORT_PADDING
      ? belowTop
      : Math.max(VIEWPORT_PADDING, aboveTop);
    const preferredLeft = rect.right - width;
    const left = Math.max(
      VIEWPORT_PADDING,
      Math.min(preferredLeft, window.innerWidth - width - VIEWPORT_PADDING)
    );

    setMenuPosition((current) => {
      const next = { left, top, width };
      if (current?.left === left && current?.top === top && current?.width === width) return current;
      return next;
    });
  }, []);

  const closeMenu = React.useCallback(() => {
    setOpen(false);
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return undefined;

    const frame = requestAnimationFrame(computeMenuPosition);
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      closeMenu();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeMenu();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', computeMenuPosition);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', computeMenuPosition);
    };
  }, [closeMenu, computeMenuPosition, filteredOptions.length, open]);

  React.useEffect(() => {
    if (!open) {
      setSearchTerm('');
      activePresetIndexRef.current = null;
      return undefined;
    }
    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;

    const blockOutsideScroll = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const options = { passive: false, capture: true };
    window.addEventListener('wheel', blockOutsideScroll, options);
    window.addEventListener('touchmove', blockOutsideScroll, options);
    return () => {
      window.removeEventListener('wheel', blockOutsideScroll, options);
      window.removeEventListener('touchmove', blockOutsideScroll, options);
    };
  }, [open]);

  const selectOption = React.useCallback((optionId) => {
    onChange?.(optionId);
    closeMenu();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [closeMenu, onChange]);

  const findFirstPresetIndex = React.useCallback(() => (
    listItemsRef.current.findIndex((item) => item.type === 'preset')
  ), []);

  const findLastPresetIndex = React.useCallback(() => {
    for (let index = listItemsRef.current.length - 1; index >= 0; index -= 1) {
      if (listItemsRef.current[index]?.type === 'preset') return index;
    }
    return -1;
  }, []);

  const focusPresetAtIndex = React.useCallback((index) => {
    if (listItemsRef.current[index]?.type !== 'preset') return;
    activePresetIndexRef.current = index;
    listRef.current?.scrollToRow?.({ index, align: 'auto' });
    requestAnimationFrame(() => {
      menuRef.current?.querySelector(`[data-preset-index="${index}"]`)?.focus();
    });
  }, [listRef]);

  const getNextPresetIndex = React.useCallback((currentIndex, direction) => {
    let index = currentIndex + direction;
    while (index >= 0 && index < listItemsRef.current.length) {
      if (listItemsRef.current[index]?.type === 'preset') return index;
      index += direction;
    }
    return -1;
  }, []);

  const stopNavigationEvent = React.useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
  }, []);

  const handlePresetKeyDown = React.useCallback((event, index) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    stopNavigationEvent(event);
    const nextIndex = getNextPresetIndex(index, event.key === 'ArrowDown' ? 1 : -1);
    if (nextIndex >= 0) {
      focusPresetAtIndex(nextIndex);
    } else {
      searchInputRef.current?.focus();
      activePresetIndexRef.current = null;
    }
  }, [focusPresetAtIndex, getNextPresetIndex, stopNavigationEvent]);

  const handleSearchKeyDown = React.useCallback((event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Escape') {
      stopNavigationEvent(event);
    } else {
      event.stopPropagation();
    }

    if (event.key === 'Escape') {
      closeMenu();
      requestAnimationFrame(() => triggerRef.current?.focus());
      return;
    }
    if (event.key === 'ArrowDown') {
      const index = findFirstPresetIndex();
      if (index >= 0) focusPresetAtIndex(index);
      return;
    }
    if (event.key === 'ArrowUp') {
      const index = findLastPresetIndex();
      if (index >= 0) focusPresetAtIndex(index);
    }
  }, [closeMenu, findFirstPresetIndex, findLastPresetIndex, focusPresetAtIndex, stopNavigationEvent]);

  const renderPreset = React.useCallback((option, index) => {
    const selected = option.id === value;
    return (
      <button
        type="button"
        role="option"
        aria-selected={selected}
        data-preset-index={index}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          selectOption(option.id);
        }}
        onClick={(event) => {
          if (event.detail === 0) selectOption(option.id);
        }}
        onKeyDown={(event) => handlePresetKeyDown(event, index)}
        onFocus={() => { activePresetIndexRef.current = index; }}
        className={cn(
          'mx-1 flex h-11 w-[calc(100%-0.5rem)] items-center gap-3 rounded-xl px-3 text-left text-xs outline-none',
          darkMode
            ? 'text-gray-100 hover:bg-gray-600 focus:bg-gray-600'
            : 'text-gray-900 hover:bg-gray-100 focus:bg-gray-100',
          selected && (darkMode ? 'bg-gray-600/70' : 'bg-gray-100')
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{option.label}</span>
          <span className={cn('block truncate text-[11px]', darkMode ? 'text-gray-400' : 'text-gray-500')}>
            {option.author}
          </span>
        </span>
        {selected && <Check className="h-4 w-4 shrink-0" />}
      </button>
    );
  }, [darkMode, handlePresetKeyDown, selectOption, value]);

  const getRowHeight = React.useCallback((index, { items }) => {
    switch (items[index]?.type) {
      case 'label':
        return LABEL_ROW_HEIGHT;
      case 'empty':
        return EMPTY_ROW_HEIGHT;
      case 'preset':
      default:
        return PRESET_ROW_HEIGHT;
    }
  }, []);

  const labelClassName = cn(
    'flex h-[30px] items-center px-3 text-[10px] font-semibold uppercase tracking-wide',
    darkMode ? 'bg-gray-700 text-gray-400' : 'bg-white text-gray-500'
  );

  const VirtualRow = React.useCallback(({
    index,
    style,
    ariaAttributes,
    items,
    renderPreset: renderPresetItem,
    labelClasses,
    isDark,
  }) => {
    const item = items[index];
    if (!item) return null;
    const rowStyle = { ...style, width: '100%' };

    if (item.type === 'label') {
      return (
        <div style={rowStyle} {...ariaAttributes}>
          <div
            className={labelClasses}
            style={{
              marginRight: `-${SCROLL_PADDING_PX}px`,
              width: `calc(100% + ${SCROLL_PADDING_PX}px)`,
            }}
          >
            {item.text}
          </div>
        </div>
      );
    }
    if (item.type === 'empty') {
      return (
        <div style={rowStyle} {...ariaAttributes}>
          <div className={cn('px-3 py-8 text-center text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {item.text}
          </div>
        </div>
      );
    }
    return (
      <div style={rowStyle} {...ariaAttributes}>
        {renderPresetItem(item.option, index)}
      </div>
    );
  }, []);

  const rowProps = React.useMemo(() => ({
    items: listItems,
    renderPreset,
    labelClasses: labelClassName,
    isDark: darkMode,
  }), [darkMode, labelClassName, listItems, renderPreset]);

  const handleRowsRendered = React.useCallback(({ startIndex }) => {
    let currentLabel = '';
    for (let index = startIndex ?? 0; index >= 0; index -= 1) {
      if (listItems[index]?.type === 'label') {
        currentLabel = listItems[index].text;
        break;
      }
    }
    setStickyLabel((current) => (current === currentLabel ? current : currentLabel));
  }, [listItems]);

  return (
    <div className="min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          setOpen(true);
        }}
        className={cn(
          'flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs shadow-sm',
          darkMode
            ? 'border-gray-600 bg-gray-700 text-gray-100'
            : 'border-gray-300 bg-white text-gray-900',
          triggerClassName
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {selectedOption ? `${selectedOption.label} - ${selectedOption.author}` : 'Select preset'}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-60 transition-transform', open && 'rotate-180')} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className={cn(
            'fixed z-[2100] overflow-hidden rounded-2xl border shadow-xl',
            darkMode
              ? 'border-gray-600 bg-gray-700 text-gray-100'
              : 'border-gray-300 bg-white text-gray-900'
          )}
          style={{
            left: menuPosition?.left ?? 0,
            top: menuPosition?.top ?? 0,
            width: menuPosition?.width ?? triggerRef.current?.getBoundingClientRect().width ?? 380,
            visibility: menuPosition ? 'visible' : 'hidden',
          }}
        >
          <div className={cn('border-b p-3', darkMode ? 'border-gray-600' : 'border-gray-200')}>
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
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search presets, creators, or groups"
                aria-label="Search visualizer presets"
                className={cn(
                  'h-9 rounded-full pl-9 pr-9 text-xs shadow-none focus-visible:ring-0',
                  darkMode
                    ? 'border-gray-600 bg-gray-800 text-white placeholder:text-gray-400'
                    : 'border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-500'
                )}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear preset search"
                  className={cn(
                    'absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1',
                    darkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-200'
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <List
            id={menuId}
            role="listbox"
            aria-label="Butterchurn presets"
            className={cn(
              'max-h-[340px] overflow-y-auto pr-1 pb-1 scrollbar-thin',
              darkMode
                ? 'scrollbar-thumb-gray-500 scrollbar-track-gray-700'
                : 'scrollbar-thumb-gray-500 scrollbar-track-gray-200'
            )}
            style={{
              maxHeight: `${LIST_MAX_HEIGHT}px`,
              scrollbarGutter: 'stable',
              width: '100%',
              overflowX: 'hidden',
            }}
            defaultHeight={LIST_MAX_HEIGHT}
            listRef={listRef}
            rowCount={listItems.length}
            rowHeight={getRowHeight}
            rowComponent={VirtualRow}
            rowProps={rowProps}
            onRowsRendered={handleRowsRendered}
          >
            {stickyLabel && (
              <div
                className={cn(labelClassName, 'sticky top-0 z-20 w-full pointer-events-none')}
                style={{
                  left: 0,
                  right: `-${SCROLL_PADDING_PX}px`,
                  width: `calc(100% + ${SCROLL_PADDING_PX}px)`,
                  isolation: 'isolate',
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
}
