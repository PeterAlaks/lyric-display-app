import test from 'node:test';
import assert from 'node:assert/strict';
import { appendActionLog, resetActionLogForTests } from '../server/realtime/actionLog.js';
import { state } from '../server/realtime/state.js';
import { registerConnectionRoutes } from '../server/routes/connection.js';
import { registerHealthRoutes } from '../server/routes/health.js';

const createRouteHarness = () => {
  const routes = new Map();
  const app = {
    get(path, ...handlers) {
      routes.set(path, handlers);
    },
  };
  return { app, routes };
};

const createResponseHarness = () => {
  const result = { statusCode: 200, payload: null };
  return {
    result,
    res: {
      status(code) {
        result.statusCode = code;
        return this;
      },
      json(payload) {
        result.payload = payload;
        return this;
      },
    },
  };
};

test('connected-client topology requires admin permission', () => {
  const requestedPermissions = [];
  const { app, routes } = createRouteHarness();
  const authenticateRequest = (permission) => {
    requestedPermissions.push(permission);
    return (_req, _res, next) => next();
  };

  registerConnectionRoutes(app, { authenticateRequest });

  assert.deepEqual(requestedPermissions, ['admin:full']);
  assert.equal(routes.get('/api/connection/clients')?.length, 2);
});

test('action log updates are delivered only to admin sockets', () => {
  resetActionLogForTests();
  const previousClients = state.connectedClients;
  const adminEvents = [];
  const outputEvents = [];
  const controllerEvents = [];
  const fallbackEvents = [];
  state.connectedClients = new Map([
    ['admin', {
      permissions: ['admin:full'],
      socket: { connected: true, emit: (eventName, payload) => adminEvents.push({ eventName, payload }) },
    }],
    ['output', {
      permissions: ['lyrics:read'],
      socket: { connected: true, emit: (eventName, payload) => outputEvents.push({ eventName, payload }) },
    }],
    ['controller', {
      permissions: ['lyrics:read', 'output:control'],
      socket: { connected: true, emit: (eventName, payload) => controllerEvents.push({ eventName, payload }) },
    }],
  ]);

  try {
    appendActionLog({ emit: (eventName, payload) => fallbackEvents.push({ eventName, payload }) }, {
      type: 'line',
      label: 'Line changed',
    });
    assert.equal(adminEvents.at(-1)?.eventName, 'actionLogUpdate');
    assert.equal(outputEvents.length, 0);
    assert.equal(controllerEvents.length, 0);
    assert.equal(fallbackEvents.length, 0);
  } finally {
    state.connectedClients = previousClients;
  }
});

test('public health probes are redacted and detailed health requires admin', async () => {
  const requestedPermissions = [];
  const { app, routes } = createRouteHarness();
  const authenticateRequest = (permission) => {
    requestedPermissions.push(permission);
    return (_req, _res, next) => next();
  };
  const secretManager = {
    async getSecretsStatus() {
      return {
        exists: true,
        configPath: 'C:/sensitive/secrets.json',
        storageBackend: 'keytar',
        daysSinceRotation: 2,
        needsRotation: false,
      };
    },
  };

  registerHealthRoutes(app, {
    io: { engine: {} },
    port: 4000,
    authenticateRequest,
    secretManager,
    startupSecretRotation: { rotated: false },
    tokenRateLimit: () => {},
  });

  const health = createResponseHarness();
  await routes.get('/api/health')[0]({}, health.res);
  assert.deepEqual(Object.keys(health.result.payload).sort(), ['status', 'timestamp']);

  const previousJoinCode = global.controllerJoinCode;
  global.controllerJoinCode = '123456';
  try {
    const ready = createResponseHarness();
    await routes.get('/api/health/ready')[0]({}, ready.res);
    assert.deepEqual(Object.keys(ready.result.payload).sort(), ['serverListening', 'status', 'timestamp']);

    secretManager.getSecretsStatus = async () => {
      throw new Error('C:/sensitive/secrets.json could not be read');
    };
    const failedReady = createResponseHarness();
    await routes.get('/api/health/ready')[0]({}, failedReady.res);
    assert.equal(failedReady.result.statusCode, 503);
    assert.deepEqual(Object.keys(failedReady.result.payload).sort(), ['serverListening', 'status', 'timestamp']);

    assert.deepEqual(requestedPermissions, ['admin:full']);
    secretManager.getSecretsStatus = async () => ({
      exists: true,
      configPath: 'C:/sensitive/secrets.json',
      storageBackend: 'keytar',
      daysSinceRotation: 2,
      needsRotation: false,
    });
    const details = createResponseHarness();
    const detailHandlers = routes.get('/api/health/details');
    await detailHandlers[1]({}, details.res);
    assert.equal(details.result.payload.security.configPath, 'C:/sensitive/secrets.json');
  } finally {
    global.controllerJoinCode = previousJoinCode;
  }
});
