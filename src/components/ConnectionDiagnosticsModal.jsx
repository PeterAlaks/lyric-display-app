import React, { useState, useEffect } from 'react';
import { Activity, Clock, Users, AlertCircle, CheckCircle, Timer, RefreshCw } from 'lucide-react';

const ConnectionDiagnosticsModal = ({ darkMode }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDiagnostics();
    }, []);

    const fetchDiagnostics = async () => {
        try {
            setLoading(true);
            if (window.electronAPI) {
                const result = await window.electronAPI.getConnectionDiagnostics?.();
                setStats(result);
            }
        } catch (error) {
            console.error('Failed to fetch diagnostics:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (ms) => {
        if (!Number.isFinite(ms) || ms <= 0) return "0s";
        const totalSeconds = Math.ceil(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        if (minutes > 0) {
            return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
        }
        return `${seconds}s`;
    };

    const formatRelativeTime = (timestamp) => {
        if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
        const delta = Date.now() - timestamp;
        if (delta < 0) return "just now";
        const seconds = Math.round(delta / 1000);
        if (seconds < 45) return `${seconds}s ago`;
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.round(minutes / 60);
        if (hours < 48) return `${hours}h ago`;
        const days = Math.round(hours / 24);
        if (days < 14) return `${days}d ago`;
        const weeks = Math.round(days / 7);
        if (weeks < 8) return `${weeks}w ago`;
        return new Date(timestamp).toLocaleString();
    };

    if (loading || !stats) {
        return (
            <div className={`flex items-center justify-center py-8 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                <span>Loading diagnostics...</span>
            </div>
        );
    }

    const isHealthy = !stats.globalBackoffActive;
    const clientEntries = Object.entries(stats.clients || {});

    return (
        <div className="space-y-6">
            {/* Status Overview Card */}
            <div className={`rounded-lg p-4 ${isHealthy
                ? (darkMode ? 'bg-green-900/20 border border-green-700/30' : 'bg-green-50 border border-green-200')
                : (darkMode ? 'bg-yellow-900/20 border border-yellow-700/30' : 'bg-yellow-50 border border-yellow-200')
                }`}>
                <div className="flex items-start gap-3">
                    {isHealthy ? (
                        <CheckCircle className={`w-6 h-6 flex-shrink-0 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                    ) : (
                        <AlertCircle className={`w-6 h-6 flex-shrink-0 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                    )}
                    <div className="flex-1">
                        <h3 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {isHealthy ? 'Connection Healthy' : 'Temporary Cooldown Active'}
                        </h3>
                        <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {isHealthy
                                ? 'All systems ready. Connections will retry immediately if needed.'
                                : `Auto-retry will resume in approximately ${formatDuration(stats.globalBackoffRemainingMs)}`
                            }
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-lg p-4 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                        <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Active Clients
                        </span>
                    </div>
                    <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {stats.totalClients || 0}
                    </p>
                </div>

                <div className={`rounded-lg p-4 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className={`w-5 h-5 ${darkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                        <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Session Failures
                        </span>
                    </div>
                    <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {stats.globalFailures || 0}
                    </p>
                </div>
            </div>

            {/* Last Failure Info */}
            {stats.lastFailureTime && (
                <div className={`rounded-lg p-4 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className={`w-5 h-5 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                        <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Most Recent Issue
                        </span>
                    </div>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {formatRelativeTime(stats.lastFailureTime)}
                    </p>
                </div>
            )}

            {/* Client Details */}
            {clientEntries.length > 0 && (
                <div>
                    <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <Users className="w-4 h-4" />
                        Connection Details
                    </h4>
                    <div className="space-y-3">
                        {clientEntries.map(([id, info]) => {
                            const isConnected = info.status === "connected";
                            const statusColor = isConnected
                                ? (darkMode ? 'text-green-400' : 'text-green-600')
                                : (darkMode ? 'text-yellow-400' : 'text-yellow-600');

                            return (
                                <div
                                    key={id}
                                    className={`rounded-lg p-3 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <span className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                            {id}
                                        </span>
                                        <span className={`text-xs font-semibold ${statusColor}`}>
                                            {info.status === "connected" ? "Connected" :
                                                info.status === "disconnected" ? "Waiting" :
                                                    String(info.status).charAt(0).toUpperCase() + String(info.status).slice(1)}
                                        </span>
                                    </div>

                                    <div className={`space-y-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {info.isConnecting && (
                                            <p className="flex items-center gap-1.5">
                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                                Currently reconnecting
                                            </p>
                                        )}
                                        <p className="flex items-center gap-1.5">
                                            <Timer className="w-3 h-3" />
                                            {info.attempts || 0} {info.attempts === 1 ? 'attempt' : 'attempts'} this session
                                        </p>
                                        {info.backoffRemaining > 0 && (
                                            <p>Next retry: {formatDuration(info.backoffRemaining)}</p>
                                        )}
                                        {info.lastAttemptTime && (
                                            <p>Last attempt: {formatRelativeTime(info.lastAttemptTime)}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {clientEntries.length === 0 && (
                <div className={`text-center py-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No connection clients queued for retry</p>
                </div>
            )}
        </div>
    );
};

export default ConnectionDiagnosticsModal;