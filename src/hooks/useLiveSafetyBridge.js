import React from 'react';

const DEFAULT_STATE = {
  connectionStatus: 'disconnected',
  authStatus: 'pending',
  ready: false,
  lastSyncTime: null,
  liveSafety: { enabled: false, updatedAt: null, updatedBy: null },
};

const LIVE_SAFETY_PREFERENCE_PATH = 'general.liveSafetyMode';
const LIVE_SAFETY_PREFERENCE_EVENT = 'live-safety-preference-updated';

const readBridgeState = () => {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  const state = window.__lyricDisplayControlSocketState;
  if (!state || typeof state !== 'object') return DEFAULT_STATE;
  return {
    ...DEFAULT_STATE,
    ...state,
    liveSafety: {
      ...DEFAULT_STATE.liveSafety,
      ...(state.liveSafety || {}),
    },
  };
};

export function useLiveSafetyBridge() {
  const [bridgeState, setBridgeState] = React.useState(readBridgeState);

  React.useEffect(() => {
    const handleUpdate = (event) => {
      if (event?.detail && typeof event.detail === 'object') {
        setBridgeState({
          ...DEFAULT_STATE,
          ...event.detail,
          liveSafety: {
            ...DEFAULT_STATE.liveSafety,
            ...(event.detail.liveSafety || {}),
          },
        });
        return;
      }
      setBridgeState(readBridgeState());
    };

    window.addEventListener('control-socket-state-updated', handleUpdate);
    setBridgeState(readBridgeState());

    return () => window.removeEventListener('control-socket-state-updated', handleUpdate);
  }, []);

  const setLiveSafetyEnabled = React.useCallback((enabled) => {
    if (typeof window === 'undefined') return false;
    const nextEnabled = Boolean(enabled);
    if (window.electronAPI?.preferences?.set) {
      window.electronAPI.preferences.set(LIVE_SAFETY_PREFERENCE_PATH, nextEnabled)
        .then((result) => {
          if (result?.success === false) {
            console.warn('[LiveSafety] Failed to save preference:', result.error);
          }
        })
        .catch((error) => {
          console.warn('[LiveSafety] Failed to save preference:', error);
        });
    }
    window.dispatchEvent(new CustomEvent(LIVE_SAFETY_PREFERENCE_EVENT, {
      detail: { enabled: nextEnabled },
    }));
    window.dispatchEvent(new CustomEvent('live-safety-set-requested', {
      detail: { enabled: nextEnabled },
    }));
    return true;
  }, []);

  return {
    ...bridgeState,
    isAuthenticated: bridgeState.authStatus === 'authenticated',
    setLiveSafetyEnabled,
  };
}

export { LIVE_SAFETY_PREFERENCE_EVENT, LIVE_SAFETY_PREFERENCE_PATH };
