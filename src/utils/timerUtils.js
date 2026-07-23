import {
  MAX_SCHEDULE_ITEMS,
  isTimedScheduleItem,
  normalizeDateOnly,
  normalizeScheduleItems,
  normalizeTimeOfDay,
} from '../../shared/scheduleUtils.js';

export const TIMER_STORAGE_KEY = 'lyricdisplay_timer_state_v2';
export const MAX_TIMER_SETS = MAX_SCHEDULE_ITEMS;

export const getTimerToggleProps = (darkMode, disabled = false) => ({
  className: `!h-6 !w-11 !border-0 shadow-sm transition-colors ${darkMode
    ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
    : 'data-[state=checked]:bg-black'
  } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`,
  thumbClassName: '!h-5 !w-5 data-[state=checked]:!translate-x-[22px] data-[state=unchecked]:!translate-x-[2px]',
});

export const DEFAULT_TIMER_CONTROL_SETTINGS = {
  mode: 'countdown',
  durationMinutes: 5,
  targetTime: '',
  targetHourFormat: '12',
  warningSeconds: 60,
  criticalSeconds: 30,
  overrunMode: false,
  useSets: false,
  sets: [],
  autoStartNext: true,
  indicatorEnabled: true,
  indicatorSeconds: 10,
  indicatorLabel: 'Next item starts in',
  scheduleTitle: 'Service Schedule',
  scheduleEventStartTime: '',
  scheduleEventDate: '',
  scheduleScheduledStartAt: null,
  scheduleIdealEndTime: '',
  scheduleShowGlobalTimeDuringManualItems: true,
  scheduleNotificationsEnabled: true,
  awaitingNext: false,
};

export const DEFAULT_TIMER_DISPLAY = {
  displayUpdatedAt: 0,
  label: 'Time Left:',
  format: 'auto',
  fontFamily: 'Bebas Neue',
  textColor: '#FFFFFF',
  accentColor: '#FFA500',
  warningColor: '#F59E0B',
  criticalColor: '#EF4444',
  backgroundColor: '#000000',
  backgroundPaint: { type: 'solid', color: '#000000' },
  timerFontFamily: 'Bebas Neue',
  timerFontSizeMode: 'auto',
  timerFontSize: 180,
  timerAlign: 'center',
  timerBold: true,
  timerItalic: false,
  timerUnderline: false,
  showSecondaryText: true,
  showProgress: true,
  showClockWhenIdle: true,
  showGlobalClock: true,
  otherItemsScale: 0.1,
  globalClockScale: 0.1,
  clockHour12: false,
  clockShowSeconds: false,
  clockShowPeriod: true,
};

const LEGACY_DEFAULT_OTHER_ITEMS_SCALE = 0.15;

export const normalizeTimerDisplaySettings = (raw) => {
  const settings = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw
    : {};
  const displayUpdatedAt = Number.isFinite(Number(settings.displayUpdatedAt)) ? Number(settings.displayUpdatedAt) : 0;
  const rawScale = settings.otherItemsScale ?? settings.globalClockScale;
  const numericScale = Number(rawScale);
  const shouldMigrateLegacyScale = displayUpdatedAt <= 0
    && Number.isFinite(numericScale)
    && numericScale === LEGACY_DEFAULT_OTHER_ITEMS_SCALE;
  const otherItemsScale = shouldMigrateLegacyScale
    ? DEFAULT_TIMER_DISPLAY.otherItemsScale
    : (rawScale ?? DEFAULT_TIMER_DISPLAY.otherItemsScale);

  return {
    ...DEFAULT_TIMER_DISPLAY,
    ...settings,
    otherItemsScale,
    globalClockScale: shouldMigrateLegacyScale
      ? DEFAULT_TIMER_DISPLAY.globalClockScale
      : (settings.globalClockScale ?? otherItemsScale),
    displayUpdatedAt,
  };
};

