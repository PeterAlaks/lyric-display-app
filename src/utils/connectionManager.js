// src/utils/connectionManager.js - New centralized connection management
import { logDebug, logError, logWarn } from './logger';

class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.globalBackoffState = {
      failureCount: 0,
      lastFailureTime: null,
      backoffUntil: null
    };
  }

  // Calculate exponential backoff with jitter
  calculateBackoff(attemptCount, baseDelay = 100) {
    const maxDelay = 30000; // 30 seconds max
    const exponential = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
    const jitter = Math.random() * 0.3 * exponential; // 30% jitter
    return Math.floor(exponential + jitter);
  }

  // Check if we should delay connection attempts globally
  shouldGloballyDelay() {
    if (!this.globalBackoffState.backoffUntil) return false;

    const now = Date.now();
    if (now < this.globalBackoffState.backoffUntil) {
      const remaining = this.globalBackoffState.backoffUntil - now;
      logDebug(`Global backoff active, ${remaining}ms remaining`);
      return true;
    }

    // Clear expired backoff
    this.globalBackoffState.backoffUntil = null;
    return false;
  }

  // Record a global connection failure
  recordGlobalFailure() {
    this.globalBackoffState.failureCount++;
    this.globalBackoffState.lastFailureTime = Date.now();

    // Apply global backoff after multiple rapid failures
    if (this.globalBackoffState.failureCount >= 3) {
      const backoffDelay = this.calculateBackoff(this.globalBackoffState.failureCount - 3, 2000);
      this.globalBackoffState.backoffUntil = Date.now() + backoffDelay;
      logWarn(`Applied global connection backoff: ${backoffDelay}ms`);
    }
  }

  // Record a successful connection (resets global failure count)
  recordGlobalSuccess() {
    if (this.globalBackoffState.failureCount > 0) {
      logDebug(`Global connection success, resetting failure count from ${this.globalBackoffState.failureCount}`);
    }
    this.globalBackoffState.failureCount = 0;
    this.globalBackoffState.backoffUntil = null;
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
    // Check global backoff first
    if (this.shouldGloballyDelay()) {
      return { allowed: false, reason: 'global_backoff' };
    }

    const state = this.getConnectionState(clientId);

    // Check if already at max attempts
    if (state.attemptCount >= state.maxAttempts) {
      return { allowed: false, reason: 'max_attempts_reached' };
    }

    // Check if currently connecting
    if (state.isConnecting) {
      return { allowed: false, reason: 'already_connecting' };
    }

    // Check client-specific backoff
    if (state.backoffUntil && Date.now() < state.backoffUntil) {
      const remaining = state.backoffUntil - Date.now();
      return { allowed: false, reason: 'client_backoff', remainingMs: remaining };
    }

    return { allowed: true };
  }

  // Start connection attempt for client
  startConnectionAttempt(clientId) {
    const state = this.getConnectionState(clientId);

    state.isConnecting = true;
    state.attemptCount++;
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
    if (this.connections.has(clientId)) {
      const state = this.connections.get(clientId);
      state.isConnecting = false;
      state.connectionPromise = null;
      logDebug(`Cleaned up connection state for ${clientId}`);
    }
  }

  // Get connection statistics
  getStats() {
    const stats = {
      totalClients: this.connections.size,
      globalFailures: this.globalBackoffState.failureCount,
      globalBackoffActive: this.shouldGloballyDelay(),
      clients: {}
    };

    this.connections.forEach((state, clientId) => {
      stats.clients[clientId] = {
        status: state.status,
        attempts: state.attemptCount,
        isConnecting: state.isConnecting,
        backoffRemaining: state.backoffUntil ? Math.max(0, state.backoffUntil - Date.now()) : 0
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
      backoffUntil: null
    };
    logDebug('Connection manager reset');
  }
}

// Create singleton instance
export const connectionManager = new ConnectionManager();

// Export for debugging
if (typeof window !== 'undefined') {
  window.connectionManager = connectionManager;
}