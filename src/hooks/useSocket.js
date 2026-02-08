// src/hooks/useSocket.js
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import useAuth from './useAuth';
import { resolveBackendOrigin } from '../utils/network';
import useSocketEvents from './useSocketEvents';
import { connectionManager, getAdvancedSettings } from '../utils/connectionManager';
import { logDebug, logError, logWarn } from '../utils/logger';

const LONG_BACKOFF_WARNING_MS = 4000;

const useSocket = (role = 'output') => {
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const cleanupTimeoutRef = useRef(null);

  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const clientId = useMemo(() => `${role}_${Date.now()}`, [role]);

  const {
    authStatus,
    setAuthStatus,
    ensureValidToken,
    refreshAuthToken,
    clearAuthToken,
  } = useAuth();

  const {
    registerAuthenticatedHandlers,
  } = useSocketEvents(role);

  const getClientType = useCallback(() => {
    if (role === 'output1') return 'output1';
    if (role === 'output2') return 'output2';
    if (role === 'stage') return 'stage';
    if (role === 'output') return 'output1';
    if (window.electronAPI) return 'desktop';
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return 'mobile';
    }
    return 'web';
  }, [role]);

  const getSocketUrl = useCallback(() => resolveBackendOrigin(), []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    const settings = getAdvancedSettings();
    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('heartbeat');
      }
    }, settings.heartbeatInterval);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const emitBackoffWarning = useCallback((detail) => {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent('connection-backoff-warning', { detail }));
    } catch (error) {
      logDebug('Failed to dispatch connection backoff warning', error);
    }
  }, []);

  const clearBackoffWarning = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent('connection-backoff-clear'));
    } catch (error) {
      logDebug('Failed to clear connection backoff warning', error);
    }
  }, []);

  const handleAuthError = useCallback((errorMessage, dispatchEvent = true) => {
    setAuthStatus('failed');
    clearAuthToken();

    if (dispatchEvent && errorMessage) {
      window.dispatchEvent(new CustomEvent('auth-error', {
        detail: { message: errorMessage },
      }));
    }
  }, [clearAuthToken, setAuthStatus]);

  const cleanupSocket = useCallback(() => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve();
        return;
      }

      const socket = socketRef.current;
      socketRef.current = null;

      const cleanupTimeout = setTimeout(() => {
        logWarn(`Socket cleanup timeout for ${clientId}`);
        resolve();
      }, 2000);

      try {
        socket.removeAllListeners();

        if (socket.connected) {
          socket.on('disconnect', () => {
            clearTimeout(cleanupTimeout);
            resolve();
          });
          socket.disconnect();
        } else {
          clearTimeout(cleanupTimeout);
          resolve();
        }
      } catch (error) {
        logError('Socket cleanup error:', error);
        clearTimeout(cleanupTimeout);
        resolve();
      }
    });
  }, [clientId]);

  const connectSocketInternal = useCallback(async () => {
    const canConnect = connectionManager.canAttemptConnection(clientId);

    if (!canConnect.allowed) {
      if (canConnect.reason === 'max_attempts_reached') {
        logError('Max connection attempts reached for ' + clientId);
        setConnectionStatus('error');
        setAuthStatus('failed');
        clearBackoffWarning();
        return;
      }

      if (canConnect.reason === 'already_connecting') {
        logDebug('Connection already in progress for ' + clientId);
        return;
      }

      if (canConnect.reason !== 'global_backoff' && canConnect.reason !== 'client_backoff') {
        logDebug('Connection attempt blocked for ' + clientId + ' (' + canConnect.reason + ')');
        clearBackoffWarning();
        return;
      }

      const state = connectionManager.getConnectionState(clientId);
      const retryDelay = canConnect.remainingMs || Math.max(0, state.backoffUntil ? state.backoffUntil - Date.now() : 1000);

      if (retryDelay >= LONG_BACKOFF_WARNING_MS) {
        emitBackoffWarning({
          scope: canConnect.reason === 'global_backoff' ? 'global' : 'client',
          remainingMs: retryDelay,
          reason: canConnect.reason,
          clientId,
          attempts: state.attemptCount,
          timestamp: Date.now(),
        });
      } else {
        clearBackoffWarning();
      }

      logDebug('Scheduling retry for ' + clientId + ' in ' + retryDelay + 'ms due to ' + canConnect.reason);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSocketInternal();
      }, retryDelay);
      return;
    }

    clearBackoffWarning();

    try {
      connectionManager.startConnectionAttempt(clientId);

      setAuthStatus('authenticating');
      setConnectionStatus('connecting');

      const clientType = getClientType();

      let token;
      try {
        token = await ensureValidToken(clientType);
      } catch (tokenError) {
        logError('Token acquisition failed:', tokenError);
        throw tokenError;
      }

      if (!token) {
        throw new Error('Authentication token was not provided');
      }

      const socketUrl = getSocketUrl();
      logDebug(`Connecting socket to: ${socketUrl} (${clientId})`);

      await cleanupSocket();

      const settings = getAdvancedSettings();
      const socketOptions = {
        transports: ['websocket', 'polling'],
        timeout: settings.connectionTimeout,
        reconnection: false,
        forceNew: true,
        auth: { token },
      };

      socketRef.current = io(socketUrl, socketOptions);

      if (socketRef.current) {
        const socket = socketRef.current;
        const resolvedClientType = getClientType();
        const isDesktopApp = resolvedClientType === 'desktop';

        const handleConnect = () => {
          logDebug(`Socket connected successfully: ${clientId}`);
          connectionManager.recordConnectionSuccess(clientId);
          setConnectionStatus('connected');
          setAuthStatus('authenticated');
          startHeartbeat();
        };

        const handleConnectError = (error) => {
          logError(`Socket connection error (${clientId}):`, error);
          connectionManager.recordConnectionFailure(clientId, error);
          setConnectionStatus('error');
          scheduleRetry();
        };

        const handleDisconnect = (reason) => {
          logDebug(`Socket disconnected (${clientId}): ${reason}`);
          setConnectionStatus('disconnected');
          stopHeartbeat();

          if (reason !== 'io client disconnect' && reason !== 'transport close') {
            scheduleRetry();
          }
        };

        socket.on('connect', handleConnect);
        socket.on('connect_error', handleConnectError);
        socket.on('disconnect', handleDisconnect);

        registerAuthenticatedHandlers({
          socket,
          clientType: resolvedClientType,
          isDesktopApp,
          reconnectTimeoutRef,
          startHeartbeat,
          stopHeartbeat,
          setConnectionStatus,
          requestReconnect: () => connectSocketInternal(),
          handleAuthError,
        });
      }

    } catch (error) {
      logError(`Socket connection failed (${clientId}):`, error);
      connectionManager.recordConnectionFailure(clientId, error);
      setAuthStatus('failed');
      setConnectionStatus('error');
      scheduleRetry();
    }
  }, [
    clientId,
    getClientType,
    ensureValidToken,
    getSocketUrl,
    registerAuthenticatedHandlers,
    startHeartbeat,
    stopHeartbeat,
    handleAuthError,
    setAuthStatus,
    setConnectionStatus,
    cleanupSocket,
    emitBackoffWarning,
    clearBackoffWarning
  ]);

  const scheduleRetry = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const canConnect = connectionManager.canAttemptConnection(clientId);

    if (!canConnect.allowed) {
      if (canConnect.reason === 'max_attempts_reached') {
        logError('Max connection attempts reached for ' + clientId);
        setConnectionStatus('error');
        setAuthStatus('failed');
        clearBackoffWarning();
        return;
      }

      if (canConnect.reason === 'already_connecting') {
        logDebug('Connection already in progress for ' + clientId);
        return;
      }

      if (canConnect.reason !== 'global_backoff' && canConnect.reason !== 'client_backoff') {
        logDebug('Connection attempt blocked for ' + clientId + ' (' + canConnect.reason + ')');
        clearBackoffWarning();
        return;
      }

      const state = connectionManager.getConnectionState(clientId);
      const retryDelay = canConnect.remainingMs || Math.max(0, state.backoffUntil ? state.backoffUntil - Date.now() : 1000);

      if (retryDelay >= LONG_BACKOFF_WARNING_MS) {
        emitBackoffWarning({
          scope: canConnect.reason === 'global_backoff' ? 'global' : 'client',
          remainingMs: retryDelay,
          reason: canConnect.reason,
          clientId,
          attempts: state.attemptCount,
          timestamp: Date.now(),
        });
      } else {
        clearBackoffWarning();
      }

      logDebug('Scheduling retry for ' + clientId + ' in ' + retryDelay + 'ms due to ' + canConnect.reason);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSocketInternal();
      }, retryDelay);
      return;
    }

    clearBackoffWarning();

    const state = connectionManager.getConnectionState(clientId);
    const delay = state.backoffUntil ? Math.max(0, state.backoffUntil - Date.now()) : 1000;

    logDebug('Scheduling retry for ' + clientId + ' in ' + delay + 'ms');
    reconnectTimeoutRef.current = setTimeout(() => {
      connectSocketInternal();
    }, delay);
  }, [clientId, connectSocketInternal, clearBackoffWarning, emitBackoffWarning]);

  const connectSocket = useCallback(connectSocketInternal, [connectSocketInternal]);

  useEffect(() => {
    return () => {
      clearBackoffWarning();
    };
  }, [clearBackoffWarning]);

  useEffect(() => {
    const staggerDelay = role === 'control' ? 0 : role === 'output1' ? 500 : 1000;

    const startConnection = setTimeout(() => {
      connectSocket();
    }, staggerDelay);

    return () => {
      clearTimeout(startConnection);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }

      stopHeartbeat();
      connectionManager.cleanup(clientId);

      cleanupSocket().then(() => {
        logDebug(`Socket cleanup completed for ${clientId}`);
      });
    };
  }, [connectSocket, stopHeartbeat, clientId, role, cleanupSocket]);

  const createEmitFunction = useCallback((eventName) => {
    return (...args) => {
      if (!socketRef.current || !socketRef.current.connected) {
        logWarn(`Cannot emit ${eventName} - socket not connected (${clientId})`);
        return false;
      }

      if (authStatus !== 'authenticated') {
        logWarn(`Cannot emit ${eventName} - not authenticated (status: ${authStatus}, ${clientId})`);
        return false;
      }

      socketRef.current.emit(eventName, ...args);
      logDebug(`Emitted ${eventName} from ${clientId}:`, ...args);
      return true;
    };
  }, [authStatus, clientId]);

  const rawEmitLineUpdate = useMemo(() => createEmitFunction('lineUpdate'), [createEmitFunction]);

  const emitLineUpdate = useCallback((value) => {
    const payload = (value && typeof value === 'object' && !Array.isArray(value))
      ? ('index' in value ? value : { index: value })
      : { index: value };
    return rawEmitLineUpdate(payload);
  }, [rawEmitLineUpdate]);

  const emitLyricsLoad = useCallback(createEmitFunction('lyricsLoad'), [createEmitFunction]);
  const rawEmitStyleUpdate = useMemo(() => createEmitFunction('styleUpdate'), [createEmitFunction]);
  const rawEmitOutputMetrics = useMemo(() => createEmitFunction('outputMetrics'), [createEmitFunction]);

  const emitStyleUpdate = useCallback((outputOrPayload, maybeSettings) => {
    if (outputOrPayload && typeof outputOrPayload === 'object' && !Array.isArray(outputOrPayload)) {
      if ('output' in outputOrPayload && 'settings' in outputOrPayload) {
        return rawEmitStyleUpdate(outputOrPayload);
      }
    }

    return rawEmitStyleUpdate({
      output: outputOrPayload,
      settings: maybeSettings,
    });
  }, [rawEmitStyleUpdate]);

  const emitOutputMetrics = useCallback((output, metrics) => {
    return rawEmitOutputMetrics({ output, metrics });
  }, [rawEmitOutputMetrics]);

  const emitOutputToggle = useCallback(createEmitFunction('outputToggle'), [createEmitFunction]);
  const emitSetlistAdd = useCallback(createEmitFunction('setlistAdd'), [createEmitFunction]);
  const emitSetlistRemove = useCallback(createEmitFunction('setlistRemove'), [createEmitFunction]);
  const emitSetlistLoad = useCallback(createEmitFunction('setlistLoad'), [createEmitFunction]);
  const emitRequestSetlist = useCallback(createEmitFunction('requestSetlist'), [createEmitFunction]);
  const emitSetlistClear = useCallback(createEmitFunction('setlistClear'), [createEmitFunction]);

  const forceReconnect = useCallback(() => {
    logDebug(`Force reconnecting ${clientId}...`);
    connectionManager.cleanup(clientId);

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    cleanupSocket().then(() => {
      setConnectionStatus('disconnected');
      setAuthStatus('pending');
      clearBackoffWarning();
      setTimeout(() => {
        connectSocket();
      }, 100);
    });
  }, [clientId, cleanupSocket, connectSocket, clearBackoffWarning, setAuthStatus]);

  return {
    socket: socketRef.current,
    emitLineUpdate,
    emitLyricsLoad,
    emitStyleUpdate,
    emitOutputToggle,
    emitSetlistAdd,
    emitSetlistRemove,
    emitSetlistLoad,
    emitRequestSetlist,
    emitSetlistClear,
    emitOutputMetrics,
    connectionStatus,
    authStatus,
    forceReconnect,
    refreshAuthToken,
    isConnected: connectionStatus === 'connected',
    isAuthenticated: authStatus === 'authenticated',
    connectionStats: connectionManager.getStats(),
  };
};

export default useSocket;