export const createIdleTimerState = () => ({
  version: 2,
  status: 'idle',
  running: false,
  paused: false,
  finished: false,
  mode: 'countdown',
  phase: 'timer',
  label: '',
  durationMs: 0,
  startTime: null,
  endTime: null,
  targetTime: null,
  elapsedBeforePauseMs: 0,
  pausedRemainingMs: null,
  remaining: null,
  warningMs: 60000,
  criticalMs: 30000,
  overrunMode: false,
  overrunStartedAt: null,
  sets: [],
  activeSetIndex: 0,
  autoStartNext: true,
  indicatorEnabled: false,
  indicatorDurationMs: 10000,
  indicatorLabel: 'Next item starts in',
  scheduleTitle: '',
  scheduleRunId: '',
  scheduleEventStartTime: '',
  scheduleEventDate: '',
  scheduleScheduledStartAt: null,
  scheduleIdealEndAt: null,
  scheduleStartedAt: null,
  scheduleJoinedAt: null,
  scheduleReconciled: false,
  scheduleReconciliationHold: false,
  schedulePausedOverrunMs: 0,
  scheduleAssumedCompletedIds: [],
  scheduleShowGlobalTimeDuringManualItems: true,
  scheduleNotificationsEnabled: true,
  display: { ...DEFAULT_TIMER_DISPLAY },
  updatedAt: Date.now(),
});

export const clampNumber = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const normalizeTimerNumberInput = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  if (value === '') return '';

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;

  const clamped = Math.min(max, Math.max(min, numeric));
  if (typeof value === 'string' && /^(\d+(\.\d*)?|\.\d+)$/.test(value) && numeric === clamped) {
    return value;
  }

  return clamped;
};

export const minutesToMs = (minutes) => Math.round(clampNumber(minutes, 0, 0, 1440) * 60000);

export const secondsToMs = (seconds) => Math.round(clampNumber(seconds, 0, 0, 86400) * 1000);

export const msToMinutesInput = (ms) => {
  const numeric = clampNumber(ms, 0, 0);
  return Math.max(0, Math.round((numeric / 60000) * 100) / 100);
};

const isValidTargetTime = (value) => {
  if (typeof value !== 'string' || !value) return false;
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return Number.isInteger(hours)
    && Number.isInteger(minutes)
    && hours >= 0
    && hours <= 23
    && minutes >= 0
    && minutes <= 59;
};

const normalizeNullableTimestamp = (value) => {
  if (value === null || value === undefined || value === '') return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
};

