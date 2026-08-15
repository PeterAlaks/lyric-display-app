import React, { useEffect, useRef } from 'react';
import { Info, X } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

const TutorialPopover = ({
  open,
  onOpenChange,
  title,
  children,
  darkMode = false,
  onNeverShowAgain,
  autoCloseMs = 6000,
  side = 'right',
  align = 'center',
  sideOffset = 10,
  anchor,
  icon,
}) => {
  const contentRef = useRef(null);
  const Icon = icon || Info;

  useEffect(() => {
    if (!open || !autoCloseMs) return undefined;

    const timeoutId = window.setTimeout(() => {
      onOpenChange?.(false);
    }, autoCloseMs);

    return () => window.clearTimeout(timeoutId);
  }, [autoCloseMs, onOpenChange, open]);

  useEffect(() => {
    if (!open) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const canScrollWithinPopover = (target, deltaY = 0) => {
      if (!contentRef.current || !target || !contentRef.current.contains(target)) {
        return false;
      }

      let node = target;
      while (node && node !== contentRef.current.parentElement) {
        if (node instanceof HTMLElement) {
          const style = window.getComputedStyle(node);
          const overflowY = style.overflowY;
          const isScrollable = ['auto', 'scroll'].includes(overflowY) && node.scrollHeight > node.clientHeight;

          if (isScrollable) {
            if (deltaY === 0) return true;
            const atTop = node.scrollTop <= 0;
            const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
            if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
              return true;
            }
          }
        }
        node = node.parentElement;
      }

      return false;
    };

    const preventScroll = (event) => {
      if (canScrollWithinPopover(event.target, event.deltaY || 0)) return;
      event.preventDefault();
    };

    const preventScrollKeys = (event) => {
      const scrollKeys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '];
      if (!scrollKeys.includes(event.key)) return;

      const target = event.target;
      const tag = target?.tagName;
      const isInputLike = target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (isInputLike) return;
      if (contentRef.current?.contains(target)) return;

      event.preventDefault();
    };

    window.addEventListener('wheel', preventScroll, { passive: false, capture: true });
    window.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
    window.addEventListener('keydown', preventScrollKeys, { capture: true });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener('wheel', preventScroll, { capture: true });
      window.removeEventListener('touchmove', preventScroll, { capture: true });
      window.removeEventListener('keydown', preventScrollKeys, { capture: true });
    };
  }, [open]);

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal>
      {anchor && <PopoverAnchor asChild>{anchor}</PopoverAnchor>}
      <PopoverContent
        ref={contentRef}
        side={side}
        align={align}
        sideOffset={sideOffset}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className={`w-80 rounded-xl p-4 text-sm shadow-lg ${darkMode
          ? 'bg-gray-900 border-gray-700 text-gray-100'
          : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${darkMode
                ? 'bg-blue-500/15 text-blue-300'
                : 'bg-blue-50 text-blue-700'
                }`}>
                <Icon className="h-4 w-4" />
              </div>
              {title && <div className="font-semibold leading-tight pr-2">{title}</div>}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange?.(false)}
              className={`-mt-1 -mr-1 rounded-md p-1 transition-colors ${darkMode
                ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              aria-label="Close tutorial popover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={`text-xs leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{children}</div>
          {onNeverShowAgain && (
            <button
              type="button"
              onClick={onNeverShowAgain}
              className={`text-xs font-medium underline-offset-2 hover:underline ${darkMode ? 'text-blue-300' : 'text-blue-700'
                }`}
            >
              Never show again
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TutorialPopover;
