import { useCallback, useEffect, useRef } from 'react';

function getNearestScrollableAncestor(element) {
  let node = element?.parentElement;

  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const canScrollY = /(auto|scroll)/.test(style.overflowY || '');
    if (canScrollY && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }

  return document.scrollingElement || document.documentElement;
}

function centerElementInScroller(element, behavior = 'auto') {
  if (!element) return;

  const scroller = getNearestScrollableAncestor(element);
  if (!scroller) {
    element.scrollIntoView({ block: 'center', behavior });
    return;
  }

  const elementRect = element.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const targetTop = scroller.scrollTop
    + (elementRect.top - scrollerRect.top)
    - ((scroller.clientHeight - elementRect.height) / 2);
  const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const nextTop = Math.max(0, Math.min(maxTop, targetTop));

  if (Math.abs(scroller.scrollTop - nextTop) <= 2) return;
  scroller.scrollTo({ top: nextTop, behavior });
}

export default function useSectionNavigation({
  listRef,
  useVirtualized,
  onLineSelect,
}) {
  const sectionChipsContainerRef = useRef(null);
  const sectionChipsScrollerRef = useRef(null);

  const scrollToVirtualizedLine = useCallback((lineIndex, behavior = 'smooth') => {
    if (!listRef.current) return;

    const scroll = (nextBehavior) => {
      listRef.current?.scrollToRow({
        index: lineIndex,
        align: 'center',
        behavior: nextBehavior
      });
    };

    scroll(behavior);
    requestAnimationFrame(() => scroll('auto'));
    window.setTimeout(() => scroll('auto'), 140);
  }, [listRef]);

  const scrollToNormalLine = useCallback((lineIndex, behavior = 'smooth') => {
    const scroll = (nextBehavior) => {
      const target = document.querySelector(`[data-line-index="${lineIndex}"]`);
      centerElementInScroller(target, nextBehavior);
    };

    requestAnimationFrame(() => scroll(behavior));
    requestAnimationFrame(() => requestAnimationFrame(() => scroll('auto')));
    window.setTimeout(() => scroll('auto'), 140);
  }, []);

  const scrollToLineIndex = useCallback((lineIndex, behavior = 'smooth') => {
    if (lineIndex == null) return;

    if (useVirtualized) {
      scrollToVirtualizedLine(lineIndex, behavior);
    } else {
      scrollToNormalLine(lineIndex, behavior);
    }
  }, [scrollToNormalLine, scrollToVirtualizedLine, useVirtualized]);

  const handleSectionJump = useCallback((section) => {
    if (!section || !Number.isInteger(section.startLine)) return;
    onLineSelect(section.startLine);
    scrollToLineIndex(section.startLine);
  }, [onLineSelect, scrollToLineIndex]);

  const handleSectionChipsWheel = useCallback((event) => {
    const scroller = sectionChipsScrollerRef.current;
    if (!scroller) return;

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    if (maxScrollLeft <= 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const wheelDelta = event.deltaX + event.deltaY;
    if (wheelDelta === 0) return;

    const nextScrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, scroller.scrollLeft + wheelDelta)
    );
    scroller.scrollLeft = nextScrollLeft;
  }, []);

  useEffect(() => {
    const container = sectionChipsContainerRef.current;
    const scroller = sectionChipsScrollerRef.current;
    if (!container || !scroller) return;

    const handleNativeWheel = (event) => handleSectionChipsWheel(event);
    container.addEventListener('wheel', handleNativeWheel, { passive: false, capture: true });

    return () => {
      container.removeEventListener('wheel', handleNativeWheel, { capture: true });
    };
  }, [handleSectionChipsWheel]);

  useEffect(() => {
    const handleScrollToLine = (event) => {
      const { lineIndex, behavior = 'smooth' } = event.detail;
      if (lineIndex == null) return;

      if (useVirtualized) {
        scrollToVirtualizedLine(lineIndex, behavior);
      } else {
        scrollToNormalLine(lineIndex, behavior);
      }
    };

    window.addEventListener('scroll-to-lyric-line', handleScrollToLine);
    return () => window.removeEventListener('scroll-to-lyric-line', handleScrollToLine);
  }, [scrollToNormalLine, scrollToVirtualizedLine, useVirtualized]);

  return {
    sectionChipsContainerRef,
    sectionChipsScrollerRef,
    handleSectionJump,
  };
}