export const normalizeTimerControlSettings = (raw) => {
  const settings = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw
    : {};

  const sets = Array.isArray(settings.sets)
    ? normalizeScheduleItems(settings.sets)
    : DEFAULT_TIMER_CONTROL_SETTINGS.sets;
  const isLegacyPlaceholderSchedule = sets.length > 0
    && sets.length <= 2
    && sets.every((set, index) => (
      set.id === `timer-set-${index + 1}`
      && set.label === `Timer ${index + 1}`
      && set.durationMs === 5 * 60_000
    ));
  const warningSeconds = normalizeTimerNumberInput(
    settings.warningSeconds,
    DEFAULT_TIMER_CONTROL_SETTINGS.warningSeconds,
    0,
    86400
  );
  const rawCriticalSeconds = normalizeTimerNumberInput(
    settings.criticalSeconds,
    DEFAULT_TIMER_CONTROL_SETTINGS.criticalSeconds,
    0,
    86400
  );
  const criticalSeconds = warningSeconds !== ''
    && rawCriticalSeconds !== ''
    && Number(rawCriticalSeconds) > Number(warningSeconds)
    ? warningSeconds
    : rawCriticalSeconds;

  return {
    ...DEFAULT_TIMER_CONTROL_SETTINGS,
    ...settings,
    mode: ['countdown', 'countup', 'target'].includes(settings.mode) ? settings.mode : DEFAULT_TIMER_CONTROL_SETTINGS.mode,
    durationMinutes: normalizeTimerNumberInput(settings.durationMinutes, DEFAULT_TIMER_CONTROL_SETTINGS.durationMinutes, 0, 1440),
    targetTime: isValidTargetTime(settings.targetTime) ? settings.targetTime : '',
    targetHourFormat: settings.targetHourFormat === '24' ? '24' : '12',
    warningSeconds,
    criticalSeconds,
    overrunMode: Boolean(settings.overrunMode),
    useSets: Boolean(settings.useSets),
    sets: isLegacyPlaceholderSchedule ? [] : sets,
    autoStartNext: settings.autoStartNext !== false,
    indicatorEnabled: settings.indicatorEnabled !== false,
    indicatorSeconds: normalizeTimerNumberInput(settings.indicatorSeconds, DEFAULT_TIMER_CONTROL_SETTINGS.indicatorSeconds, 0, 86400),
    indicatorLabel: typeof settings.indicatorLabel === 'string' ? settings.indicatorLabel : DEFAULT_TIMER_CONTROL_SETTINGS.indicatorLabel,
    scheduleTitle: typeof settings.scheduleTitle === 'string'
      ? settings.scheduleTitle.slice(0, 160)
      : DEFAULT_TIMER_CONTROL_SETTINGS.scheduleTitle,
    scheduleEventStartTime: isValidTargetTime(settings.scheduleEventStartTime) ? settings.scheduleEventStartTime : '',
    scheduleEventDate: normalizeDateOnly(settings.scheduleEventDate),
    scheduleScheduledStartAt: normalizeNullableTimestamp(settings.scheduleScheduledStartAt),
    scheduleIdealEndTime: isValidTargetTime(settings.scheduleIdealEndTime) ? settings.scheduleIdealEndTime : '',
    scheduleShowGlobalTimeDuringManualItems: settings.scheduleShowGlobalTimeDuringManualItems !== false,
    scheduleNotificationsEnabled: settings.scheduleNotificationsEnabled !== false,
    settingsUpdatedAt: Number.isFinite(Number(settings.settingsUpdatedAt)) ? Number(settings.settingsUpdatedAt) : 0,
  };
};

