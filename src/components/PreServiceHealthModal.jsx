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

const statusBadgeClass = (status, darkMode) => {
  if (status === 'pass') {
    return darkMode ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'warn') {
    return darkMode ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return darkMode ? 'border-rose-500/25 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700';
};

const getDashboardState = ({ failCount, warnCount, checks, loading }) => {
  if (loading && checks.length === 0) {
    return {
      status: 'warn',
      label: 'Checking readiness',
      detail: 'Running service-critical checks before reporting status.',
    };
  }
  if (failCount > 0) {
    return {
      status: 'fail',
      label: 'Not production ready',
      detail: `${failCount} required check${failCount === 1 ? '' : 's'} need attention before going live.`,
    };
  }
  if (warnCount > 0) {
    return {
      status: 'warn',
      label: 'Review before service',
      detail: `${warnCount} advisory check${warnCount === 1 ? '' : 's'} should be reviewed before production.`,
    };
  }
  return {
    status: 'pass',
    label: 'Production ready',
    detail: 'Service-critical systems are reporting healthy status.',
  };
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
  const [lastCheckedAt, setLastCheckedAt] = React.useState(null);

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
      setLastCheckedAt(new Date());

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

  const failCount = checks.filter((check) => check.status === 'fail').length;
  const warnCount = checks.filter((check) => check.status === 'warn').length;
  const passCount = checks.filter((check) => check.status === 'pass').length;
  const dashboardState = getDashboardState({ failCount, warnCount, checks, loading });
  const DashboardIcon = statusIcon[dashboardState.status] || AlertTriangle;
  const initialLoading = loading && checks.length === 0;
  const checkedAtLabel = lastCheckedAt
    ? lastCheckedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Pending';

  return (
    <div className="flex min-h-0 flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 190px)' }}>
      <div className={`flex items-center justify-between gap-4 border-b px-5 py-4 ${darkMode ? 'border-white/5 bg-slate-950/45' : 'border-slate-900/5 bg-[#f8fafc]'}`}>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            Production readiness dashboard
          </p>
          <p className={`mt-0.5 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Last checked: {checkedAtLabel}
          </p>
        </div>
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
        className={`min-h-0 flex-1 overflow-y-auto p-5 pb-16 ${darkMode ? 'bg-gray-950/20' : 'bg-gray-50/60'}`}
        style={{ maxHeight: 'calc(100vh - 285px)' }}
      >
        <div className="space-y-4">
          <section className={`rounded-xl border px-3.5 py-3 ${statusBadgeClass(dashboardState.status, darkMode)}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${darkMode ? 'bg-gray-950/50' : 'bg-white/80'}`}>
                  {initialLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <DashboardIcon className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold leading-tight">{dashboardState.label}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed opacity-85">{dashboardState.detail}</p>
                </div>
              </div>
              <div className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${darkMode ? 'border-white/10 bg-black/20' : 'border-black/5 bg-white/70'}`}>
                {passCount}/{checks.length || 0} checks passed
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Passed', value: passCount, status: 'pass' },
              { label: 'Warnings', value: warnCount, status: 'warn' },
              { label: 'Issues', value: failCount, status: 'fail' },
              { label: 'Total checks', value: checks.length || '-', status: dashboardState.status },
            ].map((metric) => (
              <div key={metric.label} className={`rounded-xl border px-4 py-3 ${darkMode ? 'border-gray-800 bg-gray-900/60' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-semibold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{metric.label}</span>
                  <span className={`h-2 w-2 rounded-full ${metric.status === 'pass' ? 'bg-emerald-500' : metric.status === 'warn' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                </div>
                <p className={`mt-2 text-2xl font-bold tabular-nums ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{metric.value}</p>
              </div>
            ))}
          </section>

          <section className={`mb-3 overflow-hidden rounded-2xl border ${darkMode ? 'border-gray-800 bg-gray-900/60' : 'border-gray-200 bg-white'}`}>
            <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
              <div>
                <p className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Readiness checks</p>
                <p className={`mt-0.5 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Connection, outputs, media, safety, and supporting services.</p>
              </div>
              {loading && checks.length > 0 && (
                <Loader2 className={`h-4 w-4 animate-spin ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              )}
            </div>

            {initialLoading ? (
              <div className={`flex items-center justify-center py-12 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Checking production readiness...
              </div>
            ) : (
              <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
                {checks.map((check) => {
                  const StatusIcon = statusIcon[check.status] || AlertTriangle;
                  const ItemIcon = checkIcon[check.id] || BadgeInfo;
                  return (
                    <div key={check.id} className={`grid gap-3 px-4 py-3 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] ${darkMode ? 'hover:bg-blue-500/5' : 'hover:bg-blue-50/50'}`}>
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${darkMode ? 'bg-gray-950 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                          <ItemIcon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{check.label}</p>
                          <p className={`mt-1 text-xs leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{check.detail}</p>
                        </div>
                      </div>
                      <div className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold uppercase ${statusBadgeClass(check.status, darkMode)}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {check.status === 'pass' ? 'Passed' : check.status === 'warn' ? 'Review' : 'Failed'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
