import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import express from 'express';
import {
  evaluateNdiReadiness,
  evaluateOutputReadiness,
  evaluateProjectionReadiness,
  NDI_FRAME_FRESH_MS,
  NDI_TELEMETRY_FRESH_MS,
  OUTPUT_METRICS_FRESH_MS,
} from '../shared/productionReadiness.js';
import {
  DEFAULT_BACKEND_PORT,
  isValidBackendPort,
  normalizeBackendPort,
  resolveRuntimeBackendPort,
} from '../shared/backendPort.js';
import {
  findAvailableBackendPort,
  probeBackendPort,
} from '../main/portAvailability.js';

const NOW = 1_800_000_000_000;
const serverSource = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
const packagedRuntimeProbeSource = fs.readFileSync(
  new URL('../scripts/verify-packaged-runtime.js', import.meta.url),
  'utf8',
);
const startupSource = fs.readFileSync(new URL('../main/startup.js', import.meta.url), 'utf8');
const backendSource = fs.readFileSync(new URL('../main/backend.js', import.meta.url), 'utf8');
const preferencesIpcSource = fs.readFileSync(
  new URL('../main/ipc/preferences.js', import.meta.url),
  'utf8',
);
const releaseWorkflowSource = fs.readFileSync(
  new URL('../.github/workflows/build-release.yml', import.meta.url),
  'utf8',
);
const platformWorkflowSource = fs.readFileSync(
  new URL('../.github/workflows/test-platform-builds.yml', import.meta.url),
  'utf8',
);
const releaseScriptSource = fs.readFileSync(new URL('../scripts/release.js', import.meta.url), 'utf8');

test('production backend ports are validated and resolved without changing the development port', () => {
  assert.equal(DEFAULT_BACKEND_PORT, 4000);
  assert.equal(isValidBackendPort(1024), true);
  assert.equal(isValidBackendPort(65535), true);
  assert.equal(isValidBackendPort(1023), false);
  assert.equal(isValidBackendPort(65536), false);
  assert.equal(isValidBackendPort('4001'), true);
  assert.equal(isValidBackendPort('4001.5'), false);
  assert.equal(normalizeBackendPort('4700'), 4700);
  assert.equal(normalizeBackendPort('invalid'), DEFAULT_BACKEND_PORT);
  assert.equal(resolveRuntimeBackendPort({ isPackaged: true, configuredPort: 4700, environmentPort: 4800 }), 4700);
  assert.equal(resolveRuntimeBackendPort({ isPackaged: false, configuredPort: 4700, environmentPort: 4800 }), 4800);
  assert.equal(resolveRuntimeBackendPort({ isPackaged: false, configuredPort: 4700 }), DEFAULT_BACKEND_PORT);
});

