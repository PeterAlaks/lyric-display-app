import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import useAuth from '../hooks/useAuth';
import { resolveBackendOrigin } from '../utils/network';
import useSocketEvents from '../hooks/useSocketEvents';
import { connectionManager } from '../utils/connectionManager';
import { logDebug, logError, logWarn } from '../utils/logger';
import { getRequestedControllerClientType } from '../utils/clientType';

const ControlSocketContext = createContext(null);

export const useControlSocket = () => {
    const context = useContext(ControlSocketContext);
    if (!context) {
        throw new Error('useControlSocket must be used within ControlSocketProvider');
    }
    return context;
};

export const useOptionalControlSocket = () => useContext(ControlSocketContext);

const LONG_BACKOFF_WARNING_MS = 4000;
const OBS_DOCK_RECOVERY_POLL_MS = 2500;

export const ControlSocketProvider = ({ children, role = 'control' }) => {
    const socketRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const heartbeatIntervalRef = useRef(null);
    const clientId = useRef(`control_${Date.now()}`);
    const readyRef = useRef(false);
    const appliedSavedLiveSafetyRef = useRef(false);

    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [ready, setReady] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [liveSafety, setLiveSafety] = useState({ enabled: false, updatedAt: null, updatedBy: null });
    const [actionLog, setActionLog] = useState([]);

    const {
        authStatus,
        setAuthStatus,
        ensureValidToken,
        refreshAuthToken,
        clearAuthToken,
    } = useAuth();

    const { registerAuthenticatedHandlers } = useSocketEvents(role);

    const getClientType = useCallback(() => {
        if (window.electronAPI) return 'desktop';
        const requestedClientType = getRequestedControllerClientType();
        if (requestedClientType) return requestedClientType;
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

    const disposeCurrentSocket = useCallback((socket, reason) => {
        if (!socket || socketRef.current !== socket) {
            return false;
        }

        socketRef.current = null;
        readyRef.current = false;
        setReady(false);
        stopHeartbeat();

        try {
            socket.removeAllListeners();
            socket.disconnect();
        } catch (error) {
            logError(`Socket dispose error (${reason}):`, error);
        }

        return true;
    }, [stopHeartbeat]);

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
                auth: { token, purpose: role },
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
                    if (error?.message?.includes('Authentication') || error?.message?.includes('token')) {
                        handleAuthError(error.message, false);
                    }
                    setConnectionStatus('error');
                    readyRef.current = false;
                    setReady(false);
                    disposeCurrentSocket(socket, 'connect_error');
                    scheduleRetry();
                };

                const handleDisconnect = (reason) => {
                    logDebug(`Control socket disconnected: ${reason}`);
                    setConnectionStatus('disconnected');
                    readyRef.current = false;
                    setReady(false);
                    stopHeartbeat();

                    if (reason !== 'io client disconnect') {
                        disposeCurrentSocket(socket, `disconnect:${reason}`);
                        scheduleRetry();
                    }
                };

                socket.on('connect', handleConnect);
                socket.on('connect_error', handleConnectError);
                socket.on('disconnect', handleDisconnect);

                socket.on('currentState', (state) => {
                    const syncTime = Date.now();
                    setLastSyncTime(syncTime);
                    if (state?.liveSafety && typeof state.liveSafety.enabled === 'boolean') {
                        setLiveSafety(state.liveSafety);
                    }
                    try {
                        localStorage.setItem('lastSyncTime', syncTime.toString());
                    } catch (err) {
                        console.warn('Failed to store lastSyncTime:', err);
                    }
                });

                socket.on('periodicStateSync', (state) => {
                    if (state?.liveSafety && typeof state.liveSafety.enabled === 'boolean') {
                        setLiveSafety(state.liveSafety);
                    }
                });

                socket.on('liveSafetyUpdate', (nextLiveSafety) => {
                    if (nextLiveSafety && typeof nextLiveSafety.enabled === 'boolean') {
                        setLiveSafety(nextLiveSafety);
                    }
                });

                socket.on('liveSafetyBlocked', (payload) => {
                    window.dispatchEvent(new CustomEvent('live-safety-blocked', {
                        detail: payload,
                    }));
                });

                socket.on('actionLogSnapshot', (entries) => {
                    if (Array.isArray(entries)) {
                        setActionLog(entries);
                    }
                });

                socket.on('actionLogUpdate', (entry) => {
                    if (entry && typeof entry === 'object') {
                        setActionLog((prev) => [...prev, entry].slice(-750));
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
        disposeCurrentSocket,
        setAuthStatus,
        setConnectionStatus,
        emitBackoffWarning,
        clearBackoffWarning,
        role
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

    const pendingEmissionsRef = useRef(new Map());

    const createEmitFunction = useCallback((eventName) => {
        return (...args) => {
            if (!socketRef.current?.connected || !readyRef.current || authStatus !== 'authenticated') {

                pendingEmissionsRef.current.set(eventName, { args });
                return true;
            }

            socketRef.current.emit(eventName, ...args);
            logDebug(`Emitted ${eventName}:`, ...args);
            return true;
        };
    }, [authStatus]);

    useEffect(() => {
        if (readyRef.current && socketRef.current?.connected && authStatus === 'authenticated') {
            pendingEmissionsRef.current.forEach((emission, eventName) => {
                socketRef.current.emit(eventName, ...emission.args);
                logDebug(`Emitted queued ${eventName}:`, ...emission.args);
            });
            pendingEmissionsRef.current.clear();
        }
    }, [readyRef.current, authStatus]);

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
    const emitIndividualOutputToggle = useCallback(createEmitFunction('individualOutputToggle'), [createEmitFunction]);
    const emitSetlistAdd = useCallback(createEmitFunction('setlistAdd'), [createEmitFunction]);
    const emitSetlistRemove = useCallback(createEmitFunction('setlistRemove'), [createEmitFunction]);
    const emitSetlistLoad = useCallback(createEmitFunction('setlistLoad'), [createEmitFunction]);
    const emitRequestSetlist = useCallback(createEmitFunction('requestSetlist'), [createEmitFunction]);
    const emitSetlistClear = useCallback(createEmitFunction('setlistClear'), [createEmitFunction]);
    const emitSetlistReorder = useCallback(createEmitFunction('setlistReorder'), [createEmitFunction]);
    const emitLyricsDraftSubmit = useCallback(createEmitFunction('lyricsDraftSubmit'), [createEmitFunction]);
    const emitLyricsDraftApprove = useCallback(createEmitFunction('lyricsDraftApprove'), [createEmitFunction]);
    const emitLyricsDraftReject = useCallback(createEmitFunction('lyricsDraftReject'), [createEmitFunction]);
    const emitStageTimerUpdate = useCallback(createEmitFunction('stageTimerUpdate'), [createEmitFunction]);
    const emitStageMessagesUpdate = useCallback(createEmitFunction('stageMessagesUpdate'), [createEmitFunction]);
    const emitSplitNormalGroup = useCallback(createEmitFunction('splitNormalGroup'), [createEmitFunction]);
    const emitAutoplayStateUpdate = useCallback(createEmitFunction('autoplayStateUpdate'), [createEmitFunction]);
    const emitOutputRemove = useCallback(createEmitFunction('outputRemove'), [createEmitFunction]);
    const emitOutputsRegister = useCallback(createEmitFunction('outputsRegister'), [createEmitFunction]);
    const emitLiveSafetySet = useCallback((enabled) => {
        return createEmitFunction('liveSafetySet')({ enabled: Boolean(enabled) });
    }, [createEmitFunction]);
    const emitRequestActionLog = useCallback((payload = {}) => {
        return createEmitFunction('requestActionLog')(payload);
    }, [createEmitFunction]);
    const emitActionLogClear = useCallback(() => {
        return createEmitFunction('actionLogClear')();
    }, [createEmitFunction]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const snapshot = {
            connectionStatus,
            authStatus,
            ready,
            lastSyncTime,
            liveSafety,
        };
        window.__lyricDisplayControlSocketState = snapshot;
        window.dispatchEvent(new CustomEvent('control-socket-state-updated', { detail: snapshot }));
    }, [authStatus, connectionStatus, lastSyncTime, liveSafety, ready]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const snapshot = {
            actionLog,
            ready,
            authStatus,
            connectionStatus,
        };
        window.__lyricDisplayActionLogState = snapshot;
        window.dispatchEvent(new CustomEvent('action-log-state-updated', { detail: snapshot }));
    }, [actionLog, authStatus, connectionStatus, ready]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleSetLiveSafety = (event) => {
            const enabled = event?.detail?.enabled;
            if (typeof enabled === 'boolean') {
                emitLiveSafetySet(enabled);
            }
        };

        window.addEventListener('live-safety-set-requested', handleSetLiveSafety);
        return () => window.removeEventListener('live-safety-set-requested', handleSetLiveSafety);
    }, [emitLiveSafetySet]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleRequestActionLog = (event) => {
            emitRequestActionLog(event?.detail || {});
        };
        const handleClearActionLog = () => {
            emitActionLogClear();
        };

        window.addEventListener('action-log-requested', handleRequestActionLog);
        window.addEventListener('action-log-clear-requested', handleClearActionLog);
        return () => {
            window.removeEventListener('action-log-requested', handleRequestActionLog);
            window.removeEventListener('action-log-clear-requested', handleClearActionLog);
        };
    }, [emitActionLogClear, emitRequestActionLog]);

    useEffect(() => {
        if (!ready || authStatus !== 'authenticated' || !window.electronAPI?.preferences?.get) return;
        if (appliedSavedLiveSafetyRef.current) return;
        appliedSavedLiveSafetyRef.current = true;

        let cancelled = false;
        window.electronAPI.preferences.get('general.liveSafetyMode')
            .then((result) => {
                if (cancelled || result?.success === false || typeof result?.value !== 'boolean') return;
                if (result.value !== Boolean(liveSafety?.enabled)) {
                    emitLiveSafetySet(result.value);
                }
            })
            .catch((error) => {
                console.warn('[LiveSafety] Failed to load saved preference:', error);
            });

        return () => {
            cancelled = true;
        };
    }, [authStatus, emitLiveSafetySet, liveSafety?.enabled, ready]);

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

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        if (getClientType() !== 'obsDock') return undefined;
        if (connectionStatus === 'connected' || connectionStatus === 'connecting' || authStatus === 'authenticating') {
            return undefined;
        }

        let cancelled = false;
        let recoveryPending = false;
        const backendReadyUrl = `${resolveBackendOrigin()}/api/health/ready`;

        const tryRecoverDockConnection = async () => {
            if (cancelled || recoveryPending) return;
            recoveryPending = true;

            try {
                const response = await fetch(backendReadyUrl, { cache: 'no-store' });
                if (!response.ok) return;
                const payload = await response.json();
                if (cancelled || payload?.status !== 'ready' || !payload?.serverListening) return;

                logDebug('OBS dock backend is ready after restart; resetting connection backoff');
                connectionManager.cleanup(clientId.current);
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                    reconnectTimeoutRef.current = null;
                }
                setConnectionStatus('disconnected');
                setAuthStatus('pending');
                readyRef.current = false;
                setReady(false);
                clearBackoffWarning();
                connectSocketInternal();
            } catch {
                // The backend is expected to be unreachable while Dock Mode is restarting.
            } finally {
                recoveryPending = false;
            }
        };

        tryRecoverDockConnection();
        const interval = window.setInterval(tryRecoverDockConnection, OBS_DOCK_RECOVERY_POLL_MS);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [authStatus, clearBackoffWarning, connectSocketInternal, connectionStatus, getClientType, setAuthStatus, setConnectionStatus]);

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
        emitIndividualOutputToggle,
        emitSetlistAdd,
        emitSetlistRemove,
        emitSetlistLoad,
        emitRequestSetlist,
        emitSetlistClear,
        emitSetlistReorder,
        emitLyricsDraftSubmit,
        emitLyricsDraftApprove,
        emitLyricsDraftReject,
        emitStageTimerUpdate,
        emitStageMessagesUpdate,
        emitSplitNormalGroup,
        emitAutoplayStateUpdate,
        emitOutputRemove,
        emitOutputsRegister,
        emitLiveSafetySet,
        emitRequestActionLog,
        emitActionLogClear,
        connectionStatus,
        authStatus,
        forceReconnect,
        refreshAuthToken,
        isConnected: connectionStatus === 'connected',
        isAuthenticated: authStatus === 'authenticated',
        ready,
        lastSyncTime,
        liveSafety,
        actionLog,
        getConnectionDiagnostics,
    };

    return (
        <ControlSocketContext.Provider value={value}>
            {children}
        </ControlSocketContext.Provider>
    );
};
