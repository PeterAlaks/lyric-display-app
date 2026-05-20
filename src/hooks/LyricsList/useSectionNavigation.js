import { useCallback, useEffect, useRef } from 'react';
import { VIRTUALIZATION_THRESHOLD } from '../../components/LyricsList/layout';

export default function useSectionNavigation({
  listRef,
  useVirtualized,
  lyricsLength,
  onLineSelect,
}) {
  const sectionChipsContainerRef = useRef(null);
  const sectionChipsScrollerRef = useRef(null);

  const scrollToLineIndex = useCallback((lineIndex) => {
    if (lineIndex == null) return;

    if (useVirtualized) {
      if (listRef.current) {
        listRef.current.scrollToRow({
          index: lineIndex,
          align: 'center',
          behavior: 'smooth'
        });
      }
    } else {
      setTimeout(() => {
        const target = document.querySelector(`[data-line-index="${lineIndex}"]`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 10);
    }
  }, [listRef, useVirtualized]);

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
      const { lineIndex } = event.detail;
      if (lineIndex == null) return;

      if (lyricsLength > VIRTUALIZATION_THRESHOLD) {
        if (listRef.current) {
          listRef.current.scrollToRow({
            index: lineIndex,
            align: 'center',
            behavior: 'smooth'
          });
        }
      } else {
        setTimeout(() => {
          const target = document.querySelector(`[data-line-index="${lineIndex}"]`);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
    };

    window.addEventListener('scroll-to-lyric-line', handleScrollToLine);
    return () => window.removeEventListener('scroll-to-lyric-line', handleScrollToLine);
  }, [listRef, lyricsLength]);

  return {
    sectionChipsContainerRef,
    sectionChipsScrollerRef,
    handleSectionJump,
  };
}
