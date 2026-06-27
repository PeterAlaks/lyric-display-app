import React from 'react';
import LyricVisualFrame from '../output/LyricVisualFrame';

export default function LyricVideoPreview({
  resolvedLine,
  currentLine,
  settings,
  active,
  title,
  gapBehavior,
  styleLabel,
}) {
  let line = resolvedLine;
  let visible = Boolean(line);

  if (!line && gapBehavior === 'show-title' && title) {
    line = title;
    visible = true;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-100 text-gray-950 dark:bg-gray-950 dark:text-gray-100">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white/80 px-5 py-3 text-xs backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-950 dark:text-gray-100">Video Preview</div>
          <div className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-500">{styleLabel || 'Lyric Video'} / 16:9</div>
        </div>
        <div className="font-mono text-[11px] text-gray-400 dark:text-gray-500">1920 x 1080</div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-6">
        <div className="aspect-video w-full max-w-6xl overflow-hidden rounded-lg bg-black shadow-[0_24px_70px_rgba(15,23,42,0.18)] ring-1 ring-black/10 dark:shadow-[0_24px_70px_rgba(0,0,0,0.48)] dark:ring-white/10">
          <LyricVisualFrame
            line={line || ''}
            currentLine={currentLine}
            settings={settings}
            visible={visible}
            active={active}
            previewMode
            frameKey={line || 'gap'}
            label="Lyric Video Preview"
            className="relative h-full w-full overflow-hidden"
          />
        </div>
      </div>
    </div>
  );
}
