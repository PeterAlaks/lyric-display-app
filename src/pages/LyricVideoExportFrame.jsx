import React, { useEffect, useMemo, useRef, useState } from 'react';
import LyricVisualFrame from '../components/output/LyricVisualFrame';
import IntroOverlay from '../components/LyricVideoStudio/IntroOverlay';
import ButterchurnBackground from '../components/LyricVideoStudio/ButterchurnBackground';
import { getActiveLyricVideoLine, getLyricVideoLineOutputText } from '../utils/lyricVideoTimeline';
import { isButterchurnBackground } from '../../shared/lyricVideoVisualizer.js';

export default function LyricVideoExportFrame() {
  const [payload, setPayload] = useState(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [renderMode, setRenderMode] = useState('overlay');
  const payloadRef = useRef(null);
  const visualizerRef = useRef(null);
  const loadWaiterRef = useRef(null);

  const afterPaint = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
  });

  useEffect(() => {
    window.__lyricVideoExportLoad = (nextPayload) => new Promise((resolve, reject) => {
      const safePayload = nextPayload || null;
      payloadRef.current = safePayload;
      setPayload(safePayload);
      setCurrentTimeMs(0);
      setRenderMode(nextPayload?.exportRenderMode || 'overlay');
      if (isButterchurnBackground(safePayload?.visualizer)) {
        loadWaiterRef.current = { resolve, reject };
      } else {
        void afterPaint().then(resolve);
      }
    });

    window.__lyricVideoExportSetRenderMode = (nextMode) => new Promise((resolve) => {
      setRenderMode(nextMode === 'background' ? 'background' : 'overlay');
      void afterPaint().then(resolve);
    });

    window.__lyricVideoExportReset = async () => {
      if (!isButterchurnBackground(payloadRef.current?.visualizer)) return true;
      await visualizerRef.current?.waitUntilReady?.();
      return visualizerRef.current?.reset?.();
    };

    window.__lyricVideoExportSeek = async (nextTimeMs) => {
      const safeTimeMs = Math.max(0, Number(nextTimeMs) || 0);
      const currentPayload = payloadRef.current;
      if (isButterchurnBackground(currentPayload?.visualizer)) {
        const fps = Math.max(1, Math.min(120, Number(currentPayload?.exportSettings?.fps) || 30));
        await visualizerRef.current?.waitUntilReady?.();
        await visualizerRef.current?.renderFrame?.({
          timelineTimeMs: safeTimeMs,
          elapsedTime: 1 / fps,
        });
      }
      setCurrentTimeMs(safeTimeMs);
      return afterPaint();
    };

    return () => {
      loadWaiterRef.current?.reject?.(new Error('Export renderer was closed before the visualizer initialized.'));
      loadWaiterRef.current = null;
      delete window.__lyricVideoExportLoad;
      delete window.__lyricVideoExportSetRenderMode;
      delete window.__lyricVideoExportReset;
      delete window.__lyricVideoExportSeek;
    };
  }, []);

  const handleVisualizerReady = () => {
    const waiter = loadWaiterRef.current;
    if (!waiter) return;
    loadWaiterRef.current = null;
    void afterPaint().then(waiter.resolve);
  };

  const handleVisualizerError = (error) => {
    const waiter = loadWaiterRef.current;
    if (!waiter) return;
    loadWaiterRef.current = null;
    waiter.reject(error);
  };

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
  const canvasWidth = Math.max(320, Number(payload.exportSettings?.width) || 1920);
  const audioStartTimeMs = introDurationMs + introPaddingMs;
  const butterchurnEnabled = isButterchurnBackground(payload.visualizer);
  let line = backgroundMode || preMainTimeline ? '' : (getLyricVideoLineOutputText(resolved?.activeLine) || '');
  if (!backgroundMode && !preMainTimeline && !line && payload.gapBehavior === 'show-title') {
    line = payload.title || '';
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent">
      <ButterchurnBackground
        ref={visualizerRef}
        enabled={butterchurnEnabled && !backgroundMode}
        visualizer={payload.visualizer}
        audioSource={payload.audio?.sourceUrl}
        currentTimeMs={0}
        audioStartTimeMs={audioStartTimeMs}
        width={canvasWidth}
        height={canvasHeight}
        fps={payload.exportSettings?.fps}
        manual
        onReady={handleVisualizerReady}
        onError={handleVisualizerError}
      />
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
        renderBackgroundLayer={!butterchurnEnabled && backgroundMode}
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
