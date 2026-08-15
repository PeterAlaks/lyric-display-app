import React from 'react';
import { AlertTriangle, Download, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import { useActionLogBridge } from '../hooks/useActionLogBridge';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'secondary', label: 'Secondary Controllers' },
  { id: 'line', label: 'Lines' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'setlist', label: 'Setlist' },
  { id: 'output', label: 'Output' },
  { id: 'stage', label: 'Stage' },
  { id: 'safety', label: 'Safety' },
  { id: 'draft', label: 'Drafts' },
  { id: 'system', label: 'System' },
];

const typeTone = {
  line: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
  lyrics: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200',
  setlist: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
  output: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200',
  stage: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200',
  safety: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  draft: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-200',
  system: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

const formatTime = (timestamp) => {
  if (!Number.isFinite(timestamp)) return 'Unknown time';
  return new Date(timestamp).toLocaleString();
};

const formatActor = (actor = {}) => {
  const type = actor.clientType || 'unknown';
  const device = actor.deviceId ? ` (${String(actor.deviceId).slice(0, 18)})` : '';
  return `${type}${device}`;
};

const formatMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return '';
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join('; ');
};

const formatExport = (entries) => {
  const lines = [
    'LyricDisplay Operator Action Log',
    `Exported: ${new Date().toLocaleString()}`,
    '',
  ];

  entries.forEach((entry) => {
    lines.push(`[${formatTime(entry.createdAt)}] ${formatActor(entry.actor)} - ${entry.label || entry.type}`);
    if (entry.detail) lines.push(`  ${entry.detail}`);
    if (entry.target) lines.push(`  Target: ${entry.target}`);
    const metadata = formatMetadata(entry.metadata);
    if (metadata) lines.push(`  Metadata: ${metadata}`);
    lines.push('');
  });

  return lines.join('\n');
};

