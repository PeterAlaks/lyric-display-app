import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppWindowMac, ArrowLeft, CircleHelp, Download, FilePlus2, FileText, MonitorUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Tooltip } from '../components/ui/tooltip';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import { parseLrc } from '../utils/parseLrc';
import { createDefaultOutputSettings } from '../context/LyricsStore';
import {
  useAllOutputIds,
  useLyricsState,
  useOutputSettings,
} from '../hooks/useStoreSelectors';
import { getActiveLyricVideoLine } from '../utils/lyricVideoTimeline';
import { getLyricVideoLineOutputText } from '../utils/lyricVideoLineText';
import LyricVideoTimeline from '../components/LyricVideoStudio/LyricVideoTimeline';
import LyricVideoPreview from '../components/LyricVideoStudio/LyricVideoPreview';
import LyricVideoTransport from '../components/LyricVideoStudio/LyricVideoTransport';
import LyricVideoSettingsPanel from '../components/LyricVideoStudio/LyricVideoSettingsPanel';
import LyricVideoExportModal from '../components/LyricVideoStudio/LyricVideoExportModal';
import LyricVideoStyleModal from '../components/LyricVideoStudio/LyricVideoStyleModal';
import {
  LYRIC_VIDEO_STUDIO_CHANNEL,
  readLyricVideoStudioState,
  sanitizeLyricVideoProjectForPersistence,
  writeLyricVideoStudioState,
} from '../utils/lyricVideoStudioState';

const DEFAULT_LYRIC_VIDEO_SETTINGS = createDefaultOutputSettings({
  fontSize: 86,
  minFontSize: 42,
  maxLinesEnabled: true,
  maxLines: 2,
  lyricsPosition: 'center',
  xMargin: 4,
  yMargin: 3,
  dropShadowOpacity: 7,
  dropShadowBlur: 14,
  backgroundOpacity: 0,
  fullScreenMode: true,
  fullScreenBackgroundType: 'color',
  fullScreenBackgroundColor: '#111827',
  fullScreenBackgroundPaint: { type: 'solid', color: '#111827' },
  alwaysShowBackground: true,
  transitionAnimation: 'fade',
  transitionSpeed: 220,
});

const DEFAULT_PROJECT = {
  name: 'Untitled Video 1',
  audio: {
    filePath: null,
    fileName: '',
    objectUrl: '',
    sourceUrl: '',
    durationMs: 0,
    mimeType: '',
  },
  offsetMs: 0,
  gapBehavior: 'keep-previous-line',
  clearAfterMs: 2500,
  styleSource: 'lyricVideo',
  intro: {
    enabled: false,
    title: '',
    subtitle: '',
    details: '',
    durationMs: 3000,
  },
  exportSettings: {
    format: 'mp4',
    width: 1920,
    height: 1080,
    fps: 30,
    introPaddingMs: 0,
    outroPaddingMs: 3000,
  },
};

const EXPORT_READINESS_TIMEOUT_MS = 8000;

const hasTimedLyrics = (timestamps) =>
  Array.isArray(timestamps) && timestamps.some((timestamp) => (
    typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= 0
  ));

const getProjectIntro = (project = {}) => ({
  ...DEFAULT_PROJECT.intro,
  ...(project.intro || project.openingScreen || {}),
});

const getIntroDurationMs = (project = {}) => {
  const intro = getProjectIntro(project);
  return intro.enabled
    ? Math.max(0, Math.min(30000, Number(intro.durationMs) || DEFAULT_PROJECT.intro.durationMs))
    : 0;
};

const getIntroPaddingMs = (project = {}) => Math.max(0, Number(project.exportSettings?.introPaddingMs) || 0);
const getOutroDurationMs = (project = {}) => Math.max(0, Number(project.exportSettings?.outroPaddingMs) || 0);
const getAudioDurationMs = (project = {}) => Math.max(0, Number(project.audio?.durationMs) || 0);
const getVideoDurationMs = (project = {}) => (
  getIntroDurationMs(project)
  + getIntroPaddingMs(project)
  + getAudioDurationMs(project)
  + getOutroDurationMs(project)
);

const mergePersistedProject = (persistedProject) => {
  const safeProject = persistedProject && typeof persistedProject === 'object' ? persistedProject : {};
  const { openingScreen: _legacyOpeningScreen, ...safeProjectWithoutLegacyOpening } = safeProject;
  return {
    ...DEFAULT_PROJECT,
    ...safeProjectWithoutLegacyOpening,
    audio: {
      ...DEFAULT_PROJECT.audio,
      ...(safeProject.audio || {}),
      objectUrl: '',
      sourceUrl: '',
    },
    exportSettings: {
      ...DEFAULT_PROJECT.exportSettings,
      ...(safeProject.exportSettings || {}),
    },
    intro: {
      ...DEFAULT_PROJECT.intro,
      ...(safeProject.intro || safeProject.openingScreen || {}),
    },
  };
};

