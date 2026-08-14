import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import LyricVisualFrame from '../components/output/LyricVisualFrame';
import IntroOverlay from '../components/LyricVideoStudio/IntroOverlay';
import ButterchurnBackground from '../components/LyricVideoStudio/ButterchurnBackground';
import { getActiveLyricVideoLine, getLyricVideoLineOutputText } from '../utils/lyricVideoTimeline';
import { isButterchurnBackground } from '../../shared/lyricVideoVisualizer.js';
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
    if (typeof BroadcastChannel === 'undefined') return undefined;

    const channel = new BroadcastChannel(LYRIC_VIDEO_STUDIO_CHANNEL);
    channel.onmessage = (event) => {
      const next = normalizeSnapshot(event.data);
      if (next) {
        setSnapshot(next);
        setClockNow(Date.now());
      }
    };
    channel.postMessage({ type: 'request-snapshot' });

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

  const projectedTimeMs = snapshot
    ? snapshot.currentTimeMs + (snapshot.isPlaying ? Math.max(0, clockNow - snapshot.sentAt) : 0)
    : 0;
  const currentTimeMs = snapshot?.videoDurationMs
    ? Math.min(projectedTimeMs, Math.max(0, Number(snapshot.videoDurationMs) || 0))
    : projectedTimeMs;

  const resolved = useMemo(() => {
    if (!snapshot) return null;
    const project = snapshot.project || {};
    const intro = project.intro || project.openingScreen || {};
    const introDurationMs = intro.enabled ? Math.max(0, Number(intro.durationMs) || 0) : 0;
    const introPaddingMs = Math.max(0, Number(project.exportSettings?.introPaddingMs) || 0);
    if (currentTimeMs < introDurationMs + introPaddingMs) {
      return {
        activeIndex: null,
        activeLine: null,
        nextIndex: null,
        progressToNext: 0,
        inGap: false,
        gapMs: 0,
      };
    }
    return getActiveLyricVideoLine({
      lyrics: snapshot.studioLyrics,
      timestamps: snapshot.studioTimestamps,
      currentTimeMs: Math.max(0, currentTimeMs - introDurationMs - introPaddingMs),
      offsetMs: project.offsetMs,
      gapBehavior: project.gapBehavior,
      clearAfterMs: project.clearAfterMs,
    });
  }, [currentTimeMs, snapshot]);

  if (!snapshot) {
    return <div className="h-screen w-screen bg-black" />;
  }

  const project = snapshot.project || {};
  const intro = project.intro || project.openingScreen || {};
  const introDurationMs = intro.enabled ? Math.max(0, Number(intro.durationMs) || 0) : 0;
  const introPaddingMs = Math.max(0, Number(project.exportSettings?.introPaddingMs) || 0);
  const preMainTimeline = currentTimeMs < introDurationMs + introPaddingMs;
  const audioStartTimeMs = introDurationMs + introPaddingMs;
  const butterchurnEnabled = isButterchurnBackground(project.visualizer);
  const title = snapshot.previewTitle || snapshot.studioFileName?.replace(/\.[^.]+$/, '') || 'Lyric Video';
  let line = getLyricVideoLineOutputText(resolved?.activeLine) || '';
  if (preMainTimeline) {
    line = '';
  } else if (!line && project.gapBehavior === 'show-title') {
    line = title;
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent">
      <ButterchurnBackground
        enabled={butterchurnEnabled}
        visualizer={project.visualizer}
        audioSource={snapshot.visualizerAudioSource}
        currentTimeMs={currentTimeMs}
        audioStartTimeMs={audioStartTimeMs}
        width={project.exportSettings?.width}
        height={project.exportSettings?.height}
        fps={project.exportSettings?.fps}
        preview
      />
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
        renderBackgroundLayer={!butterchurnEnabled}
      />
      <IntroOverlay
        intro={intro}
        title={title}
        currentTimeMs={currentTimeMs}
        canvasHeight={snapshot.project?.exportSettings?.height || 1080}
      />
    </div>
  );
}
