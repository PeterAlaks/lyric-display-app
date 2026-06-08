import React from 'react';
import { Download } from 'lucide-react';
import useModal from '../../hooks/useModal';

function KaraokeExportBody({
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
        <div className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
          <div className="text-xs uppercase tracking-wide text-gray-500">Format</div>
          <div className="mt-1 font-medium text-gray-950 dark:text-gray-100">{settings.format.toUpperCase()}</div>
        </div>
        <div className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
          <div className="text-xs uppercase tracking-wide text-gray-500">Canvas</div>
          <div className="mt-1 font-medium text-gray-950 dark:text-gray-100">{settings.width} x {settings.height}</div>
        </div>
        <div className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
          <div className="text-xs uppercase tracking-wide text-gray-500">Frame Rate</div>
          <div className="mt-1 font-medium text-gray-950 dark:text-gray-100">{settings.fps} fps</div>
        </div>
        <div className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
          <div className="text-xs uppercase tracking-wide text-gray-500">Outro</div>
          <div className="mt-1 font-medium text-gray-950 dark:text-gray-100">{settings.outroPaddingMs} ms</div>
        </div>
      </div>

      {isExporting && (
        <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex justify-between text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-100">
            <span>{progress?.phase || 'exporting'}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-900">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="text-xs text-emerald-900 dark:text-emerald-100">
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

      <div className="rounded-md bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        Readiness: {audioAttached ? 'audio attached' : 'audio missing'}, {audioExportable ? 'desktop file path ready' : 'desktop file path missing'}, {hasTimedLyrics ? 'timed lyrics loaded' : 'timed lyrics missing'}. FFmpeg must be installed and available on PATH.
      </div>
    </div>
  );
}

export default function KaraokeExportModal({
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
      headerDescription: 'Render fixed frames, encode with FFmpeg, and mux the selected audio.',
      variant: 'info',
      icon: <Download className="h-6 w-6" aria-hidden />,
      size: 'md',
      scrollBehavior: 'scroll',
      allowBackdropClose: false,
      dismissible: !isExporting,
      modalKey: 'karaoke-export-settings',
      body: (
        <KaraokeExportBody
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
