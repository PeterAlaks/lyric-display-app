// Project: LyricDisplay App
// File: src/hooks/useSocket.js

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import useAuth from './useAuth';
import { resolveBackendOrigin } from '../utils/network';
import useSocketEvents from './useSocketEvents';

import { logDebug, logError, logWarn } from '../utils/logger';

const useSocket = (role = 'output') => {
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);

  const [connectionStatus, setConnectionStatus] = useState('disconnected');

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

  const connectSocketInternal = useCallback(async () => {
    try {
      setAuthStatus('authenticating');
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
      logDebug('Connecting socket to:', socketUrl, '(with auth)');

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }

      const socketOptions = {
        transports: ['websocket', 'polling'],
        timeout: 30000,
        reconnection: false,
        forceNew: true,
        auth: { token },
      };

      socketRef.current = io(socketUrl, socketOptions);

      if (socketRef.current) {
        const socket = socketRef.current;
        const resolvedClientType = getClientType();
        const isDesktopApp = resolvedClientType === 'desktop';

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

      setAuthStatus('authenticated');
    } catch (error) {
      logError('Socket connection failed:', error);
      setAuthStatus('failed');
      setConnectionStatus('error');

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        logDebug('Retrying socket connection...');
        connectSocketInternal();
      }, 5000);
    }
  }, [getClientType, ensureValidToken, getSocketUrl, registerAuthenticatedHandlers, startHeartbeat, stopHeartbeat, handleAuthError, setAuthStatus, setConnectionStatus]);

  const connectSocket = useCallback(connectSocketInternal, [connectSocketInternal]);

  useEffect(() => {
    connectSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopHeartbeat();
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }
    };
  }, [connectSocket, stopHeartbeat]);

  const createEmitFunction = useCallback((eventName) => {
    return (...args) => {
      if (!socketRef.current || !socketRef.current.connected) {
        logWarn(`Cannot emit ${eventName} - socket not connected`);
        return false;
      }

      if (authStatus !== 'authenticated') {
        logWarn(`Cannot emit ${eventName} - not authenticated (status: ${authStatus})`);
        return false;
      }

      socketRef.current.emit(eventName, ...args);
      logDebug(`Emitted ${eventName}:`, ...args);
      return true;
    };
  }, [authStatus]);

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
    logDebug('Force reconnecting...');
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }
    setConnectionStatus('disconnected');
    setAuthStatus('pending');
    connectSocket();
  }, [connectSocket, setAuthStatus]);

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
  };
};

export default useSocket;
