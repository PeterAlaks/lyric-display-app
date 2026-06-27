import React from 'react';
import { Download } from 'lucide-react';
import useModal from '../../hooks/useModal';

function LyricVideoExportBody({
  settings,
  audioAttached,
  audioExportable,
  hasTimedLyrics,
  isExporting,
  progress,
  result,
}) {
  const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-900/70">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Format</div>
          <div className="mt-1 font-medium text-gray-950 dark:text-gray-100">{settings.format.toUpperCase()}</div>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-900/70">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Canvas</div>
          <div className="mt-1 font-medium text-gray-950 dark:text-gray-100">{settings.width} x {settings.height}</div>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-900/70">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Frame Rate</div>
          <div className="mt-1 font-medium text-gray-950 dark:text-gray-100">{settings.fps} fps</div>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-900/70">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Outro</div>
          <div className="mt-1 font-medium text-gray-950 dark:text-gray-100">{settings.outroPaddingMs} ms</div>
        </div>
      </div>

      {isExporting && (
        <div className="space-y-2 rounded-xl bg-blue-50 p-3 dark:bg-blue-500/10">
          <div className="flex justify-between text-xs font-medium uppercase tracking-wide text-blue-800 dark:text-blue-100">
            <span>{progress?.phase || 'exporting'}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-950">
            <div className="h-full bg-gradient-to-r from-blue-400 to-purple-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="text-xs text-blue-900 dark:text-blue-100">
            Frame {progress?.frame || 0} of {progress?.frameCount || 0}
          </div>
        </div>
      )}

      {result?.success && (
        <div className="rounded-md bg-green-50 p-3 text-green-900 dark:bg-green-950/40 dark:text-green-100">
          Export complete: <span className="font-mono">{result.outputPath}</span>
        </div>
      )}

      {result?.error && (
        <div className="max-h-40 overflow-y-auto rounded-md bg-red-50 p-3 text-red-900 dark:bg-red-950/40 dark:text-red-100">
          {result.error}
        </div>
      )}

      <div className="rounded-xl bg-gray-50 p-3 text-gray-700 dark:bg-gray-900/70 dark:text-gray-300">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Readiness</div>
        {audioAttached ? 'Audio attached' : 'Audio missing'}, {audioExportable ? 'desktop file path ready' : 'desktop file path missing'}, {hasTimedLyrics ? 'timed lyrics loaded' : 'timed lyrics missing'}. FFmpeg must be installed and available on PATH.
      </div>
    </div>
  );
}

export default function LyricVideoExportModal({
  open,
  settings,
  audioAttached,
  audioExportable,
  hasTimedLyrics,
  isExporting,
  progress,
  result,
  onStartExport,
  onCancelExport,
  onClose,
}) {
  const { showModal } = useModal();
  const openRef = React.useRef(false);
  const latestRef = React.useRef({ onClose });
  const canExport = audioAttached && audioExportable && hasTimedLyrics && !isExporting;

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
      size: 'md',
      scrollBehavior: 'scroll',
      allowBackdropClose: false,
      dismissible: !isExporting,
      modalKey: 'lyricVideo-export-settings',
      body: (
        <LyricVideoExportBody
          settings={settings}
          audioAttached={audioAttached}
          audioExportable={audioExportable}
          hasTimedLyrics={hasTimedLyrics}
          isExporting={isExporting}
          progress={progress}
          result={result}
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
              onSelect: onStartExport,
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
    isExporting,
    onCancelExport,
    onStartExport,
    open,
    progress,
    result,
    settings,
    showModal,
  ]);

  return null;
}
