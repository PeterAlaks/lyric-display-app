import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import registerSocketEvents, { getOutputRegistry, hasOutput } from './events.js';
import SimpleSecretManager from './security/secretManager.js';
import { createTokenService } from './auth/tokens.js';
import { registerObsDockPairingToken } from './auth/obsDockPairing.js';
import { createRequestAuthenticator } from './auth/httpAuth.js';
import { createSocketAuthenticator } from './auth/socketAuth.js';
import { hasPermission } from './auth/permissions.js';
import { corsMiddleware } from './middleware/cors.js';
import { localhostOnly } from './middleware/localhostOnly.js';
import { createMediaPaths } from './media/paths.js';
import { createUserMediaService } from './media/userMedia.js';
import { createBackgroundMediaService } from './media/backgroundMedia.js';
import { createUploadMiddleware } from './media/uploads.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerOutputRoutes } from './routes/outputs.js';
import { registerConnectionRoutes } from './routes/connection.js';
import { registerMediaRoutes } from './routes/media.js';
import { registerAdminSecretRoutes } from './routes/adminSecrets.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerIntegrationRoutes } from './routes/integrations.js';
import { registerAppControlRoutes } from './routes/appControl.js';
import { registerTemplateRoutes } from './routes/templates.js';
import { loadPersistedSessionState } from './realtime/sessionPersistence.js';

dotenv.config();

process.on('uncaughtException', (error) => {
  console.error('Backend uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Backend unhandled rejection:', reason);
  process.exit(1);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const secretManager = new SimpleSecretManager();
const startupSecretRotation = await secretManager.rotateJWTSecretIfStale();
const secrets = startupSecretRotation.secrets;

if (startupSecretRotation.rotated) {
  console.log('JWT secret auto-rotated during startup because it was stale');
}

const JWT_SECRET = secrets.JWT_SECRET;
const TOKEN_EXPIRY = secrets.TOKEN_EXPIRY || process.env.TOKEN_EXPIRY || '24h';
const ADMIN_TOKEN_EXPIRY = secrets.ADMIN_TOKEN_EXPIRY || process.env.ADMIN_TOKEN_EXPIRY || '7d';

global.controllerJoinCode = String(Math.floor(100000 + Math.random() * 900000));

if (process.env.LYRICDISPLAY_OBS_DOCK_PAIRING_TOKEN) {
  registerObsDockPairingToken(process.env.LYRICDISPLAY_OBS_DOCK_PAIRING_TOKEN);
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const isDev = process.env.NODE_ENV === 'development';

const tokenService = createTokenService({
  secrets,
  jwtSecret: JWT_SECRET,
  tokenExpiry: TOKEN_EXPIRY,
  adminTokenExpiry: ADMIN_TOKEN_EXPIRY,
});

const authenticateRequest = createRequestAuthenticator({
  verifyToken: tokenService.verifyToken,
});

const tokenRateLimit = rateLimit({
  windowMs: secrets.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: secrets.RATE_LIMIT_MAX_REQUESTS || 50,
  message: { error: 'Too many token requests, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const dataRoot = process.env.LYRICDISPLAY_DATA_DIR
  ? path.resolve(process.env.LYRICDISPLAY_DATA_DIR)
  : path.join(__dirname, '..');

const mediaPaths = createMediaPaths({ dataRoot });
const userMediaService = createUserMediaService(mediaPaths);
const backgroundMediaService = createBackgroundMediaService(mediaPaths);
const uploadMiddleware = createUploadMiddleware({
  ...mediaPaths,
  getMediaDirectory: userMediaService.getMediaDirectory,
});

await loadPersistedSessionState({ dataRoot });

app.use(corsMiddleware);
app.use(express.json());
app.use('/api/auth', tokenRateLimit);

registerOutputRoutes(app, { getOutputRegistry, hasOutput });
registerIntegrationRoutes(app, { getOutputRegistry, port: PORT });
registerAppControlRoutes(app, { localhostOnly });
registerTemplateRoutes(app, { localhostOnly });
registerAuthRoutes(app, { secrets, tokenService, localhostOnly });
registerConnectionRoutes(app, { authenticateRequest });
registerMediaRoutes(app, {
  authenticateRequest,
  backgroundMediaService,
  userMediaService,
  ...uploadMiddleware,
  uploadsRoot: mediaPaths.uploadsRoot,
});
registerAdminSecretRoutes(app, { localhostOnly, secretManager });

const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

io.use(createSocketAuthenticator({
  verifyToken: tokenService.verifyToken,
}));

registerSocketEvents(io, { hasPermission });

registerHealthRoutes(app, {
  io,
  port: PORT,
  secretManager,
  startupSecretRotation,
  tokenRateLimit,
});

process.on('message', (message) => {
  if (message?.type === 'obs-dock-pairing-token') {
    const registered = registerObsDockPairingToken(message.token);
    if (registered) {
      console.log('Registered temporary OBS dock pairing token');
    }
    return;
  }

  if (message?.type === 'obs-dock-local-auth') {
    process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH = message.enabled ? '1' : '';
  }
});

if (!isDev) {
  const frontendPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(frontendPath));

  app.get('/{*splat}', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

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

  if (startupSecretRotation.rotated) {
    console.log('JWT secret startup rotation completed; previous tokens remain valid during the grace period');
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
