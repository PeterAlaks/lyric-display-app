import React, { useEffect, useRef } from 'react';
import { formatTimestamp } from '../../utils/timestampHelpers';
import { getLyricVideoLineDisplayText } from '../../utils/lyricVideoLineText';

export default function LyricVideoTimeline({
  lyrics,
  timestamps,
  activeIndex,
  onSelectTime,
}) {
  const listRef = useRef(null);
  const activeRowRef = useRef(null);

  useEffect(() => {
    if (activeIndex === null || activeIndex === undefined || !activeRowRef.current || !listRef.current) {
      return;
    }

    const container = listRef.current;
    const row = activeRowRef.current;
    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const rowTopInViewport = rowRect.top - containerRect.top;
    const rowBottomInViewport = rowRect.bottom - containerRect.top;
    const rowTopInScrollContent = rowTopInViewport + container.scrollTop;
    const isFullyVisible = rowTopInViewport >= 0 && rowBottomInViewport <= container.clientHeight;

    if (isFullyVisible) {
      return;
    }

    container.scrollTo({
      top: Math.max(0, rowTopInScrollContent),
      behavior: 'smooth',
    });
  }, [activeIndex]);

  const hasLyrics = Array.isArray(lyrics) && lyrics.length > 0;

  const content = !hasLyrics ? (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-500 dark:text-gray-400">
      No timed lyrics loaded.
    </div>
  ) : (
    lyrics.map((line, index) => {
      const timestamp = timestamps?.[index];
      const hasTimestamp = typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= 0;
      const isActive = index === activeIndex;
      const text = getLyricVideoLineDisplayText(line) || '(blank)';

      return (
        <button
          key={`${index}-${timestamp ?? 'untimed'}`}
          ref={isActive ? activeRowRef : null}
          type="button"
          className={`grid w-full grid-cols-[72px_1fr] gap-3 px-4 py-3 text-left text-sm transition-colors ${isActive
            ? 'bg-blue-50 text-blue-950 dark:bg-blue-500/10 dark:text-blue-100'
            : 'text-gray-700 hover:bg-blue-50/70 hover:text-blue-700 dark:text-gray-200 dark:hover:bg-blue-500/10 dark:hover:text-blue-200'
            }`}
          onClick={() => hasTimestamp && onSelectTime?.(timestamp * 10)}
          disabled={!hasTimestamp}
        >
          <span className={`font-mono text-xs ${hasTimestamp ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}>
            {hasTimestamp ? formatTimestamp(timestamp) : '--:--'}
          </span>
          <span className="line-clamp-2 whitespace-pre-wrap wrap-break-word">{text}</span>
        </button>
      );
    })
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-gray-900">
      <div className="shrink-0 border-b border-gray-200 bg-white/95 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/95 dark:text-gray-400">
        Lyrics Timeline
      </div>
      <div className="min-h-0 flex-1 p-3 pb-4">
        <div
          ref={listRef}
          className="h-full min-h-0 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 bg-white scroll-smooth dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-950"
          style={{ scrollbarGutter: 'stable' }}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
