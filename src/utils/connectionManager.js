// src/utils/connectionManager.js - Centralized connection management for sockets
import { logDebug, logError, logWarn } from './logger';

class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.globalBackoffState = {
      failureCount: 0,
      lastFailureTime: null,
      backoffUntil: null,
    };
  }

  // Calculate exponential backoff with jitter
  calculateBackoff(attemptCount, baseDelay = 100) {
    const maxDelay = 30000; // 30 seconds max
    const exponential = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
    const jitter = Math.random() * 0.3 * exponential; // 30% jitter
    return Math.floor(exponential + jitter);
  }

  getGlobalBackoffRemaining() {
    if (!this.globalBackoffState.backoffUntil) {
      return 0;
    }
    const remaining = this.globalBackoffState.backoffUntil - Date.now();
    if (remaining <= 0) {
      this.globalBackoffState.backoffUntil = null;
      return 0;
    }
    return remaining;
  }

  // Check if we should delay connection attempts globally
  shouldGloballyDelay() {
    const remaining = this.getGlobalBackoffRemaining();
    if (remaining > 0) {
      logDebug(`Global backoff active, ${remaining}ms remaining`);
      return true;
    }
    return false;
  }

  // Record a global connection failure
  recordGlobalFailure() {
    this.globalBackoffState.failureCount += 1;
    this.globalBackoffState.lastFailureTime = Date.now();

    // Apply global backoff after multiple rapid failures
    if (this.globalBackoffState.failureCount >= 3) {
      const delay = this.calculateBackoff(this.globalBackoffState.failureCount - 3, 2000);
      this.globalBackoffState.backoffUntil = Date.now() + delay;
      logWarn(`Applied global connection backoff: ${delay}ms`);
    }
  }

  // Record a successful connection (resets global failure count)
  recordGlobalSuccess() {
    if (this.globalBackoffState.failureCount > 0) {
      logDebug(`Global connection success, resetting failure count from ${this.globalBackoffState.failureCount}`);
    }
    this.globalBackoffState.failureCount = 0;
    this.globalBackoffState.backoffUntil = null;
    this.globalBackoffState.lastFailureTime = null;
  }

  // Get connection state for a specific client
  getConnectionState(clientId) {
    if (!this.connections.has(clientId)) {
      this.connections.set(clientId, {
        status: 'disconnected',
        attemptCount: 0,
        lastAttemptTime: null,
        backoffUntil: null,
        connectionPromise: null,
        maxAttempts: 10,
        isConnecting: false,
      });
    }
    return this.connections.get(clientId);
  }

  // Check if connection should be attempted for specific client
  canAttemptConnection(clientId) {
    const globalRemaining = this.getGlobalBackoffRemaining();
    if (globalRemaining > 0) {
      return { allowed: false, reason: 'global_backoff', remainingMs: globalRemaining };
    }

    const state = this.getConnectionState(clientId);

    if (state.attemptCount >= state.maxAttempts) {
      return { allowed: false, reason: 'max_attempts_reached', remainingMs: 0 };
    }

    if (state.isConnecting) {
      return { allowed: false, reason: 'already_connecting', remainingMs: 0 };
    }

    const clientRemaining = state.backoffUntil ? Math.max(0, state.backoffUntil - Date.now()) : 0;
    if (clientRemaining > 0) {
      return { allowed: false, reason: 'client_backoff', remainingMs: clientRemaining };
    }

    return { allowed: true, reason: null, remainingMs: 0 };
  }

  // Start connection attempt for client
  startConnectionAttempt(clientId) {
    const state = this.getConnectionState(clientId);

    state.isConnecting = true;
    state.attemptCount += 1;
    state.lastAttemptTime = Date.now();

    // Set client-specific backoff for next attempt
    const backoffDelay = this.calculateBackoff(state.attemptCount - 1);
    state.backoffUntil = Date.now() + backoffDelay;

    logDebug(`Starting connection attempt ${state.attemptCount} for ${clientId}, next attempt in ${backoffDelay}ms`);
  }

  // Record connection success for client
  recordConnectionSuccess(clientId) {
    const state = this.getConnectionState(clientId);

    state.status = 'connected';
    state.attemptCount = 0;
    state.backoffUntil = null;
    state.isConnecting = false;
    state.connectionPromise = null;

    this.recordGlobalSuccess();
    logDebug(`Connection successful for ${clientId}`);
  }

  // Record connection failure for client
  recordConnectionFailure(clientId, error) {
    const state = this.getConnectionState(clientId);

    state.status = 'disconnected';
    state.isConnecting = false;
    state.connectionPromise = null;

    this.recordGlobalFailure();
    logWarn(`Connection failed for ${clientId}: ${error?.message || error}`);
  }

  // Clean up connection tracking for client
  cleanup(clientId) {
    if (!this.connections.has(clientId)) {
      return;
    }

    const state = this.connections.get(clientId);
    state.isConnecting = false;
    state.connectionPromise = null;
    this.connections.delete(clientId);
    logDebug(`Cleaned up connection state for ${clientId}`);

    if (this.connections.size === 0) {
      if (this.globalBackoffState.failureCount > 0 || this.globalBackoffState.backoffUntil) {
        logDebug('No remaining clients, clearing global backoff state');
      }
      this.globalBackoffState.failureCount = 0;
      this.globalBackoffState.backoffUntil = null;
      this.globalBackoffState.lastFailureTime = null;
    }
  }

  // Get connection statistics
  getStats() {
    const globalRemaining = this.getGlobalBackoffRemaining();
    const globalBackoffActive = globalRemaining > 0;

    const stats = {
      totalClients: this.connections.size,
      globalFailures: this.globalBackoffState.failureCount,
      globalBackoffActive,
      globalBackoffRemainingMs: globalRemaining,
      globalBackoffUntil: this.globalBackoffState.backoffUntil,
      lastFailureTime: this.globalBackoffState.lastFailureTime,
      clients: {},
    };

    this.connections.forEach((state, clientId) => {
      const remaining = state.backoffUntil ? Math.max(0, state.backoffUntil - Date.now()) : 0;
      stats.clients[clientId] = {
        status: state.status,
        attempts: state.attemptCount,
        isConnecting: state.isConnecting,
        backoffRemaining: remaining,
        lastAttemptTime: state.lastAttemptTime,
        nextAttemptAt: state.backoffUntil,
      };
    });

    return stats;
  }

  // Reset all connection states (for debugging)
  reset() {
    this.connections.clear();
    this.globalBackoffState = {
      failureCount: 0,
      lastFailureTime: null,
      backoffUntil: null,
    };
    logDebug('Connection manager reset');
  }
}

// Create singleton instance
export const connectionManager = new ConnectionManager();

// Export for debugging
if (typeof window !== 'undefined') {
  window.connectionManager = connectionManager;
  if (!window.__connectionManagerUnloadAttached) {
    window.addEventListener('beforeunload', () => {
      try {
        connectionManager.reset();
      } catch (error) {
        logDebug('Failed to reset connection manager on unload', error);
      }
    });
    window.__connectionManagerUnloadAttached = true;
  }
}
