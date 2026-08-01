import React, { useEffect, useMemo, useState } from 'react';
import LyricVisualFrame from '../components/output/LyricVisualFrame';
import IntroOverlay from '../components/LyricVideoStudio/IntroOverlay';
import { getActiveLyricVideoLine, getLyricVideoLineOutputText } from '../utils/lyricVideoTimeline';

export default function LyricVideoExportFrame() {
  const [payload, setPayload] = useState(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [renderMode, setRenderMode] = useState('overlay');

  useEffect(() => {
    window.__lyricVideoExportLoad = (nextPayload) => {
      setPayload(nextPayload || null);
      setCurrentTimeMs(0);
      setRenderMode(nextPayload?.exportRenderMode || 'overlay');
      return true;
    };

    window.__lyricVideoExportSetRenderMode = (nextMode) => new Promise((resolve) => {
      setRenderMode(nextMode === 'background' ? 'background' : 'overlay');
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
    });

    window.__lyricVideoExportSeek = (nextTimeMs) => new Promise((resolve) => {
      setCurrentTimeMs(Math.max(0, Number(nextTimeMs) || 0));
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
    });

    return () => {
      delete window.__lyricVideoExportLoad;
      delete window.__lyricVideoExportSetRenderMode;
      delete window.__lyricVideoExportSeek;
    };
  }, []);

  const resolved = useMemo(() => {
    if (!payload) return null;
    const intro = payload.intro || payload.openingScreen || {};
    const introDurationMs = intro.enabled ? Math.max(0, Number(intro.durationMs) || 0) : 0;
    const introPaddingMs = Math.max(0, Number(payload.exportSettings?.introPaddingMs) || 0);
    return getActiveLyricVideoLine({
      lyrics: payload.lyrics,
      timestamps: payload.timestamps,
      currentTimeMs: Math.max(0, currentTimeMs - introDurationMs - introPaddingMs),
      offsetMs: payload.offsetMs,
      gapBehavior: payload.gapBehavior,
      clearAfterMs: payload.clearAfterMs,
    });
  }, [currentTimeMs, payload]);

  if (!payload) {
    return <div className="h-screen w-screen bg-black" />;
  }

  const backgroundMode = renderMode === 'background';
  const intro = payload.intro || payload.openingScreen || {};
  const introDurationMs = intro.enabled ? Math.max(0, Number(intro.durationMs) || 0) : 0;
  const introPaddingMs = Math.max(0, Number(payload.exportSettings?.introPaddingMs) || 0);
  const introActive = !backgroundMode && intro.enabled && currentTimeMs < introDurationMs;
  const preMainTimeline = !backgroundMode && currentTimeMs < (introDurationMs + introPaddingMs);
  const canvasHeight = Math.max(180, Number(payload.exportSettings?.height) || 1080);
  let line = backgroundMode || preMainTimeline ? '' : (getLyricVideoLineOutputText(resolved?.activeLine) || '');
  if (!backgroundMode && !preMainTimeline && !line && payload.gapBehavior === 'show-title') {
    line = payload.title || '';
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent">
      <LyricVisualFrame
        line={line}
        currentLine={resolved?.activeLine}
        settings={payload.settings}
        visible={Boolean(line)}
        active
        previewMode
        disableAnimations
        frameKey={line || 'gap'}
        label="Lyric Video Export"
        className="relative h-screen w-screen overflow-hidden"
        renderBackgroundLayer={backgroundMode}
        renderFullScreenElementLayer={!backgroundMode}
      />
      {introActive && (
        <IntroOverlay
          intro={intro}
          title={payload.title}
          currentTimeMs={currentTimeMs}
          canvasHeight={canvasHeight}
        />
      )}
    </div>
  );
}