test('backend port probing rejects an occupied port and finds a usable recovery port', async () => {
  const occupiedServer = net.createServer();
  occupiedServer.listen(0);
  await once(occupiedServer, 'listening');
  const occupiedPort = occupiedServer.address().port;

  try {
    const occupied = await probeBackendPort(occupiedPort);
    assert.equal(occupied.available, false);
    assert.equal(occupied.code, 'EADDRINUSE');

    const recovery = await findAvailableBackendPort({
      preferredPort: occupiedPort,
      excludedPorts: [occupiedPort],
    });
    assert.equal(recovery.success, true);
    assert.equal(isValidBackendPort(recovery.port), true);
    assert.notEqual(recovery.port, occupiedPort);
    assert.equal((await probeBackendPort(recovery.port)).available, true);
  } finally {
    occupiedServer.closeAllConnections?.();
    await new Promise((resolve, reject) => {
      occupiedServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('port changes are availability-checked and startup conflicts have a recovery path', () => {
  assert.match(preferencesIpcSource, /probeBackendPort\(targetPort\)/);
  assert.match(preferencesIpcSource, /code:\s*'PORT_UNAVAILABLE'/);
  assert.match(backendSource, /portConflict\.code\s*=\s*'PORT_IN_USE'/);
  assert.match(backendSource, /portConflict\.port\s*=\s*normalizeBackendPort\(msg\.port/);
  assert.match(startupSource, /findAvailableBackendPort/);
  assert.match(startupSource, /Switch to Port/);
  assert.match(startupSource, /setPreference\('advanced\.serverPort',\s*recoveryPort\)/);
  assert.doesNotMatch(startupSource, /Application Already Running/);
});

test('renderer port portability is enforced by local and hosted release gates', () => {
  assert.match(releaseScriptSource, /npm run test:renderer-storage/);
  assert.match(releaseWorkflowSource, /npm run test:renderer-storage/);
  assert.match(platformWorkflowSource, /npm run test:renderer-storage/);
});

test('production SPA fallback safely serves clean projection routes from packaged paths', async () => {
  assert.match(
    serverSource,
    /res\.sendFile\(['"]index\.html['"],\s*\{\s*root:\s*frontendPath\s*\}\)/,
  );
  assert.doesNotMatch(
    serverSource,
    /res\.sendFile\(path\.join\(frontendPath,\s*['"]index\.html['"]\)\)/,
  );
  assert.match(
    packagedRuntimeProbeSource,
    /requestText\(port,\s*['"]\/output1\?projection=1&escapeHint=1['"]\)/,
  );

  const hiddenMountRoot = fs.mkdtempSync(path.join(os.tmpdir(), '.mount_LyricDisplay-'));
  const frontendPath = path.join(hiddenMountRoot, 'resources', 'app.asar', 'dist');
  const indexHtml = '<!doctype html><html><body><div id="root"></div></body></html>';
  const app = express();
  let server;

  try {
    fs.mkdirSync(frontendPath, { recursive: true });
    fs.writeFileSync(path.join(frontendPath, 'index.html'), indexHtml, 'utf8');
    app.use(express.static(frontendPath));
    app.get('/{*splat}', (_req, res) => (
      res.sendFile('index.html', { root: frontendPath })
    ));

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/output1?projection=1&escapeHint=1`);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), indexHtml);
  } finally {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    fs.rmSync(hiddenMountRoot, { recursive: true, force: true });
  }
});

test('readiness requires every enabled output to report fresh render health', () => {
  const result = evaluateOutputReadiness({
    now: NOW,
    storeState: {
      output1Enabled: true,
      output2Enabled: false,
      customOutputIds: ['output3'],
      output3Enabled: true,
      output1Settings: {
        instanceCount: 1,
        allInstances: [{ socketId: 'one', lastUpdate: NOW - 1000 }],
      },
      output3Settings: {
        instanceCount: 1,
        allInstances: [{ socketId: 'three', lastUpdate: NOW - OUTPUT_METRICS_FRESH_MS - 1 }],
      },
    },
  });

  assert.equal(result.status, 'fail');
  assert.match(result.detail, /Output 3 stopped reporting/);
  assert.doesNotMatch(result.detail, /Output 2/);
});

test('readiness passes when all enabled outputs have a fresh instance', () => {
  const result = evaluateOutputReadiness({
    now: NOW,
    storeState: {
      output1Enabled: true,
      output2Enabled: false,
      output1Settings: {
        instanceCount: 2,
        allInstances: [
          { socketId: 'stale', lastUpdate: NOW - OUTPUT_METRICS_FRESH_MS - 1 },
          { socketId: 'fresh', lastUpdate: NOW - 5000 },
        ],
      },
    },
  });

  assert.equal(result.status, 'pass');
  assert.match(result.detail, /1\/1 enabled output/);
});

test('projection readiness warns for no active projection and fails a removed display mapping', () => {
  const noProjection = evaluateProjectionReadiness({
    projection: { success: true, displays: [{ id: 1 }], projections: [] },
  });
  assert.equal(noProjection.status, 'warn');

  const removed = evaluateProjectionReadiness({
    projection: {
      success: true,
      displays: [{ id: 1 }],
      projections: [{ outputKey: 'output1', displayId: 2 }],
    },
  });
  assert.equal(removed.status, 'fail');
  assert.match(removed.detail, /no longer map/);
});

test('NDI readiness requires a completed handshake and fresh per-output frames', () => {
  const outputSettings = {
    output1: { settings: { enabled: true } },
    output2: { settings: { enabled: false } },
  };

  const starting = evaluateNdiReadiness({
    companionStatus: { running: true, ready: false, starting: true },
    outputSettings,
    now: NOW,
  });
  assert.equal(starting.status, 'fail');
  assert.match(starting.detail, /starting/);

  const staleFrames = evaluateNdiReadiness({
    companionStatus: { running: true, ready: true },
    outputSettings,
    telemetry: {
      updatedAt: NOW - NDI_TELEMETRY_FRESH_MS,
      stats: {
        perOutput: {
          output1: {
            senderReady: true,
            pageLoaded: true,
            lastPaintTs: NOW - NDI_FRAME_FRESH_MS - 1,
          },
        },
      },
    },
    now: NOW,
  });
  assert.equal(staleFrames.status, 'fail');
  assert.match(staleFrames.detail, /fresh NDI frames/);
});

test('NDI readiness passes only when every enabled route is healthy', () => {
  const result = evaluateNdiReadiness({
    companionStatus: { running: true, ready: true },
    outputSettings: {
      output1: { settings: { enabled: true } },
      output2: { settings: { enabled: true } },
    },
    telemetry: {
      updatedAt: NOW - 1000,
      stats: {
        perOutput: {
          output1: { senderReady: true, pageLoaded: true, lastPaintTs: NOW - 1000 },
          output2: { senderReady: true, pageLoaded: true, lastPaintTs: NOW - 2000 },
        },
      },
    },
    now: NOW,
  });

  assert.equal(result.status, 'pass');
  assert.match(result.detail, /2 enabled NDI routes/);
});

test('unused NDI is not treated as a production dependency', () => {
  const result = evaluateNdiReadiness({
    companionStatus: { running: false, ready: false },
    outputSettings: {
      output1: { settings: { enabled: false } },
      output2: { settings: { enabled: false } },
    },
    now: NOW,
  });

  assert.equal(result.status, 'pass');
  assert.match(result.detail, /No NDI output routes/);
});
