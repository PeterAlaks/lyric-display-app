export const SEARCH_TIMEOUTS_MS = {
  suggestions: {
    default: 2500,
    openHymnal: 1500,
    lrclib: 12000,
    lyricsOvh: 2500,
    chartlyrics: 1500,
  },
  full: {
    default: 6000,
    openHymnal: 2000,
    lrclib: 15000,
    lyricsOvh: 5000,
    chartlyrics: 2500,
  },
};

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_BASE_BACKOFF_MS = 30_000;
const CIRCUIT_MAX_BACKOFF_MS = 5 * 60_000;

export function createAbortError(message = 'Search cancelled') {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export function createTimeoutError(message) {
  const error = new Error(message);
  error.name = 'TimeoutError';
  return error;
}

export function normalizeSearchMode({ mode, limit } = {}) {
  if (mode === 'suggestions' || mode === 'full') return mode;
  return Number(limit) > 10 ? 'full' : 'suggestions';
}

export function getProviderSearchTimeout(providerId, mode = 'suggestions') {
  const config = SEARCH_TIMEOUTS_MS[mode] || SEARCH_TIMEOUTS_MS.suggestions;
  return config[providerId] || config.default;
}

export function createTimedAbortController(parentSignal, timeoutMs) {
  const controller = new AbortController();
  let timeoutId = null;

  const abortFromParent = () => {
    controller.abort(parentSignal?.reason || createAbortError());
  };

  if (parentSignal?.aborted) {
    abortFromParent();
  } else if (parentSignal) {
    parentSignal.addEventListener('abort', abortFromParent, { once: true });
  }

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(createTimeoutError(`Provider timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cancel: () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (parentSignal) {
        parentSignal.removeEventListener('abort', abortFromParent);
      }
    },
  };
}

export function recordProviderHealth(prev = {}, { duration = null, errors = [], now = Date.now() } = {}) {
  const previous = {
    avgDuration: null,
    requests: 0,
    failures: 0,
    consecutiveFailures: 0,
    circuitOpenUntil: null,
    lastFailureAt: null,
    ...prev,
  };

  const hasErrors = Array.isArray(errors) && errors.length > 0;
  const requests = previous.requests + 1;
  const failures = previous.failures + (hasErrors ? 1 : 0);

  const alpha = 0.3;
  const avgDuration = duration == null
    ? previous.avgDuration
    : previous.avgDuration == null
      ? duration
      : (alpha * duration) + ((1 - alpha) * previous.avgDuration);

  const consecutiveFailures = hasErrors ? previous.consecutiveFailures + 1 : 0;
  let circuitOpenUntil = hasErrors ? previous.circuitOpenUntil : null;
  const lastFailureAt = hasErrors ? now : previous.lastFailureAt;

  if (hasErrors && consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    const exponent = consecutiveFailures - CIRCUIT_FAILURE_THRESHOLD;
    const backoff = Math.min(CIRCUIT_MAX_BACKOFF_MS, CIRCUIT_BASE_BACKOFF_MS * (2 ** exponent));
    circuitOpenUntil = now + backoff;
  }

  return {
    avgDuration,
    requests,
    failures,
    consecutiveFailures,
    circuitOpenUntil,
    lastFailureAt,
  };
}

export function getCircuitState(stats, now = Date.now()) {
  const openUntil = Number(stats?.circuitOpenUntil) || 0;
  return {
    open: openUntil > now,
    openUntil: openUntil > now ? openUntil : null,
  };
}

export function computePenaltyFromHealth(stats, now = Date.now()) {
  if (!stats) return 0;

  const circuit = getCircuitState(stats, now);
  if (circuit.open) return 120000;

  const failureRate = stats.requests > 0 ? stats.failures / stats.requests : 0;
  const latencyMs = stats.avgDuration ?? 0;

  const latencyPenalty = latencyMs > 1200 ? Math.min(60000, (latencyMs - 1200) * 30) : 0;
  const errorPenalty = Math.min(80000, failureRate * 80000);

  return Math.round(latencyPenalty + errorPenalty);
}
