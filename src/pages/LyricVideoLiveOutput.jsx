import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import LyricVisualFrame from '../components/output/LyricVisualFrame';
import { getActiveLyricVideoLine } from '../utils/lyricVideoTimeline';
import { getLyricVideoLineOutputText } from '../utils/lyricVideoLineText';
import {
  LYRIC_VIDEO_STUDIO_CHANNEL,
  LYRIC_VIDEO_STUDIO_STATE_KEY,
  readLyricVideoStudioState,
} from '../utils/lyricVideoStudioState';

const normalizeSnapshot = (state) => {
  if (!state || typeof state !== 'object') return null;

  return {
    ...state,
    sentAt: Number(state.sentAt) || Number(state.updatedAt) || Date.now(),
    currentTimeMs: Math.max(0, Number(state.currentTimeMs) || 0),
    isPlaying: Boolean(state.isPlaying),
    studioLyrics: Array.isArray(state.studioLyrics) ? state.studioLyrics : [],
    studioTimestamps: Array.isArray(state.studioTimestamps) ? state.studioTimestamps : [],
  };
};

export default function LyricVideoLiveOutput() {
  const location = useLocation();
  const [snapshot, setSnapshot] = useState(() => normalizeSnapshot(readLyricVideoStudioState()));
  const [clockNow, setClockNow] = useState(() => Date.now());
  const searchParams = new URLSearchParams(location.search);
  const isProjectionMode = ['1', 'true'].includes((searchParams.get('projection') || '').toLowerCase());
  const showProjectionExitHint = ['1', 'true'].includes((searchParams.get('escapeHint') || '').toLowerCase());

  useEffect(() => {
    const modeStyle = isProjectionMode
      ? 'background: #000000 !important'
      : 'background: transparent !important';
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    if (html) html.setAttribute('style', modeStyle);
    if (body) body.setAttribute('style', modeStyle);
    if (root) root.setAttribute('style', modeStyle);

    return () => {
      if (html) html.removeAttribute('style');
      if (body) body.removeAttribute('style');
      if (root) root.removeAttribute('style');
    };
  }, [isProjectionMode]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;

    const channel = new BroadcastChannel(LYRIC_VIDEO_STUDIO_CHANNEL);
    channel.onmessage = (event) => {
      const next = normalizeSnapshot(event.data);
      if (next) {
        setSnapshot(next);
        setClockNow(Date.now());
      }
    };

    return () => channel.close();
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== LYRIC_VIDEO_STUDIO_STATE_KEY || !event.newValue) return;
      const next = normalizeSnapshot(readLyricVideoStudioState());
      if (next) setSnapshot(next);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!snapshot?.isPlaying) return undefined;

    let frameId = null;
    const tick = () => {
      setClockNow(Date.now());
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [snapshot?.isPlaying]);

  const currentTimeMs = snapshot
    ? snapshot.currentTimeMs + (snapshot.isPlaying ? Math.max(0, clockNow - snapshot.sentAt) : 0)
    : 0;

  const resolved = useMemo(() => {
    if (!snapshot) return null;
    const project = snapshot.project || {};
    return getActiveLyricVideoLine({
      lyrics: snapshot.studioLyrics,
      timestamps: snapshot.studioTimestamps,
      currentTimeMs,
      offsetMs: project.offsetMs,
      gapBehavior: project.gapBehavior,
      clearAfterMs: project.clearAfterMs,
    });
  }, [currentTimeMs, snapshot]);

  if (!snapshot) {
    return <div className="h-screen w-screen bg-black" />;
  }

  const project = snapshot.project || {};
  const title = snapshot.previewTitle || snapshot.studioFileName?.replace(/\.[^.]+$/, '') || 'Lyric Video';
  let line = getLyricVideoLineOutputText(resolved?.activeLine) || '';
  if (!line && project.gapBehavior === 'show-title') {
    line = title;
  }

  return (
    <LyricVisualFrame
      line={line}
      currentLine={resolved?.activeLine}
      settings={snapshot.visualSettings || snapshot.lyricVideoSettings}
      visible={Boolean(line)}
      active
      previewMode={false}
      frameKey={line || 'gap'}
      label="Lyric Video Studio"
      isProjectionMode={isProjectionMode}
      showProjectionExitHint={showProjectionExitHint}
      className="relative h-screen w-screen overflow-hidden"
      backgroundVideoPlaying={Boolean(snapshot.isPlaying)}
    />
  );
}
