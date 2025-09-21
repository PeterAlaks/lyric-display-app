const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const resolveKey = ({ ip, deviceId, sessionId }) => {
  const address = (ip || '').trim() || 'unknown-ip';
  const device = (deviceId || sessionId || 'unknown-device').trim();
  return `${address}::${device}`;
};

class JoinCodeGuard {
  constructor() {
    this.entries = new Map();
  }

  pruneEntry(key, entry, now) {
    if (!entry) return null;

    if (entry.lockedUntil && entry.lockedUntil > now) {
      return entry;
    }

    if (entry.lockedUntil && entry.lockedUntil <= now) {
      this.entries.delete(key);
      return null;
    }

    if (entry.firstFailureAt && (now - entry.firstFailureAt) > FAILURE_WINDOW_MS) {
      this.entries.delete(key);
      return null;
    }

    return entry;
  }

  assert(context) {
    const key = resolveKey(context);
    const now = Date.now();
    const entry = this.pruneEntry(key, this.entries.get(key), now);

    if (!entry) {
      return {
        allowed: true,
        remainingAttempts: MAX_FAILURES,
        retryAfterMs: 0,
      };
    }

    if (entry.lockedUntil && entry.lockedUntil > now) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterMs: entry.lockedUntil - now,
        lockedUntil: entry.lockedUntil,
      };
    }

    const remaining = Math.max(MAX_FAILURES - entry.failCount, 0);
    return {
      allowed: true,
      remainingAttempts: remaining,
      retryAfterMs: 0,
    };
  }

  record(context, success) {
    const key = resolveKey(context);
    const now = Date.now();

    if (success) {
      this.entries.delete(key);
      return;
    }

    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        failCount: 0,
        firstFailureAt: now,
        lastFailureAt: now,
        lockedUntil: null,
      };
      this.entries.set(key, entry);
    }

    if (entry.lockedUntil && entry.lockedUntil > now) {
      return;
    }

    if (entry.firstFailureAt && (now - entry.firstFailureAt) > FAILURE_WINDOW_MS) {
      entry.failCount = 0;
      entry.firstFailureAt = now;
    }

    entry.failCount += 1;
    entry.lastFailureAt = now;

    if (entry.failCount >= MAX_FAILURES) {
      entry.lockedUntil = now + LOCKOUT_MS;
    }
  }

  snapshot() {
    const now = Date.now();
    let lockedClients = 0;
    let activeFailures = 0;

    for (const [key, entry] of this.entries.entries()) {
      const pruned = this.pruneEntry(key, entry, now);
      if (!pruned) {
        continue;
      }

      if (pruned.lockedUntil && pruned.lockedUntil > now) {
        lockedClients += 1;
      } else if (pruned.failCount > 0) {
        activeFailures += 1;
      }
    }

    return {
      lockedClients,
      activeFailureSources: activeFailures,
      trackedEntries: this.entries.size,
      failureWindowMs: FAILURE_WINDOW_MS,
      maxFailures: MAX_FAILURES,
      lockoutMs: LOCKOUT_MS,
    };
  }
}

const guard = new JoinCodeGuard();

export const assertJoinCodeAllowed = (context) => guard.assert(context);
export const recordJoinCodeAttempt = ({ success, ...context }) => guard.record(context, success);
export const getJoinCodeGuardSnapshot = () => guard.snapshot();
