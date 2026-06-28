import React, { useLayoutEffect, useRef, useState } from 'react';
import LyricVisualFrame from '../output/LyricVisualFrame';
import IntroOverlay, { isIntroActive } from './IntroOverlay';

export default function LyricVideoPreview({
  resolvedLine,
  currentLine,
  settings,
  exportSettings,
  intro,
  currentTimeMs = 0,
  mainTimelineStarted = true,
  active,
  title,
  gapBehavior,
  styleLabel,
  backgroundVideoPlaying,
}) {
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);
  const canvasWidth = Math.max(320, Number(exportSettings?.width) || 1920);
  const canvasHeight = Math.max(180, Number(exportSettings?.height) || 1080);

  useLayoutEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;

    const updateScale = () => {
      const rect = node.getBoundingClientRect();
      setScale(Math.max(0.01, Math.min(rect.width / canvasWidth, rect.height / canvasHeight)));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, [canvasHeight, canvasWidth]);

  let line = resolvedLine;
  let visible = Boolean(line);
  const introVisible = isIntroActive(intro, currentTimeMs);

  if (introVisible || !mainTimelineStarted) {
    line = '';
    visible = false;
  } else if (!line && gapBehavior === 'show-title' && title) {
    line = title;
    visible = true;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f8fafc] text-gray-950 dark:bg-gray-950 dark:text-gray-100">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white/80 px-5 text-xs backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-950 dark:text-gray-100">Video Preview</div>
          <div className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-500">{styleLabel || 'Lyric Video'} / 16:9</div>
        </div>
        <div className="font-mono text-[11px] text-gray-400 dark:text-gray-500">{canvasWidth} x {canvasHeight}</div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-6">
        <div
          ref={frameRef}
          className="w-full max-w-6xl overflow-hidden rounded-lg bg-black shadow-[0_24px_70px_rgba(15,23,42,0.18)] ring-1 ring-black/10 dark:shadow-[0_24px_70px_rgba(0,0,0,0.48)] dark:ring-white/10"
          style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
        >
          <div
            className="origin-top-left"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: `scale(${scale})`,
            }}
          >
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
              backgroundVideoPlaying={backgroundVideoPlaying}
            />
            <IntroOverlay
              intro={intro}
              title={title}
              currentTimeMs={currentTimeMs}
              canvasHeight={canvasHeight}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
