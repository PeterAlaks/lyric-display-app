import { useCallback, useRef, useState } from 'react';
import { logDebug, logError, logWarn } from '../utils/logger';
import { resolveBackendOrigin } from '../utils/network';

class AuthService {
  constructor() {
    this.token = null;
    this.tokenExpiry = null;
    this.refreshPromise = null;
    this.serverValidated = false;
    this.joinCodeRequest = null;
  }

  getServerUrl() {
    return resolveBackendOrigin();
  }

  generateDeviceId() {
    const stored = localStorage.getItem('lyric_display_device_id');
    if (stored) return stored;

    const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('lyric_display_device_id', deviceId);
    return deviceId;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  requiresJoinCode(clientType) {
    return ['web', 'mobile'].includes(clientType);
  }

  getStoredJoinCode() {
    const stored = localStorage.getItem('lyric_display_join_code');
    if (!stored) return null;

    const trimmed = stored.trim();
    if (!trimmed) {
      this.clearStoredJoinCode();
      return null;
    }

    return trimmed;
  }

  storeJoinCode(code) {
    if (typeof code === 'string' && code.trim()) {
      const normalized = code.trim();
      localStorage.setItem('lyric_display_join_code', normalized);
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('join-code-updated', { detail: { joinCode: normalized } }));
      }
    }
  }

  clearStoredJoinCode() {
    localStorage.removeItem('lyric_display_join_code');
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('join-code-updated', { detail: { joinCode: null } }));
    }
  }

  async promptForJoinCode(reason = 'missing', prefill = '') {
    if (typeof window === 'undefined' || !window.dispatchEvent) {
      return null;
    }

    if (this.joinCodeRequest) {
      return this.joinCodeRequest;
    }

    this.joinCodeRequest = new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        this.joinCodeRequest = null;
        if (typeof value === 'string') {
          resolve(value.trim() || null);
        } else {
          resolve(null);
        }
      };

      const detail = {
        reason,
        prefill,
        resolve: (value) => settle(value),
      };

      try {
        window.dispatchEvent(new CustomEvent('request-join-code', { detail }));
      } catch (error) {
        logWarn('Failed to dispatch join code request modal:', error);
        settle(null);
        return;
      }

      setTimeout(() => settle(null), 60000);
    });

    return this.joinCodeRequest;
  }

  async getAdminKey() {
    // Try to get admin key from Electron API first
    if (window.electronAPI?.getAdminKey) {
      try {
        return await window.electronAPI.getAdminKey();
      } catch (error) {
        logWarn('Failed to get admin key from Electron API:', error);
      }
    }

    // Fallback to environment variable for development
    if (import.meta.env.DEV && import.meta.env.VITE_ADMIN_KEY) {
      logWarn('Using admin key from environment variable (development only)');
      return import.meta.env.VITE_ADMIN_KEY;
    }

    return null;
  }

  async requestToken(clientType = 'web') {
    const deviceId = this.generateDeviceId();
    const sessionId = this.generateSessionId();

    const baseBody = {
      clientType,
      deviceId,
      sessionId
    };

    if (clientType === 'desktop') {
      // Ask main process to mint the JWT instead of exposing admin key
      if (window.electronAPI?.getDesktopJWT) {
        const jwt = await window.electronAPI.getDesktopJWT({ deviceId, sessionId });
        if (jwt) {
          this.token = jwt;
          this.tokenExpiry = Date.now() + (this.parseExpiryTime('7d') * 1000);
          localStorage.setItem('lyric_display_token', this.token);
          return this.token;
        }
      }

      const adminKey = await this.getAdminKey();
      if (adminKey) {
        baseBody.adminKey = adminKey;
        logDebug('Including admin key in token request');
      } else {
        logWarn('No admin key available for desktop client token request');
      }
    }

    const requiresJoinCode = this.requiresJoinCode(clientType);
    let joinCode = null;

    if (requiresJoinCode) {
      joinCode = this.getStoredJoinCode();
      if (!joinCode) {
        joinCode = await this.promptForJoinCode('missing');
      }

      if (!joinCode) {
        throw new Error('JOIN_CODE_REQUIRED: Join code was not provided');
      }

      this.storeJoinCode(joinCode);
    }

    const attempts = requiresJoinCode ? 2 : 1;
    let lastError = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const requestBody = { ...baseBody };

      if (requiresJoinCode && joinCode) {
        requestBody.joinCode = joinCode;
      }

      try {
        const response = await fetch(`${this.getServerUrl()}/api/auth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          let errorPayload = null;

          try {
            errorPayload = await response.json();
          } catch {
            errorPayload = null;
          }

          const message = errorPayload?.error || 'Token request failed';

          if (response.status === 403 && message.includes('Admin access key')) {
            throw new Error('ADMIN_KEY_REQUIRED: ' + message);
          }

          if (requiresJoinCode && response.status === 403 && message.includes('Join code')) {
            this.clearStoredJoinCode();

            if (attempt === attempts - 1) {
              throw new Error('JOIN_CODE_INVALID: ' + message);
            }

            joinCode = await this.promptForJoinCode('invalid', joinCode || '');
            if (!joinCode) {
              throw new Error('JOIN_CODE_REQUIRED: Join code was not provided');
            }

            this.storeJoinCode(joinCode);
            continue;
          }

          throw new Error(message);
        }

        const data = await response.json();
        this.token = data.token;
        this.tokenExpiry = Date.now() + (this.parseExpiryTime(data.expiresIn) * 1000);

        localStorage.setItem('lyric_display_token', this.token);
        localStorage.setItem('lyric_display_token_expiry', this.tokenExpiry.toString());
        localStorage.setItem('lyric_display_client_type', clientType);
        this.serverValidated = true;

        logDebug(`Authentication token obtained for ${clientType} client`);
        return this.token;
      } catch (error) {
        lastError = error;
        break;
      }
    }

    if (lastError) {
      const message = lastError?.message || String(lastError);
      logError('Token request failed:', message);

      if (message.startsWith('ADMIN_KEY_REQUIRED:')) {
        window.dispatchEvent(new CustomEvent('admin-key-error', {
          detail: {
            message: message.replace('ADMIN_KEY_REQUIRED: ', ''),
            isProduction: !import.meta.env.DEV
          },
        }));
      }

      throw lastError;
    }

    throw new Error('Token request failed');
  }

  async validateToken(token) {
    if (!token) return false;

    try {
      const response = await fetch(`${this.getServerUrl()}/api/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return !!data.valid;
    } catch (error) {
      logError('Token validation request failed:', error);
      return false;
    }
  }

  async refreshToken() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.token) {
      throw new Error('No token to refresh');
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.getServerUrl()}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: this.token
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Token refresh failed');
        }

        const data = await response.json();
        this.token = data.token;
        this.tokenExpiry = Date.now() + (this.parseExpiryTime(data.expiresIn) * 1000);

        localStorage.setItem('lyric_display_token', this.token);
        localStorage.setItem('lyric_display_token_expiry', this.tokenExpiry.toString());
        this.serverValidated = true;

        logDebug('Authentication token refreshed');
        return this.token;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  loadStoredToken() {
    const stored = localStorage.getItem('lyric_display_token');
    const expiry = localStorage.getItem('lyric_display_token_expiry');

    if (stored && expiry) {
      const expiryTime = parseInt(expiry);
      if (Date.now() < expiryTime - 60000) {
        this.token = stored;
        this.tokenExpiry = expiryTime;
        return true;
      }
      this.clearStoredToken();
    }
    return false;
  }

  clearStoredToken() {
    localStorage.removeItem('lyric_display_token');
    localStorage.removeItem('lyric_display_token_expiry');
    this.token = null;
    this.tokenExpiry = null;
    this.serverValidated = false;
  }

  isTokenValid() {
    return this.token && Date.now() < (this.tokenExpiry - 60000);
  }

  needsRefresh() {
    if (!this.token || !this.tokenExpiry) return false;
    return Date.now() > (this.tokenExpiry - 5 * 60 * 1000);
  }

  parseExpiryTime(expiresIn) {
    if (typeof expiresIn === 'number') return expiresIn;
    if (typeof expiresIn === 'string') {
      const match = expiresIn.match(/^(\d+)([smhd])$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
        return value * (multipliers[unit] || 3600);
      }
    }
    return 3600;
  }

  async ensureValidToken(clientType = 'web') {
    const hasStoredToken = this.loadStoredToken();
    if (!hasStoredToken || !this.isTokenValid()) {
      return await this.requestToken(clientType);
    }

    if (!this.serverValidated) {
      const stillValid = await this.validateToken(this.token);
      if (!stillValid) {
        logWarn('Stored token failed server validation, requesting new token');
        this.clearStoredToken();
        return await this.requestToken(clientType);
      }
      this.serverValidated = true;
    }

    if (this.needsRefresh()) {
      try {
        return await this.refreshToken();
      } catch (error) {
        logDebug('Token refresh failed, requesting new token');
        this.clearStoredToken();
        return await this.requestToken(clientType);
      }
    }

    return this.token;
  }
}

const authServiceInstance = new AuthService();

const useAuth = () => {
  const authServiceRef = useRef(authServiceInstance);

  const [authStatus, setAuthStatus] = useState('pending');

  const ensureValidToken = useCallback(async (clientType = 'web') => {
    return authServiceRef.current.ensureValidToken(clientType);
  }, []);

  const refreshAuthToken = useCallback(async () => {
    try {
      await authServiceRef.current.refreshToken();
      logDebug('Token refreshed successfully');
      return true;
    } catch (error) {
      logError('Token refresh failed:', error);
      setAuthStatus('failed');
      return false;
    }
  }, []);

  const clearAuthToken = useCallback(() => {
    authServiceRef.current.clearStoredToken();
  }, []);

  return {
    authStatus,
    setAuthStatus,
    ensureValidToken,
    refreshAuthToken,
    clearAuthToken,
  };
};

export default useAuth;
