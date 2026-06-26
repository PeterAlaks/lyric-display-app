import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertJoinCodeAllowed, recordJoinCodeAttempt } from '../server/auth/joinCodeGuard.js';
import { registerObsDockPairingToken } from '../server/auth/obsDockPairing.js';
import { getClientPermissions, hasPermission } from '../server/auth/permissions.js';
import { createTokenService } from '../server/auth/tokens.js';
import { localhostOnly } from '../server/middleware/localhostOnly.js';
import { registerAppControlRoutes } from '../server/routes/appControl.js';
import { registerAuthRoutes } from '../server/routes/auth.js';
import { registerTemplateRoutes } from '../server/routes/templates.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function createObsDockTokenRoute({ tokenService }) {
  const routes = [];
  const app = {
    post(path, ...handlers) {
      routes.push({ method: 'POST', path, handlers });
    },
    get() {},
  };

  registerAuthRoutes(app, { secrets: {}, tokenService, localhostOnly });

  const route = routes.find((candidate) => candidate.path === '/api/auth/obs-dock/token');
  assert.ok(route, 'OBS dock token route should be registered');
  return route.handlers;
}

function createAppControlRoute(routePath, options = {}) {
  const routes = [];
  const app = {
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers });
    },
    post(path, ...handlers) {
      routes.push({ method: 'POST', path, handlers });
    },
  };

  registerAppControlRoutes(app, { localhostOnly, ...options });

  const route = routes.find((candidate) => candidate.path === routePath);
  assert.ok(route, `${routePath} route should be registered`);
  return route.handlers;
}

function createSwitchToDockModeRoute() {
  return createAppControlRoute('/api/app/switch-to-dock-mode');
}

function createSwitchToDesktopModeRoute() {
  return createAppControlRoute('/api/app/switch-to-desktop-mode');
}

function createTemplateRoute(routePath = '/api/templates/:type') {
  const routes = [];
  const app = {
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers });
    },
  };

  registerTemplateRoutes(app, { localhostOnly });

  const route = routes.find((candidate) => candidate.path === routePath);
  assert.ok(route, `${routePath} route should be registered`);
  return route.handlers;
}

async function invokeRoute(handlers, req) {
  const res = createResponse();
  let index = 0;

  const next = () => {
    index += 1;
    const handler = handlers[index];
    if (handler) {
      return handler(req, res, next);
    }
    return undefined;
  };

  await handlers[0](req, res, next);
  return res;
}

function createLocalRequest({ body = {}, origin = null } = {}) {
  return {
    body,
    params: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    connection: { remoteAddress: '127.0.0.1' },
    get(name) {
      return name.toLowerCase() === 'origin' ? origin : undefined;
    },
  };
}

function createTemplateRequest({ type = 'output', origin = null } = {}) {
  return {
    ...createLocalRequest({ origin }),
    params: { type },
  };
}

test('controller tokens are invalidated when the join code rotates', () => {
  const previousJoinCode = global.controllerJoinCode;
  global.controllerJoinCode = '123456';

  try {
    const tokenService = createTokenService({
      secrets: {},
      jwtSecret: 'test-current-secret',
      tokenExpiry: '1h',
      adminTokenExpiry: '1h',
    });

    const token = tokenService.generateToken({
      clientType: 'mobile',
      deviceId: 'device-a',
      sessionId: 'session-a',
      joinCode: '123456',
      permissions: getClientPermissions('mobile'),
    });

    assert.equal(tokenService.verifyToken(token)?.clientType, 'mobile');

    global.controllerJoinCode = '654321';
    assert.equal(tokenService.verifyToken(token), null);
  } finally {
    global.controllerJoinCode = previousJoinCode;
  }
});

test('token verification accepts previous signing secret during grace period', () => {
  const issuer = createTokenService({
    secrets: {},
    jwtSecret: 'test-previous-secret',
    tokenExpiry: '1h',
    adminTokenExpiry: '1h',
  });
  const verifier = createTokenService({
    secrets: {
      previousSecret: 'test-previous-secret',
      previousSecretExpiry: new Date(Date.now() + 60_000).toISOString(),
    },
    jwtSecret: 'test-current-secret',
    tokenExpiry: '1h',
    adminTokenExpiry: '1h',
  });

  const token = issuer.generateToken({
    clientType: 'desktop',
    deviceId: 'desktop-device',
    sessionId: 'desktop-session',
    permissions: getClientPermissions('desktop'),
  });

  assert.equal(verifier.verifyToken(token)?.clientType, 'desktop');
});