export default function OperatorActionLogModal({ darkMode }) {
  const { showToast } = useToast();
  const { showModal } = useModal();
  const { actionLog, requestActionLog, clearActionLog, ready, isAuthenticated } = useActionLogBridge();
  const [filter, setFilter] = React.useState('secondary');
  const filtersContainerRef = React.useRef(null);
  const filtersScrollerRef = React.useRef(null);

  React.useEffect(() => {
    requestActionLog();
  }, [requestActionLog]);

  const handleFiltersWheel = React.useCallback((event) => {
    const scroller = filtersScrollerRef.current;
    if (!scroller) return;

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    if (maxScrollLeft <= 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const wheelDelta = event.deltaX + event.deltaY;
    if (wheelDelta === 0) return;

    scroller.scrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, scroller.scrollLeft + wheelDelta)
    );
  }, []);

  React.useEffect(() => {
    const container = filtersContainerRef.current;
    const scroller = filtersScrollerRef.current;
    if (!container || !scroller) return;

    const handleNativeWheel = (event) => handleFiltersWheel(event);
    container.addEventListener('wheel', handleNativeWheel, { passive: false, capture: true });

    return () => {
      container.removeEventListener('wheel', handleNativeWheel, { capture: true });
    };
  }, [handleFiltersWheel]);

  const filteredEntries = React.useMemo(() => {
    const entries = [...actionLog].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (filter === 'all') return entries;
    if (filter === 'secondary') {
      return entries.filter((entry) => entry.actor?.clientType !== 'desktop');
    }
    return entries.filter((entry) => entry.type === filter);
  }, [actionLog, filter]);

  const handleExport = async () => {
    const content = formatExport(filteredEntries);
    const fileName = `lyricdisplay-action-log-${new Date().toISOString().slice(0, 10)}.txt`;

    try {
      if (window.electronAPI?.showSaveDialog && window.electronAPI?.writeFile) {
        const result = await window.electronAPI.showSaveDialog({
          title: 'Export Operator Action Log',
          defaultPath: fileName,
          filters: [{ name: 'Text Files', extensions: ['txt'] }],
        });
        if (result?.canceled || !result?.filePath) return;
        const writeResult = await window.electronAPI.writeFile(result.filePath, content);
        if (writeResult?.success === false) {
          throw new Error(writeResult.error || 'Unable to export action log');
        }
      } else {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      showToast({
        title: 'Action log exported',
        message: `${filteredEntries.length} entr${filteredEntries.length === 1 ? 'y' : 'ies'} exported.`,
        variant: 'success',
      });
    } catch (error) {
      showToast({
        title: 'Export failed',
        message: error.message || 'Unable to export action log.',
        variant: 'error',
      });
    }
  };

  const handleRefresh = () => {
    const requested = requestActionLog();
    if (requested) {
      showToast({
        title: 'Action log refresh requested',
        message: 'Fetching the latest operator activity.',
        variant: 'info',
        duration: 2500,
        dedupeKey: 'action-log-refresh',
      });
    }
  };

  const handleClear = async () => {
    const confirmation = await showModal({
      title: 'Clear Action Log?',
      description: 'This will remove the current operator action history. A new system entry will record that the log was cleared.',
      variant: 'warning',
      size: 'sm',
      actions: [
        { label: 'Cancel', variant: 'outline', value: false },
        { label: 'Clear Log', variant: 'destructive', value: true },
      ],
    });

    if (confirmation !== true) return;

    clearActionLog();
    showToast({
      title: 'Action log cleared',
      message: 'A new system entry was added after clearing the log.',
      variant: 'info',
    });
  };

  return (
    <div className="flex min-h-0 flex-col overflow-hidden" style={{ height: 'min(680px, calc(100vh - 180px))' }}>
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 ${darkMode ? 'border-white/5 bg-slate-950/45' : 'border-slate-900/5 bg-[#f8fafc]'}`}>
        <div className="min-w-0">
          <p className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Recent operator activity</p>
          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {isAuthenticated && ready ? `${actionLog.length} stored entr${actionLog.length === 1 ? 'y' : 'ies'}` : 'Waiting for authenticated control socket'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content="Refresh operator action log" side="bottom">
            <span className="inline-flex">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={!isAuthenticated || !ready}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </span>
          </Tooltip>
          <Tooltip content="Export visible log entries to a text file" side="bottom">
            <span className="inline-flex">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredEntries.length === 0}>
                <Download className="h-4 w-4" />
              </Button>
            </span>
          </Tooltip>
          <Tooltip content="Clear the operator action log" side="bottom">
            <span className="inline-flex">
              <Button variant="outline" size="sm" onClick={handleClear} disabled={!isAuthenticated || !ready}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="relative border-b border-gray-200 dark:border-gray-700" ref={filtersContainerRef}>
        <div
          ref={filtersScrollerRef}
          className="flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap overscroll-contain px-5 py-3"
        >
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${filter === item.id
                ? darkMode ? 'border-gray-500 bg-gray-700 text-white' : 'border-gray-900 bg-gray-900 text-white'
                : darkMode ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 w-12 ${darkMode
            ? 'bg-gradient-to-l from-gray-900 via-gray-900/85 to-transparent'
            : 'bg-gradient-to-l from-white via-white/85 to-transparent'
            }`}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-32">
        {filteredEntries.length === 0 ? (
          <div className={`flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-300 text-gray-500'}`}>
            <FileText className="mb-3 h-8 w-8 opacity-70" />
            <p className="text-sm font-medium">No action log entries</p>
            <p className="mt-1 text-xs">Live actions will appear here after operators make changes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => {
              const tone = typeTone[entry.type] || typeTone.system;
              const metadata = formatMetadata(entry.metadata);
              return (
                <div
                  key={entry.id}
                  className={`rounded-lg border p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${tone}`}>
                          {entry.type || 'system'}
                        </span>
                        <p className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {entry.label}
                        </p>
                      </div>
                      <p className={`mt-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{entry.detail}</p>
                    </div>
                    <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{formatTime(entry.createdAt)}</p>
                  </div>

                  <div className={`mt-3 grid gap-2 text-xs sm:grid-cols-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    <p>Actor: {formatActor(entry.actor)}</p>
                    {entry.target && <p>Target: {entry.target}</p>}
                    {metadata && <p className="sm:col-span-2">Metadata: {metadata}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!isAuthenticated && (
        <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          The action log requires an authenticated desktop control connection.
        </div>
      )}
    </div>
  );
}
