import { performance } from 'node:perf_hooks';

export const PERIODIC_STATE_DIAGNOSTIC_SAMPLE_INTERVAL = 10;
export const LARGE_STATE_PAYLOAD_BYTES = 256 * 1024;
export const SLOW_STATE_PROCESSING_MS = 10;

export function describeStatePayload(clientInfo, payload, options = {}) {
  const serializationStartedAt = performance.now();
  let approxBytes = -1;
  let serializationError = null;
  try {
    approxBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  } catch (error) {
    serializationError = error?.message || String(error);
  }
  const serializationMs = performance.now() - serializationStartedAt;

  return {
    clientType: clientInfo?.type || 'unknown',
    purpose: clientInfo?.purpose || null,
    keys: payload && typeof payload === 'object' ? Object.keys(payload).length : 0,
    lyrics: Array.isArray(payload?.lyrics) ? payload.lyrics.length : 0,
    setlistItems: Array.isArray(payload?.setlistFiles) ? payload.setlistFiles.length : 0,
    hasRawLyricsContent: Object.hasOwn(payload || {}, 'rawLyricsContent'),
    approxBytes,
    buildMs: Number.isFinite(options.buildMs) ? options.buildMs : null,
    serializationMs,
    serializationError,
  };
}

export function shouldSamplePeriodicState(sampleNumber, buildMs = 0) {
  return sampleNumber === 1
    || sampleNumber % PERIODIC_STATE_DIAGNOSTIC_SAMPLE_INTERVAL === 0
    || buildMs >= SLOW_STATE_PROCESSING_MS;
}

export function isStatePayloadNoteworthy(metrics) {
  return Boolean(
    metrics?.serializationError
    || metrics?.approxBytes >= LARGE_STATE_PAYLOAD_BYTES
    || metrics?.buildMs >= SLOW_STATE_PROCESSING_MS
    || metrics?.serializationMs >= SLOW_STATE_PROCESSING_MS
  );
}
