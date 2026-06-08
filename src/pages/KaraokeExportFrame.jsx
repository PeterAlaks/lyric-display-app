import React, { useEffect, useMemo, useState } from 'react';
import LyricVisualFrame from '../components/output/LyricVisualFrame';
import { getActiveKaraokeLine } from '../utils/karaokeTimeline';
import { getKaraokeLineOutputText } from '../utils/karaokeLineText';

export default function KaraokeExportFrame() {
  const [payload, setPayload] = useState(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  useEffect(() => {
    window.__karaokeExportLoad = (nextPayload) => {
      setPayload(nextPayload || null);
      setCurrentTimeMs(0);
      return true;
    };

    window.__karaokeExportSeek = (nextTimeMs) => new Promise((resolve) => {
      setCurrentTimeMs(Math.max(0, Number(nextTimeMs) || 0));
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
    });

    return () => {
      delete window.__karaokeExportLoad;
      delete window.__karaokeExportSeek;
    };
  }, []);

  const resolved = useMemo(() => {
    if (!payload) return null;
    return getActiveKaraokeLine({
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

  let line = getKaraokeLineOutputText(resolved?.activeLine) || '';
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
      label="Karaoke Export"
      className="relative h-screen w-screen overflow-hidden"
    />
  );
}
