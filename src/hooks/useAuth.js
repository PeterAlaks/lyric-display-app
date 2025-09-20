import { useCallback, useRef, useState } from 'react';
import { logDebug, logError, logWarn } from '../utils/logger';
import { readSecureToken, writeSecureToken, clearSecureToken } from '../utils/secureTokenStore';
import { resolveBackendOrigin } from '../utils/network';

class AuthService {
  constructor() {
    this.token = null;
    this.tokenExpiry = null;
    this.refreshPromise = null;
    this.serverValidated = false;
    this.joinCodeRequest = null;
    this.joinCodeTimer = null;
    this.tokenRequestPromise = null;
    this.lastClientType = null;
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

  async promptForJoinCode(reason = 'missing', options = {}) {
    if (typeof window === 'undefined' || !window.dispatchEvent) {
      return null;
    }

    let prefill = '';
    let lockInfo = null;

    if (typeof options === 'string') {
      prefill = options;
    } else if (options && typeof options === 'object') {
      prefill = typeof options.prefill === 'string' ? options.prefill : '';
      lockInfo = options.lockInfo || null;
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
        if (this.joinCodeTimer) {
          clearTimeout(this.joinCodeTimer);
          this.joinCodeTimer = null;
        }
        if (typeof value === 'string') {
          resolve(value.trim() || null);
        } else {
          resolve(null);
        }
      };

      const detail = {
        reason,
        prefill,
        lockInfo,
        resolve: (value) => settle(value),
      };

      try {
        window.dispatchEvent(new CustomEvent('request-join-code', { detail }));
      } catch (error) {
        logWarn('Failed to dispatch join code request modal:', error);
        settle(null);
        return;
      }

      const timeoutMs = lockInfo?.retryAfterMs
        ? Math.max(Number(lockInfo.retryAfterMs) + 1000, 1000)
        : 60000;

      this.joinCodeTimer = setTimeout(() => settle(null), timeoutMs);
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
    if (this.tokenRequestPromise) {
      return this.tokenRequestPromise;
    }

    this.tokenRequestPromise = (async () => {
      try {
        const deviceId = this.generateDeviceId();
        const sessionId = this.generateSessionId();

        const baseBody = {
          clientType,
          deviceId,
          sessionId
        };

        if (clientType === 'desktop') {
          if (window.electronAPI?.getDesktopJWT) {
            const jwt = await window.electronAPI.getDesktopJWT({ deviceId, sessionId });
            if (jwt) {
              this.token = jwt;
              this.tokenExpiry = Date.now() + (this.parseExpiryTime('7d') * 1000);
              this.lastClientType = clientType;
              await writeSecureToken({ clientType, deviceId, token: this.token, expiresAt: this.tokenExpiry });
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
        let joinCode = requiresJoinCode ? this.getStoredJoinCode() : null;

        while (true) {
          const requestBody = { ...baseBody };

          if (requiresJoinCode) {
            if (!joinCode) {
              joinCode = await this.promptForJoinCode('missing');
            }

            if (!joinCode) {
              throw new Error('JOIN_CODE_REQUIRED: Join code was not provided');
            }

            this.storeJoinCode(joinCode);
            requestBody.joinCode = joinCode;
          }

          let response;
          try {
            response = await fetch(`${this.getServerUrl()}/api/auth/token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody)
            });
          } catch (networkError) {
            logError('Token request failed:', networkError);
            throw new Error('Token request failed');
          }

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

            if (requiresJoinCode) {
              if (response.status === 403 && message.includes('Join code')) {
                this.clearStoredJoinCode();
                const previousCode = joinCode;
                joinCode = await this.promptForJoinCode('invalid', { prefill: previousCode || '' });
                if (!joinCode) {
                  throw new Error('JOIN_CODE_REQUIRED: Join code was not provided');
                }
                continue;
              }

              if (response.status === 423) {
                const retryAfterMs = Number(errorPayload?.retryAfterMs) || 0;
                this.clearStoredJoinCode();
                await this.promptForJoinCode('locked', { lockInfo: { retryAfterMs } });
                joinCode = null;
                continue;
              }
            }

            throw new Error(message);
          }

          const data = await response.json();
          this.token = data.token;
          this.tokenExpiry = Date.now() + (this.parseExpiryTime(data.expiresIn) * 1000);

          this.lastClientType = clientType;
          await writeSecureToken({ clientType, deviceId, token: this.token, expiresAt: this.tokenExpiry });
          this.serverValidated = true;

          logDebug(`Authentication token obtained for ${clientType} client`);
          return this.token;
        }
      } catch (error) {
        const message = error?.message || String(error);
        if (message.startsWith('ADMIN_KEY_REQUIRED:')) {
          window.dispatchEvent(new CustomEvent('admin-key-error', {
            detail: {
              message: message.replace('ADMIN_KEY_REQUIRED: ', ''),
              isProduction: !import.meta.env.DEV,
            },
          }));
        }
        throw error;
      }
    })();
    try {
      return await this.tokenRequestPromise;
    } finally {
      this.tokenRequestPromise = null;
    }
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
        const resolvedClientType = data.clientType || this.lastClientType || 'web';
        this.token = data.token;
        this.tokenExpiry = Date.now() + (this.parseExpiryTime(data.expiresIn) * 1000);
        this.lastClientType = resolvedClientType;
        const deviceId = this.generateDeviceId();
        await writeSecureToken({ clientType: resolvedClientType, deviceId, token: this.token, expiresAt: this.tokenExpiry });
        this.serverValidated = true;

        logDebug('Authentication token refreshed');
        return this.token;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async loadStoredToken(clientType = 'web') {
    const deviceId = this.generateDeviceId();

    try {
      const stored = await readSecureToken({ clientType, deviceId });
      if (!stored?.token) {
        return false;
      }

      const expiresAt = typeof stored.expiresAt === 'number' ? stored.expiresAt : null;
      if (expiresAt && Date.now() >= (expiresAt - 60000)) {
        await clearSecureToken({ clientType, deviceId });
        return false;
      }

      this.token = stored.token;
      this.tokenExpiry = expiresAt;
      this.lastClientType = stored.clientType || clientType || this.lastClientType;
      return true;
    } catch (error) {
      logWarn('Failed to load stored token:', error);
      return false;
    }
  }

  clearStoredToken() {
    const deviceId = this.generateDeviceId();
    const clientType = this.lastClientType || 'web';

    clearSecureToken({ clientType, deviceId }).catch((error) => {
      logWarn('Failed to clear secure token store:', error);
    });

    this.token = null;
    this.tokenExpiry = null;
    this.serverValidated = false;
    this.lastClientType = null;
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
    const hasStoredToken = await this.loadStoredToken(clientType);
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
