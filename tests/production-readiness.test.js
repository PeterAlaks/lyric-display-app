import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateNdiReadiness,
  evaluateOutputReadiness,
  evaluateProjectionReadiness,
  NDI_FRAME_FRESH_MS,
  NDI_TELEMETRY_FRESH_MS,
  OUTPUT_METRICS_FRESH_MS,
} from '../shared/productionReadiness.js';

const NOW = 1_800_000_000_000;

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