test('join-code guard locks repeated failures and clears after success', () => {
  const context = {
    ip: '203.0.113.10',
    deviceId: `device-${Date.now()}-${Math.random()}`,
    sessionId: 'session-lockout',
  };

  assert.equal(assertJoinCodeAllowed(context).allowed, true);

  for (let i = 0; i < 5; i += 1) {
    recordJoinCodeAttempt({ ...context, success: false });
  }

  const locked = assertJoinCodeAllowed(context);
  assert.equal(locked.allowed, false);
  assert.equal(locked.remainingAttempts, 0);
  assert.ok(locked.retryAfterMs > 0);

  recordJoinCodeAttempt({ ...context, success: true });
  assert.equal(assertJoinCodeAllowed(context).allowed, true);
});

test('permission sets keep output clients read-only and desktop admin authoritative', () => {
  assert.deepEqual(getClientPermissions('output3'), ['lyrics:read', 'settings:read']);
  assert.equal(getClientPermissions('mobile').includes('setlist:write'), false);
  assert.equal(getClientPermissions('mobile').includes('lyrics:write'), true);
  assert.equal(getClientPermissions('obsDock').includes('admin:full'), false);
  assert.equal(getClientPermissions('obsDock').includes('setlist:write'), true);

  assert.equal(hasPermission({ userData: { permissions: ['admin:full'] } }, 'setlist:delete'), true);
  assert.equal(hasPermission({ userData: { permissions: ['lyrics:read'] } }, 'lyrics:write'), false);
});

test('OBS dock local headless auth mints limited obsDock tokens only for local dock pages', async () => {
  const previous = process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH;
  process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH = '1';

  try {
    const tokenService = createTokenService({
      secrets: {},
      jwtSecret: 'test-current-secret',
      tokenExpiry: '1h',
      adminTokenExpiry: '1h',
    });
    const handlers = createObsDockTokenRoute({ tokenService });

    const res = await invokeRoute(handlers, createLocalRequest({
      body: { deviceId: 'obs-device', sessionId: 'obs-session' },
      origin: 'http://localhost:5173',
    }));

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.clientType, 'obsDock');
    assert.equal(res.body.permissions.includes('admin:full'), false);
    assert.equal(tokenService.verifyToken(res.body.token)?.clientType, 'obsDock');
  } finally {
    if (previous === undefined) {
      delete process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH;
    } else {
      process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH = previous;
    }
  }
});

test('OBS dock auth rejects non-local origins even from loopback requests', async () => {
  const previous = process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH;
  process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH = '1';

  try {
    const tokenService = createTokenService({
      secrets: {},
      jwtSecret: 'test-current-secret',
      tokenExpiry: '1h',
      adminTokenExpiry: '1h',
    });
    const handlers = createObsDockTokenRoute({ tokenService });

    const res = await invokeRoute(handlers, createLocalRequest({
      body: { deviceId: 'obs-device' },
      origin: 'https://example.com',
    }));

    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /local dock page/i);
  } finally {
    if (previous === undefined) {
      delete process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH;
    } else {
      process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH = previous;
    }
  }
});

test('OBS dock pairing tokens are one-time credentials', async () => {
  const previous = process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH;
  delete process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH;

  try {
    const tokenService = createTokenService({
      secrets: {},
      jwtSecret: 'test-current-secret',
      tokenExpiry: '1h',
      adminTokenExpiry: '1h',
    });
    const handlers = createObsDockTokenRoute({ tokenService });
    const pairingToken = '0123456789abcdef0123456789abcdef';

    assert.equal(registerObsDockPairingToken(pairingToken), true);

    const first = await invokeRoute(handlers, createLocalRequest({
      body: { deviceId: 'obs-device', pairingToken },
      origin: 'null',
    }));
    const second = await invokeRoute(handlers, createLocalRequest({
      body: { deviceId: 'obs-device', pairingToken },
      origin: 'null',
    }));

    assert.equal(first.statusCode, 200);
    assert.equal(first.body.clientType, 'obsDock');
    assert.equal(second.statusCode, 403);
  } finally {
    if (previous === undefined) {
      delete process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH;
    } else {
      process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH = previous;
    }
  }
});

test('local app-control desktop mode switch reports Electron acknowledgement timeout', async () => {
  const previousSend = process.send;
  const messages = [];
  process.send = (message) => {
    messages.push(message);
    return true;
  };

  try {
    const handlers = createAppControlRoute('/api/app/switch-to-desktop-mode', { appControlTimeoutMs: 10 });
    const res = await invokeRoute(handlers, createLocalRequest({
      origin: 'null',
    }));

    assert.equal(res.statusCode, 504);
    assert.match(res.body.error, /timed out/i);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'switch-to-desktop-mode');
    assert.match(messages[0].requestId, /^app_control_/);
  } finally {
    if (previousSend === undefined) {
      delete process.send;
    } else {
      process.send = previousSend;
    }
  }
});

