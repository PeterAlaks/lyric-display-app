import { getJoinCodeGuardSnapshot } from '../auth/joinCodeGuard.js';

export function registerHealthRoutes(app, {
  io,
  port,
  authenticateRequest,
  secretManager,
  startupSecretRotation,
  tokenRateLimit,
}) {
  const isDev = process.env.NODE_ENV === 'development';

  app.get('/api/health', async (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
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
        });
      } else {
        res.status(503).json({
          status: 'not_ready',
          serverListening: true,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Health ready check error:', error);
      res.status(503).json({
        status: 'error',
        serverListening: true,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/api/health/details', authenticateRequest('admin:full'), async (req, res) => {
    try {
      const secretsStatus = await secretManager.getSecretsStatus();
      const checks = {
        serverListening: true,
        secretsLoaded: Boolean(secretsStatus?.exists),
        joinCodeGenerated: Boolean(global.controllerJoinCode),
        socketIOReady: Boolean(io && io.engine),
        rateLimiterActive: Boolean(tokenRateLimit),
      };

      res.json({
        status: Object.values(checks).every(Boolean) ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        environment: isDev ? 'development' : 'production',
        port,
        uptime: process.uptime(),
        checks,
        security: {
          secretsLoaded: Boolean(secretsStatus?.exists),
          daysSinceRotation: secretsStatus?.daysSinceRotation ?? null,
          needsRotation: Boolean(secretsStatus?.needsRotation),
          autoRotatedAtStartup: Boolean(startupSecretRotation.rotated),
          joinCodeGuard: getJoinCodeGuardSnapshot(),
          storageBackend: secretsStatus?.storageBackend || null,
          configPath: secretsStatus?.configPath || null,
        },
      });
    } catch (error) {
      console.error('Detailed health check error:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Detailed health diagnostics are unavailable',
      });
    }
  });
}
