import React from 'react';
import LyricVisualFrame from '../output/LyricVisualFrame';

export default function KaraokePreview({
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
    <div className="flex h-full min-h-0 flex-col bg-[#0b0f14]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs text-neutral-300">
        <div className="min-w-0">
          <div className="font-semibold text-neutral-100">Video Preview</div>
          <div className="mt-0.5 truncate text-[11px] text-neutral-500">{styleLabel || 'Karaoke Video'} / 16:9</div>
        </div>
        <div className="rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-neutral-400">1920 x 1080</div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-5">
        <div className="aspect-video w-full max-w-6xl overflow-hidden rounded-md border border-white/10 bg-black shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
          <LyricVisualFrame
            line={line || ''}
            currentLine={currentLine}
            settings={settings}
            visible={visible}
            active={active}
            previewMode
            frameKey={line || 'gap'}
            label="Karaoke Preview"
            className="relative h-full w-full overflow-hidden"
          />
        </div>
      </div>
    </div>
  );
}
