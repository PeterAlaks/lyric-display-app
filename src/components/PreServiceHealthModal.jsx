import React from 'react';
import {
  AlertTriangle,
  BadgeInfo,
  CheckCircle2,
  FileText,
  Image,
  ListMusic,
  Loader2,
  Monitor,
  PanelTop,
  RadioTower,
  RefreshCw,
  Server,
  ShieldCheck,
  Wifi,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveBackendUrl } from '../utils/network';
import useLyricsStore from '../context/LyricsStore';
import { useLiveSafetyBridge } from '../hooks/useLiveSafetyBridge';
import useToast from '../hooks/useToast';

const statusIcon = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
};

const checkIcon = {
  backend: Server,
  socket: Wifi,
  lyrics: FileText,
  setlist: ListMusic,
  outputs: PanelTop,
  displays: Monitor,
  ndi: RadioTower,
  version: BadgeInfo,
  media: Image,
  liveSafety: ShieldCheck,
};

const statusClass = (status, darkMode) => {
  if (status === 'pass') return darkMode ? 'text-emerald-300' : 'text-emerald-600';
  if (status === 'warn') return darkMode ? 'text-amber-300' : 'text-amber-600';
  return darkMode ? 'text-rose-300' : 'text-rose-600';
};

const collectMediaReferences = (storeState) => {
  const refs = [];
  const outputIds = ['output1', 'output2', ...(storeState.customOutputIds || [])];
  for (const id of outputIds) {
    const settings = storeState[`${id}Settings`] || {};
    if (settings.fullScreenBackgroundMedia) refs.push({ output: id, url: settings.fullScreenBackgroundMedia });
    if (settings.fullScreenElementMedia) refs.push({ output: id, url: settings.fullScreenElementMedia });
  }
  return refs;
};

