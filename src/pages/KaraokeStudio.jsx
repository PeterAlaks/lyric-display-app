import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import useToast from '../hooks/useToast';
import { parseLrc } from '../utils/parseLrc';
import { createDefaultOutputSettings } from '../context/LyricsStore';
import {
  useAllOutputIds,
  useLyricsState,
  useOutputSettings,
} from '../hooks/useStoreSelectors';
import { getActiveKaraokeLine } from '../utils/karaokeTimeline';
import { getKaraokeLineOutputText } from '../utils/karaokeLineText';
import KaraokeTimeline from '../components/KaraokeStudio/KaraokeTimeline';
import KaraokePreview from '../components/KaraokeStudio/KaraokePreview';
import KaraokeTransport from '../components/KaraokeStudio/KaraokeTransport';
import KaraokeSettingsPanel from '../components/KaraokeStudio/KaraokeSettingsPanel';
import KaraokeExportModal from '../components/KaraokeStudio/KaraokeExportModal';
import KaraokeStyleModal from '../components/KaraokeStudio/KaraokeStyleModal';

const DEFAULT_KARAOKE_SETTINGS = createDefaultOutputSettings({
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
  styleSource: 'karaoke',
  exportSettings: {
    format: 'mp4',
    width: 1920,
    height: 1080,
    fps: 30,
    introPaddingMs: 0,
    outroPaddingMs: 3000,
  },
};

const hasTimedLyrics = (timestamps) =>
  Array.isArray(timestamps) && timestamps.some((timestamp) => (
    typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= 0
  ));

export default function KaraokeStudio() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const exportCancelRequestedRef = useRef(false);
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
  const [project, setProject] = useState(DEFAULT_PROJECT);
  const [karaokeSettings, setKaraokeSettings] = useState(DEFAULT_KARAOKE_SETTINGS);
  const outputStyleSource = project.styleSource === 'karaoke' ? 'output1' : project.styleSource;
  const { settings: outputVisualSettings } = useOutputSettings(outputStyleSource);
  const visualSettings = project.styleSource === 'karaoke'
    ? karaokeSettings
    : outputVisualSettings;
  const [studioLyrics, setStudioLyrics] = useState(() => lyrics || []);
  const [studioTimestamps, setStudioTimestamps] = useState(() => lyricsTimestamps || []);
  const [studioFileName, setStudioFileName] = useState(() => lyricsFileName || '');
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [exportOpen, setExportOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [exportResult, setExportResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const timedLyricsAvailable = hasTimedLyrics(studioTimestamps);
  const audioSource = project.audio.objectUrl || project.audio.sourceUrl;

  useEffect(() => {
    setProject((current) => {
      if (current.styleSource === 'karaoke' || outputIds.includes(current.styleSource)) return current;
      return { ...current, styleSource: 'karaoke' };
    });
  }, [outputIds]);

  const updateKaraokeSettings = useCallback((partial) => {
    setKaraokeSettings((current) => ({
      ...current,
      ...(partial || {}),
    }));
  }, []);

  useEffect(() => () => {
    if (project.audio.objectUrl) {
      URL.revokeObjectURL(project.audio.objectUrl);
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, [project.audio.objectUrl]);

  const resolveCurrentLine = useCallback((timeMs = currentTimeMs) => getActiveKaraokeLine({
    lyrics: studioLyrics,
    timestamps: studioTimestamps,
    currentTimeMs: timeMs,
    offsetMs: project.offsetMs,
    gapBehavior: project.gapBehavior,
    clearAfterMs: project.clearAfterMs,
  }), [
    currentTimeMs,
    project.clearAfterMs,
    project.gapBehavior,
    project.offsetMs,
    studioLyrics,
    studioTimestamps,
  ]);

  const resolved = useMemo(() => resolveCurrentLine(currentTimeMs), [currentTimeMs, resolveCurrentLine]);
  const resolvedLine = getKaraokeLineOutputText(resolved.activeLine) || '';
  const previewTitle = songMetadata?.title || studioFileName?.replace(/\.[^.]+$/, '') || 'Karaoke';

  const updateFromAudioClock = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTimeMs(audio.currentTime * 1000);
  }, []);

  const tick = useCallback(() => {
    updateFromAudioClock();
    rafRef.current = requestAnimationFrame(tick);
  }, [updateFromAudioClock]);

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
    updateFromAudioClock();
  }, [project.offsetMs, project.gapBehavior, project.clearAfterMs, updateFromAudioClock]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.karaoke?.onExportProgress?.((progress) => {
      setExportProgress(progress);
    });

    return () => unsubscribe?.();
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
      setCurrentTimeMs(audioRef.current ? audioRef.current.currentTime * 1000 : 0);
      setStatusMessage(`Loaded ${file.name}`);
      showToast({
        title: 'LRC loaded',
        message: `${file.name} is ready in Karaoke Studio.`,
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

  const setAudioProject = (audio) => {
    setProject((current) => {
      if (current.audio.objectUrl && current.audio.objectUrl !== audio.objectUrl) {
        URL.revokeObjectURL(current.audio.objectUrl);
      }
      return {
        ...current,
        audio: {
          ...current.audio,
          ...audio,
        },
      };
    });
  };

  const handleAttachAudio = async () => {
    if (window.electronAPI?.karaoke?.selectAudio) {
      const result = await window.electronAPI.karaoke.selectAudio();
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
    setProject((current) => ({
      ...current,
      audio: {
        ...current.audio,
        durationMs,
      },
    }));
    updateFromAudioClock();
  };

  const handleSeek = (nextTimeMs) => {
    const audio = audioRef.current;
    const safeMs = Math.max(0, Number(nextTimeMs) || 0);
    if (audio) {
      audio.currentTime = safeMs / 1000;
    }
    setCurrentTimeMs(safeMs);
  };

  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audioSource || !audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        const message = error?.message || 'Unable to play audio';
        setStatusMessage(message);
        showToast({
          title: 'Playback failed',
          message,
          variant: 'error',
        });
      }
    } else {
      audio.pause();
      setIsPlaying(false);
      updateFromAudioClock();
    }
  };

  const handleStartExport = async () => {
    if (!window.electronAPI?.karaoke?.exportVideo) {
      setExportResult({ success: false, error: 'Karaoke export is only available in the desktop app.' });
      return;
    }

    setIsExporting(true);
    exportCancelRequestedRef.current = false;
    setExportProgress({ phase: 'starting', frame: 0, frameCount: 0, percent: 0 });
    setExportResult(null);
    showToast({
      title: 'Export started',
      message: 'Rendering karaoke video frames.',
      variant: 'info',
    });

    try {
      const result = await window.electronAPI.karaoke.exportVideo({
        lyrics: studioLyrics,
        timestamps: studioTimestamps,
        offsetMs: project.offsetMs,
        gapBehavior: project.gapBehavior,
        clearAfterMs: project.clearAfterMs,
        title: previewTitle,
        settings: visualSettings,
        audio: project.audio,
        exportSettings: project.exportSettings,
      });

      if (result?.canceled) {
        setExportResult({ success: false, error: 'Export canceled.' });
        if (!exportCancelRequestedRef.current) {
          showToast({
            title: 'Export canceled',
            message: 'The karaoke export was canceled.',
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
      const message = error?.message || 'Export failed.';
      setExportResult({ success: false, error: message });
      showToast({
        title: 'Export failed',
        message,
        variant: 'error',
        duration: 8000,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancelExport = async () => {
    exportCancelRequestedRef.current = true;
    await window.electronAPI?.karaoke?.cancelExport?.();
    setIsExporting(false);
    setExportResult({ success: false, error: 'Export canceled.' });
    showToast({
      title: 'Export canceled',
      message: 'The karaoke export was canceled.',
      variant: 'warn',
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-100 text-gray-950 dark:bg-gray-950 dark:text-gray-100">
      <header className="flex h-[72px] flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">Karaoke Studio</h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{studioFileName || 'Import an LRC file to begin'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled>
            <Save className="h-4 w-4" />
            Save Draft
          </Button>
          <Button type="button" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)_360px] grid-rows-[minmax(0,1fr)_204px] gap-4 overflow-hidden p-4 pb-6">
        <aside className="row-span-2 flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <Button type="button" variant="outline" size="sm" onClick={() => lrcInputRef.current?.click()}>
              <FileText className="h-4 w-4" />
              Import LRC
            </Button>
            <input ref={lrcInputRef} type="file" accept=".lrc" className="hidden" onChange={handleImportLrc} />
            <input ref={browserAudioInputRef} type="file" accept=".mp3,.wav,.m4a,.aac,audio/*" className="hidden" onChange={handleBrowserAudio} />
          </div>
          <div className="min-h-0 flex-1">
            <KaraokeTimeline
              lyrics={studioLyrics}
              timestamps={studioTimestamps}
              activeIndex={resolved.activeIndex}
              onSelectTime={handleSeek}
            />
          </div>
        </aside>

        <section className="min-h-0 overflow-hidden rounded-lg">
          <KaraokePreview
            resolvedLine={resolvedLine}
            currentLine={resolved.activeLine}
            settings={visualSettings}
            active={Boolean(audioSource || studioLyrics.length)}
            title={previewTitle}
            gapBehavior={project.gapBehavior}
            styleLabel={project.styleSource === 'karaoke' ? 'Karaoke Video' : project.styleSource.replace('output', 'Output ')}
          />
        </section>

        <aside className="row-span-2 min-h-0 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <KaraokeSettingsPanel
            project={project}
            outputIds={outputIds}
            onProjectChange={setProject}
            onOpenStyleEditor={() => setStyleOpen(true)}
            onOpenExport={() => setExportOpen(true)}
          />
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <audio
            ref={audioRef}
            src={audioSource || undefined}
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={updateFromAudioClock}
            onSeeked={updateFromAudioClock}
            onPause={() => {
              setIsPlaying(false);
              updateFromAudioClock();
            }}
            onPlay={() => setIsPlaying(true)}
            onEnded={() => {
              setIsPlaying(false);
              updateFromAudioClock();
            }}
          />
          <KaraokeTransport
            audio={project.audio}
            currentTimeMs={currentTimeMs}
            durationMs={project.audio.durationMs}
            isPlaying={isPlaying}
            onAttachAudio={handleAttachAudio}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            volume={volume}
            onVolumeChange={setVolume}
          />
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-5 pb-4 pt-2 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            {statusMessage || (timedLyricsAvailable ? 'Timed lyrics ready.' : 'No usable timestamps detected.')}
          </div>
        </section>
      </main>

      <KaraokeExportModal
        open={exportOpen}
        settings={project.exportSettings}
        audioAttached={Boolean(audioSource)}
        audioExportable={Boolean(project.audio.filePath && project.audio.durationMs)}
        hasTimedLyrics={timedLyricsAvailable}
        isExporting={isExporting}
        progress={exportProgress}
        result={exportResult}
        onStartExport={handleStartExport}
        onCancelExport={handleCancelExport}
        onClose={() => setExportOpen(false)}
      />
      <KaraokeStyleModal
        open={styleOpen}
        settings={karaokeSettings}
        onSettingsChange={updateKaraokeSettings}
        onClose={() => setStyleOpen(false)}
      />
    </div>
  );
}