test('local app-control route asks Electron to switch to desktop mode', async () => {
  const previousSend = process.send;
  const messages = [];
  process.send = (message) => {
    messages.push(message);
    setImmediate(() => {
      process.emit('message', {
        type: 'app-control-response',
        requestId: message.requestId,
        success: true,
      });
    });
    return true;
  };

  try {
    const handlers = createSwitchToDesktopModeRoute();
    const res = await invokeRoute(handlers, createLocalRequest({
      origin: 'null',
    }));

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'switch-to-desktop-mode');
    assert.equal(messages[0].source, 'obs-dock');
    assert.match(messages[0].requestId, /^app_control_/);
  } finally {
    if (previousSend === undefined) {
      delete process.send;
    } else {
      process.send = previousSend;
    }
  }
});

test('local app-control route asks Electron to switch to Dock Mode', async () => {
  const previousSend = process.send;
  const messages = [];
  process.send = (message) => {
    messages.push(message);
    return true;
  };

  try {
    const handlers = createSwitchToDockModeRoute();
    const res = await invokeRoute(handlers, createLocalRequest({
      origin: 'null',
    }));

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true });
    assert.deepEqual(messages, [{ type: 'switch-to-dock-mode', source: 'obs-dock' }]);
  } finally {
    if (previousSend === undefined) {
      delete process.send;
    } else {
      process.send = previousSend;
    }
  }
});

test('local app-control Dock Mode switch rejects non-local browser origins', async () => {
  const previousSend = process.send;
  process.send = () => true;

  try {
    const handlers = createSwitchToDockModeRoute();
    const res = await invokeRoute(handlers, createLocalRequest({
      origin: 'https://example.com',
    }));

    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /local dock page/i);
  } finally {
    if (previousSend === undefined) {
      delete process.send;
    } else {
      process.send = previousSend;
    }
  }
});

test('local app-control capabilities report dock headless auth state', async () => {
  const previousSend = process.send;
  const previousAuth = process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH;
  process.send = () => true;
  process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH = '1';

  try {
    const handlers = createAppControlRoute('/api/app/capabilities');
    const res = await invokeRoute(handlers, createLocalRequest({
      origin: 'null',
    }));

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      switchToDesktopMode: true,
      obsDockLocalAuth: true,
    });
  } finally {
    if (previousSend === undefined) {
      delete process.send;
    } else {
      process.send = previousSend;
    }
    if (previousAuth === undefined) {
      delete process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH;
    } else {
      process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH = previousAuth;
    }
  }
});

test('local app-control route rejects non-local browser origins', async () => {
  const previousSend = process.send;
  process.send = () => true;

  try {
    const handlers = createSwitchToDesktopModeRoute();
    const res = await invokeRoute(handlers, createLocalRequest({
      origin: 'https://example.com',
    }));

    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /local dock page/i);
  } finally {
    if (previousSend === undefined) {
      delete process.send;
    } else {
      process.send = previousSend;
    }
  }
});

test('local template route loads saved output templates from user data', async () => {
  const previousUserData = process.env.LYRICDISPLAY_USER_DATA_DIR;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-templates-'));

  try {
    process.env.LYRICDISPLAY_USER_DATA_DIR = tempDir;
    const templatesDir = path.join(tempDir, 'UserTemplates');
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(path.join(templatesDir, 'output-templates.json'), JSON.stringify([
      { id: 'user-1', name: 'Lower Third', settings: { fontSize: 54 } },
    ]), 'utf8');

    const handlers = createTemplateRoute();
    const res = await invokeRoute(handlers, createTemplateRequest({
      type: 'output',
      origin: 'null',
    }));

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.templates, [
      { id: 'user-1', name: 'Lower Third', settings: { fontSize: 54 } },
    ]);
  } finally {
    if (previousUserData === undefined) {
      delete process.env.LYRICDISPLAY_USER_DATA_DIR;
    } else {
      process.env.LYRICDISPLAY_USER_DATA_DIR = previousUserData;
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('local template route rejects non-local browser origins', async () => {
  const handlers = createTemplateRoute();
  const res = await invokeRoute(handlers, createTemplateRequest({
    type: 'output',
    origin: 'https://example.com',
  }));

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /local LyricDisplay page/i);
});