export const normalizeTimerState = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createIdleTimerState();
  }

  const idle = createIdleTimerState();
  const running = Boolean(raw.running);
  const paused = Boolean(raw.paused);
  const status = raw.status || (running ? (paused ? 'paused' : 'running') : (raw.finished ? 'finished' : 'idle'));
  const durationMs = clampNumber(raw.durationMs ?? raw.durationMinutes * 60000, 0, 0);
  const sets = Array.isArray(raw.sets) ? normalizeScheduleItems(raw.sets) : [];
  const warningMs = clampNumber(raw.warningMs, 60000, 0);
  const criticalMs = Math.min(clampNumber(raw.criticalMs, 30000, 0), warningMs);

  return {
    ...idle,
    ...raw,
    version: 2,
    status,
    running,
    paused,
    finished: Boolean(raw.finished) || status === 'finished',
    mode: ['countdown', 'countup', 'target'].includes(raw.mode) ? raw.mode : 'countdown',
    phase: raw.phase === 'indicator' ? 'indicator' : 'timer',
    label: String(raw.label || ''),
    durationMs,
    startTime: normalizeNullableTimestamp(raw.startTime),
    endTime: normalizeNullableTimestamp(raw.endTime),
    targetTime: normalizeNullableTimestamp(raw.targetTime),
    elapsedBeforePauseMs: clampNumber(raw.elapsedBeforePauseMs, 0, 0),
    pausedRemainingMs: Number.isFinite(Number(raw.pausedRemainingMs)) ? Math.max(0, Number(raw.pausedRemainingMs)) : null,
    warningMs,
    criticalMs,
    overrunMode: Boolean(raw.overrunMode),
    overrunStartedAt: normalizeNullableTimestamp(raw.overrunStartedAt),
    sets,
    activeSetIndex: Math.trunc(clampNumber(raw.activeSetIndex, 0, 0, Math.max(0, sets.length - 1))),
    autoStartNext: raw.autoStartNext !== false,
    indicatorEnabled: Boolean(raw.indicatorEnabled),
    indicatorDurationMs: clampNumber(raw.indicatorDurationMs, 10000, 0),
    indicatorLabel: typeof raw.indicatorLabel === 'string' ? raw.indicatorLabel : 'Next item starts in',
    scheduleTitle: String(raw.scheduleTitle || ''),
    scheduleRunId: String(raw.scheduleRunId || '').slice(0, 96),
    scheduleEventStartTime: normalizeTimeOfDay(raw.scheduleEventStartTime),
    scheduleEventDate: normalizeDateOnly(raw.scheduleEventDate),
    scheduleScheduledStartAt: normalizeNullableTimestamp(raw.scheduleScheduledStartAt),
    scheduleIdealEndAt: normalizeNullableTimestamp(raw.scheduleIdealEndAt),
    scheduleStartedAt: normalizeNullableTimestamp(raw.scheduleStartedAt),
    scheduleJoinedAt: normalizeNullableTimestamp(raw.scheduleJoinedAt),
    scheduleReconciled: Boolean(raw.scheduleReconciled),
    scheduleReconciliationHold: Boolean(raw.scheduleReconciliationHold),
    schedulePausedOverrunMs: clampNumber(raw.schedulePausedOverrunMs, 0, 0, 24 * 60 * 60 * 1000),
    scheduleAssumedCompletedIds: Array.isArray(raw.scheduleAssumedCompletedIds)
      ? raw.scheduleAssumedCompletedIds.map((id) => String(id || '').slice(0, 96)).filter(Boolean).slice(0, MAX_TIMER_SETS)
      : [],
    scheduleShowGlobalTimeDuringManualItems: raw.scheduleShowGlobalTimeDuringManualItems !== false,
    scheduleNotificationsEnabled: raw.scheduleNotificationsEnabled !== false,
    awaitingNext: Boolean(raw.awaitingNext),
    display: normalizeTimerDisplaySettings(raw.display),
    updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : Date.now(),
  };
};

export const shouldShowGlobalTimeForManualScheduleItem = (timerState) => {
  if (!timerState || typeof timerState !== 'object' || Array.isArray(timerState)) return false;
  if (timerState.scheduleShowGlobalTimeDuringManualItems === false || timerState.phase === 'indicator') return false;
  if (!timerState.running && !timerState.paused) return false;
  if (!Array.isArray(timerState.sets) || timerState.sets.length === 0) return false;

  const activeIndex = Math.max(0, Math.min(
    timerState.sets.length - 1,
    Math.trunc(Number(timerState.activeSetIndex) || 0)
  ));
  return !isTimedScheduleItem(timerState.sets[activeIndex]);
};

export const resetActiveTimerRuntime = (raw) => {
  const state = normalizeTimerState(raw);
  const isActiveRuntime = state.running || state.paused || ['running', 'paused'].includes(state.status);

  if (!isActiveRuntime) return state;

  return normalizeTimerState({
    ...createIdleTimerState(),
    display: state.display,
  });
};

export const getRemainingMs = (timerState, now = Date.now()) => {
  const state = normalizeTimerState(timerState);

  if (state.mode === 'countup') return null;
  if (state.paused && Number.isFinite(state.pausedRemainingMs)) return state.pausedRemainingMs;
  if (!state.endTime) return null;
  return state.endTime - now;
};

export const getElapsedMs = (timerState, now = Date.now()) => {
  const state = normalizeTimerState(timerState);
  if (state.paused) return clampNumber(state.elapsedBeforePauseMs, 0, 0);
  if (!state.startTime) return clampNumber(state.elapsedBeforePauseMs, 0, 0);
  return clampNumber(state.elapsedBeforePauseMs + (now - state.startTime), 0, 0);
};

