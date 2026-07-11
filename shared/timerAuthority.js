const MAX_TIMER_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_TIMER_SETS = 10;
const MAX_TIMER_PAYLOAD_BYTES = 64 * 1024;
const MAX_CLOCK_DISTANCE_MS = 48 * 60 * 60 * 1000;
const TIMESTAMP_FIELDS = ['startTime', 'endTime', 'targetTime', 'overrunStartedAt'];

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const clamp = (value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
};
const nullableTimestamp = (value) => (
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? null
    : Number(value)
);
const boundedText = (value, fallback = '', maxLength = 160) => String(value ?? fallback).slice(0, maxLength);
const byteLength = (value) => (
  typeof Buffer !== 'undefined'
    ? Buffer.byteLength(value, 'utf8')
    : new TextEncoder().encode(value).byteLength
);

const safeDisplay = (value, fallback = {}) => {
  if (!isPlainObject(value)) return isPlainObject(fallback) ? { ...fallback } : {};
  const serialized = JSON.stringify(value);
  if (byteLength(serialized) > 32 * 1024) throw new Error('Timer display settings are too large');
  return JSON.parse(serialized);
};

export function localizeAuthoritativeTimerState(timerState, localNow = Date.now(), fallbackServerNow = null) {
  if (!isPlainObject(timerState) || timerState.clockBasis === 'local') return timerState;
  const serverNow = Number(timerState.serverNow ?? fallbackServerNow);
  if (!Number.isFinite(serverNow)) return timerState;
  const offsetMs = localNow - serverNow;
  const localized = { ...timerState, clockBasis: 'local', clockOffsetMs: offsetMs, localizedAt: localNow };
  for (const field of TIMESTAMP_FIELDS) {
    const timestamp = nullableTimestamp(timerState[field]);
    localized[field] = timestamp === null ? null : timestamp + offsetMs;
  }
  return localized;
}

export function applyAuthoritativeTimerUpdate(currentState = {}, incomingState, now = Date.now()) {
  if (!isPlainObject(incomingState)) return { accepted: false, error: 'Invalid timer update payload' };
  try {
    const serialized = JSON.stringify(incomingState);
    if (byteLength(serialized) > MAX_TIMER_PAYLOAD_BYTES) {
      return { accepted: false, error: 'Timer update payload is too large' };
    }

    const currentRevision = Math.max(0, Number(currentState?.revision) || 0);
    const suppliedRevision = Number(incomingState.baseRevision ?? incomingState.revision);
    if (Number.isFinite(suppliedRevision) && suppliedRevision < currentRevision) {
      return { accepted: false, stale: true, error: 'Timer state changed on another controller' };
    }

    const clientSentAt = Number(incomingState.clientSentAt ?? incomingState.updatedAt);
    const rebaseOffset = Number.isFinite(clientSentAt) ? now - clientSentAt : 0;
    const rebaseTimestamp = (value) => {
      const timestamp = nullableTimestamp(value);
      if (timestamp === null) return null;
      const rebased = timestamp + rebaseOffset;
      return Math.abs(rebased - now) <= MAX_CLOCK_DISTANCE_MS ? rebased : null;
    };
    const running = Boolean(incomingState.running);
    const paused = running && Boolean(incomingState.paused);
    const finished = !running && Boolean(incomingState.finished);
    const status = running ? (paused ? 'paused' : 'running') : (finished ? 'finished' : 'idle');
    const sets = Array.isArray(incomingState.sets)
      ? incomingState.sets.slice(0, MAX_TIMER_SETS).map((set, index) => ({
        id: boundedText(set?.id, `set-${index + 1}`, 96),
        label: boundedText(set?.label, `Timer ${index + 1}`, 160),
        durationMs: clamp(set?.durationMs, 0, 0, MAX_TIMER_DURATION_MS),
      })).filter((set) => set.durationMs > 0)
      : [];

    const state = {
      version: 2,
      revision: currentRevision + 1,
      status,
      running,
      paused,
      finished,
      mode: ['countdown', 'countup', 'target'].includes(incomingState.mode) ? incomingState.mode : 'countdown',
      phase: incomingState.phase === 'indicator' ? 'indicator' : 'timer',
      label: boundedText(incomingState.label),
      durationMs: clamp(incomingState.durationMs, 0, 0, MAX_TIMER_DURATION_MS),
      startTime: rebaseTimestamp(incomingState.startTime),
      endTime: paused ? null : rebaseTimestamp(incomingState.endTime),
      targetTime: rebaseTimestamp(incomingState.targetTime),
      elapsedBeforePauseMs: clamp(incomingState.elapsedBeforePauseMs, 0, 0, MAX_TIMER_DURATION_MS),
      pausedRemainingMs: paused
        ? clamp(incomingState.pausedRemainingMs, 0, 0, MAX_TIMER_DURATION_MS)
        : null,
      remaining: (paused || !incomingState.endTime)
        ? boundedText(incomingState.remaining, '', 32) || null
        : null,
      warningMs: clamp(incomingState.warningMs, 60000, 0, MAX_TIMER_DURATION_MS),
      criticalMs: clamp(incomingState.criticalMs, 30000, 0, MAX_TIMER_DURATION_MS),
      overrunMode: Boolean(incomingState.overrunMode),
      overrunStartedAt: rebaseTimestamp(incomingState.overrunStartedAt),
      sets,
      activeSetIndex: clamp(incomingState.activeSetIndex, 0, 0, Math.max(0, sets.length - 1)),
      autoStartNext: incomingState.autoStartNext !== false,
      indicatorEnabled: Boolean(incomingState.indicatorEnabled),
      indicatorDurationMs: clamp(incomingState.indicatorDurationMs, 10000, 0, MAX_TIMER_DURATION_MS),
      indicatorLabel: boundedText(incomingState.indicatorLabel, 'Next timer starts in'),
      display: safeDisplay(incomingState.display, currentState?.display),
      updatedAt: now,
      serverUpdatedAt: now,
      serverNow: now,
      clockBasis: 'server',
    };
    return { accepted: true, state };
  } catch (error) {
    return { accepted: false, error: error.message || 'Invalid timer update' };
  }
}

