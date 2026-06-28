import React from 'react';
import {
  Captions,
  Download,
  ExternalLink,
  FileAudio,
  FolderOpen,
  Gauge,
  HardDrive,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
  Wrench,
} from 'lucide-react';
import useModal from '../../hooks/useModal';
import { Button } from '../ui/button';
import AlwaysInfoButton from './AlwaysInfoButton';

const PERFORMANCE_MODES = [
  {
    value: 'faster',
    label: 'Faster',
    icon: Zap,
  },
  {
    value: 'balanced',
    label: 'Balanced',
    icon: Gauge,
  },
  {
    value: 'best',
    label: 'Best',
    icon: Sparkles,
  },
];

const formatMp4Name = (name) => {
  const trimmed = String(name || 'Untitled Video 1').trim() || 'Untitled Video 1';
  return trimmed.toLowerCase().endsWith('.mp4') ? trimmed : `${trimmed}.mp4`;
};

function ReadinessRow({ icon: Icon, label, detail, ready, checking }) {
  return (
    <div className="flex min-w-0 items-start gap-3 py-2.5">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center ${ready
        ? 'text-green-600 dark:text-green-300'
        : checking
          ? 'text-blue-600 dark:text-blue-300'
          : 'text-amber-600 dark:text-amber-300'
        }`}
      >
        {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="font-medium text-gray-900 dark:text-gray-100">{label}</span>
          <span className={`shrink-0 text-xs font-medium ${ready
            ? 'text-green-700 dark:text-green-300'
            : checking
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {checking ? 'Checking' : ready ? 'Ready' : 'Needs attention'}
          </span>
        </div>
        {detail && (
          <p className="mt-0.5 wrap-break-word text-xs leading-5 text-gray-500 dark:text-gray-400">{detail}</p>
        )}
      </div>
    </div>
  );
}

function LyricVideoExportBody({
  settings,
  projectName,
  audioAttached,
  audioExportable,
  hasTimedLyrics,
  ffmpegReadiness,
  isExporting,
  progress,
  result,
  performanceMode,
  onPerformanceModeChange,
  onSelectFfmpeg,
  onRefreshReadiness,
  onOpenFfmpegDownload,
}) {
  const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
  const ffmpegChecking = ffmpegReadiness?.checking || !ffmpegReadiness;
  const ffmpegReady = ffmpegReadiness?.available === true;
  const ffmpegActionsDisabled = isExporting || ffmpegChecking;
  const ffmpegActionButtonClass = 'justify-start border-gray-300 bg-white text-gray-800 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-100 dark:hover:border-blue-400/60 dark:hover:bg-blue-500/15 dark:hover:text-blue-100';
  const readinessItems = [
    {
      label: 'Audio attached',
      icon: FileAudio,
      ready: audioAttached,
    },
    {
      label: 'Desktop audio path',
      icon: HardDrive,
      ready: audioExportable,
    },
    {
      label: 'Timed LRC lyrics',
      icon: Captions,
      ready: hasTimedLyrics,
    },
    {
      label: 'FFmpeg',
      icon: Wrench,
      ready: ffmpegReady,
      checking: ffmpegChecking,
      detail: ffmpegChecking
        ? 'checking...'
        : ffmpegReady
          ? `Ready${ffmpegReadiness?.ffmpegPath ? `: ${ffmpegReadiness.ffmpegPath}` : ''}`
          : (ffmpegReadiness?.error || 'FFmpeg is not available.'),
    },
  ];

  return (
    <div className="space-y-5 text-sm">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Export Settings</div>
          </div>
          <div className="min-w-0 max-w-[50%] truncate text-xs font-medium text-gray-600 dark:text-gray-300">
            {formatMp4Name(projectName)}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/70">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Format</dt>
            <dd className="mt-1 font-medium text-gray-950 dark:text-gray-100">{settings.format.toUpperCase()}</dd>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/70">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Canvas</dt>
            <dd className="mt-1 font-medium text-gray-950 dark:text-gray-100">{settings.width} x {settings.height}</dd>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/70">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Frame Rate</dt>
            <dd className="mt-1 font-medium text-gray-950 dark:text-gray-100">{settings.fps} fps</dd>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/70">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Outro</dt>
            <dd className="mt-1 font-medium text-gray-950 dark:text-gray-100">{settings.outroPaddingMs} ms</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Performance</div>
          <AlwaysInfoButton
            side="left"
            ariaLabel="Export performance notes"
            content="Faster export depends on FFmpeg hardware encoder support on this computer. Battery power can slow exports."
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {PERFORMANCE_MODES.map((mode) => {
            const Icon = mode.icon;
            const selected = performanceMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                disabled={isExporting}
                onClick={() => onPerformanceModeChange(mode.value)}
                className={`min-h-11.5 rounded-md border px-3 py-2 text-left transition ${selected
                  ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-200 dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-100 dark:ring-blue-400/30'
                  : 'border-gray-200 bg-white text-gray-800 hover:border-blue-300 hover:bg-blue-50/60 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-100 dark:hover:border-blue-400/60 dark:hover:bg-blue-500/10'
                } ${isExporting ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4" />
                  {mode.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {isExporting && (
        <div className="space-y-2 border-b border-gray-200 pb-4 dark:border-gray-800">
          <div className="flex justify-between text-xs font-medium uppercase tracking-wide text-blue-800 dark:text-blue-100">
            <span>{progress?.phase || 'exporting'}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-950">
            <div className="h-full bg-linear-to-r from-blue-400 to-purple-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="text-xs text-blue-900 dark:text-blue-100">
            Frame {progress?.frame || 0} of {progress?.frameCount || 0}
          </div>
        </div>
      )}

      {result?.success && (
        <div className="border-b border-gray-200 pb-4 text-green-700 dark:border-gray-800 dark:text-green-300">
          Export complete: <span className="font-mono">{result.outputPath}</span>
        </div>
      )}

      {result?.error && (
        <div className="max-h-40 overflow-y-auto border-b border-gray-200 pb-4 text-red-700 dark:border-gray-800 dark:text-red-300">
          {result.error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="space-y-3">
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {readinessItems.map((item) => (
              <ReadinessRow key={item.label} {...item} />
            ))}
          </div>
        </section>

        <aside className="space-y-4 lg:border-l lg:border-gray-200 lg:pl-5 lg:dark:border-gray-800">
          {!ffmpegReady && !ffmpegChecking ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-medium text-gray-950 dark:text-gray-100">
                <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                Set up FFmpeg
              </div>
              <p className="text-xs leading-5 text-gray-600 dark:text-gray-300">
                On ffmpeg.org, use the packages or executable builds for your platform. You can choose the downloaded zip, extracted folder, or ffmpeg executable.
              </p>
              <div className="grid gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onOpenFfmpegDownload} disabled={ffmpegActionsDisabled} className={ffmpegActionButtonClass}>
                  <ExternalLink className="h-4 w-4" />
                  Get FFmpeg
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onSelectFfmpeg} disabled={ffmpegActionsDisabled} className={ffmpegActionButtonClass}>
                  <FolderOpen className="h-4 w-4" />
                  Choose FFmpeg
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onRefreshReadiness} disabled={ffmpegActionsDisabled} className={ffmpegActionButtonClass}>
                  <RefreshCw className={`h-4 w-4 ${ffmpegChecking ? 'animate-spin' : ''}`} />
                  Recheck
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onSelectFfmpeg} disabled={ffmpegActionsDisabled} className={ffmpegActionButtonClass}>
                <FolderOpen className="h-4 w-4" />
                Change FFmpeg
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onRefreshReadiness} disabled={ffmpegActionsDisabled} className={ffmpegActionButtonClass}>
                <RefreshCw className={`h-4 w-4 ${ffmpegChecking ? 'animate-spin' : ''}`} />
                Recheck
              </Button>
            </div>
          )}

          <div className="text-xs leading-5 text-gray-600 dark:text-gray-300">
            <p>
              This export uses only the LRC and audio files you selected locally. Confirm you have the rights needed before publishing or distributing the rendered video.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function LyricVideoExportModal({
  open,
  settings,
  projectName,
  audioAttached,
  audioExportable,
  hasTimedLyrics,
  ffmpegReadiness,
  isExporting,
  progress,
  result,
  onSelectFfmpeg,
  onRefreshReadiness,
  onOpenFfmpegDownload,
  onStartExport,
  onCancelExport,
  onClose,
}) {
  const { showModal } = useModal();
  const [performanceMode, setPerformanceMode] = React.useState('balanced');
  const openRef = React.useRef(false);
  const latestRef = React.useRef({ onClose });
  const ffmpegReady = ffmpegReadiness?.available === true;
  const canExport = audioAttached && audioExportable && hasTimedLyrics && ffmpegReady && !isExporting;

  React.useEffect(() => {
    latestRef.current = { onClose };
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;

    const promise = showModal({
      title: 'MP4 Export',
      headerDescription: 'Render lyric video frames, encode with FFmpeg, and mux the selected audio.',
      variant: 'info',
      icon: <Download className="h-6 w-6" aria-hidden />,
      size: 'lg',
      className: 'h-[min(680px,calc(100vh-120px))]',
      scrollBehavior: 'scroll',
      allowBackdropClose: false,
      dismissible: !isExporting,
      modalKey: 'lyricVideo-export-settings',
      body: (
        <LyricVideoExportBody
          settings={settings}
          projectName={projectName}
          audioAttached={audioAttached}
          audioExportable={audioExportable}
          hasTimedLyrics={hasTimedLyrics}
          ffmpegReadiness={ffmpegReadiness}
          isExporting={isExporting}
          progress={progress}
          result={result}
          performanceMode={performanceMode}
          onPerformanceModeChange={setPerformanceMode}
          onSelectFfmpeg={onSelectFfmpeg}
          onRefreshReadiness={onRefreshReadiness}
          onOpenFfmpegDownload={onOpenFfmpegDownload}
        />
      ),
      actions: isExporting
        ? [
            {
              label: 'Cancel Export',
              value: 'cancel',
              variant: 'outline',
              closeOnClick: false,
              onSelect: onCancelExport,
            },
          ]
        : [
            {
              label: 'Close',
              value: 'close',
              variant: 'outline',
            },
            {
              label: 'Export MP4',
              value: 'export',
              variant: 'default',
              disabled: !canExport,
              closeOnClick: false,
              onSelect: () => onStartExport(performanceMode),
            },
          ],
    });

    if (!openRef.current) {
      openRef.current = true;
      promise.finally(() => {
        openRef.current = false;
        latestRef.current.onClose?.();
      });
    }
  }, [
    audioAttached,
    audioExportable,
    canExport,
    hasTimedLyrics,
    ffmpegReadiness,
    isExporting,
    onCancelExport,
    onOpenFfmpegDownload,
    onRefreshReadiness,
    onSelectFfmpeg,
    onStartExport,
    open,
    performanceMode,
    progress,
    projectName,
    result,
    settings,
    showModal,
  ]);

  return null;
}
