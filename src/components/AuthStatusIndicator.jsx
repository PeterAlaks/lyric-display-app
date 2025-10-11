// src/components/AuthStatusIndicator.jsx
import React, { useCallback, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import { resolveBackendUrl } from '../utils/network';

const AuthStatusIndicator = ({ authStatus, connectionStatus, onRetry, onRefreshToken, darkMode = false }) => {
  const { showToast } = useToast();
  const { showModal } = useModal();

  const [joinCode, setJoinCode] = React.useState(null);

  const refreshJoinCode = useCallback(async () => {
    try {
      if (window.electronAPI?.getJoinCode) {
        const code = await window.electronAPI.getJoinCode();
        if (code) {
          setJoinCode(code);
          return;
        }
      }

      const response = await fetch(resolveBackendUrl('/api/auth/join-code'));
      if (!response.ok) {
        throw new Error(`Failed to fetch join code: ${response.status}`);
      }
      const payload = await response.json();
      setJoinCode(payload?.joinCode || null);
    } catch (error) {
      console.warn('Failed to load join code', error);
    }
  }, [resolveBackendUrl]);

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
      return <ShieldCheck className="w-5 h-5 text-green-500" />;
    }
    if (authStatus === 'authenticating' || connectionStatus === 'reconnecting') {
      return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
    }
    if (authStatus === 'failed' || authStatus === 'admin-key-required' || connectionStatus === 'error') {
      return <ShieldAlert className="w-5 h-5 text-red-500" />;
    }
    return <Shield className="w-5 h-5 text-gray-400" />;
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

  const showAuthModal = () => {
    refreshJoinCode();
    const statusText = getStatusText();
    const showRetryButton = authStatus === 'failed' || authStatus === 'admin-key-required' || connectionStatus === 'error';
    const showRefreshButton = authStatus === 'authenticated' && connectionStatus === 'connected';

    let description = `Connection Status: ${connectionStatus}\nAuthentication Status: ${authStatus}`;

    if (authStatus === 'authenticated' && connectionStatus === 'connected') {
      description += '\n\nYour connection is secured with JWT tokens and has full permissions.';
    } else if (authStatus === 'failed') {
      description += '\n\nAuthentication failed. Please retry to obtain a new token.';
    } else if (authStatus === 'admin-key-required') {
      description += '\n\nThe desktop app is waiting for the administrator key. Add or restore the secure secrets data on the host machine, then retry.';
    } else if (connectionStatus === 'error') {
      description += '\n\nConnection to the backend failed. Check the server status and try again.';
    } else if (authStatus === 'authenticating' || connectionStatus === 'reconnecting') {
      description += '\n\nThe client is attempting to establish a secure session.';
    }

    const actions = [];

    if (showRetryButton) {
      actions.push({
        label: 'Retry Connection',
        variant: 'primary',
        onClick: () => {
          onRetry();
          return true;
        }
      });
    }

    if (showRefreshButton) {
      actions.push({
        label: 'Refresh Token',
        variant: 'secondary',
        onClick: () => {
          onRefreshToken();
          return true;
        }
      });
    }

    actions.push({
      label: 'Close',
      variant: 'secondary'
    });

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

    const modalBody = joinCode ? (
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Controller Join Code
        </p>
        <div className="flex items-center gap-3">
          <p
            className={`text-lg font-semibold tracking-[0.3em] tabular-nums flex-1 ${darkMode ? 'text-white' : 'text-gray-900'
              }`}
          >
            {joinCode}
          </p>
          <button
            onClick={handleCopyJoinCode}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${darkMode
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
          >
            Copy
          </button>
        </div>
      </div>
    ) : (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Controller join code not available.
      </p>
    );

    showModal({
      title: 'Connection Status',
      description,
      variant: getStatusVariant(),
      actions,
      icon: getStatusIcon(),
      body: modalBody
    });
  };

  return (
    <button
      onClick={showAuthModal}
      className={`p-2 rounded-lg font-medium transition-colors ${darkMode
        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }`}
      title={`Authentication Status: ${getStatusText()}`}
    >
      {getStatusIcon()}
    </button>
  );
};

export default AuthStatusIndicator;
