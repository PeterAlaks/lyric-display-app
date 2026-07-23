import React from 'react';
import useLyricsStore from '../context/LyricsStore';
import {
  TIMER_STORAGE_KEY,
  createIdleTimerState,
  formatDuration,
  getElapsedMs,
  getRemainingMs,
  getTimerDisplay,
  getTimerIntensity,
  getTimerProgress,
  normalizeTimerState,
  resetActiveTimerRuntime,
} from '../utils/timerUtils';
import { localizeAuthoritativeTimerState } from '../../shared/timerAuthority.js';
import {
  isTimedScheduleItem,
  normalizeScheduleItems,
} from '../../shared/scheduleUtils.js';

const getDisplayUpdatedAt = (display) => {
  const updatedAt = Number(display?.displayUpdatedAt);
  return Number.isFinite(updatedAt) ? updatedAt : 0;
};

const applyIncomingDisplaySettings = (display) => {
  if (!display || typeof display !== 'object' || Array.isArray(display)) return;
  const incomingUpdatedAt = getDisplayUpdatedAt(display);
  if (incomingUpdatedAt <= 0) return;

  const store = useLyricsStore.getState();
  const currentUpdatedAt = getDisplayUpdatedAt(store.timerDisplaySettings);
  if (incomingUpdatedAt > currentUpdatedAt && typeof store.updateTimerDisplaySettings === 'function') {
    store.updateTimerDisplaySettings(display, { touch: false });
  }
};

const readStoredTimerState = () => {
  if (typeof window === 'undefined') return createIdleTimerState();
  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
    return raw ? resetActiveTimerRuntime(JSON.parse(raw)) : createIdleTimerState();
  } catch {
    return createIdleTimerState();
  }
};

const writeStoredTimerState = (timerState) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timerState));
    window.dispatchEvent(new CustomEvent('shared-timer-state', { detail: timerState }));
  } catch {
    // Storage can fail in locked-down browser sources; socket sync still works.
  }
};

const getPausedRemainingLabel = (state) => (
  Number.isFinite(state.pausedRemainingMs)
    ? formatDuration(state.pausedRemainingMs, state.display?.format || 'auto')
    : null
);

const stripVolatileTimerFields = (state) => {
  if (!state || typeof state !== 'object') return state;
  const comparable = { ...state };
  delete comparable.updatedAt;
  delete comparable.serverUpdatedAt;
  delete comparable.serverNow;
  delete comparable.clockOffsetMs;
  delete comparable.localizedAt;
  delete comparable.clockBasis;
  return comparable;
};

const timerStatesAreEquivalent = (a, b) => {
  try {
    return JSON.stringify(stripVolatileTimerFields(a)) === JSON.stringify(stripVolatileTimerFields(b));
  } catch {
    return false;
  }
};

const createSetRuntime = (current, set, index, startTime = Date.now()) => {
  const timed = isTimedScheduleItem(set);
  const durationMs = timed ? Math.max(1_000, Number(set.durationMs) || 0) : 0;
  return {
    ...current,
    status: 'running',
    running: true,
    paused: false,
    finished: false,
    mode: timed ? 'countdown' : 'countup',
    phase: 'timer',
    label: set.label,
    activeSetIndex: index,
    durationMs,
    startTime,
    endTime: timed ? startTime + durationMs : null,
    targetTime: null,
    elapsedBeforePauseMs: 0,
    pausedRemainingMs: null,
    remaining: null,
    overrunStartedAt: null,
    scheduleReconciliationHold: false,
    schedulePausedOverrunMs: 0,
    awaitingNext: false,
  };
};