export default function LyricVideoStudio() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { showModal } = useModal();
  const persistedStateRef = useRef(readLyricVideoStudioState());
  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const playbackAnchorRef = useRef({ startedAtMs: 0, videoTimeMs: 0 });
  const audioPlayPromiseRef = useRef(null);
  const mountedRef = useRef(true);
  const exportCancelRequestedRef = useRef(false);
  const exportInFlightRef = useRef(false);
  const readinessRequestIdRef = useRef(0);
  const audioResourceRef = useRef({ objectUrl: '', sourceUrl: '' });
  const liveChannelRef = useRef(null);
  const latestSnapshotRef = useRef(null);
  const persistenceTimerRef = useRef(null);
  const lrcInputRef = useRef(null);
  const browserAudioInputRef = useRef(null);

  const {
    lyrics,
    lyricsTimestamps,
    lyricsFileName,
    songMetadata,
  } = useLyricsState();
  const allOutputIds = useAllOutputIds();
  const outputIds = useMemo(
    () => allOutputIds.filter((id) => id.startsWith('output')),
    [allOutputIds]
  );
  const [project, setProject] = useState(() => mergePersistedProject(persistedStateRef.current?.project));
  const [lyricVideoSettings, setLyricVideoSettings] = useState(() => ({
    ...DEFAULT_LYRIC_VIDEO_SETTINGS,
    ...(persistedStateRef.current?.lyricVideoSettings || {}),
  }));
  const outputStyleSource = project.styleSource === 'lyricVideo' ? 'output1' : project.styleSource;
  const { settings: outputVisualSettings } = useOutputSettings(outputStyleSource);
  const visualSettings = project.styleSource === 'lyricVideo'
    ? lyricVideoSettings
    : outputVisualSettings;
  const [studioLyrics, setStudioLyrics] = useState(() => (
    Array.isArray(persistedStateRef.current?.studioLyrics)
      ? persistedStateRef.current.studioLyrics
      : (lyrics || [])
  ));
  const [studioTimestamps, setStudioTimestamps] = useState(() => (
    Array.isArray(persistedStateRef.current?.studioTimestamps)
      ? persistedStateRef.current.studioTimestamps
      : (lyricsTimestamps || [])
  ));
  const [studioFileName, setStudioFileName] = useState(() => persistedStateRef.current?.studioFileName || lyricsFileName || '');
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Math.max(0, Number(persistedStateRef.current?.currentTimeMs) || 0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const savedVolume = Number(persistedStateRef.current?.volume);
    return Number.isFinite(savedVolume) ? Math.max(0, Math.min(1, savedVolume)) : 0.85;
  });
  const [exportOpen, setExportOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [exportResult, setExportResult] = useState(null);
  const [exportReadiness, setExportReadiness] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const timedLyricsAvailable = hasTimedLyrics(studioTimestamps);
  const audioSource = project.audio.objectUrl || project.audio.sourceUrl;
  const intro = useMemo(() => getProjectIntro(project), [project]);
  const introDurationMs = useMemo(() => getIntroDurationMs(project), [project]);
  const introPaddingMs = useMemo(() => getIntroPaddingMs(project), [project]);
  const audioStartTimeMs = introDurationMs + introPaddingMs;
  const audioDurationMs = useMemo(() => getAudioDurationMs(project), [project]);
  const audioEndTimeMs = audioStartTimeMs + audioDurationMs;
  const videoDurationMs = useMemo(() => getVideoDurationMs(project), [project]);
  const mainTimelineStarted = currentTimeMs >= audioStartTimeMs;

  useEffect(() => {
    setProject((current) => {
      if (current.styleSource === 'lyricVideo' || outputIds.includes(current.styleSource)) return current;
      return { ...current, styleSource: 'lyricVideo' };
    });
  }, [outputIds]);

  const updateLyricVideoSettings = useCallback((partial) => {
    setLyricVideoSettings((current) => ({
      ...current,
      ...(partial || {}),
    }));
  }, []);

  const releaseAudioResources = useCallback((audio = {}) => {
    if (audio.objectUrl) {
      URL.revokeObjectURL(audio.objectUrl);
    }
    if (audio.sourceUrl) {
      const revokePromise = window.electronAPI?.lyricVideo?.revokeMedia?.(audio.sourceUrl);
      revokePromise?.catch?.(() => { });
    }
  }, []);

  const resolveCurrentLine = useCallback((videoTimeMs = currentTimeMs) => {
    if (videoTimeMs < audioStartTimeMs) {
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
      lyrics: studioLyrics,
      timestamps: studioTimestamps,
      currentTimeMs: Math.max(0, videoTimeMs - audioStartTimeMs),
      offsetMs: project.offsetMs,
      gapBehavior: project.gapBehavior,
      clearAfterMs: project.clearAfterMs,
    });
  }, [
    audioStartTimeMs,
    currentTimeMs,
    project.clearAfterMs,
    project.gapBehavior,
    project.offsetMs,
    studioLyrics,
    studioTimestamps,
  ]);

  const resolved = useMemo(() => resolveCurrentLine(currentTimeMs), [currentTimeMs, resolveCurrentLine]);
  const resolvedLine = getLyricVideoLineOutputText(resolved.activeLine) || '';
  const previewTitle = songMetadata?.title || studioFileName?.replace(/\.[^.]+$/, '') || 'Lyric Video';

  const studioSnapshot = useMemo(() => ({
    project: sanitizeLyricVideoProjectForPersistence(project),
    lyricVideoSettings,
    studioLyrics,
    studioTimestamps,
    studioFileName,
    currentTimeMs,
    isPlaying,
    volume,
    videoDurationMs,
    audioStartTimeMs,
    previewTitle,
    visualSettings,
    styleLabel: project.styleSource === 'lyricVideo' ? 'Lyric Video' : project.styleSource.replace('output', 'Output '),
    updatedAt: Date.now(),
  }), [
    currentTimeMs,
    isPlaying,
    lyricVideoSettings,
    previewTitle,
    project,
    studioFileName,
    studioLyrics,
    studioTimestamps,
    visualSettings,
    volume,
    videoDurationMs,
    audioStartTimeMs,
  ]);

  useEffect(() => {
    latestSnapshotRef.current = studioSnapshot;
  }, [studioSnapshot]);

  const publishStudioSnapshot = useCallback(() => {
    const snapshot = {
      ...(latestSnapshotRef.current || {}),
      sentAt: Date.now(),
    };

    try {
      liveChannelRef.current?.postMessage(snapshot);
    } catch { }

    return snapshot;
  }, []);

  const persistStudioSnapshot = useCallback(() => {
    const snapshot = latestSnapshotRef.current;
    if (!snapshot) return;
    writeLyricVideoStudioState({
      project: sanitizeLyricVideoProjectForPersistence(snapshot.project),
      lyricVideoSettings: snapshot.lyricVideoSettings,
      studioLyrics: snapshot.studioLyrics,
      studioTimestamps: snapshot.studioTimestamps,
      studioFileName: snapshot.studioFileName,
      currentTimeMs: snapshot.currentTimeMs,
      volume: snapshot.volume,
      updatedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel(LYRIC_VIDEO_STUDIO_CHANNEL);
    liveChannelRef.current = channel;
    publishStudioSnapshot();

    return () => {
      if (liveChannelRef.current === channel) {
        liveChannelRef.current = null;
      }
      channel.close();
    };
  }, [publishStudioSnapshot]);

  useEffect(() => {
    publishStudioSnapshot();
  }, [
    isPlaying,
    project,
    publishStudioSnapshot,
    studioFileName,
    studioLyrics,
    studioTimestamps,
    visualSettings,
  ]);

  useEffect(() => {
    if (isPlaying) return;
    publishStudioSnapshot();
  }, [currentTimeMs, isPlaying, publishStudioSnapshot]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const interval = window.setInterval(() => {
      publishStudioSnapshot();
    }, 200);
    return () => window.clearInterval(interval);
  }, [isPlaying, publishStudioSnapshot]);

  useEffect(() => {
    if (persistenceTimerRef.current) {
      window.clearTimeout(persistenceTimerRef.current);
    }

    persistenceTimerRef.current = window.setTimeout(() => {
      persistenceTimerRef.current = null;
      persistStudioSnapshot();
    }, 500);

    return () => {
      if (persistenceTimerRef.current) {
        window.clearTimeout(persistenceTimerRef.current);
        persistenceTimerRef.current = null;
      }
    };
  }, [
    isPlaying,
    lyricVideoSettings,
    persistStudioSnapshot,
    project,
    studioFileName,
    studioLyrics,
    studioTimestamps,
    volume,
    isPlaying ? null : currentTimeMs,
  ]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const interval = window.setInterval(persistStudioSnapshot, 2000);
    return () => window.clearInterval(interval);
  }, [isPlaying, persistStudioSnapshot]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (persistenceTimerRef.current) {
        window.clearTimeout(persistenceTimerRef.current);
        persistenceTimerRef.current = null;
      }
      persistStudioSnapshot();
      releaseAudioResources(audioResourceRef.current);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (exportInFlightRef.current) {
        window.electronAPI?.lyricVideo?.cancelExport?.();
      }
    };
  }, [persistStudioSnapshot, releaseAudioResources]);

  const clampVideoTime = useCallback((timeMs) => {
    const upperBound = videoDurationMs || Number.MAX_SAFE_INTEGER;
    return Math.max(0, Math.min(upperBound, Number(timeMs) || 0));
  }, [videoDurationMs]);

  const updatePlaybackAnchor = useCallback((videoTimeMs) => {
    playbackAnchorRef.current = {
      startedAtMs: performance.now(),
      videoTimeMs: clampVideoTime(videoTimeMs),
    };
  }, [clampVideoTime]);

  const syncAudioToVideoTime = useCallback((videoTimeMs, { shouldPlay = false } = {}) => {
    const audio = audioRef.current;
    if (!audio) return;
    const safeVideoTimeMs = clampVideoTime(videoTimeMs);
    const inAudioRange = audioDurationMs > 0
      && safeVideoTimeMs >= audioStartTimeMs
      && safeVideoTimeMs < audioEndTimeMs;
    const targetAudioTimeMs = Math.max(0, Math.min(audioDurationMs, safeVideoTimeMs - audioStartTimeMs));

    if (Number.isFinite(audio.duration) && Math.abs((audio.currentTime * 1000) - targetAudioTimeMs) > 250) {
      audio.currentTime = targetAudioTimeMs / 1000;
    }

    if (shouldPlay && inAudioRange) {
      if (audio.paused && !audioPlayPromiseRef.current) {
        audioPlayPromiseRef.current = audio.play()
          .catch((error) => {
            const message = error?.message || 'Unable to play audio';
            setStatusMessage(message);
            showToast({
              title: 'Playback failed',
              message,
              variant: 'error',
            });
            setIsPlaying(false);
          })
          .finally(() => {
            audioPlayPromiseRef.current = null;
          });
      }
    } else if (!audio.paused) {
      audio.pause();
    }
  }, [audioDurationMs, audioEndTimeMs, audioStartTimeMs, clampVideoTime, showToast]);

  const updateFromAudioClock = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || currentTimeMs < audioStartTimeMs) return;
    const nextVideoTimeMs = clampVideoTime(audioStartTimeMs + (audio.currentTime * 1000));
    setCurrentTimeMs(nextVideoTimeMs);
    if (isPlaying) {
      updatePlaybackAnchor(nextVideoTimeMs);
    }
  }, [audioStartTimeMs, clampVideoTime, currentTimeMs, isPlaying, updatePlaybackAnchor]);

  const tick = useCallback(() => {
    const anchor = playbackAnchorRef.current;
    let nextVideoTimeMs = clampVideoTime(anchor.videoTimeMs + (performance.now() - anchor.startedAtMs));
    const audio = audioRef.current;
    if (
      audio
      && !audio.paused
      && nextVideoTimeMs >= audioStartTimeMs
      && nextVideoTimeMs <= audioEndTimeMs + 250
    ) {
      nextVideoTimeMs = clampVideoTime(audioStartTimeMs + (audio.currentTime * 1000));
    }

    setCurrentTimeMs(nextVideoTimeMs);
    syncAudioToVideoTime(nextVideoTimeMs, { shouldPlay: true });

    if (videoDurationMs && nextVideoTimeMs >= videoDurationMs - 5) {
      syncAudioToVideoTime(videoDurationMs, { shouldPlay: false });
      setCurrentTimeMs(videoDurationMs);
      setIsPlaying(false);
      rafRef.current = null;
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [audioEndTimeMs, audioStartTimeMs, clampVideoTime, syncAudioToVideoTime, videoDurationMs]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, tick]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (videoDurationMs && currentTimeMs > videoDurationMs) {
      const nextTimeMs = clampVideoTime(currentTimeMs);
      setCurrentTimeMs(nextTimeMs);
      updatePlaybackAnchor(nextTimeMs);
      syncAudioToVideoTime(nextTimeMs, { shouldPlay: isPlaying });
    }
  }, [clampVideoTime, currentTimeMs, isPlaying, syncAudioToVideoTime, updatePlaybackAnchor, videoDurationMs]);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.lyricVideo?.onExportProgress?.((progress) => {
      setExportProgress(progress);
    });

    return () => unsubscribe?.();
  }, []);

  const readExportReadiness = useCallback(async ({ requestId = `renderer-${Date.now()}`, source = 'unknown' } = {}) => {
    try {
      if (!window.electronAPI?.lyricVideo?.getExportReadiness) {
        throw new Error('Lyric video export is only available in the desktop app.');
      }
      console.info('[LyricVideoStudio] FFmpeg readiness request started', { requestId, source });
      let timeoutId = null;
      const readiness = await Promise.race([
        window.electronAPI.lyricVideo.getExportReadiness({ requestId, source }),
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error('FFmpeg readiness check timed out. Choose the FFmpeg executable or confirm ffmpeg is available on PATH.'));
          }, EXPORT_READINESS_TIMEOUT_MS);
        }),
      ]).finally(() => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      });
      const normalized = { checking: false, ...(readiness || {}) };
      console.info('[LyricVideoStudio] FFmpeg readiness request completed', {
        requestId,
        source,
        available: normalized.available,
        ffmpegPath: normalized.ffmpegPath,
        error: normalized.error,
      });
      return normalized;
    } catch (error) {
      console.warn('[LyricVideoStudio] FFmpeg readiness request failed', {
        requestId,
        source,
        error: error?.message || String(error),
      });
      return {
        checking: false,
        available: false,
        error: error?.message || 'Unable to check FFmpeg availability.',
      };
    }
  }, []);

  const refreshExportReadiness = useCallback(() => {
    const requestId = readinessRequestIdRef.current + 1;
    readinessRequestIdRef.current = requestId;
    console.info('[LyricVideoStudio] FFmpeg readiness refresh requested', { requestId, source: 'manual-recheck' });
    setExportReadiness({ checking: true, available: false });

    const timeoutId = window.setTimeout(() => {
      if (!mountedRef.current || readinessRequestIdRef.current !== requestId) return;
      console.warn('[LyricVideoStudio] FFmpeg readiness refresh timed out in renderer', { requestId, source: 'manual-recheck' });
      setExportReadiness({
        checking: false,
        available: false,
        error: 'FFmpeg readiness check timed out. Choose the FFmpeg executable or confirm ffmpeg is available on PATH.',
      });
    }, EXPORT_READINESS_TIMEOUT_MS);

    readExportReadiness({ requestId, source: 'manual-recheck' })
      .then((readiness) => {
        if (!mountedRef.current || readinessRequestIdRef.current !== requestId) return;
        console.info('[LyricVideoStudio] FFmpeg readiness refresh applied', {
          requestId,
          source: 'manual-recheck',
          available: readiness?.available,
          error: readiness?.error,
        });
        setExportReadiness(readiness);
      })
      .catch((error) => {
        if (!mountedRef.current || readinessRequestIdRef.current !== requestId) return;
        console.warn('[LyricVideoStudio] FFmpeg readiness refresh failed', {
          requestId,
          source: 'manual-recheck',
          error: error?.message || String(error),
        });
        setExportReadiness({
          checking: false,
          available: false,
          error: error?.message || 'Unable to check FFmpeg availability.',
        });
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });
  }, [readExportReadiness]);

  useEffect(() => {
    if (!exportOpen) return undefined;

    let canceled = false;
    setExportReadiness({ checking: true, available: false });
    const requestId = readinessRequestIdRef.current + 1;
    readinessRequestIdRef.current = requestId;

    const loadReadiness = async () => {
      const readiness = await readExportReadiness({ requestId, source: 'export-modal-open' });
      if (!canceled) {
        setExportReadiness(readiness);
      }
    };

    loadReadiness();
    return () => {
      canceled = true;
    };
  }, [exportOpen, readExportReadiness]);

  const handleSelectFfmpeg = useCallback(async () => {
    if (!window.electronAPI?.lyricVideo?.selectFfmpeg) {
      setExportReadiness({
        checking: false,
        available: false,
        error: 'FFmpeg setup is only available in the desktop app.',
      });
      return;
    }

    const result = await window.electronAPI.lyricVideo.selectFfmpeg();
    if (result?.success) {
      setExportReadiness({
        checking: false,
        available: true,
        ffmpegPath: result.ffmpegPath,
      });
      showToast({
        title: 'FFmpeg ready',
        message: result.ffmpegPath,
        variant: 'success',
      });
      return;
    }

    if (result?.canceled) return;

    setExportReadiness({
      checking: false,
      available: false,
      ffmpegPath: result?.ffmpegPath,
      error: result?.error || 'Selected file could not be used as FFmpeg.',
    });
    showToast({
      title: 'FFmpeg setup failed',
      message: result?.error || 'Selected file could not be used as FFmpeg.',
      variant: 'error',
    });
  }, [showToast]);

  const handleOpenFfmpegDownload = useCallback(() => {
    window.open('https://ffmpeg.org/download.html', '_blank', 'noopener,noreferrer');
  }, []);

  const handleImportLrc = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = await parseLrc(file, { enableSplitting: false });
      setStudioLyrics(parsed.processedLines || []);
      setStudioTimestamps(parsed.timestamps || []);
      setStudioFileName(file.name);
      setCurrentTimeMs((timeMs) => clampVideoTime(timeMs));
      setStatusMessage(`Loaded ${file.name}`);
      showToast({
        title: 'LRC loaded',
        message: `${file.name} is ready in Lyric Video Studio.`,
        variant: 'success',
      });
    } catch (error) {
      const message = error?.message || 'Failed to import LRC file';
      setStatusMessage(message);
      showToast({
        title: 'LRC import failed',
        message,
        variant: 'error',
      });
    }
  };

  const setAudioProject = (audio, { resetPlayback = true } = {}) => {
    if (resetPlayback) {
      const audioElement = audioRef.current;
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentTimeMs(0);
      updatePlaybackAnchor(0);
    }

    setProject((current) => {
      if (
        (current.audio.objectUrl && current.audio.objectUrl !== audio.objectUrl)
        || (current.audio.sourceUrl && current.audio.sourceUrl !== audio.sourceUrl)
      ) {
        releaseAudioResources(current.audio);
      }
      const nextAudio = {
        ...current.audio,
        ...audio,
      };
      audioResourceRef.current = {
        objectUrl: nextAudio.objectUrl || '',
        sourceUrl: nextAudio.sourceUrl || '',
      };
      return {
        ...current,
        audio: nextAudio,
      };
    });
  };

  useEffect(() => {
    const savedAudio = persistedStateRef.current?.project?.audio;
    if (!savedAudio?.filePath || project.audio.sourceUrl || project.audio.objectUrl) {
      return undefined;
    }

    let canceled = false;

    const restoreSavedAudio = async () => {
      try {
        const result = await window.electronAPI?.lyricVideo?.restoreAudio?.({
          filePath: savedAudio.filePath,
          mimeType: savedAudio.mimeType,
        });

        if (canceled || !result?.success) return;

        setAudioProject({
          filePath: result.filePath,
          fileName: result.fileName || savedAudio.fileName || '',
          sourceUrl: result.sourceUrl || '',
          objectUrl: '',
          mimeType: result.mimeType || savedAudio.mimeType || '',
          durationMs: savedAudio.durationMs || 0,
        }, { resetPlayback: false });
      } catch {
        // Leave the saved path in settings; the export modal will explain if it is unusable.
      }
    };

    restoreSavedAudio();

    return () => {
      canceled = true;
    };
  }, [project.audio.objectUrl, project.audio.sourceUrl]);

  const handleAttachAudio = async () => {
    if (window.electronAPI?.lyricVideo?.selectAudio) {
      const result = await window.electronAPI.lyricVideo.selectAudio();
      if (result?.success) {
        setAudioProject({
          filePath: result.filePath,
          fileName: result.fileName,
          sourceUrl: result.sourceUrl || '',
          objectUrl: '',
          mimeType: result.mimeType || '',
          durationMs: 0,
        });
        setStatusMessage(`Attached ${result.fileName}`);
        showToast({
          title: 'Audio attached',
          message: result.fileName,
          variant: 'success',
        });
        return;
      }
      if (!result?.canceled) {
        const message = result?.error || 'Failed to attach audio';
        setStatusMessage(message);
        showToast({
          title: 'Audio attach failed',
          message,
          variant: 'error',
        });
      }
      return;
    }

    browserAudioInputRef.current?.click();
  };

  const handleBrowserAudio = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAudioProject({
      filePath: null,
      fileName: file.name,
      objectUrl: URL.createObjectURL(file),
      sourceUrl: '',
      mimeType: file.type || '',
      durationMs: 0,
    });
    setStatusMessage(`Attached ${file.name}`);
    showToast({
      title: 'Audio attached',
      message: file.name,
      variant: 'success',
    });
  };

  const handleLoadedMetadata = () => {
    const durationMs = Number.isFinite(audioRef.current?.duration)
      ? audioRef.current.duration * 1000
      : 0;
    if (audioRef.current && currentTimeMs > 0 && durationMs > 0) {
      const restoredAudioTimeMs = Math.max(0, Math.min(durationMs, currentTimeMs - audioStartTimeMs));
      if (Math.abs((audioRef.current.currentTime * 1000) - restoredAudioTimeMs) > 250) {
        audioRef.current.currentTime = restoredAudioTimeMs / 1000;
      }
    }
    setProject((current) => ({
      ...current,
      audio: {
        ...current.audio,
        durationMs,
      },
    }));
    syncAudioToVideoTime(currentTimeMs, { shouldPlay: isPlaying });
  };

  const handleSeek = (nextTimeMs) => {
    const safeMs = clampVideoTime(nextTimeMs);
    updatePlaybackAnchor(safeMs);
    syncAudioToVideoTime(safeMs, { shouldPlay: isPlaying });
    setCurrentTimeMs(safeMs);
  };

  const handlePlayPause = useCallback(async () => {
    if (!audioSource) return;

    if (isPlaying) {
      syncAudioToVideoTime(currentTimeMs, { shouldPlay: false });
      setIsPlaying(false);
      return;
    }

    const startTimeMs = videoDurationMs && currentTimeMs >= videoDurationMs - 5
      ? 0
      : clampVideoTime(currentTimeMs);
    setCurrentTimeMs(startTimeMs);
    updatePlaybackAnchor(startTimeMs);
    syncAudioToVideoTime(startTimeMs, { shouldPlay: true });
    setIsPlaying(true);
  }, [
    audioSource,
    clampVideoTime,
    currentTimeMs,
    isPlaying,
    syncAudioToVideoTime,
    updatePlaybackAnchor,
    videoDurationMs,
  ]);

  useEffect(() => {
    const handleStudioSpacebar = (event) => {
      if (event.code !== 'Space' || event.repeat || exportOpen || styleOpen) return;

      const target = event.target;
      const isTextEntry = target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable
      );
      if (isTextEntry) return;

      const activeModal = document.querySelector('[data-modal-root="true"]');
      if (activeModal?.contains?.(target)) return;

      event.preventDefault();
      event.stopPropagation();
      handlePlayPause();
    };

    window.addEventListener('keydown', handleStudioSpacebar, true);
    return () => window.removeEventListener('keydown', handleStudioSpacebar, true);
  }, [exportOpen, handlePlayPause, styleOpen]);

  const handleStartExport = async (performanceMode = 'balanced') => {
    if (!window.electronAPI?.lyricVideo?.exportVideo) {
      setExportResult({ success: false, error: 'Lyric video export is only available in the desktop app.' });
      return;
    }

    setIsExporting(true);
    exportInFlightRef.current = true;
    exportCancelRequestedRef.current = false;
    setExportProgress({ phase: 'starting', frame: 0, frameCount: 0, percent: 0 });
    setExportResult(null);
    showToast({
      title: 'Export started',
      message: 'Rendering lyric video frames.',
      variant: 'info',
    });

    try {
      const result = await window.electronAPI.lyricVideo.exportVideo({
        lyrics: studioLyrics,
        timestamps: studioTimestamps,
        offsetMs: project.offsetMs,
        gapBehavior: project.gapBehavior,
        clearAfterMs: project.clearAfterMs,
        title: project.name || 'Untitled Video 1',
        settings: visualSettings,
        intro,
        audio: project.audio,
        exportSettings: {
          ...project.exportSettings,
          performanceMode,
        },
      });

      if (!mountedRef.current) return;

      if (result?.canceled) {
        setExportResult(exportCancelRequestedRef.current ? null : { success: false, error: 'Export canceled.' });
        if (!exportCancelRequestedRef.current) {
          showToast({
            title: 'Export canceled',
            message: 'The lyric video export was canceled.',
            variant: 'warn',
          });
        }
      } else if (result?.success) {
        setExportResult(result);
        setStatusMessage(`Exported ${result.outputPath}`);
        showToast({
          title: 'Export complete',
          message: result.outputPath,
          variant: 'success',
          duration: 8000,
        });
      } else {
        const message = result?.error || 'Export failed.';
        setExportResult({ success: false, error: message });
        showToast({
          title: 'Export failed',
          message,
          variant: 'error',
          duration: 8000,
        });
      }
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error?.message || 'Export failed.';
      setExportResult({ success: false, error: message });
      showToast({
        title: 'Export failed',
        message,
        variant: 'error',
        duration: 8000,
      });
    } finally {
      exportInFlightRef.current = false;
      if (mountedRef.current) {
        setIsExporting(false);
      }
    }
  };

  const handleOpenExportModal = useCallback(() => {
    if (!isExporting) {
      setExportResult(null);
      setExportProgress(null);
    }
    setExportOpen(true);
  }, [isExporting]);

  const handleCancelExport = async () => {
    exportCancelRequestedRef.current = true;
    await window.electronAPI?.lyricVideo?.cancelExport?.();
    exportInFlightRef.current = false;
    setIsExporting(false);
    setExportProgress(null);
    setExportResult(null);
    showToast({
      title: 'Export canceled',
      message: 'The lyric video export was canceled.',
      variant: 'warn',
    });
  };

  const handleOpenHelp = () => {
    showModal({
      title: 'Lyric Video Studio Help',
      headerDescription: 'Prepare local LRC and audio files, review sync, and export responsibly.',
      component: 'LyricVideoStudioHelp',
      variant: 'info',
      size: 'large',
      dismissLabel: 'Got it',
    });
  };

  const handleOpenProjectOutput = () => {
    showModal({
      title: 'Project Lyric Video Studio',
      headerDescription: 'Send the live studio preview to this monitor or an external display.',
      component: 'ProjectOutput',
      variant: 'info',
      size: 'lg',
      className: 'max-w-4xl',
      actions: [],
      customLayout: true,
      initialOutputKey: 'lyric-video-studio',
      extraOutputOptions: [
        {
          value: 'lyric-video-studio',
          label: 'Lyric Video Studio',
          hint: 'Live studio preview',
        },
      ],
    });
  };

  const handleOpenLiveOutput = useCallback(() => {
    window.electronAPI?.display?.openOutputWindow?.('lyric-video-studio');
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 text-gray-950 dark:bg-gray-950 dark:text-gray-100">
      <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white/95 px-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back" className="text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">Lyric Video Studio</h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{studioFileName || 'Import an LRC file to begin'}</p>
          </div>
        </div>
        <div className="absolute left-1/2 w-[min(360px,32vw)] -translate-x-1/2">
          <input
            type="text"
            value={project.name || ''}
            onChange={(event) => {
              const name = event.target.value.slice(0, 120);
              setProject((current) => ({ ...current, name }));
            }}
            onBlur={() => {
              setProject((current) => ({
                ...current,
                name: current.name?.trim() || 'Untitled Video 1',
              }));
            }}
            aria-label="Lyric video project name"
            className="h-9 w-full rounded-md border border-transparent bg-gray-100 px-3 text-center text-sm font-semibold text-gray-950 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-500/50 dark:focus:bg-gray-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content="Project live studio preview" side="bottom">
            <Button type="button" variant="ghost" size="icon" onClick={handleOpenProjectOutput} aria-label="Project Lyric Video Studio" className="text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300">
              <MonitorUp className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Open live studio preview window" side="bottom">
            <Button type="button" variant="ghost" size="icon" onClick={handleOpenLiveOutput} aria-label="Open Live Studio Preview" className="text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300">
              <AppWindowMac className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Lyric Video Studio help" side="bottom">
            <Button type="button" variant="ghost" size="icon" onClick={handleOpenHelp} aria-label="Lyric Video Studio Help" className="text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300">
              <CircleHelp className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Export MP4 lyric video" side="bottom">
            <Button type="button" size="sm" onClick={handleOpenExportModal} className="rounded-full bg-linear-to-r from-blue-400 to-purple-600 px-4 text-white transition-all duration-200 hover:from-blue-500 hover:to-purple-700">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </Tooltip>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)_360px] grid-rows-[minmax(0,1fr)_204px] overflow-hidden">
        <aside className="row-span-2 flex min-h-0 flex-col overflow-hidden border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-5 dark:border-gray-800">
            <Tooltip content="Import a timestamped .lrc file" side="bottom">
              <Button type="button" variant="ghost" size="sm" onClick={() => lrcInputRef.current?.click()} className="rounded-full text-gray-600 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300">
                <FileText className="h-4 w-4" />
                Import LRC
              </Button>
            </Tooltip>
            <Tooltip content="Create or edit lyrics in New Song Canvas" side="bottom">
              <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/new-song')} className="rounded-full text-gray-600 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300">
                <FilePlus2 className="h-4 w-4" />
                Create LRC
              </Button>
            </Tooltip>
            <input ref={lrcInputRef} type="file" accept=".lrc" className="hidden" onChange={handleImportLrc} />
            <input ref={browserAudioInputRef} type="file" accept=".mp3,.wav,.m4a,.aac,audio/*" className="hidden" onChange={handleBrowserAudio} />
          </div>
          <div className="min-h-0 flex-1">
            <LyricVideoTimeline
              lyrics={studioLyrics}
              timestamps={studioTimestamps}
              activeIndex={resolved.activeIndex}
              onSelectTime={(timeMs) => handleSeek(audioStartTimeMs + timeMs)}
            />
          </div>
        </aside>

        <section className="min-h-0 overflow-hidden">
          <LyricVideoPreview
            resolvedLine={resolvedLine}
            currentLine={resolved.activeLine}
            settings={visualSettings}
            exportSettings={project.exportSettings}
            intro={intro}
            currentTimeMs={currentTimeMs}
            mainTimelineStarted={mainTimelineStarted}
            active={Boolean(audioSource || studioLyrics.length)}
            title={previewTitle}
            gapBehavior={project.gapBehavior}
            styleLabel={project.styleSource === 'lyricVideo' ? 'Lyric Video' : project.styleSource.replace('output', 'Output ')}
            backgroundVideoPlaying={isPlaying}
          />
        </section>

        <aside className="row-span-2 min-h-0 overflow-hidden border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <LyricVideoSettingsPanel
            project={project}
            outputIds={outputIds}
            onProjectChange={setProject}
            onOpenStyleEditor={() => setStyleOpen(true)}
            onOpenExport={handleOpenExportModal}
          />
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <audio
            ref={audioRef}
            src={audioSource || undefined}
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={updateFromAudioClock}
            onSeeked={updateFromAudioClock}
            onPause={() => { }}
            onPlay={() => { }}
            onEnded={() => {
              updatePlaybackAnchor(audioEndTimeMs);
              setCurrentTimeMs(audioEndTimeMs);
            }}
          />
          <LyricVideoTransport
            audio={project.audio}
            currentTimeMs={currentTimeMs}
            durationMs={videoDurationMs}
            isPlaying={isPlaying}
            onAttachAudio={handleAttachAudio}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            volume={volume}
            onVolumeChange={setVolume}
          />
          <div className="shrink-0 border-t border-gray-200 bg-white px-5 pb-4 pt-2 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            {statusMessage || (timedLyricsAvailable ? 'Timed lyrics ready.' : 'No usable timestamps detected.')}
          </div>
        </section>
      </main>

      <LyricVideoExportModal
        open={exportOpen}
        settings={project.exportSettings}
        projectName={project.name || 'Untitled Video 1'}
        audioAttached={Boolean(audioSource)}
        audioExportable={Boolean(project.audio.filePath && project.audio.durationMs)}
        hasTimedLyrics={timedLyricsAvailable}
        ffmpegReadiness={exportReadiness}
        isExporting={isExporting}
        progress={exportProgress}
        result={exportResult}
        onSelectFfmpeg={handleSelectFfmpeg}
        onRefreshReadiness={refreshExportReadiness}
        onOpenFfmpegDownload={handleOpenFfmpegDownload}
        onStartExport={handleStartExport}
        onCancelExport={handleCancelExport}
        onClose={() => setExportOpen(false)}
      />
      <LyricVideoStyleModal
        open={styleOpen}
        settings={lyricVideoSettings}
        onSettingsChange={updateLyricVideoSettings}
        onClose={() => setStyleOpen(false)}
      />
    </div>
  );
}
