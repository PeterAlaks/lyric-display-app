const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export function getIpcSenderUrl(event) {
  return event?.senderFrame?.url || event?.sender?.getURL?.() || '';
}

export function isTrustedAppRendererUrl(value, { development = false, backendPort = 4000 } = {}) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'http:') return false;
    if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) return false;

    const allowedPorts = new Set([String(backendPort)]);
    if (development) allowedPorts.add('5173');
    return allowedPorts.has(url.port);
  } catch {
    return false;
  }
}

export function assertTrustedAppRenderer(event, channel, options = {}) {
  const senderUrl = getIpcSenderUrl(event);
  if (!isTrustedAppRendererUrl(senderUrl, options)) {
    throw new Error(`Unauthorized IPC caller for ${channel}`);
  }
  return senderUrl;
}

export function isExpectedWindowSender(event, win) {
  return Boolean(event?.sender && win && !win.isDestroyed?.() && event.sender === win.webContents);
}

export function normalizeAuthIdentity(payload = {}) {
  const normalize = (value, label) => {
    const result = String(value || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(result)) {
      throw new Error(`Invalid ${label}`);
    }
    return result;
  };

  return {
    deviceId: normalize(payload.deviceId, 'device ID'),
    sessionId: normalize(payload.sessionId, 'session ID'),
  };
}

export function normalizeTokenStorePayload(payload = {}, { requireToken = false } = {}) {
  const clientType = String(payload.clientType || '').trim();
  if (!/^(desktop|stage|output\d+|obsDock)$/.test(clientType)) {
    throw new Error('Invalid token client type');
  }

  const deviceId = String(payload.deviceId || '').trim();
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(deviceId)) {
    throw new Error('Invalid token device ID');
  }

  const normalized = { clientType, deviceId };
  if (requireToken) {
    const token = String(payload.token || '');
    if (token.length < 16 || token.length > 16 * 1024) {
      throw new Error('Invalid token value');
    }
    normalized.token = token;
    normalized.expiresAt = Number.isFinite(payload.expiresAt) ? payload.expiresAt : null;
  }
  return normalized;
}

export function normalizeBrowserUrl(value, fallback = 'https://www.google.com') {
  const input = String(value || '').trim() || fallback;
  const url = new URL(input);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS browser URLs are allowed');
  }
  return url.toString();
}
