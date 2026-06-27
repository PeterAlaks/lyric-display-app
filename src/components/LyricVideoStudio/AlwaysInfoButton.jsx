import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

export default function AlwaysInfoButton({
  content,
  ariaLabel = 'Information',
  side = 'left',
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  const closeTimerRef = useRef(null);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = contentRef.current?.offsetWidth || 280;
    const height = contentRef.current?.offsetHeight || 72;
    const gap = 8;
    const padding = 8;

    let x = rect.left + rect.width / 2 - width / 2;
    let y = rect.bottom + gap;

    if (side === 'left') {
      x = rect.left - width - gap;
      y = rect.top + rect.height / 2 - height / 2;
    } else if (side === 'right') {
      x = rect.right + gap;
      y = rect.top + rect.height / 2 - height / 2;
    } else if (side === 'top') {
      x = rect.left + rect.width / 2 - width / 2;
      y = rect.top - height - gap;
    }

    setPosition({
      x: Math.max(padding, Math.min(x, window.innerWidth - width - padding)),
      y: Math.max(padding, Math.min(y, window.innerHeight - height - padding)),
    });
  };

  const show = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updatePosition();
    setOpen(true);
    requestAnimationFrame(updatePosition);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
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
  }, [open]);

  const popover = open && typeof document !== 'undefined' ? createPortal(
    <div
      ref={contentRef}
      role="tooltip"
      className="fixed z-[9999] max-w-[280px] rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs leading-relaxed text-gray-100 shadow-lg dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
      style={{ left: position.x, top: position.y }}
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