export default function PreServiceHealthModal({ darkMode }) {
  const { authStatus, connectionStatus, ready, liveSafety } = useLiveSafetyBridge();
  const { showToast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [checks, setChecks] = React.useState([]);

  const runChecks = React.useCallback(async ({ notify = false } = {}) => {
    setLoading(true);
    const nextChecks = [];
    const storeState = useLyricsStore.getState();

    try {
      try {
        const response = await fetch(resolveBackendUrl('/api/health/ready'));
        const payload = await response.json().catch(() => ({}));
        nextChecks.push({
          id: 'backend',
          label: 'Backend',
          status: response.ok && payload.status === 'ready' ? 'pass' : 'fail',
          detail: response.ok ? `Ready on port ${payload.port || 4000}` : (payload.error || 'Backend is not ready'),
        });
      } catch (error) {
        nextChecks.push({ id: 'backend', label: 'Backend', status: 'fail', detail: error.message });
      }

    nextChecks.push({
      id: 'socket',
      label: 'Socket',
      status: connectionStatus === 'connected' && authStatus === 'authenticated' && ready ? 'pass' : 'fail',
      detail: `${connectionStatus}, ${authStatus}${ready ? ', synced' : ', waiting for state sync'}`,
    });

    const lyricsCount = Array.isArray(storeState.lyrics) ? storeState.lyrics.length : 0;
    nextChecks.push({
      id: 'lyrics',
      label: 'Loaded Lyrics',
      status: lyricsCount > 0 ? 'pass' : 'warn',
      detail: lyricsCount > 0 ? `${storeState.lyricsFileName || 'Untitled'} (${lyricsCount} lines)` : 'No lyrics are currently loaded',
    });

    nextChecks.push({
      id: 'setlist',
      label: 'Setlist',
      status: (storeState.setlistFiles || []).length > 0 ? 'pass' : 'warn',
      detail: `${(storeState.setlistFiles || []).length} songs loaded`,
    });

    const outputIds = ['output1', 'output2', ...(storeState.customOutputIds || [])];
    const connectedOutputs = outputIds.filter((id) => Number(storeState[`${id}Settings`]?.instanceCount || 0) > 0);
    nextChecks.push({
      id: 'outputs',
      label: 'Output Browser Sources',
      status: connectedOutputs.length > 0 ? 'pass' : 'warn',
      detail: connectedOutputs.length > 0
        ? `${connectedOutputs.length}/${outputIds.length} output(s) reporting metrics`
        : 'No output browser source has reported metrics yet',
    });

    try {
      const projection = await window.electronAPI?.display?.getProjectionState?.();
      nextChecks.push({
        id: 'displays',
        label: 'Displays',
        status: projection?.success ? 'pass' : 'warn',
        detail: projection?.success
          ? `${projection.displays?.length || 0} display(s), ${projection.projections?.length || 0} projection window(s)`
          : 'Display state unavailable',
      });
    } catch (error) {
      nextChecks.push({ id: 'displays', label: 'Displays', status: 'warn', detail: error.message });
    }

    try {
      const ndi = await window.electronAPI?.ndi?.getCompanionStatus?.();
      nextChecks.push({
        id: 'ndi',
        label: 'NDI Companion',
        status: ndi?.running ? 'pass' : (ndi?.installed ? 'warn' : 'warn'),
        detail: ndi?.running
          ? `Running${ndi.version ? `, v${ndi.version}` : ''}`
          : (ndi?.installed ? 'Installed but not running' : 'Not installed'),
      });
    } catch (error) {
      nextChecks.push({ id: 'ndi', label: 'NDI Companion', status: 'warn', detail: error.message });
    }

    try {
      const version = await window.electronAPI?.getAppVersion?.();
      nextChecks.push({
        id: 'version',
        label: 'App Version',
        status: 'pass',
        detail: version?.version ? `LyricDisplay ${version.version}` : 'Version unavailable',
      });
    } catch (error) {
      nextChecks.push({ id: 'version', label: 'App Version', status: 'warn', detail: error.message });
    }

    const mediaRefs = collectMediaReferences(storeState);
    if (mediaRefs.length === 0) {
      nextChecks.push({ id: 'media', label: 'Media Assets', status: 'pass', detail: 'No custom media references in output styles' });
    } else {
      const missing = [];
      await Promise.all(mediaRefs.map(async (media) => {
        try {
          const response = await fetch(resolveBackendUrl(media.url), { method: 'HEAD' });
          if (!response.ok) missing.push(media);
        } catch {
          missing.push(media);
        }
      }));
      nextChecks.push({
        id: 'media',
        label: 'Media Assets',
        status: missing.length === 0 ? 'pass' : 'fail',
        detail: missing.length === 0 ? `${mediaRefs.length} media reference(s) reachable` : `${missing.length}/${mediaRefs.length} media reference(s) missing`,
      });
    }

      nextChecks.push({
        id: 'liveSafety',
        label: 'Live Safety',
        status: liveSafety?.enabled ? 'pass' : 'warn',
        detail: liveSafety?.enabled ? 'Enabled for secondary controllers' : 'Disabled',
      });

      setChecks(nextChecks);

      if (notify) {
        const failCount = nextChecks.filter((check) => check.status === 'fail').length;
        if (failCount > 0) {
          showToast({
            title: 'Production readiness failed',
            message: `${failCount} check${failCount === 1 ? '' : 's'} need attention.`,
            variant: 'error',
            duration: 5000,
            dedupeKey: 'production-readiness-refresh',
          });
        } else {
          showToast({
            title: 'Production readiness refreshed',
            message: 'Production readiness checks completed successfully.',
            variant: 'success',
            duration: 3500,
            dedupeKey: 'production-readiness-refresh',
          });
        }
      }
    } catch (error) {
      if (notify) {
        showToast({
          title: 'Production readiness failed',
          message: error.message || 'Unable to refresh production readiness.',
          variant: 'error',
          duration: 5000,
          dedupeKey: 'production-readiness-refresh',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [authStatus, connectionStatus, liveSafety?.enabled, ready, showToast]);

  React.useEffect(() => {
    runChecks();
  }, [runChecks]);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
        <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Production readiness
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => runChecks({ notify: true })}
          disabled={loading}
          title="Refresh production readiness checks"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto p-5 pb-16"
        style={{ maxHeight: 'calc(100vh - 300px)' }}
      >
        {loading && checks.length === 0 ? (
          <div className={`flex items-center justify-center py-10 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Checking production readiness...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {checks.map((check) => {
              const StatusIcon = statusIcon[check.status] || AlertTriangle;
              const ItemIcon = checkIcon[check.id] || BadgeInfo;
              return (
                <div
                  key={check.id}
                  className={`relative min-h-[136px] rounded-lg border p-4 shadow-sm transition-colors ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${darkMode ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-700'}`}>
                      <ItemIcon className="h-5 w-5" />
                    </div>
                    <StatusIcon className={`h-5 w-5 flex-shrink-0 ${statusClass(check.status, darkMode)}`} />
                  </div>
                  <div className="mt-4 min-w-0">
                    <p className={`text-sm font-semibold leading-tight ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{check.label}</p>
                    <p className={`mt-2 text-xs leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{check.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
