import React, { useEffect, useMemo, useState } from 'react';
import LyricVisualFrame from '../components/output/LyricVisualFrame';
import { getActiveLyricVideoLine } from '../utils/lyricVideoTimeline';
import { getLyricVideoLineOutputText } from '../utils/lyricVideoLineText';

export default function LyricVideoExportFrame() {
  const [payload, setPayload] = useState(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  useEffect(() => {
    window.__lyricVideoExportLoad = (nextPayload) => {
      setPayload(nextPayload || null);
      setCurrentTimeMs(0);
      return true;
    };

    window.__lyricVideoExportSeek = (nextTimeMs) => new Promise((resolve) => {
      setCurrentTimeMs(Math.max(0, Number(nextTimeMs) || 0));
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
    });

    return () => {
      delete window.__lyricVideoExportLoad;
      delete window.__lyricVideoExportSeek;
    };
  }, []);

  const resolved = useMemo(() => {
    if (!payload) return null;
    return getActiveLyricVideoLine({
      lyrics: payload.lyrics,
      timestamps: payload.timestamps,
      currentTimeMs,
      offsetMs: payload.offsetMs,
      gapBehavior: payload.gapBehavior,
      clearAfterMs: payload.clearAfterMs,
    });
  }, [currentTimeMs, payload]);

  if (!payload) {
    return <div className="h-screen w-screen bg-black" />;
  }

  let line = getLyricVideoLineOutputText(resolved?.activeLine) || '';
  if (!line && payload.gapBehavior === 'show-title') {
    line = payload.title || '';
  }

  return (
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
    />
  );
}
