import React, { forwardRef, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';

const mergeRefs = (refs) => (node) => {
  refs.forEach((ref) => {
    if (!ref) return;
    if (typeof ref === 'function') {
      ref(node);
    } else {
      ref.current = node;
    }
  });
};

export const ContextMenu = forwardRef(function ContextMenu(
  {
    visible,
    position,
    darkMode,
    positioning = 'absolute',
    className = '',
    style,
    children,
    onMeasured,
    ...rest
  },
  forwardedRef
) {
  const internalRef = useRef(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible || !internalRef.current || typeof onMeasured !== 'function') return;

    const element = internalRef.current;
    const handleMeasure = () => {
      const rect = element.getBoundingClientRect();
      const next = { width: rect.width, height: rect.height };
      const prev = lastSizeRef.current;
      if (next.width !== prev.width || next.height !== prev.height) {
        lastSizeRef.current = next;
        onMeasured(next);
      }
    };

    handleMeasure();
    const resizeObserver = new ResizeObserver(handleMeasure);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [visible, onMeasured]);

  if (!visible || !position) return null;

  return (
    <div
      ref={mergeRefs([forwardedRef, internalRef])}
      className={clsx(
        'pointer-events-auto z-30 rounded-lg border py-1 text-[13px] shadow-lg',
        darkMode ? 'bg-gray-800 text-gray-100 border-gray-700' : 'bg-white text-gray-800 border-gray-200',
        className
      )}
      style={{ top: position.top, left: position.left, position: positioning, ...style }}
      role="menu"
      {...rest}
    >
      {children}
    </div>
  );
});

export const ContextMenuItem = forwardRef(function ContextMenuItem(
  {
    children,
    inset = false,
    disabled = false,
    className = '',
    destructive = false,
    icon = null,
    darkMode,
    ...rest
  },
  forwardedRef
) {
  return (
    <button
      ref={forwardedRef}
      type="button"
      className={clsx(
        'flex w-full items-center px-4 py-2.5 text-left transition-colors duration-150',
        inset && 'pl-9',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : darkMode
            ? 'hover:bg-gray-700 focus-visible:bg-gray-700'
            : 'hover:bg-gray-100 focus-visible:bg-gray-100',
        destructive && 'text-red-600',
        className
      )}
      disabled={disabled}
      role="menuitem"
      {...rest}
    >
      {icon && <span className="mr-2 inline-flex items-center">{icon}</span>}
      {children}
    </button>
  );
});

export const ContextMenuSeparator = ({ className = '', darkMode }) => (
  <div className={clsx('my-1 h-px', darkMode ? 'bg-gray-700' : 'bg-gray-200', className)} role="separator" />
);

export const ContextMenuLabel = ({ children, className = '', darkMode }) => (
  <div
    className={clsx(
      'px-3 py-2 text-xs font-semibold uppercase tracking-wide',
      darkMode ? 'text-gray-300' : 'text-gray-600',
      className
    )}
  >
    {children}
  </div>
);

export const ContextMenuSubmenu = forwardRef(function ContextMenuSubmenu(
  {
    open,
    direction = 'right',
    offsetTop = 0,
    maxHeight,
    darkMode,
    className = '',
    style,
    children,
    ...rest
  },
  forwardedRef
) {
  if (!open) return null;
  return (
    <div
      ref={forwardedRef}
      className={clsx(
        'absolute z-40 w-48 rounded-lg border py-1 text-[13px] shadow-lg overflow-y-auto',
        direction === 'right' ? 'left-[calc(100%+8px)]' : 'right-[calc(100%+8px)]',
        darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-800',
        className
      )}
      style={{ top: offsetTop, maxHeight, ...style }}
      role="menu"
      {...rest}
    >
      {children}
    </div>
  );
});

export default {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuSubmenu
};