export function advanceAuthoritativeTimerBoundary(currentState, now = Date.now()) {
  if (!isPlainObject(currentState) || !currentState.running || currentState.paused) return null;
  if (currentState.mode === 'countup' || !Number.isFinite(Number(currentState.endTime))) return null;
  const boundaryTime = Number(currentState.endTime);
  if (boundaryTime > now) return null;

  const revision = Math.max(0, Number(currentState.revision) || 0) + 1;
  const base = {
    ...currentState,
    revision,
    updatedAt: now,
    serverUpdatedAt: now,
    serverNow: now,
    clockBasis: 'server',
  };
  if (currentState.overrunMode && currentState.phase === 'timer') {
    if (currentState.overrunStartedAt) return null;
    return { ...base, overrunStartedAt: currentState.overrunStartedAt || boundaryTime };
  }

  const nextIndex = (Number(currentState.activeSetIndex) || 0) + 1;
  const nextSet = currentState.sets?.[nextIndex];
  if (currentState.phase === 'timer' && nextSet && currentState.autoStartNext) {
    if (currentState.indicatorEnabled && currentState.indicatorDurationMs > 0) {
      return {
        ...base,
        phase: 'indicator',
        label: currentState.indicatorLabel,
        durationMs: currentState.indicatorDurationMs,
        startTime: boundaryTime,
        endTime: boundaryTime + currentState.indicatorDurationMs,
        pausedRemainingMs: null,
        remaining: null,
      };
    }
    return {
      ...base,
      phase: 'timer',
      label: nextSet.label,
      activeSetIndex: nextIndex,
      durationMs: nextSet.durationMs,
      startTime: boundaryTime,
      endTime: boundaryTime + nextSet.durationMs,
      pausedRemainingMs: null,
      remaining: null,
    };
  }
  if (currentState.phase === 'indicator' && nextSet) {
    return {
      ...base,
      phase: 'timer',
      label: nextSet.label,
      activeSetIndex: nextIndex,
      durationMs: nextSet.durationMs,
      startTime: boundaryTime,
      endTime: boundaryTime + nextSet.durationMs,
      pausedRemainingMs: null,
      remaining: null,
    };
  }
  return {
    ...base,
    status: 'finished',
    running: false,
    paused: false,
    finished: true,
    endTime: null,
    pausedRemainingMs: null,
    remaining: '0:00',
  };
}