export const useSharedTimer = ({
  emitTimerUpdate,
  tickIntervalMs = 250,
  renderTickIntervalMs = tickIntervalMs,
} = {}) => {
  const [timerState, setTimerState] = React.useState(() => readStoredTimerState());
  const [now, setNow] = React.useState(Date.now());
  const latestStateRef = React.useRef(timerState);
  const emitRef = React.useRef(emitTimerUpdate);
  const activeTickIntervalMs = Math.max(100, Number(tickIntervalMs) || 250);
  const activeRenderTickIntervalMs = Math.max(100, Number(renderTickIntervalMs) || activeTickIntervalMs);

  React.useEffect(() => {
    latestStateRef.current = timerState;
  }, [timerState]);

  React.useEffect(() => {
    emitRef.current = emitTimerUpdate;
  }, [emitTimerUpdate]);

  const commitTimerState = React.useCallback((nextState, { emit = true } = {}) => {
    const clientSentAt = Date.now();
    const baseRevision = Math.max(0, Number(latestStateRef.current?.revision) || 0);
    const normalized = normalizeTimerState({ ...nextState, updatedAt: clientSentAt });
    if (emit && typeof emitRef.current === 'function') {
      const sent = emitRef.current({ ...normalized, baseRevision, clientSentAt });
      if (sent === false) return latestStateRef.current;
    }
    setTimerState(normalized);
    latestStateRef.current = normalized;
    writeStoredTimerState(normalized);
    return normalized;
  }, []);

  React.useEffect(() => {
    const handleTimerEvent = (event) => {
      const detail = event?.detail;
      if (!detail || detail.type === 'upcomingSongUpdate') return;
      const normalized = normalizeTimerState(localizeAuthoritativeTimerState(detail));
      const incomingRevision = Math.max(0, Number(normalized.revision) || 0);
      const currentRevision = Math.max(0, Number(latestStateRef.current?.revision) || 0);
      if (incomingRevision > 0 && incomingRevision < currentRevision) return;
      applyIncomingDisplaySettings(normalized.display);
      if (timerStatesAreEquivalent(normalized, latestStateRef.current)) return;
      setTimerState(normalized);
      latestStateRef.current = normalized;
      writeStoredTimerState(normalized);
    };

    const handleSharedTimerEvent = (event) => {
      if (!event?.detail) return;
      const normalized = normalizeTimerState(event.detail);
      applyIncomingDisplaySettings(normalized.display);
      if (timerStatesAreEquivalent(normalized, latestStateRef.current)) return;
      setTimerState(normalized);
      latestStateRef.current = normalized;
    };

    const handleStorage = (event) => {
      if (event.key !== TIMER_STORAGE_KEY || !event.newValue) return;
      try {
        const normalized = normalizeTimerState(JSON.parse(event.newValue));
        applyIncomingDisplaySettings(normalized.display);
        if (timerStatesAreEquivalent(normalized, latestStateRef.current)) return;
        setTimerState(normalized);
        latestStateRef.current = normalized;
      } catch {
        // Ignore malformed storage updates.
      }
    };

    window.addEventListener('stage-timer-update', handleTimerEvent);
    window.addEventListener('shared-timer-state', handleSharedTimerEvent);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('stage-timer-update', handleTimerEvent);
      window.removeEventListener('shared-timer-state', handleSharedTimerEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  React.useEffect(() => {
    if (renderTickIntervalMs === null || renderTickIntervalMs === false) return;
    const shouldTick = timerState.running || timerState.status === 'running' || timerState.status === 'paused';
    const interval = window.setInterval(() => setNow(Date.now()), shouldTick ? activeRenderTickIntervalMs : 1000);
    return () => window.clearInterval(interval);
  }, [activeRenderTickIntervalMs, renderTickIntervalMs, timerState.running, timerState.status]);

  const startTimer = React.useCallback((options = {}) => {
    const current = latestStateRef.current;
    const startTime = Date.now();
    const mode = options.mode || current.mode || 'countdown';
    const durationMs = Math.max(0, Number(options.durationMs) || 0);
    const requestedIndicatorDurationMs = Number(options.indicatorDurationMs);
    const targetTime = options.targetTime !== null
      && options.targetTime !== undefined
      && options.targetTime !== ''
      && Number.isFinite(Number(options.targetTime))
      ? Number(options.targetTime)
      : null;
    const scheduleIdealEndAt = options.scheduleIdealEndAt !== null
      && options.scheduleIdealEndAt !== undefined
      && options.scheduleIdealEndAt !== ''
      && Number.isFinite(Number(options.scheduleIdealEndAt))
      ? Number(options.scheduleIdealEndAt)
      : null;
    const endTime = mode === 'target'
      ? targetTime
      : (mode === 'countdown' ? startTime + durationMs : null);

    return commitTimerState({
      ...current,
      status: 'running',
      running: true,
      paused: false,
      finished: false,
      mode,
      phase: 'timer',
      label: options.label || current.label || '',
      durationMs,
      startTime,
      endTime,
      targetTime,
      elapsedBeforePauseMs: 0,
      pausedRemainingMs: null,
      remaining: null,
      warningMs: Number.isFinite(Number(options.warningMs)) ? Number(options.warningMs) : current.warningMs,
      criticalMs: Number.isFinite(Number(options.criticalMs)) ? Number(options.criticalMs) : current.criticalMs,
      overrunMode: Boolean(options.overrunMode),
      overrunStartedAt: null,
      sets: Array.isArray(options.sets) ? options.sets : [],
      activeSetIndex: 0,
      autoStartNext: options.autoStartNext !== false,
      indicatorEnabled: Boolean(options.indicatorEnabled),
      indicatorDurationMs: Number.isFinite(requestedIndicatorDurationMs)
        ? Math.max(0, requestedIndicatorDurationMs)
        : Math.max(0, Number(current.indicatorDurationMs) || 0),
      indicatorLabel: typeof options.indicatorLabel === 'string' ? options.indicatorLabel : current.indicatorLabel,
      scheduleTitle: options.scheduleTitle || '',
      scheduleRunId: Array.isArray(options.sets) && options.sets.length > 0 ? `schedule-run-${startTime}` : '',
      scheduleEventStartTime: typeof options.scheduleEventStartTime === 'string' ? options.scheduleEventStartTime : '',
      scheduleEventDate: typeof options.scheduleEventDate === 'string' ? options.scheduleEventDate : '',
      scheduleScheduledStartAt: Number.isFinite(Number(options.scheduleScheduledStartAt))
        ? Number(options.scheduleScheduledStartAt)
        : null,
      scheduleIdealEndAt,
      scheduleStartedAt: Array.isArray(options.sets) && options.sets.length > 0 ? startTime : null,
      scheduleJoinedAt: Array.isArray(options.sets) && options.sets.length > 0 ? startTime : null,
      scheduleReconciled: false,
      scheduleReconciliationHold: false,
      schedulePausedOverrunMs: 0,
      scheduleAssumedCompletedIds: [],
      scheduleShowGlobalTimeDuringManualItems: options.scheduleShowGlobalTimeDuringManualItems !== false,
      scheduleNotificationsEnabled: options.scheduleNotificationsEnabled !== false,
      awaitingNext: false,
      display: { ...current.display, ...(options.display || {}) },
    });
  }, [commitTimerState]);

  const startTimerSet = React.useCallback((options = {}) => {
    const sets = normalizeScheduleItems((Array.isArray(options.sets) ? options.sets : [])
      .map((set, index) => ({
        ...set,
        id: set?.id || `set-${Date.now()}-${index}`,
      })));

    if (sets.length === 0) return null;

    const firstTimed = isTimedScheduleItem(sets[0]);

    return startTimer({
      ...options,
      mode: firstTimed ? 'countdown' : 'countup',
      durationMs: firstTimed ? sets[0].durationMs : 0,
      label: sets[0].label,
      sets,
    });
  }, [startTimer]);

  const startScheduleRun = React.useCallback((options = {}) => {
    const current = latestStateRef.current;
    const sets = normalizeScheduleItems(Array.isArray(options.sets) ? options.sets : []);
    if (sets.length === 0) return null;

    const joinedAt = Number.isFinite(Number(options.joinedAt)) ? Number(options.joinedAt) : Date.now();
    const phase = options.phase === 'indicator' ? 'indicator' : 'timer';
    const requestedIndex = Math.trunc(Number(options.activeSetIndex) || 0);
    const activeSetIndex = phase === 'indicator'
      ? Math.max(0, Math.min(sets.length - 2, requestedIndex))
      : Math.max(0, Math.min(sets.length - 1, requestedIndex));
    const item = sets[activeSetIndex];
    const timed = phase === 'indicator' || isTimedScheduleItem(item);
    const durationMs = phase === 'indicator'
      ? Math.max(0, Number(options.indicatorDurationMs) || 0)
      : (timed ? Math.max(1_000, Number(item.durationMs) || 0) : 0);
    const requestedStartAt = Number(options.phaseStartAt);
    const phaseStartAt = Number.isFinite(requestedStartAt) && requestedStartAt <= joinedAt
      ? requestedStartAt
      : joinedAt;
    const endTime = timed ? phaseStartAt + durationMs : null;
    const reconciliationHold = phase === 'timer'
      && timed
      && Number.isFinite(endTime)
      && endTime <= joinedAt;
    const scheduledStartAt = Number.isFinite(Number(options.scheduleScheduledStartAt))
      ? Number(options.scheduleScheduledStartAt)
      : null;
    const actualStartAt = Number.isFinite(Number(options.scheduleStartedAt))
      ? Number(options.scheduleStartedAt)
      : joinedAt;
    const scheduleIdealEndAt = Number.isFinite(Number(options.scheduleIdealEndAt))
      ? Number(options.scheduleIdealEndAt)
      : null;

    return commitTimerState({
      ...current,
      status: 'running',
      running: true,
      paused: false,
      finished: false,
      mode: timed ? 'countdown' : 'countup',
      phase,
      label: phase === 'indicator'
        ? (options.indicatorLabel || current.indicatorLabel || 'Next item starts in')
        : item.label,
      durationMs,
      startTime: phaseStartAt,
      endTime,
      targetTime: null,
      elapsedBeforePauseMs: 0,
      pausedRemainingMs: null,
      remaining: null,
      warningMs: Number.isFinite(Number(options.warningMs)) ? Number(options.warningMs) : current.warningMs,
      criticalMs: Number.isFinite(Number(options.criticalMs)) ? Number(options.criticalMs) : current.criticalMs,
      overrunMode: Boolean(options.overrunMode),
      overrunStartedAt: reconciliationHold ? endTime : null,
      sets,
      activeSetIndex,
      autoStartNext: options.autoStartNext !== false,
      indicatorEnabled: Boolean(options.indicatorEnabled),
      indicatorDurationMs: Math.max(0, Number(options.indicatorDurationMs) || 0),
      indicatorLabel: typeof options.indicatorLabel === 'string' ? options.indicatorLabel : current.indicatorLabel,
      scheduleTitle: options.scheduleTitle || '',
      scheduleRunId: typeof options.scheduleRunId === 'string' && options.scheduleRunId
        ? options.scheduleRunId
        : `schedule-run-${joinedAt}`,
      scheduleEventStartTime: typeof options.scheduleEventStartTime === 'string' ? options.scheduleEventStartTime : '',
      scheduleEventDate: typeof options.scheduleEventDate === 'string' ? options.scheduleEventDate : '',
      scheduleScheduledStartAt: scheduledStartAt,
      scheduleIdealEndAt,
      scheduleStartedAt: actualStartAt,
      scheduleJoinedAt: joinedAt,
      scheduleReconciled: true,
      scheduleReconciliationHold: reconciliationHold,
      schedulePausedOverrunMs: 0,
      scheduleAssumedCompletedIds: Array.isArray(options.scheduleAssumedCompletedIds)
        ? options.scheduleAssumedCompletedIds
        : [],
      scheduleShowGlobalTimeDuringManualItems: options.scheduleShowGlobalTimeDuringManualItems !== false,
      scheduleNotificationsEnabled: options.scheduleNotificationsEnabled !== false,
      awaitingNext: false,
      display: { ...current.display, ...(options.display || {}) },
    });
  }, [commitTimerState]);

  const pauseTimer = React.useCallback(() => {
    const current = latestStateRef.current;
    if (!current.running || current.paused) return current;
    const pausedRemainingMs = getRemainingMs(current, Date.now());
    const pausedOverrunMs = current.scheduleReconciliationHold && Number.isFinite(pausedRemainingMs) && pausedRemainingMs < 0
      ? Math.abs(pausedRemainingMs)
      : 0;
    return commitTimerState({
      ...current,
      status: 'paused',
      running: true,
      paused: true,
      endTime: null,
      elapsedBeforePauseMs: getElapsedMs(current, Date.now()),
      pausedRemainingMs: Number.isFinite(pausedRemainingMs) ? Math.max(0, pausedRemainingMs) : null,
      remaining: pausedOverrunMs > 0
        ? `+${formatDuration(pausedOverrunMs, current.display?.format || 'auto')}`
        : getPausedRemainingLabel({ ...current, pausedRemainingMs }),
      schedulePausedOverrunMs: pausedOverrunMs,
    });
  }, [commitTimerState]);

  const resumeTimer = React.useCallback(() => {
    const current = latestStateRef.current;
    if (!current.running || !current.paused) return current;
    if (current.awaitingNext) return current;
    const startTime = Date.now();
    const resumesHeldOvertime = current.scheduleReconciliationHold && Number(current.schedulePausedOverrunMs) > 0;
    const endTime = current.mode === 'countdown' || current.mode === 'target'
      ? (resumesHeldOvertime
        ? startTime - Number(current.schedulePausedOverrunMs)
        : startTime + Math.max(0, Number(current.pausedRemainingMs) || 0))
      : null;
    return commitTimerState({
      ...current,
      status: 'running',
      paused: false,
      startTime: resumesHeldOvertime ? endTime - Math.max(0, Number(current.durationMs) || 0) : startTime,
      endTime,
      pausedRemainingMs: null,
      remaining: null,
      schedulePausedOverrunMs: 0,
    });
  }, [commitTimerState]);

  const stopTimer = React.useCallback(() => {
    const current = latestStateRef.current;
    return commitTimerState({
      ...createIdleTimerState(),
      display: { ...current.display },
    });
  }, [commitTimerState]);

  const addTime = React.useCallback((deltaMs) => {
    const current = latestStateRef.current;
    if (!current.running || current.mode === 'countup') return current;
    if (current.paused) {
      if (current.scheduleReconciliationHold) {
        const nextOverrunMs = Math.max(0, (Number(current.schedulePausedOverrunMs) || 0) - deltaMs);
        const nextPausedRemainingMs = Math.max(0, deltaMs - (Number(current.schedulePausedOverrunMs) || 0));
        const remainsHeld = nextOverrunMs > 0;
        return commitTimerState({
          ...current,
          pausedRemainingMs: remainsHeld ? 0 : nextPausedRemainingMs,
          durationMs: Math.max(0, current.durationMs + deltaMs),
          remaining: remainsHeld
            ? `+${formatDuration(nextOverrunMs, current.display?.format || 'auto')}`
            : formatDuration(nextPausedRemainingMs, current.display?.format || 'auto'),
          scheduleReconciliationHold: remainsHeld,
          schedulePausedOverrunMs: nextOverrunMs,
          overrunStartedAt: remainsHeld ? current.overrunStartedAt : null,
        });
      }
      const pausedRemainingMs = Math.max(0, (Number(current.pausedRemainingMs) || 0) + deltaMs);
      return commitTimerState({
        ...current,
        pausedRemainingMs,
        durationMs: Math.max(0, current.durationMs + deltaMs),
        remaining: formatDuration(pausedRemainingMs, current.display?.format || 'auto'),
      });
    }

    const nextEndTime = Number.isFinite(Number(current.endTime)) ? Number(current.endTime) + deltaMs : current.endTime;
    const clearsReconciliationHold = current.scheduleReconciliationHold
      && Number.isFinite(Number(nextEndTime))
      && Number(nextEndTime) > Date.now();
    return commitTimerState({
      ...current,
      durationMs: Math.max(0, current.durationMs + deltaMs),
      endTime: nextEndTime,
      scheduleReconciliationHold: clearsReconciliationHold ? false : current.scheduleReconciliationHold,
      overrunStartedAt: clearsReconciliationHold ? null : current.overrunStartedAt,
    });
  }, [commitTimerState]);

  const skipToNextSet = React.useCallback(() => {
    const current = latestStateRef.current;
    const nextIndex = current.activeSetIndex + 1;
    const nextSet = current.sets?.[nextIndex];
    if (!nextSet) return current;
    const startTime = Date.now();
    if (current.phase !== 'indicator' && current.indicatorEnabled && current.indicatorDurationMs > 0) {
      return commitTimerState({
        ...current,
        status: 'running',
        running: true,
        paused: false,
        finished: false,
        mode: 'countdown',
        phase: 'indicator',
        label: current.indicatorLabel,
        durationMs: current.indicatorDurationMs,
        startTime,
        endTime: startTime + current.indicatorDurationMs,
        elapsedBeforePauseMs: 0,
        pausedRemainingMs: null,
        remaining: null,
        overrunStartedAt: null,
        scheduleReconciliationHold: false,
        schedulePausedOverrunMs: 0,
        awaitingNext: false,
      });
    }
    return commitTimerState(createSetRuntime(current, nextSet, nextIndex, startTime));
  }, [commitTimerState]);

  const jumpToSet = React.useCallback((index) => {
    const current = latestStateRef.current;
    const targetIndex = Math.trunc(Math.max(0, Math.min(current.sets.length - 1, Number(index) || 0)));
    const targetSet = current.sets?.[targetIndex];
    if (!targetSet) return current;
    return commitTimerState(createSetRuntime(current, targetSet, targetIndex));
  }, [commitTimerState]);

  const completeSchedule = React.useCallback(() => {
    const current = latestStateRef.current;
    if (!current.running && !current.paused) return current;
    const completionValue = current.mode === 'countup' ? getTimerDisplay(current, Date.now()) : '0:00';
    return commitTimerState({
      ...current,
      status: 'finished',
      running: false,
      paused: false,
      finished: true,
      mode: 'countdown',
      durationMs: 0,
      startTime: null,
      endTime: null,
      elapsedBeforePauseMs: 0,
      pausedRemainingMs: null,
      remaining: completionValue,
      scheduleReconciliationHold: false,
      schedulePausedOverrunMs: 0,
      awaitingNext: false,
    });
  }, [commitTimerState]);

  const advanceSchedule = React.useCallback(() => {
    const current = latestStateRef.current;
    return current.sets?.[current.activeSetIndex + 1]
      ? skipToNextSet()
      : completeSchedule();
  }, [completeSchedule, skipToNextSet]);

  const displayValue = React.useMemo(() => getTimerDisplay(timerState, now), [timerState, now]);
  const intensity = React.useMemo(() => getTimerIntensity(timerState, now), [timerState, now]);
  const progress = React.useMemo(() => getTimerProgress(timerState, now), [timerState, now]);

  return {
    timerState,
    now,
    displayValue,
    intensity,
    progress,
    actions: {
      startTimer,
      startTimerSet,
      startScheduleRun,
      pauseTimer,
      resumeTimer,
      stopTimer,
      addTime,
      skipToNextSet,
      jumpToSet,
      completeSchedule,
      advanceSchedule,
      commitTimerState,
    },
  };
};

export default useSharedTimer;
