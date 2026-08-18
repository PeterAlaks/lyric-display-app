import { useCallback, useEffect, useRef } from 'react';

export default function useHorizontalWheelScroll() {
  const scrollerRef = useRef(null);
  const wheelCleanupRef = useRef(null);

  const handleWheel = useCallback((event) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    if (maxScrollLeft <= 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const wheelDelta = event.deltaX + event.deltaY;
    if (wheelDelta === 0) return;

    scroller.scrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, scroller.scrollLeft + wheelDelta)
    );
  }, []);

  const containerRef = useCallback((container) => {
    wheelCleanupRef.current?.();
    wheelCleanupRef.current = null;
    if (!container) return;

    const handleNativeWheel = (event) => handleWheel(event);
    container.addEventListener('wheel', handleNativeWheel, { passive: false, capture: true });

    wheelCleanupRef.current = () => {
      container.removeEventListener('wheel', handleNativeWheel, { capture: true });
    };
  }, [handleWheel]);

  useEffect(() => () => {
    wheelCleanupRef.current?.();
    wheelCleanupRef.current = null;
  }, []);

  return { containerRef, scrollerRef };
}
