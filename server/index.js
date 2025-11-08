// server/index.js
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import registerSocketEvents from './events.js';
import { assertJoinCodeAllowed, recordJoinCodeAttempt, getJoinCodeGuardSnapshot } from './joinCodeGuard.js';
import SimpleSecretManager from './secretManager.js';

const cleanupOldMediaFiles = async (outputKey) => {
  try {
    const files = await fs.promises.readdir(backgroundMediaDir);
    const pattern = new RegExp(`^${outputKey}-(output[12])-\\d+-[a-f0-9-]+\\.(jpg|jpeg|png|gif|webp|avif|mp4|webm|ogg|mov)$`, 'i');

    for (const file of files) {
      if (pattern.test(file)) {
        const filePath = path.join(backgroundMediaDir, file);
        await fs.promises.unlink(filePath);
        console.log(`Cleaned up old media file: ${file}`);
      }
    }
  } catch (error) {
    console.warn('Media cleanup warning (non-critical):', error.message);
  }
};

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const secretManager = new SimpleSecretManager();
const secrets = await secretManager.loadSecrets();

const JWT_SECRET = secrets.JWT_SECRET;
const TOKEN_EXPIRY = secrets.TOKEN_EXPIRY || process.env.TOKEN_EXPIRY || '24h';
const ADMIN_TOKEN_EXPIRY = secrets.ADMIN_TOKEN_EXPIRY || process.env.ADMIN_TOKEN_EXPIRY || '7d';

global.controllerJoinCode = String(Math.floor(100000 + Math.random() * 900000));
const VALID_CLIENT_TYPES = ['desktop', 'web', 'output1', 'output2', 'stage', 'mobile'];
const CONTROLLER_CLIENT_TYPES = ['web', 'mobile'];
const isControllerClient = (clientType) => CONTROLLER_CLIENT_TYPES.includes(clientType);


const app = express();
const server = http.createServer(app);

const dataRoot = process.env.LYRICDISPLAY_DATA_DIR
  ? path.resolve(process.env.LYRICDISPLAY_DATA_DIR)
  : path.join(__dirname, '..');
const uploadsRoot = path.join(dataRoot, 'uploads');
const backgroundMediaDir = path.join(uploadsRoot, 'backgrounds');
fs.mkdirSync(backgroundMediaDir, { recursive: true });

const allowedMediaTypes = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
]);

const backgroundStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, backgroundMediaDir),
  filename: (req, file, cb) => {
    const outputKey = req.body.outputKey || 'output1';
    const ext = path.extname(file.originalname || '').slice(0, 16) || '.bin';
    const uniqueName = `bg-${outputKey}-${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  }
});

const backgroundUpload = multer({
  storage: backgroundStorage,
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file?.mimetype || !allowedMediaTypes.has(file.mimetype)) {
      return cb(new Error('Unsupported media type'));
    }
    cb(null, true);
  },
});

// Rate limiting for token endpoints
const tokenRateLimit = rateLimit({
  windowMs: secrets.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: secrets.RATE_LIMIT_MAX_REQUESTS || 50,
  message: { error: 'Too many token requests, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS middleware for development
const corsMiddleware = (req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  if (isDev) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
};

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use('/api/auth', tokenRateLimit);

const localhostOnly = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (ip === '127.0.0.1' || ip === '::1' || req.hostname === 'localhost') return next();
  return res.status(403).json({ error: 'Local access only' });
};

const authenticateRequest = (requiredPermission) => (req, res, next) => {
  try {
    const authHeader = req.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const permissions = decoded.permissions || getClientPermissions(decoded.clientType);
    if (requiredPermission && !permissions.includes(requiredPermission) && !permissions.includes('admin:full')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    req.user = { ...decoded, permissions };
    return next();
  } catch (error) {
    console.error('HTTP authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};


// Token generation utilities
const generateToken = (payload, expiresIn = TOKEN_EXPIRY) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

const verifyToken = (token) => {
  const decode = (secret) => {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      return null;
    }
  };

  let decoded = decode(JWT_SECRET);

  if (!decoded && secrets.previousSecret && secrets.previousSecretExpiry) {
    const graceExpiry = new Date(secrets.previousSecretExpiry);
    if (new Date() < graceExpiry) {
      decoded = decode(secrets.previousSecret);
    }
  }

  if (!decoded) {
    return null;
  }

  if (isControllerClient(decoded.clientType)) {
    if (decoded.joinCode !== global.controllerJoinCode) {
      return null;
    }
  }

  return decoded;
};

// Authentication endpoints
app.post('/api/auth/token', (req, res) => {
  const { clientType, deviceId, sessionId, adminKey, joinCode } = req.body;

  if (!clientType || !deviceId) {
    return res.status(400).json({
      error: 'Missing required fields: clientType and deviceId'
    });
  }

  if (!VALID_CLIENT_TYPES.includes(clientType)) {
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

    const expiresIn = clientType === 'desktop' ? ADMIN_TOKEN_EXPIRY : TOKEN_EXPIRY;
    const token = generateToken(payload, expiresIn);

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

app.get('/api/auth/join-code', (req, res) => {
  res.json({ joinCode: global.controllerJoinCode || null });
});

app.post('/api/auth/refresh', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token required for refresh' });
  }

  const decoded = verifyToken(token);
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

    const expiresIn = decoded.clientType === 'desktop' ? ADMIN_TOKEN_EXPIRY : TOKEN_EXPIRY;
    const newToken = generateToken(newPayload, expiresIn);

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

  const decoded = verifyToken(token);
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

app.get('/api/connection/clients', authenticateRequest('lyrics:read'), (req, res) => {
  try {
    const connectedClientsData = global.getConnectedClients ? global.getConnectedClients() : [];

    res.json({
      success: true,
      clients: connectedClientsData,
      totalCount: connectedClientsData.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching connected clients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch connected clients'
    });
  }
});

app.post(
  '/api/media/backgrounds',
  authenticateRequest('settings:write'),
  async (req, res, next) => {
    backgroundUpload.single('background')(req, res, async (err) => {
      if (err) {
        console.error('Background upload error:', err);
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ error: err.message });
        }
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const relativePath = `/media/backgrounds/${req.file.filename}`;

      const outputKey = req.body.outputKey;
      if (outputKey && /^output[12]$/.test(outputKey)) {
        cleanupOldMediaFiles(outputKey).catch(err =>
          console.warn('Background cleanup failed (non-blocking):', err.message)
        );
      }

      res.json({
        url: relativePath,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: Date.now(),
      });
    });
  }
);

app.use('/media', express.static(uploadsRoot, {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

// Admin endpoint for secret management
app.get('/api/admin/secrets/status', localhostOnly, async (req, res) => {
  const status = await secretManager.getSecretsStatus();
  res.json(status);
});

app.post('/api/admin/secrets/rotate', localhostOnly, async (req, res) => {
  try {
    const newSecrets = await secretManager.rotateJWTSecret();
    res.json({
      success: true,
      message: 'JWT secret rotated successfully. Server restart required.',
      lastRotated: newSecrets.lastRotated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Permission system
function getClientPermissions(clientType) {
  const permissions = {
    desktop: [
      'lyrics:read', 'lyrics:write', 'lyrics:delete',
      'setlist:read', 'setlist:write', 'setlist:delete',
      'output:control', 'settings:write', 'admin:full'
    ],
    web: [
      'lyrics:read', 'lyrics:draft',
      'setlist:read',
      'output:control', 'settings:read', 'settings:write'
    ],
    output1: ['lyrics:read', 'settings:read'],
    output2: ['lyrics:read', 'settings:read'],
    stage: ['lyrics:read', 'settings:read'],
    mobile: [
      'lyrics:read', 'lyrics:draft',
      'setlist:read',
      'output:control', 'settings:read', 'settings:write'
    ]
  };

  return permissions[clientType] || ['lyrics:read'];
}

// Socket.IO authentication middleware (strict JWT required)
const authenticateSocket = (socket, next) => {

  if (socket.handshake.query?.token) {
    const error = new Error('Token in query string not allowed');
    error.data = { code: 'AUTH_TOKEN_IN_QUERY' };
    return next(error);
  }

  const token = socket.handshake.auth?.token;

  if (!token) {
    console.warn('Socket connection rejected: missing authentication token');
    const error = new Error('Authentication token required');
    error.data = { code: 'AUTH_TOKEN_REQUIRED' };
    return next(error);
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    console.warn('Socket connection rejected: invalid or expired token');
    const error = new Error('Invalid or expired token');
    error.data = { code: 'AUTH_TOKEN_INVALID' };
    return next(error);
  }

  socket.userData = {
    clientType: decoded.clientType,
    deviceId: decoded.deviceId,
    sessionId: decoded.sessionId,
    permissions: decoded.permissions,
    connectedAt: Date.now()
  };

  console.log('Socket authenticated:', decoded.clientType, '(' + decoded.deviceId + ')');
  return next();
};

// Permission checking utility
const hasPermission = (socket, permission) => {
  return socket.userData?.permissions?.includes(permission) ||
    socket.userData?.permissions?.includes('admin:full');
};

// Create Socket.IO server with authentication
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// Apply authentication middleware
io.use(authenticateSocket);

// Register socket events with authentication
registerSocketEvents(io, { hasPermission });

const PORT = process.env.PORT || 4000;
const isDev = process.env.NODE_ENV === 'development';

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const secretsStatus = await secretManager.getSecretsStatus();
  const joinCodeMetrics = getJoinCodeGuardSnapshot();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: isDev ? 'development' : 'production',
    security: {
      secretsLoaded: secretsStatus.exists,
      daysSinceRotation: secretsStatus.daysSinceRotation,
      needsRotation: secretsStatus.needsRotation,
      joinCodeGuard: joinCodeMetrics,
    }
  });
});

app.get('/api/health/ready', async (req, res) => {
  try {
    const secretsStatus = await secretManager.getSecretsStatus();
    const checks = {
      serverListening: true,
      secretsLoaded: !!secretsStatus?.exists,
      joinCodeGenerated: !!global.controllerJoinCode,
      socketIOReady: !!(io && io.engine),
      rateLimiterActive: !!tokenRateLimit,
    };

    const allChecksPass = Object.values(checks).every(check => check === true);

    if (allChecksPass) {
      res.json({
        status: 'ready',
        serverListening: true,
        timestamp: new Date().toISOString(),
        checks,
        uptime: process.uptime(),
        port: PORT,
        secretsStatus,
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        serverListening: true,
        timestamp: new Date().toISOString(),
        checks,
        failedChecks: Object.entries(checks)
          .filter(([_, passed]) => !passed)
          .map(([check]) => check),
        secretsStatus,
      });
    }
  } catch (error) {
    console.error('Health ready check error:', error);
    res.status(503).json({
      status: 'error',
      serverListening: true,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

if (!isDev) {
  const frontendPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(frontendPath));

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, async () => {
  const secretsStatus = await secretManager.getSecretsStatus();

  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Authentication enabled with JWT');
  console.log('Rate limiting active for auth endpoints');
  if (secretsStatus?.configPath) {
    console.log(`Secrets loaded from: ${secretsStatus.configPath}`);
  }

  if (secretsStatus?.needsRotation) {
    console.log(`JWT secret is ${secretsStatus.daysSinceRotation} days old - consider rotation`);
  }

  console.log('Server fully initialized and listening on port', PORT);

  if (process.send) {
    process.send({
      status: 'ready',
      port: PORT,
      timestamp: new Date().toISOString(),
      pid: process.pid
    });
  }
}).on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Another instance may be running.`);
    if (process.send) {
      process.send({
        status: 'error',
        error: 'EADDRINUSE',
        port: PORT,
        message: `Port ${PORT} is already in use`
      });
    }
    process.exit(1);
  } else {
    console.error('Server error:', error);
    if (process.send) {
      process.send({
        status: 'error',
        error: error.code || 'UNKNOWN',
        message: error.message
      });
    }
    process.exit(1);
  }
});
