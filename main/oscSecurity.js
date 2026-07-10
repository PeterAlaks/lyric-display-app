import net from 'node:net';

export const OSC_LOOPBACK_ADDRESS = '127.0.0.1';
export const OSC_ALL_INTERFACES_ADDRESS = '0.0.0.0';
export const DEFAULT_OSC_RATE_LIMIT = 30;
export const DEFAULT_OSC_DUPLICATE_WINDOW_MS = 75;

export function normalizeOscBindAddress(value) {
  return value === OSC_ALL_INTERFACES_ADDRESS
    ? OSC_ALL_INTERFACES_ADDRESS
    : OSC_LOOPBACK_ADDRESS;
}

export function normalizeOscAllowedSources(value) {
  const entries = Array.isArray(value) ? value : String(value || '').split(',');
  return Array.from(new Set(entries
    .map((entry) => String(entry || '').trim())
    .filter((entry) => net.isIP(entry) === 4)));
}

export function isOscSourceAllowed(sourceAddress, { bindAddress, allowedSources } = {}) {
  if (typeof sourceAddress !== 'string' || net.isIP(sourceAddress) !== 4) return false;
  if (normalizeOscBindAddress(bindAddress) === OSC_LOOPBACK_ADDRESS) {
    return sourceAddress.startsWith('127.');
  }

  const normalizedSources = normalizeOscAllowedSources(allowedSources);
  return normalizedSources.length === 0 || normalizedSources.includes(sourceAddress);
}

export class OscMessageGuard {
  constructor({ rateLimit = DEFAULT_OSC_RATE_LIMIT, duplicateWindowMs = DEFAULT_OSC_DUPLICATE_WINDOW_MS } = {}) {
    this.rateLimit = this.normalizeRateLimit(rateLimit);
    this.duplicateWindowMs = this.normalizeDuplicateWindow(duplicateWindowMs);
    this.rateWindows = new Map();
    this.recentMessages = new Map();
    this.stats = { rateLimited: 0, duplicates: 0 };
  }

  normalizeRateLimit(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(200, Math.max(5, parsed)) : DEFAULT_OSC_RATE_LIMIT;
  }

  normalizeDuplicateWindow(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(1000, Math.max(0, parsed)) : DEFAULT_OSC_DUPLICATE_WINDOW_MS;
  }

  configure({ rateLimit, duplicateWindowMs } = {}) {
    if (rateLimit !== undefined) this.rateLimit = this.normalizeRateLimit(rateLimit);
    if (duplicateWindowMs !== undefined) this.duplicateWindowMs = this.normalizeDuplicateWindow(duplicateWindowMs);
  }

  evaluate({ sourceAddress, address, args = [], now = Date.now() }) {
    const currentWindow = this.rateWindows.get(sourceAddress);
    const rateState = !currentWindow || now - currentWindow.startedAt >= 1000
      ? { startedAt: now, count: 0 }
      : currentWindow;
    rateState.count += 1;
    this.rateWindows.set(sourceAddress, rateState);

    if (rateState.count > this.rateLimit) {
      this.stats.rateLimited += 1;
      return { allowed: false, reason: 'rate_limit' };
    }

    if (this.duplicateWindowMs > 0) {
      let signature;
      try {
        signature = `${sourceAddress}|${address}|${JSON.stringify(args.map((arg) => arg?.value))}`;
      } catch {
        signature = `${sourceAddress}|${address}`;
      }
      const previousAt = this.recentMessages.get(signature);
      this.recentMessages.set(signature, now);
      if (Number.isFinite(previousAt) && now - previousAt < this.duplicateWindowMs) {
        this.stats.duplicates += 1;
        return { allowed: false, reason: 'duplicate' };
      }

      if (this.recentMessages.size > 1000) {
        const cutoff = now - Math.max(1000, this.duplicateWindowMs * 4);
        for (const [key, timestamp] of this.recentMessages) {
          if (timestamp < cutoff) this.recentMessages.delete(key);
        }
      }
    }

    return { allowed: true, reason: null };
  }

  getStats() {
    return { ...this.stats };
  }
}
