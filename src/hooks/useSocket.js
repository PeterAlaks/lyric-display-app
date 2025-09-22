// src/hooks/useSocket.js - Enhanced with connection management
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import useAuth from './useAuth';
import { resolveBackendOrigin } from '../utils/network';
import useSocketEvents from './useSocketEvents';
import { connectionManager } from '../utils/connectionManager';
import { logDebug, logError, logWarn } from '../utils/logger';

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
    if (window.electronAPI) return 'desktop';
    if (role === 'output1') return 'output1';
    if (role === 'output2') return 'output2';
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

    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('heartbeat');
      }
    }, 30000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
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

  // Enhanced cleanup with promise-based socket disconnection
  const cleanupSocket = useCallback(() => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve();
        return;
      }

      const socket = socketRef.current;
      socketRef.current = null;

      // Set timeout for cleanup
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
    // Check with connection manager before attempting
    const canConnect = connectionManager.canAttemptConnection(clientId);

    if (!canConnect.allowed) {
      if (canConnect.reason === 'max_attempts_reached') {
        logError(`Max connection attempts reached for ${clientId}`);
        setConnectionStatus('error');
        setAuthStatus('failed');
        return;
      }

      if (canConnect.reason === 'already_connecting') {
        logDebug(`Connection already in progress for ${clientId}`);
        return;
      }

      // Schedule retry for backoff cases
      if (canConnect.reason === 'global_backoff' || canConnect.reason === 'client_backoff') {
        const retryDelay = canConnect.remainingMs || 1000;
        logDebug(`Scheduling retry for ${clientId} in ${retryDelay}ms due to ${canConnect.reason}`);

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSocketInternal();
        }, retryDelay);
        return;
      }
    }

    try {
      // Record attempt start with connection manager
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

      // Clean up existing socket with proper async handling
      await cleanupSocket();

      const socketOptions = {
        transports: ['websocket', 'polling'],
        timeout: 10000, // Reduced from 30s
        reconnection: false,
        forceNew: true,
        auth: { token },
      };

      socketRef.current = io(socketUrl, socketOptions);

      if (socketRef.current) {
        const socket = socketRef.current;
        const resolvedClientType = getClientType();
        const isDesktopApp = resolvedClientType === 'desktop';

        // Enhanced connection success handling
        const handleConnect = () => {
          logDebug(`Socket connected successfully: ${clientId}`);
          connectionManager.recordConnectionSuccess(clientId);
          setConnectionStatus('connected');
          setAuthStatus('authenticated');
          startHeartbeat();
        };

        // Enhanced error handling
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

          // Only attempt reconnection for unexpected disconnects
          if (reason !== 'io client disconnect' && reason !== 'transport close') {
            scheduleRetry();
          }
        };

        // Set up event handlers
        socket.on('connect', handleConnect);
        socket.on('connect_error', handleConnectError);
        socket.on('disconnect', handleDisconnect);

        // Register application-specific handlers
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
    cleanupSocket
  ]);

  // Centralized retry scheduling
  const scheduleRetry = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    const canConnect = connectionManager.canAttemptConnection(clientId);
    if (!canConnect.allowed && canConnect.reason === 'max_attempts_reached') {
      logError(`Max retries reached for ${clientId}, giving up`);
      return;
    }

    // Use connection manager's backoff calculation
    const state = connectionManager.getConnectionState(clientId);
    const delay = state.backoffUntil ? Math.max(0, state.backoffUntil - Date.now()) : 1000;

    logDebug(`Scheduling retry for ${clientId} in ${delay}ms`);
    reconnectTimeoutRef.current = setTimeout(() => {
      connectSocketInternal();
    }, delay);
  }, [clientId, connectSocketInternal]);

  const connectSocket = useCallback(connectSocketInternal, [connectSocketInternal]);

  useEffect(() => {
    // Add staggered delay for different client types to prevent connection storms
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

      // Async cleanup with timeout
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

      // Small delay to ensure cleanup is complete
      setTimeout(() => {
        connectSocket();
      }, 100);
    });
  }, [clientId, cleanupSocket, connectSocket, setAuthStatus]);

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
    connectionStatus,
    authStatus,
    forceReconnect,
    refreshAuthToken,
    isConnected: connectionStatus === 'connected',
    isAuthenticated: authStatus === 'authenticated',
    connectionStats: connectionManager.getStats(), // For debugging
  };
};

export default useSocket;