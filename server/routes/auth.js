import { assertJoinCodeAllowed, recordJoinCodeAttempt } from '../auth/joinCodeGuard.js';
import { consumeObsDockPairingToken, pruneObsDockPairingTokens } from '../auth/obsDockPairing.js';
import { getClientPermissions } from '../auth/permissions.js';
import { isControllerClient, isOutputClientType, VALID_CLIENT_TYPES } from '../config/clientTypes.js';
import { localhostOnly } from '../middleware/localhostOnly.js';

const isAllowedObsDockOrigin = (origin) => {
  if (!origin || origin === 'null') return true;

  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1'
    );
  } catch {
    return false;
  }
};

const isLocalObsDockAuthEnabled = () => process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH === '1';

export function registerAuthRoutes(app, { secrets, tokenService, localhostOnly }) {
  app.post('/api/auth/token', (req, res) => {
    const { clientType, deviceId, sessionId, adminKey, joinCode } = req.body;

    if (!clientType || !deviceId) {
      return res.status(400).json({
        error: 'Missing required fields: clientType and deviceId'
      });
    }

    if (!VALID_CLIENT_TYPES.includes(clientType) && !isOutputClientType(clientType)) {
      return res.status(400).json({
        error: 'Invalid client type. Must be one of: ' + VALID_CLIENT_TYPES.join(', ')
      });
    }

    if (clientType === 'desktop') {
      const isProduction = process.env.NODE_ENV === 'production';
      const isDev = process.env.NODE_ENV === 'development' || !isProduction;

      if (isProduction && adminKey !== secrets.ADMIN_ACCESS_KEY) {
        console.warn(`Desktop token request denied - invalid admin key from ${req.ip}`);
        return res.status(403).json({
          error: 'Admin access key required for desktop client tokens'
        });
      }

      if (isDev && !adminKey) {
        console.warn('Desktop token issued without admin key (development mode)');
      } else if (isDev && adminKey && adminKey !== secrets.ADMIN_ACCESS_KEY) {
        console.warn('Desktop token issued with incorrect admin key (development mode - allowing anyway)');
      }
    } else if (isControllerClient(clientType)) {
      const guardContext = { ip: req.ip, deviceId, sessionId };

      if (!joinCode || joinCode !== global.controllerJoinCode) {
        recordJoinCodeAttempt({ ...guardContext, success: false });
        const guardStatus = assertJoinCodeAllowed(guardContext);

        if (!guardStatus.allowed) {
          console.warn(`Controller token request locked out for ${req.ip} (${deviceId})`);
          return res.status(423).json({
            error: 'Too many invalid join code attempts. Try again later.',
            retryAfterMs: guardStatus.retryAfterMs,
          });
        }

        console.warn(`Controller token denied - bad join code from ${req.ip}`);
        return res.status(403).json({ error: 'Join code required or invalid' });
      }

      recordJoinCodeAttempt({ ...guardContext, success: true });
    }

    try {
      const payload = {
        clientType,
        deviceId,
        sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        permissions: getClientPermissions(clientType),
        issuedAt: Date.now()
      };

      if (isControllerClient(clientType)) {
        payload.joinCode = global.controllerJoinCode;
      }

      const expiresIn = tokenService.getExpiryForClient(clientType);
      const token = tokenService.generateToken(payload, expiresIn);

      console.log(`Generated ${clientType} token (${deviceId}) - Admin key: ${adminKey ? 'provided' : 'not provided'}`);

      res.json({
        token,
        expiresIn,
        clientType,
        deviceId,
        sessionId: payload.sessionId,
        permissions: payload.permissions
      });
    } catch (error) {
      console.error('Token generation error:', error);
      res.status(500).json({ error: 'Failed to generate token' });
    }
  });

  app.get('/api/auth/join-code', localhostOnly, (req, res) => {
    res.json({ joinCode: global.controllerJoinCode || null });
  });

  app.post('/api/auth/obs-dock/token', localhostOnly, (req, res) => {
    const { deviceId, sessionId, pairingToken } = req.body || {};
    const origin = req.get('origin');

    if (!isAllowedObsDockOrigin(origin)) {
      return res.status(403).json({ error: 'OBS dock pairing is only allowed from a local dock page' });
    }

    if (!deviceId) {
      return res.status(400).json({ error: 'Missing required field: deviceId' });
    }

    pruneObsDockPairingTokens();

    const paired = pairingToken ? consumeObsDockPairingToken(pairingToken) : false;
    const localHeadlessAuth = !paired && isLocalObsDockAuthEnabled();

    if (!paired && !localHeadlessAuth) {
      return res.status(403).json({ error: 'OBS dock pairing token is invalid or expired' });
    }

    try {
      const clientType = 'obsDock';
      const payload = {
        clientType,
        deviceId,
        sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        permissions: getClientPermissions(clientType),
        joinCode: global.controllerJoinCode,
        obsDockPairing: paired,
        obsDockLocalHeadlessAuth: localHeadlessAuth,
        issuedAt: Date.now()
      };

      const expiresIn = tokenService.getExpiryForClient(clientType);
      const token = tokenService.generateToken(payload, expiresIn);

      console.log(`Generated OBS dock token (${deviceId}) via ${paired ? 'pairing' : 'local headless auth'}`);

      res.json({
        token,
        expiresIn,
        clientType,
        deviceId,
        sessionId: payload.sessionId,
        permissions: payload.permissions
      });
    } catch (error) {
      console.error('OBS dock token generation error:', error);
      res.status(500).json({ error: 'Failed to generate OBS dock token' });
    }
  });

  app.post('/api/auth/refresh', (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required for refresh' });
    }

    const decoded = tokenService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    try {
      const newPayload = {
        clientType: decoded.clientType,
        deviceId: decoded.deviceId,
        sessionId: decoded.sessionId,
        permissions: decoded.permissions,
        issuedAt: Date.now()
      };

      if (isControllerClient(decoded.clientType)) {
        newPayload.joinCode = global.controllerJoinCode;
      }

      const expiresIn = tokenService.getExpiryForClient(decoded.clientType);
      const newToken = tokenService.generateToken(newPayload, expiresIn);

      console.log(`Refreshed token for ${decoded.clientType} client (${decoded.deviceId})`);

      res.json({
        token: newToken,
        expiresIn,
        clientType: decoded.clientType,
        deviceId: decoded.deviceId,
        sessionId: decoded.sessionId,
        permissions: decoded.permissions
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  });

  app.post('/api/auth/validate', (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const decoded = tokenService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ valid: false, error: 'Invalid or expired token' });
    }

    res.json({
      valid: true,
      clientType: decoded.clientType,
      deviceId: decoded.deviceId,
      sessionId: decoded.sessionId,
      permissions: decoded.permissions,
      expiresAt: decoded.exp * 1000
    });
  });
}
