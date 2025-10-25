import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import useAuth from '../hooks/useAuth';
import { resolveBackendOrigin } from '../utils/network';
import useSocketEvents from '../hooks/useSocketEvents';
import { connectionManager } from '../utils/connectionManager';
import { logDebug, logError, logWarn } from '../utils/logger';

const ControlSocketContext = createContext(null);

export const useControlSocket = () => {
    const context = useContext(ControlSocketContext);
    if (!context) {
        throw new Error('useControlSocket must be used within ControlSocketProvider');
    }
    return context;
};

const LONG_BACKOFF_WARNING_MS = 4000;

export const ControlSocketProvider = ({ children }) => {
    const socketRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const heartbeatIntervalRef = useRef(null);
    const clientId = useRef(`control_${Date.now()}`);
    const readyRef = useRef(false);

    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [ready, setReady] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);

    const {
        authStatus,
        setAuthStatus,
        ensureValidToken,
        refreshAuthToken,
        clearAuthToken,
    } = useAuth();

    const { registerAuthenticatedHandlers } = useSocketEvents('control');

    const getClientType = useCallback(() => {
        if (window.electronAPI) return 'desktop';
        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            return 'mobile';
        }
        return 'web';
    }, []);

    const startHeartbeat = useCallback(() => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
            if (socketRef.current?.connected) {
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

    const emitBackoffWarning = useCallback((detail) => {
        window.dispatchEvent(new CustomEvent('connection-backoff-warning', { detail }));
    }, []);

    const clearBackoffWarning = useCallback(() => {
        window.dispatchEvent(new CustomEvent('connection-backoff-clear'));
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
            readyRef.current = false;
            setReady(false);

            const cleanupTimeout = setTimeout(() => {
                logWarn(`Socket cleanup timeout for ${clientId.current}`);
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
    }, []);

    const connectSocketInternal = useCallback(async () => {
        const canConnect = connectionManager.canAttemptConnection(clientId.current);

        if (!canConnect.allowed) {
            if (canConnect.reason === 'max_attempts_reached') {
                logError('Max connection attempts reached');
                setConnectionStatus('error');
                setAuthStatus('failed');
                clearBackoffWarning();
                return;
            }

            if (canConnect.reason === 'already_connecting') {
                return;
            }

            const state = connectionManager.getConnectionState(clientId.current);
            const retryDelay = canConnect.remainingMs || Math.max(0, state.backoffUntil ? state.backoffUntil - Date.now() : 1000);

            if (retryDelay >= LONG_BACKOFF_WARNING_MS) {
                emitBackoffWarning({
                    scope: canConnect.reason === 'global_backoff' ? 'global' : 'client',
                    remainingMs: retryDelay,
                    reason: canConnect.reason,
                    clientId: clientId.current,
                    attempts: state.attemptCount,
                    timestamp: Date.now(),
                });
            } else {
                clearBackoffWarning();
            }

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
            connectionManager.startConnectionAttempt(clientId.current);
            setAuthStatus('authenticating');
            setConnectionStatus('connecting');

            const clientType = getClientType();
            const token = await ensureValidToken(clientType);

            if (!token) {
                throw new Error('Authentication token was not provided');
            }

            const socketUrl = resolveBackendOrigin();
            await cleanupSocket();

            socketRef.current = io(socketUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                reconnection: false,
                forceNew: true,
                auth: { token },
            });

            if (socketRef.current) {
                const socket = socketRef.current;
                const isDesktopApp = clientType === 'desktop';

                const handleConnect = () => {
                    logDebug(`Control socket connected: ${clientId.current}`);
                    connectionManager.recordConnectionSuccess(clientId.current);
                    setConnectionStatus('connected');
                    setAuthStatus('authenticated');
                    const syncTime = Date.now();
                    setLastSyncTime(syncTime);
                    try {
                        localStorage.setItem('lastSyncTime', syncTime.toString());
                    } catch (err) {
                        console.warn('Failed to store lastSyncTime:', err);
                    }
                    startHeartbeat();

                    socket.once('currentState', () => {
                        readyRef.current = true;
                        setReady(true);
                        window.dispatchEvent(new CustomEvent('sync-completed'));
                        logDebug('Control socket ready after receiving currentState');
                    });
                };

                const handleConnectError = (error) => {
                    logError(`Control socket connection error:`, error);
                    connectionManager.recordConnectionFailure(clientId.current, error);
                    setConnectionStatus('error');
                    readyRef.current = false;
                    setReady(false);
                    scheduleRetry();
                };

                const handleDisconnect = (reason) => {
                    logDebug(`Control socket disconnected: ${reason}`);
                    setConnectionStatus('disconnected');
                    readyRef.current = false;
                    setReady(false);
                    stopHeartbeat();

                    if (reason !== 'io client disconnect' && reason !== 'transport close') {
                        scheduleRetry();
                    }
                };

                socket.on('connect', handleConnect);
                socket.on('connect_error', handleConnectError);
                socket.on('disconnect', handleDisconnect);

                socket.on('currentState', () => {
                    const syncTime = Date.now();
                    setLastSyncTime(syncTime);
                    try {
                        localStorage.setItem('lastSyncTime', syncTime.toString());
                    } catch (err) {
                        console.warn('Failed to store lastSyncTime:', err);
                    }
                });

                registerAuthenticatedHandlers({
                    socket,
                    clientType,
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
            logError(`Control socket connection failed:`, error);
            connectionManager.recordConnectionFailure(clientId.current, error);
            setAuthStatus('failed');
            setConnectionStatus('error');
            readyRef.current = false;
            setReady(false);
            scheduleRetry();
        }
    }, [
        getClientType,
        ensureValidToken,
        cleanupSocket,
        registerAuthenticatedHandlers,
        startHeartbeat,
        stopHeartbeat,
        handleAuthError,
        setAuthStatus,
        setConnectionStatus,
        emitBackoffWarning,
        clearBackoffWarning
    ]);

    const scheduleRetry = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        const canConnect = connectionManager.canAttemptConnection(clientId.current);
        const state = connectionManager.getConnectionState(clientId.current);
        const retryDelay = canConnect.remainingMs || Math.max(0, state.backoffUntil ? state.backoffUntil - Date.now() : 1000);

        reconnectTimeoutRef.current = setTimeout(() => {
            connectSocketInternal();
        }, retryDelay);
    }, [connectSocketInternal]);

    const createEmitFunction = useCallback((eventName) => {
        return (...args) => {
            if (!socketRef.current?.connected || !readyRef.current) {
                logWarn(`Cannot emit ${eventName} - socket not ready`);
                return false;
            }

            if (authStatus !== 'authenticated') {
                logWarn(`Cannot emit ${eventName} - not authenticated`);
                return false;
            }

            socketRef.current.emit(eventName, ...args);
            logDebug(`Emitted ${eventName}:`, ...args);
            return true;
        };
    }, [authStatus]);

    const emitLineUpdate = useCallback((value) => {
        const payload = (value && typeof value === 'object' && !Array.isArray(value))
            ? ('index' in value ? value : { index: value })
            : { index: value };
        return createEmitFunction('lineUpdate')(payload);
    }, [createEmitFunction]);

    const emitLyricsLoad = useCallback(createEmitFunction('lyricsLoad'), [createEmitFunction]);

    const emitStyleUpdate = useCallback((outputOrPayload, maybeSettings) => {
        const payload = (outputOrPayload && typeof outputOrPayload === 'object' && !Array.isArray(outputOrPayload) && 'output' in outputOrPayload && 'settings' in outputOrPayload)
            ? outputOrPayload
            : { output: outputOrPayload, settings: maybeSettings };
        return createEmitFunction('styleUpdate')(payload);
    }, [createEmitFunction]);

    const emitOutputToggle = useCallback(createEmitFunction('outputToggle'), [createEmitFunction]);
    const emitSetlistAdd = useCallback(createEmitFunction('setlistAdd'), [createEmitFunction]);
    const emitSetlistRemove = useCallback(createEmitFunction('setlistRemove'), [createEmitFunction]);
    const emitSetlistLoad = useCallback(createEmitFunction('setlistLoad'), [createEmitFunction]);
    const emitRequestSetlist = useCallback(createEmitFunction('requestSetlist'), [createEmitFunction]);
    const emitSetlistClear = useCallback(createEmitFunction('setlistClear'), [createEmitFunction]);
    const emitSetlistReorder = useCallback(createEmitFunction('setlistReorder'), [createEmitFunction]);
    const emitLyricsDraftSubmit = useCallback(createEmitFunction('lyricsDraftSubmit'), [createEmitFunction]);
    const emitLyricsDraftApprove = useCallback(createEmitFunction('lyricsDraftApprove'), [createEmitFunction]);
    const emitLyricsDraftReject = useCallback(createEmitFunction('lyricsDraftReject'), [createEmitFunction]);

    const forceReconnect = useCallback(() => {
        logDebug('Force reconnecting control socket...');
        connectionManager.cleanup(clientId.current);

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        cleanupSocket().then(() => {
            setConnectionStatus('disconnected');
            setAuthStatus('pending');
            readyRef.current = false;
            setReady(false);
            clearBackoffWarning();

            setTimeout(() => {
                connectSocketInternal();
            }, 100);
        });
    }, [cleanupSocket, connectSocketInternal, clearBackoffWarning, setAuthStatus]);

    // Connection diagnostics
    const getConnectionDiagnostics = useCallback(() => {
        return {
            connectionStatus,
            authStatus,
            ready: readyRef.current,
            lastSyncTime,
            stats: connectionManager.getStats(),
            clientId: clientId.current,
        };
    }, [connectionStatus, authStatus, lastSyncTime]);

    useEffect(() => {
        const handleSyncCompleted = () => {
            const syncTime = Date.now();
            setLastSyncTime(syncTime);
            try {
                localStorage.setItem('lastSyncTime', syncTime.toString());
            } catch (err) {
                console.warn('Failed to store lastSyncTime:', err);
            }
        };

        window.addEventListener('sync-completed', handleSyncCompleted);
        return () => window.removeEventListener('sync-completed', handleSyncCompleted);
    }, []);

    useEffect(() => {
        connectSocketInternal();

        return () => {
            clearBackoffWarning();
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            stopHeartbeat();
            connectionManager.cleanup(clientId.current);
            cleanupSocket();
        };
    }, [connectSocketInternal, stopHeartbeat, cleanupSocket, clearBackoffWarning]);

    useEffect(() => {
        const handleDiagnosticsRequest = () => {
            const diagnostics = getConnectionDiagnostics();
            window.dispatchEvent(new CustomEvent('connection-diagnostics', { detail: diagnostics }));
        };

        window.addEventListener('request-connection-diagnostics', handleDiagnosticsRequest);
        return () => window.removeEventListener('request-connection-diagnostics', handleDiagnosticsRequest);
    }, [getConnectionDiagnostics]);

    const value = {
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
        emitSetlistReorder,
        emitLyricsDraftSubmit,
        emitLyricsDraftApprove,
        emitLyricsDraftReject,
        connectionStatus,
        authStatus,
        forceReconnect,
        refreshAuthToken,
        isConnected: connectionStatus === 'connected',
        isAuthenticated: authStatus === 'authenticated',
        ready,
        lastSyncTime,
        getConnectionDiagnostics,
    };

    return (
        <ControlSocketContext.Provider value={value}>
            {children}
        </ControlSocketContext.Provider>
    );
};