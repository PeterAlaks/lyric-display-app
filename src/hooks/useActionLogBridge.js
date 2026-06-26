import React from 'react';

const DEFAULT_STATE = {
  actionLog: [],
  ready: false,
  authStatus: 'pending',
  connectionStatus: 'disconnected',
};

const readBridgeState = () => {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  const state = window.__lyricDisplayActionLogState;
  if (!state || typeof state !== 'object') return DEFAULT_STATE;
  return {
    ...DEFAULT_STATE,
    ...state,
    actionLog: Array.isArray(state.actionLog) ? state.actionLog : [],
  };
};

export function useActionLogBridge() {
  const [bridgeState, setBridgeState] = React.useState(readBridgeState);

  React.useEffect(() => {
    const handleUpdate = (event) => {
      if (event?.detail && typeof event.detail === 'object') {
        setBridgeState({
          ...DEFAULT_STATE,
          ...event.detail,
          actionLog: Array.isArray(event.detail.actionLog) ? event.detail.actionLog : [],
        });
        return;
      }
      setBridgeState(readBridgeState());
    };

    window.addEventListener('action-log-state-updated', handleUpdate);
    setBridgeState(readBridgeState());
    return () => window.removeEventListener('action-log-state-updated', handleUpdate);
  }, []);

  const requestActionLog = React.useCallback((limit = 750) => {
    if (typeof window === 'undefined') return false;
    window.dispatchEvent(new CustomEvent('action-log-requested', {
      detail: { limit },
    }));
    return true;
  }, []);

  const clearActionLog = React.useCallback(() => {
    if (typeof window === 'undefined') return false;
    window.dispatchEvent(new Event('action-log-clear-requested'));
    return true;
  }, []);

  return {
    ...bridgeState,
    requestActionLog,
    clearActionLog,
    isAuthenticated: bridgeState.authStatus === 'authenticated',
  };
}