export const formatDuration = (ms, format = 'auto') => {
  const safeMs = Math.max(0, Math.floor(Number(ms) || 0));
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (format === 'verbose') {
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  if (format === 'minutes') {
    return `${Math.ceil(safeMs / 60000)} min`;
  }

  if (format === 'hhmmss' || hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  if (format === 'mmss') {
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const getTimerDisplay = (timerState, now = Date.now()) => {
  const state = normalizeTimerState(timerState);
  const display = state.display || DEFAULT_TIMER_DISPLAY;
  const format = display.format || 'auto';

  if (state.mode === 'countup') {
    return formatDuration(getElapsedMs(state, now), format);
  }

  if (state.paused && state.scheduleReconciliationHold && state.schedulePausedOverrunMs > 0) {
    return `+${formatDuration(state.schedulePausedOverrunMs, format)}`;
  }

  const remainingMs = getRemainingMs(state, now);
  if (Number.isFinite(remainingMs)) {
    if (remainingMs < 0 && (state.overrunMode || state.scheduleReconciliationHold)) {
      return `+${formatDuration(Math.abs(remainingMs), format)}`;
    }
    return formatDuration(Math.max(0, remainingMs), format);
  }

  if (typeof state.remaining === 'string' && state.remaining) return state.remaining;
  return formatDuration(state.durationMs, format);
};

export const getTimerIntensity = (timerState, now = Date.now()) => {
  const state = normalizeTimerState(timerState);
  if (state.mode === 'countup') return 'normal';
  const remainingMs = getRemainingMs(state, now);
  if (!Number.isFinite(remainingMs) || remainingMs < 0) return 'normal';
  if (remainingMs <= state.criticalMs) return 'critical';
  if (remainingMs <= state.warningMs) return 'warning';
  return 'normal';
};

export const getTimerProgress = (timerState, now = Date.now()) => {
  const state = normalizeTimerState(timerState);
  if (state.mode === 'countup') return 0;
  const remainingMs = getRemainingMs(state, now);
  const duration = state.phase === 'indicator' ? state.indicatorDurationMs : state.durationMs;
  if (!Number.isFinite(remainingMs) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - (Math.max(0, remainingMs) / duration)));
};

export const isTimerVisiblyActive = (timerState, now = Date.now()) => {
  const state = normalizeTimerState(timerState);
  if (state.paused) return true;
  if (!state.running) return false;
  if (state.mode === 'countup' || state.overrunMode || state.scheduleReconciliationHold) return true;

  const remainingMs = getRemainingMs(state, now);
  if (!Number.isFinite(remainingMs) || remainingMs > 0) return true;

  const nextIndex = state.activeSetIndex + 1;
  const hasNextSet = Boolean(state.sets?.[nextIndex]);
  if (state.phase === 'indicator') return hasNextSet;
  return hasNextSet && state.autoStartNext;
};

export const formatGlobalClock = (dateOrMs = Date.now(), options = {}) => {
  const date = dateOrMs instanceof Date ? dateOrMs : new Date(dateOrMs);
  const hour12 = Boolean(options.clockHour12);
  const showSeconds = Boolean(options.clockShowSeconds);
  const showPeriod = options.clockShowPeriod !== false;

  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12,
  }).formatToParts(date);

  const value = parts
    .filter((part) => part.type !== 'dayPeriod' || showPeriod)
    .map((part) => part.value)
    .join('')
    .trim();

  return hour12 && !showPeriod ? value.replace(/\s+$/, '') : value;
};

export const splitClockPeriod = (value = '') => {
  const text = String(value);
  const match = text.match(/^(.*?)(?:\s*)(AM|PM)$/i);
  if (!match) return { time: text, period: '' };

  return {
    time: match[1].trimEnd(),
    period: match[2].toUpperCase(),
  };
};
