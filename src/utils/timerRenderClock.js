export const ACTIVE_TIMER_RENDER_POLL_MS = 250;
export const TIMER_RENDER_STALL_THRESHOLD_MS = 1_500;
export const TIMER_RENDER_STALL_LOG_COOLDOWN_MS = 30_000;

const normalizeInterval = (value, fallback = 1_000) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(100, numeric) : fallback;
};

export const isTimerClockAdvancing = (timerState) => Boolean(
  timerState?.running
  && !timerState?.paused
  && timerState?.status !== 'paused'
);

export const getTimerRenderSchedule = (timerState, activeRenderIntervalMs = 1_000) => {
  const advancing = isTimerClockAdvancing(timerState);
  const renderIntervalMs = advancing
    ? normalizeInterval(activeRenderIntervalMs)
    : 1_000;

  return {
    advancing,
    renderIntervalMs,
    pollIntervalMs: advancing
      ? Math.min(ACTIVE_TIMER_RENDER_POLL_MS, renderIntervalMs)
      : renderIntervalMs,
  };
};

export const getTimerRenderBucket = (timerState, now, intervalMs = 1_000) => {
  const currentTime = Number(now);
  const interval = normalizeInterval(intervalMs);
  if (!Number.isFinite(currentTime)) return 0;

  if (isTimerClockAdvancing(timerState)) {
    const endTime = Number(timerState?.endTime);
    if (timerState?.mode !== 'countup' && Number.isFinite(endTime)) {
      return Math.floor((endTime - currentTime) / interval);
    }

    const startTime = Number(timerState?.startTime);
    if (timerState?.mode === 'countup' && Number.isFinite(startTime)) {
      return Math.floor((currentTime - startTime) / interval);
    }
  }

  return Math.floor(currentTime / interval);
};

const defaultMonotonicNow = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

export const createTimerRenderClock = ({
  getTimerState,
  activeRenderIntervalMs = 1_000,
  now = Date.now,
  monotonicNow = defaultMonotonicNow,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
  onRender,
  onDelay,
} = {}) => {
  if (typeof getTimerState !== 'function' || typeof onRender !== 'function') {
    return () => {};
  }

  const initialState = getTimerState();
  const schedule = getTimerRenderSchedule(initialState, activeRenderIntervalMs);
  const initialNow = now();
  let lastRenderBucket = getTimerRenderBucket(initialState, initialNow, schedule.renderIntervalMs);
  let lastPollAt = monotonicNow();
  let lastDelayReportedAt = Number.NEGATIVE_INFINITY;

  onRender(initialNow);

  const intervalId = setIntervalFn(() => {
    const currentNow = now();
    const currentPollAt = monotonicNow();
    const pollDelayMs = Math.max(0, currentPollAt - lastPollAt);
    lastPollAt = currentPollAt;

    const currentState = getTimerState();
    if (
      isTimerClockAdvancing(currentState)
      && pollDelayMs >= TIMER_RENDER_STALL_THRESHOLD_MS
      && currentPollAt - lastDelayReportedAt >= TIMER_RENDER_STALL_LOG_COOLDOWN_MS
    ) {
      lastDelayReportedAt = currentPollAt;
      onDelay?.({
        delayMs: pollDelayMs,
        pollIntervalMs: schedule.pollIntervalMs,
        renderIntervalMs: schedule.renderIntervalMs,
      });
    }

    const nextRenderBucket = getTimerRenderBucket(
      currentState,
      currentNow,
      schedule.renderIntervalMs
    );
    if (nextRenderBucket === lastRenderBucket) return;

    lastRenderBucket = nextRenderBucket;
    onRender(currentNow);
  }, schedule.pollIntervalMs);

  return () => clearIntervalFn(intervalId);
};
