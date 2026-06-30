import React, { useCallback, useEffect } from 'react';
import { Activity, Shield, ShieldAlert, ShieldCheck, RefreshCw, Copy, Check, Wifi } from 'lucide-react';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import { Tooltip } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { useLiveSafetyBridge } from '../hooks/useLiveSafetyBridge';

/* ─────────────────────────────────────────────────────────── Live Safety Cell */
function LiveSafetyStatusCell({ darkMode }) {
  const { liveSafety, setLiveSafetyEnabled, isAuthenticated, ready } = useLiveSafetyBridge();
  const d = darkMode;
  const on = Boolean(liveSafety?.enabled);

  return (
    <div className="space-y-1.5">
      <p className={`text-[10px] font-semibold uppercase tracking-widest ${d ? 'text-gray-500' : 'text-gray-400'}`}>
        Live Safety
      </p>
      <div className="flex items-center gap-2.5">
        <Switch
          checked={on}
          disabled={!isAuthenticated || !ready}
          onCheckedChange={(checked) => setLiveSafetyEnabled(checked)}
          className={`h-6! w-11! border-0! transition-colors ${
            d
              ? 'data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-gray-700'
              : 'data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-gray-200'
          }`}
          thumbClassName="!h-4 !w-4 data-[state=checked]:!translate-x-5.5 data-[state=unchecked]:!translate-x-1"
        />
        <span className={`text-xs font-semibold ${on ? 'text-emerald-500' : (d ? 'text-gray-500' : 'text-gray-400')}`}>
          {on ? 'On' : 'Off'}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────── Status badge helpers */
const STATUS_CONFIG = {
  success: { dot: 'bg-emerald-500', label: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20' },
  warning: { dot: 'bg-amber-400 animate-pulse', label: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20' },
  error:   { dot: 'bg-rose-500', label: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20' },
  info:    { dot: 'bg-gray-400 animate-pulse', label: 'text-gray-500 dark:text-gray-400', badge: 'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-600' },
};

function StatusBadge({ value, variant }) {
  const cfg = STATUS_CONFIG[variant] || STATUS_CONFIG.info;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {value}
    </span>
  );
}

/* ──────────────────────────────────────────────────────── Main component */
const AuthStatusIndicator = ({
  authStatus,
  connectionStatus,
  onRetry,
  onRefreshToken,
  darkMode = false,
  compact = false,
  className = '',
}) => {
  const { showToast } = useToast();
  const { showModal } = useModal();
  const [joinCode, setJoinCode] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const d = darkMode;

  const refreshJoinCode = useCallback(async () => {
    try {
      if (window.electronAPI?.getJoinCode) {
        const code = await window.electronAPI.getJoinCode();
        setJoinCode(code || null);
        return;
      }
      setJoinCode(null);
    } catch {
      console.warn('Failed to load join code');
    }
  }, []);

  useEffect(() => {
    refreshJoinCode();
    const handleJoinCodeUpdated = (event) => {
      const nextCode = event?.detail?.joinCode;
      if (typeof nextCode === 'string') setJoinCode(nextCode);
      else { setJoinCode(null); refreshJoinCode(); }
    };
    window.addEventListener('join-code-updated', handleJoinCodeUpdated);
    return () => window.removeEventListener('join-code-updated', handleJoinCodeUpdated);
  }, [refreshJoinCode]);

  useEffect(() => {
    const handleAuthError = (e) => showToast({ title: 'Authentication Error', message: e.detail.message || 'Authentication failed', variant: 'error' });
    const handlePermissionError = (e) => showToast({ title: 'Permission Denied', message: e.detail.message || 'Insufficient permissions', variant: 'warning' });
    const handleSetlistError = (e) => showToast({ title: 'Setlist Error', message: e.detail.message || 'Operation failed', variant: 'error' });
    const handleSetlistSuccess = (e) => {
      const { addedCount, totalCount } = e.detail;
      if (typeof addedCount === 'number' && addedCount > 1) {
        showToast({ title: 'Files Added', message: `Added ${addedCount} files (Total: ${totalCount})`, variant: 'success' });
      }
    };
    window.addEventListener('auth-error', handleAuthError);
    window.addEventListener('permission-error', handlePermissionError);
    window.addEventListener('setlist-error', handleSetlistError);
    window.addEventListener('setlist-add-success', handleSetlistSuccess);
    return () => {
      window.removeEventListener('auth-error', handleAuthError);
      window.removeEventListener('permission-error', handlePermissionError);
      window.removeEventListener('setlist-error', handleSetlistError);
      window.removeEventListener('setlist-add-success', handleSetlistSuccess);
    };
  }, [showToast]);

  /* ── derived state ── */
  const getVariant = () => {
    if (authStatus === 'authenticated' && connectionStatus === 'connected') return 'success';
    if (authStatus === 'authenticating' || connectionStatus === 'reconnecting') return 'warning';
    if (authStatus === 'failed' || authStatus === 'admin-key-required' || connectionStatus === 'error') return 'error';
    return 'info';
  };

  const variant = getVariant();
  const cfg = STATUS_CONFIG[variant];

  const getLabel = () => {
    if (authStatus === 'authenticated' && connectionStatus === 'connected') return 'Connected';
    if (authStatus === 'authenticating') return 'Authenticating…';
    if (connectionStatus === 'reconnecting') return 'Reconnecting…';
    if (authStatus === 'failed') return 'Auth Failed';
    if (authStatus === 'admin-key-required') return 'Key Required';
    if (connectionStatus === 'error') return 'Error';
    if (connectionStatus === 'disconnected') return 'Disconnected';
    return 'Connecting…';
  };

  const getStatusText = () => {
    if (authStatus === 'authenticated' && connectionStatus === 'connected') return 'Your connection is secure';
    if (authStatus === 'authenticating') return 'Establishing secure session…';
    if (connectionStatus === 'reconnecting') return 'Reconnecting…';
    if (authStatus === 'failed') return 'Authentication failed';
    if (authStatus === 'admin-key-required') return 'Administrator key required';
    if (connectionStatus === 'error') return 'Connection error';
    if (connectionStatus === 'disconnected') return 'Disconnected';
    return 'Connecting…';
  };

  const getSubtext = () => {
    if (authStatus === 'authenticated' && connectionStatus === 'connected')
      return 'Your connection is secured with JWT tokens and has full permissions.';
    if (authStatus === 'failed')
      return 'Authentication failed. Please retry to obtain a new token.';
    if (authStatus === 'admin-key-required')
      return 'Waiting for the administrator key. Restore secure secrets on the host machine, then retry.';
    if (connectionStatus === 'error')
      return 'Connection to the backend failed. Check the server status and try again.';
    if (authStatus === 'authenticating' || connectionStatus === 'reconnecting')
      return 'The client is attempting to establish a secure session.';
    return '';
  };

  const getStatusIcon = (size = 'w-4 h-4') => {
    if (authStatus === 'authenticated' && connectionStatus === 'connected')
      return <ShieldCheck className={`${size} text-emerald-500`} />;
    if (authStatus === 'authenticating' || connectionStatus === 'reconnecting')
      return <RefreshCw className={`${size} text-amber-400 animate-spin`} />;
    if (authStatus === 'failed' || authStatus === 'admin-key-required' || connectionStatus === 'error')
      return <ShieldAlert className={`${size} text-rose-500`} />;
    return <Shield className={`${size} text-gray-400`} />;
  };

  const cap = (s) => typeof s === 'string' ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  const connVariant = connectionStatus === 'connected' ? 'success'
    : connectionStatus === 'reconnecting' ? 'warning'
    : connectionStatus === 'error' ? 'error' : 'info';

  const authVariant = authStatus === 'authenticated' ? 'success'
    : authStatus === 'authenticating' ? 'warning'
    : (authStatus === 'failed' || authStatus === 'admin-key-required') ? 'error' : 'info';

  /* ── modal body ── */
  const showAuthModal = () => {
    refreshJoinCode();
    const isConnected = authStatus === 'authenticated' && connectionStatus === 'connected';

    const handleCopyCode = () => {
      if (!joinCode) return;
      navigator.clipboard.writeText(joinCode).then(() => {
        showToast({ title: 'Copied', message: 'Join code copied to clipboard', variant: 'success', duration: 2000 });
      }).catch(() => showToast({ title: 'Copy failed', message: 'Could not copy join code', variant: 'error' }));
    };

    const handleOpenPreServiceHealth = () => {
      showModal({
        title: 'Production Readiness Check',
        headerDescription: 'Review service-critical connection, output, NDI, display, media, and safety status',
        component: 'PreServiceHealth',
        variant: 'info',
        size: 'lg',
        customLayout: true,
        actions: [{ label: 'Close', variant: 'outline' }],
      });
    };

    const body = (
      <div className="space-y-5">
        {/* Status summary */}
        <div className={`flex items-start gap-3.5 p-4 rounded-xl ${
          variant === 'success'
            ? (d ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-100')
            : variant === 'error'
            ? (d ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-rose-50 border border-rose-100')
            : variant === 'warning'
            ? (d ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-100')
            : (d ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200')
        }`}>
          <span className="mt-0.5 shrink-0">{getStatusIcon('w-5 h-5')}</span>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${d ? 'text-white' : 'text-gray-900'}`}>{getStatusText()}</p>
            {getSubtext() && (
              <p className={`text-xs mt-0.5 leading-relaxed ${d ? 'text-gray-400' : 'text-gray-500'}`}>{getSubtext()}</p>
            )}
          </div>
        </div>

        {/* Status grid */}
        <div className={`rounded-xl border overflow-hidden ${d ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className={`grid grid-cols-3 divide-x ${d ? 'divide-gray-800' : 'divide-gray-200'}`}>
            {[
              { label: 'Connection', value: cap(connectionStatus), variant: connVariant },
              { label: 'Authentication', value: cap(authStatus), variant: authVariant },
            ].map(({ label, value, variant: v }) => (
              <div key={label} className={`px-4 py-3.5 ${d ? 'bg-gray-900/40' : 'bg-white'}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${d ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
                <StatusBadge value={value} variant={v} />
              </div>
            ))}
            <div className={`px-4 py-3.5 ${d ? 'bg-gray-900/40' : 'bg-white'}`}>
              <LiveSafetyStatusCell darkMode={d} />
            </div>
          </div>
        </div>

        {/* Join code */}
        {joinCode && (
          <div className={`rounded-xl border overflow-hidden ${d ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className={`px-4 py-2.5 border-b ${d ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${d ? 'text-gray-500' : 'text-gray-400'}`}>Controller Join Code</p>
            </div>
            <div className={`flex items-center gap-4 px-4 py-3.5 ${d ? 'bg-gray-900/40' : 'bg-white'}`}>
              <span className={`text-xl font-mono font-bold tracking-[0.35em] tabular-nums ${d ? 'text-white' : 'text-gray-900'}`}>
                {joinCode}
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleCopyCode}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    d ? 'border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300' : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
                <button
                  onClick={handleOpenPreServiceHealth}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    d ? 'border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300' : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <Activity className="w-3 h-3" />
                  Readiness
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

    const actions = [
      {
        label: 'Diagnostics',
        variant: 'default',
        onSelect: () => {
          showModal({
            title: 'Connection Diagnostics',
            headerDescription: 'Inspect connected clients, sync state, and retry health',
            component: 'ConnectionDiagnostics',
            variant: 'info',
            size: 'lg',
            actions: [
              { label: 'Close', variant: 'outline' },
              {
                label: 'Production Readiness',
                variant: 'default',
                onSelect: () => {
                  showModal({
                    title: 'Production Readiness Check',
                    headerDescription: 'Review service-critical connection, output, NDI, display, media, and safety status',
                    component: 'PreServiceHealth',
                    variant: 'info',
                    size: 'lg',
                    customLayout: true,
                    actions: [{ label: 'Close', variant: 'outline' }],
                  });
                },
              },
            ],
          });
        },
      },
      {
        label: 'Refresh Token',
        variant: 'outline',
        disabled: !isConnected,
        onSelect: () => { onRefreshToken(); return true; },
      },
    ];

    showModal({
      title: 'Connection Status',
      headerDescription: 'Authentication details and controller join code',
      body,
      variant: getVariant(),
      actions,
      icon: getStatusIcon(),
    });
  };

  /* ── trigger button ── */
  const variantCfg = STATUS_CONFIG[variant];
  const compactClass = d
    ? 'bg-transparent text-gray-300 hover:bg-blue-500/10 hover:text-blue-300'
    : 'bg-transparent text-gray-600 hover:bg-blue-50 hover:text-blue-600';
  const fullClass = d
    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'
    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200';

  return (
    <Tooltip content="View socket connection status and mobile controller join code" side="bottom">
      <button
        onClick={showAuthModal}
        className={`${compact ? '' : 'flex-1 min-w-0 px-3 py-2'} rounded-lg font-medium transition-all duration-150 flex items-center justify-center gap-2 ${compact ? compactClass : fullClass} ${className}`}
        title={`Status: ${getLabel()}`}
      >
        <span className="shrink-0">{getStatusIcon(compact ? 'w-4 h-4' : 'w-4 h-4')}</span>
        {!compact && (
          <span className="flex items-center gap-1.5 text-xs truncate">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${variantCfg.dot}`} />
            {getLabel()}
          </span>
        )}
      </button>
    </Tooltip>
  );
};

export default AuthStatusIndicator;
