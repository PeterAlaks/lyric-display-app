import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import electron from 'electron';

const { app } = typeof electron === 'object' && electron ? electron : {};
const isDevelopmentRuntime = !app?.isPackaged;

export const DEFAULT_TELEMETRY_URL = 'https://lyricdisplay.app/.netlify/functions/telemetry';
export const TELEMETRY_STATE_FILE = 'anonymous-installation.json';
const REQUEST_TIMEOUT_MS = 4_000;
const MAX_RESPONSE_BYTES = 8_192;

function safeReadState(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof parsed?.installationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(parsed.installationId)) return null;
    return {
      installationId: parsed.installationId,
      lastReportedVersion: typeof parsed.lastReportedVersion === 'string' ? parsed.lastReportedVersion : null,
    };
  } catch {
    return null;
  }
}

function writeState(filePath, state) {
  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(temporaryPath, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
}

export function getOrCreateAnonymousInstallation(userDataPath) {
  const filePath = path.join(userDataPath, TELEMETRY_STATE_FILE);
  const existing = safeReadState(filePath);
  if (existing) return { ...existing, filePath };

  const created = { installationId: crypto.randomUUID(), lastReportedVersion: null };
  writeState(filePath, created);
  return { ...created, filePath };
}

export function createTelemetryEvents({ installationId, currentVersion, previousVersion, platform }) {
  const base = {
    installationId,
    appVersion: currentVersion,
    platform: ['win32', 'darwin', 'linux'].includes(platform) ? platform : 'unknown',
  };
  const events = [{ ...base, event: 'launch' }];
  if (previousVersion && previousVersion !== currentVersion) {
    events.push({ ...base, event: 'update_completed', previousVersion });
  }
  return events;
}

function sendJson(urlString, payload, redirectsRemaining = 2) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      reject(new Error('Telemetry endpoint is invalid.'));
      return;
    }
    if (url.protocol !== 'https:') {
      reject(new Error('Telemetry endpoint must use HTTPS.'));
      return;
    }

    const body = JSON.stringify(payload);
    const request = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'LyricDisplay-Desktop',
      },
      timeout: REQUEST_TIMEOUT_MS,
    }, (response) => {
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location && redirectsRemaining > 0) {
        response.resume();
        const nextUrl = new URL(response.headers.location, url).toString();
        sendJson(nextUrl, payload, redirectsRemaining - 1).then(resolve, reject);
        return;
      }

      let received = 0;
      response.on('data', (chunk) => {
        received += chunk.length;
        if (received > MAX_RESPONSE_BYTES) request.destroy(new Error('Telemetry response is too large.'));
      });
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(true);
        else reject(new Error(`Telemetry endpoint returned ${response.statusCode}.`));
      });
    });

    request.on('timeout', () => request.destroy(new Error('Telemetry request timed out.')));
    request.on('error', reject);
    request.end(body);
  });
}

export async function recordSuccessfulAppLaunch({
  enabled = false,
  userDataPath = app?.getPath?.('userData'),
  currentVersion = app?.getVersion?.(),
  platform = process.platform,
  endpoint = process.env.LYRICDISPLAY_TELEMETRY_URL || DEFAULT_TELEMETRY_URL,
  sender = sendJson,
} = {}) {
  if (!enabled || (isDevelopmentRuntime && process.env.LYRICDISPLAY_TELEMETRY_FORCE !== '1') || process.env.LYRICDISPLAY_TELEMETRY_DISABLED === '1') {
    return { skipped: true };
  }
  if (!userDataPath || !currentVersion) return { skipped: true };

  const state = getOrCreateAnonymousInstallation(userDataPath);
  const events = createTelemetryEvents({
    installationId: state.installationId,
    currentVersion,
    previousVersion: state.lastReportedVersion,
    platform,
  });
  const results = [];

  for (const event of events) {
    try {
      await sender(endpoint, event);
      results.push({ event: event.event, sent: true });
    } catch (error) {
      results.push({ event: event.event, sent: false });
      console.warn(`[Telemetry] ${event.event} event was not accepted:`, error.message);
    }
  }

  const updateEvent = results.find((result) => result.event === 'update_completed');
  const canAdvanceVersion = updateEvent ? updateEvent.sent : results.some((result) => result.event === 'launch' && result.sent);
  if (canAdvanceVersion) {
    try {
      writeState(state.filePath, { installationId: state.installationId, lastReportedVersion: currentVersion });
    } catch (error) {
      console.warn('[Telemetry] Could not update anonymous installation state:', error.message);
    }
  }

  return { skipped: false, results };
}
