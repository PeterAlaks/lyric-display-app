import React, { useEffect, useRef } from 'react';
import { formatTimestamp } from '../../utils/timestampHelpers';
import { getKaraokeLineDisplayText } from '../../utils/karaokeLineText';

const TOP_VISIBILITY_INSET_PX = 18;

export default function KaraokeTimeline({
  lyrics,
  timestamps,
  activeIndex,
  onSelectTime,
}) {
  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const activeRowRef = useRef(null);

  useEffect(() => {
    if (activeIndex === null || activeIndex === undefined || !activeRowRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const row = activeRowRef.current;
    const headerHeight = headerRef.current?.offsetHeight || 0;
    const topInset = headerHeight + TOP_VISIBILITY_INSET_PX;
    const visibleTop = container.scrollTop + topInset;
    const visibleBottom = container.scrollTop + container.clientHeight;
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;

    if (rowTop >= visibleTop && rowBottom <= visibleBottom) {
      return;
    }

    container.scrollTo({
      top: Math.max(0, rowTop - topInset),
      behavior: 'smooth',
    });
  }, [activeIndex]);

  if (!Array.isArray(lyrics) || lyrics.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-500 dark:text-gray-400">
        No timed lyrics loaded.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto scroll-smooth">
      <div ref={headerRef} className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        Lyrics Timeline
      </div>
      <div className="divide-y divide-gray-100 pb-8 dark:divide-gray-800">
        {lyrics.map((line, index) => {
          const timestamp = timestamps?.[index];
          const hasTimestamp = typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= 0;
          const isActive = index === activeIndex;
          const text = getKaraokeLineDisplayText(line) || '(blank)';

          return (
            <button
              key={`${index}-${timestamp ?? 'untimed'}`}
              ref={isActive ? activeRowRef : null}
              type="button"
              className={`grid w-full grid-cols-[72px_1fr] gap-3 px-4 py-3 text-left text-sm transition-colors ${isActive
                ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-50'
                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800'
                }`}
              onClick={() => hasTimestamp && onSelectTime?.(timestamp * 10)}
              disabled={!hasTimestamp}
            >
              <span className={`font-mono text-xs ${hasTimestamp ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}>
                {hasTimestamp ? formatTimestamp(timestamp) : '--:--'}
              </span>
              <span className="line-clamp-2 whitespace-pre-wrap break-words">{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
