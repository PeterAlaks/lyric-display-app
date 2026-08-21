import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { getTooltipPosition } from '@/utils/tooltipPosition';

export default function AlwaysInfoButton({
  content,
  ariaLabel = 'Information',
  side = 'left',
  sideOffset = 8,
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  const closeTimerRef = useRef(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = contentRef.current;
    if (!trigger || !tooltip) return;

    const rect = trigger.getBoundingClientRect();
    const nextPosition = getTooltipPosition({
      anchorRect: rect,
      tooltipWidth: tooltip.offsetWidth,
      tooltipHeight: tooltip.offsetHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      preferred: side,
      gap: sideOffset,
    });

    setPosition({
      x: nextPosition.left,
      y: nextPosition.top,
      placement: nextPosition.placement,
    });
  }, [side, sideOffset]);

  const show = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (!open) {
      setPosition(null);
      setOpen(true);
    }
  };

  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setPosition(null);
      setOpen(false);
      closeTimerRef.current = null;
    }, 120);
  };

  useEffect(() => {
    if (!open) return undefined;

    const handleOutsidePointer = (event) => {
      if (triggerRef.current?.contains(event.target) || contentRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleScroll = () => {
      setPosition(null);
      setOpen(false);
    };

    document.addEventListener('pointerdown', handleOutsidePointer);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      document.removeEventListener('pointerdown', handleOutsidePointer);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    if (!open || !contentRef.current) return undefined;

    updatePosition();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updatePosition);
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [content, open, updatePosition]);

  const popover = open && typeof document !== 'undefined' ? createPortal(
    <div
      ref={contentRef}
      role="tooltip"
      data-side={position?.placement || side}
      className={`fixed z-[9999] max-w-[280px] rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs leading-relaxed text-gray-100 shadow-lg dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 ${position ? 'tooltip-opacity-fade' : ''}`}
      style={{
        left: position?.x || 0,
        top: position?.y || 0,
        maxWidth: 'min(280px, calc(100vw - 16px))',
        maxHeight: 'calc(100vh - 16px)',
        overflowY: 'auto',
        visibility: position ? 'visible' : 'hidden',
      }}
      onMouseEnter={show}
      onMouseLeave={scheduleClose}
    >
      {content}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        aria-label={ariaLabel}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={show}
        onBlur={scheduleClose}
        onClick={() => {
          if (open) {
            setPosition(null);
            setOpen(false);
          } else {
            show();
          }
        }}
      >
        <Info className="h-4 w-4" />
      </button>
      {popover}
    </>
  );
}
