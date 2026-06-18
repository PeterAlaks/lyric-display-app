import React, { useCallback, useEffect } from 'react';
import { Activity, Shield, ShieldAlert, ShieldCheck, RefreshCw, Copy } from 'lucide-react';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import { Tooltip } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { useLiveSafetyBridge } from '../hooks/useLiveSafetyBridge';

function LiveSafetyStatusCell({ darkMode }) {
  const { liveSafety, setLiveSafetyEnabled, isAuthenticated, ready } = useLiveSafetyBridge();

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Live Safety</p>
      <div className="flex items-center gap-3">
        <Switch
          checked={Boolean(liveSafety?.enabled)}
          disabled={!isAuthenticated || !ready}
          onCheckedChange={(checked) => setLiveSafetyEnabled(checked)}
          className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
            ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
            : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
            }`}
          thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
        />
        <p className={`text-sm font-bold ${liveSafety?.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {liveSafety?.enabled ? 'On' : 'Off'}
        </p>
      </div>
    </div>
  );
}

const AuthStatusIndicator = ({ authStatus, connectionStatus, onRetry, onRefreshToken, darkMode = false, compact = false, className = '' }) => {
  const { showToast } = useToast();
  const { showModal } = useModal();

  const [joinCode, setJoinCode] = React.useState(null);

  const refreshJoinCode = useCallback(async () => {
    try {
      if (window.electronAPI?.getJoinCode) {
        const code = await window.electronAPI.getJoinCode();
        setJoinCode(code || null);
        return;
      }
      setJoinCode(null);
    } catch (error) {
      console.warn('Failed to load join code', error);
    }
  }, []);

  useEffect(() => {
    refreshJoinCode();

    const handleJoinCodeUpdated = (event) => {
      const nextCode = event?.detail?.joinCode;
      if (typeof nextCode === 'string') {
        setJoinCode(nextCode);
      } else {
        setJoinCode(null);
        refreshJoinCode();
      }
    };

    window.addEventListener('join-code-updated', handleJoinCodeUpdated);
    return () => window.removeEventListener('join-code-updated', handleJoinCodeUpdated);
  }, [refreshJoinCode]);

  useEffect(() => {
    const handleAuthError = (event) => {
      showToast({
        title: 'Authentication Error',
        message: event.detail.message || 'Authentication failed',
        variant: 'error'
      });
    };

    const handlePermissionError = (event) => {
      showToast({
        title: 'Permission Denied',
        message: event.detail.message || 'Insufficient permissions',
        variant: 'warning'
      });
    };

    const handleSetlistError = (event) => {
      showToast({
        title: 'Setlist Error',
        message: event.detail.message || 'Operation failed',
        variant: 'error'
      });
    };

    const handleSetlistSuccess = (event) => {
      const { addedCount, totalCount } = event.detail;
      if (typeof addedCount === 'number' && addedCount > 1) {
        showToast({
          title: 'Files Added',
          message: `Added ${addedCount} files to setlist (Total: ${totalCount})`,
          variant: 'success'
        });
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

  const getStatusIcon = () => {
    if (authStatus === 'authenticated' && connectionStatus === 'connected') {
      return <ShieldCheck className="w-4 h-4 text-green-500" />;
    }
    if (authStatus === 'authenticating' || connectionStatus === 'reconnecting') {
      return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
    }
    if (authStatus === 'failed' || authStatus === 'admin-key-required' || connectionStatus === 'error') {
      return <ShieldAlert className="w-4 h-4 text-red-500" />;
    }
    return <Shield className="w-4 h-4 text-gray-400" />;
  };

  const getStatusText = () => {
    if (authStatus === 'authenticated' && connectionStatus === 'connected') {
      return 'Secure Connection';
    }
    if (authStatus === 'authenticating') {
      return 'Authenticating...';
    }
    if (connectionStatus === 'reconnecting') {
      return 'Reconnecting...';
    }
    if (authStatus === 'failed') {
      return 'Authentication Failed';
    }
    if (authStatus === 'admin-key-required') {
      return 'Admin Key Required';
    }
    if (connectionStatus === 'error') {
      return 'Connection Error';
    }
    if (connectionStatus === 'disconnected') {
      return 'Disconnected';
    }
    return 'Connecting...';
  };

  const getStatusVariant = () => {
    if (authStatus === 'authenticated' && connectionStatus === 'connected') {
      return 'success';
    }
    if (authStatus === 'authenticating' || connectionStatus === 'reconnecting') {
      return 'warning';
    }
    if (authStatus === 'failed' || authStatus === 'admin-key-required' || connectionStatus === 'error') {
      return 'error';
    }
    return 'info';
  };

  const capitalizeStatus = (status) => {
    if (typeof status !== 'string') return status;
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusDetails = () => {
    const conn = capitalizeStatus(connectionStatus);
    const auth = capitalizeStatus(authStatus);
    return { connection: conn, auth };
  };

  const showAuthModal = () => {
    refreshJoinCode();
    const showRefreshButton = authStatus === 'authenticated' && connectionStatus === 'connected';

    const statusDetails = getStatusDetails();

    let subtext = '';
    if (authStatus === 'authenticated' && connectionStatus === 'connected') {
      subtext = 'Your connection is secured with JWT tokens and has full permissions.';
    } else if (authStatus === 'failed') {
      subtext = 'Authentication failed. Please retry to obtain a new token.';
    } else if (authStatus === 'admin-key-required') {
      subtext = 'The desktop app is waiting for the administrator key. Add or restore the secure secrets data on the host machine, then retry.';
    } else if (connectionStatus === 'error') {
      subtext = 'Connection to the backend failed. Check the server status and try again.';
    } else if (authStatus === 'authenticating' || connectionStatus === 'reconnecting') {
      subtext = 'The client is attempting to establish a secure session.';
    }

    const actions = [];

    actions.push({
      label: 'Connection Diagnostics',
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
    });

    actions.push({
      label: 'Refresh Token',
      variant: 'outline',
      disabled: !showRefreshButton,
      onSelect: () => {
        onRefreshToken();
        return true;
      }
    });

    const statusBody = (
      <div className="space-y-4 p-2">
        <div className={`p-4 rounded-2xl flex items-center gap-3 border ${getStatusVariant() === 'success' ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-900 dark:text-green-100' : 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30 text-yellow-900 dark:text-yellow-100'}`}>
          {getStatusIcon()}
          <div>
            <h3 className="text-xl font-bold">{getStatusText()}</h3>
            <p className="text-sm opacity-90">Connection health overview</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Connection</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{statusDetails.connection}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Authentication</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{statusDetails.auth}</p>
          </div>
          <LiveSafetyStatusCell darkMode={darkMode} />
        </div>

        {subtext && (
          <p className={`text-xs leading-relaxed mt-2 opacity-80 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {subtext}
          </p>
        )}
      </div>
    );

    const handleCopyJoinCode = () => {
      if (joinCode) {
        navigator.clipboard.writeText(joinCode).then(() => {
          showToast({
            title: 'Copied',
            message: 'Join code copied to clipboard',
            variant: 'success',
            duration: 2000,
          });
        }).catch(() => {
          showToast({
            title: 'Copy failed',
            message: 'Could not copy join code',
            variant: 'error',
          });
        });
      }
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

    const modalBody = joinCode ? (
      <>
        {statusBody}
        <div className="space-y-4 p-4 pt-6 border-t border-gray-200 dark:border-gray-600 mt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Controller Join Code
          </p>
          <div className="flex items-center gap-3">
            <p className={`text-xl font-semibold tracking-[0.3em] tabular-nums ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {joinCode}
            </p>
            <button
              onClick={handleCopyJoinCode}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border hover:shadow-sm hover:scale-[1.02] ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300'}`}
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
            <button
              onClick={handleOpenPreServiceHealth}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border hover:shadow-sm hover:scale-[1.02] ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300'}`}
            >
              <Activity className="w-3 h-3" />
              Production Readiness
            </button>
          </div>
        </div>
      </>
    ) : (
      statusBody
    );

    showModal({
      title: 'Socket Connection Status',
      headerDescription: 'View authentication details and secondary controller join code',
      body: modalBody,
      variant: getStatusVariant(),
      actions,
      icon: getStatusIcon()
    });
  };

  const getStatusLabel = () => {
    if (authStatus === 'authenticated' && connectionStatus === 'connected') {
      return 'Connected';
    }
    if (authStatus === 'authenticating') {
      return 'Authenticating...';
    }
    if (connectionStatus === 'reconnecting') {
      return 'Reconnecting...';
    }
    if (authStatus === 'failed') {
      return 'Auth Failed';
    }
    if (authStatus === 'admin-key-required') {
      return 'Key Required';
    }
    if (connectionStatus === 'error') {
      return 'Error';
    }
    if (connectionStatus === 'disconnected') {
      return 'Disconnected';
    }
    return 'Connecting...';
  };

  return (
    <Tooltip content="See current socket connection status and mobile controller join code" side="bottom">
      <button
        onClick={showAuthModal}
        className={`${compact ? '' : 'flex-1 min-w-0 px-3 py-2.5'} rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${darkMode
          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          } ${className}`}
        title={`Authentication Status: ${getStatusText()}`}
      >
        <span className="shrink-0">{getStatusIcon()}</span>
        {!compact && <span className="text-xs truncate">{getStatusLabel()}</span>}
      </button>
    </Tooltip>
  );
};

export default AuthStatusIndicator;
