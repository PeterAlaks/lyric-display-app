import assert from 'node:assert/strict';
import test from 'node:test';
import { assertJoinCodeAllowed, recordJoinCodeAttempt } from '../server/auth/joinCodeGuard.js';
import { getClientPermissions, hasPermission } from '../server/auth/permissions.js';
import { createTokenService } from '../server/auth/tokens.js';

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

  assert.equal(hasPermission({ userData: { permissions: ['admin:full'] } }, 'setlist:delete'), true);
  assert.equal(hasPermission({ userData: { permissions: ['lyrics:read'] } }, 'lyrics:write'), false);
});
