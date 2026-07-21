import React from 'react';
import { CalendarClock, Settings2 } from 'lucide-react';
import { useControlSocket } from '../context/ControlSocketProvider';
import useModal from '../hooks/useModal';
import useSharedTimer from '../hooks/useSharedTimer';
import useToast from '../hooks/useToast';
import {
  DEFAULT_TIMER_CONTROL_SETTINGS,
  DEFAULT_TIMER_DISPLAY,
  formatGlobalClock,
  getRemainingMs,
  getTimerDisplay,
  getTimerIntensity,
  getTimerProgress,
  getTimerToggleProps,
  minutesToMs,
  secondsToMs,
  splitClockPeriod,
} from '../utils/timerUtils';
import { paintToCss } from '../utils/paint';
import { readTimerScheduleSnapshot, saveTimerScheduleSnapshot } from '../utils/timerScheduleStorage.js';
import { useDarkModeState, useTimerControlSettings, useTimerDisplaySettings } from '../hooks/useStoreSelectors';
import TimerControlLayout from './TimerControlLayout';
import { isCommandFocusProtected } from '../../shared/commandSafetyPolicy.js';
import {
  calculateScheduleProjection,
  isTimedScheduleItem,
  normalizeScheduleDocument,
  resolveScheduleTime,
} from '../../shared/scheduleUtils.js';

const PERIOD_STYLE = {
  fontSize: '0.42em',
  marginLeft: '0.12em',
  verticalAlign: 'baseline',
  lineHeight: 1,
};

const formatScheduleClock = (timestamp) => new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(timestamp));

const formatScheduleVariance = (varianceMs) => {
  const minutes = Math.max(1, Math.ceil(Math.abs(Number(varianceMs) || 0) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const usePreviewClock = (enabled, intervalMs = 1000) => {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [enabled, intervalMs]);

  return now;
};

const useWindowActive = () => {
  const getActive = React.useCallback(() => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState !== 'hidden' && document.hasFocus();
  }, []);
  const [active, setActive] = React.useState(getActive);

  React.useEffect(() => {
    const updateActive = () => setActive(getActive());
    window.addEventListener('focus', updateActive);
    window.addEventListener('blur', updateActive);
    document.addEventListener('visibilitychange', updateActive);
    updateActive();

    return () => {
      window.removeEventListener('focus', updateActive);
      window.removeEventListener('blur', updateActive);
      document.removeEventListener('visibilitychange', updateActive);
    };
  }, [getActive]);

  return active;
};

const usePageVisible = () => {
  const getVisible = React.useCallback(() => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState !== 'hidden';
  }, []);
  const [visible, setVisible] = React.useState(getVisible);

  React.useEffect(() => {
    const updateVisible = () => setVisible(getVisible());
    document.addEventListener('visibilitychange', updateVisible);
    updateVisible();

    return () => {
      document.removeEventListener('visibilitychange', updateVisible);
    };
  }, [getVisible]);

  return visible;
};

const TimerPreview = React.memo(({ timerState, displaySettings, scheduleMode = false, scheduleItems = [] }) => {
  const showSecondaryText = displaySettings.showSecondaryText !== false;
  const needsClock = timerState.running || timerState.paused || displaySettings.showGlobalClock;
  const windowActive = useWindowActive();
  const pageVisible = usePageVisible();
  const timerActive = timerState.running || timerState.paused;
  const previewTickMs = pageVisible
    ? (timerActive ? (windowActive ? 1000 : 2000) : (windowActive ? 1000 : 5000))
    : 15000;
  const now = usePreviewClock(needsClock, previewTickMs);
  const displayValue = React.useMemo(() => getTimerDisplay(timerState, now), [timerState, now]);
  const intensity = React.useMemo(() => getTimerIntensity(timerState, now), [timerState, now]);
  const progress = React.useMemo(() => getTimerProgress(timerState, now), [timerState, now]);
  const accent = intensity === 'critical' ? '#EF4444' : intensity === 'warning' ? '#F59E0B' : displaySettings.accentColor;
  const globalClockValue = React.useMemo(() => formatGlobalClock(now, {
    clockHour12: displaySettings.clockHour12,
    clockShowSeconds: displaySettings.clockShowSeconds,
    clockShowPeriod: displaySettings.clockShowPeriod,
  }), [displaySettings.clockHour12, displaySettings.clockShowPeriod, displaySettings.clockShowSeconds, now]);
  const globalClockParts = React.useMemo(() => splitClockPeriod(globalClockValue), [globalClockValue]);
  const previewHasActiveSchedule = (timerState.running || timerState.paused)
    && Array.isArray(timerState.sets)
    && timerState.sets.length > 0;
  const nextScheduleIndex = previewHasActiveSchedule
    ? timerState.activeSetIndex + 1
    : 0;
  const nextScheduleItem = scheduleItems[nextScheduleIndex] || null;

  return (
    <div className="space-y-3">
      <div
        className="flex min-h-[285px] flex-col items-center justify-center rounded-lg px-6"
        style={{ background: paintToCss(displaySettings.backgroundPaint, displaySettings.backgroundColor || '#000000') }}
      >
        {showSecondaryText && (
          <div className="text-xs font-semibold mb-4" style={{ color: accent }}>
            {timerState.phase === 'indicator' ? timerState.indicatorLabel : (timerState.label || displaySettings.label)}
          </div>
        )}
        <div
          className="leading-none max-w-full"
          style={{
            color: intensity === 'critical' ? '#EF4444' : displaySettings.textColor,
            fontFamily: displaySettings.timerFontFamily,
            fontSize: displaySettings.timerFontSizeMode === 'manual' ? `${displaySettings.timerFontSize}px` : 'clamp(4rem, 12vw, 10rem)',
            fontWeight: displaySettings.timerBold ? 700 : 400,
            fontStyle: displaySettings.timerItalic ? 'italic' : 'normal',
            textDecoration: displaySettings.timerUnderline ? 'underline' : 'none',
            textAlign: displaySettings.timerAlign,
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: '"tnum" 1, "lnum" 1',
            whiteSpace: 'nowrap',
          }}
        >
          {displayValue}
        </div>
        {showSecondaryText && timerState.sets?.length > 1 && (
          <div className="mt-4 text-xs text-white/70">
            {timerState.activeSetIndex + 1} of {timerState.sets.length}
          </div>
        )}
        {displaySettings.showProgress && (
          <div className="mt-8 w-full h-2 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: accent }} />
          </div>
        )}
      </div>

      {scheduleMode && (
        <div
          className="flex w-full items-center justify-between gap-6 rounded-lg border px-6 py-4"
          style={{
            background: paintToCss(displaySettings.backgroundPaint, displaySettings.backgroundColor || '#000000'),
            borderColor: 'rgba(255,255,255,0.14)',
          }}
        >
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-white/55">Next Schedule Item</span>
          <span className="min-w-0 text-right">
            <span className="block truncate text-sm font-semibold text-white/85">
              {nextScheduleItem?.label || (scheduleItems.length > 0 ? 'End of schedule' : 'No schedule loaded')}
            </span>
            {nextScheduleItem && (
              <span className="mt-0.5 block text-[10px] text-white/45">
                Item {nextScheduleIndex + 1} of {scheduleItems.length}
              </span>
            )}
          </span>
        </div>
      )}

      {showSecondaryText && displaySettings.showGlobalClock && (
        <div
          className="flex w-full items-center justify-between rounded-lg border px-6 py-4"
          style={{
            background: paintToCss(displaySettings.backgroundPaint, displaySettings.backgroundColor || '#000000'),
            borderColor: 'rgba(255,255,255,0.14)',
          }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-white/55">Global Time</span>
          <span
            className="font-mono text-2xl font-semibold text-white/80"
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontFeatureSettings: '"tnum" 1, "lnum" 1',
            }}
          >
            {globalClockParts.time}
            {globalClockParts.period && <span style={PERIOD_STYLE}>{globalClockParts.period}</span>}
          </span>
        </div>
      )}
    </div>
  );
});

TimerPreview.displayName = 'TimerPreview';

const TimerControlModule = () => {
  const { emitStageTimerUpdate } = useControlSocket();
  const { showModal } = useModal();
  const { showToast } = useToast();
  const { darkMode } = useDarkModeState();
  const { settings: timerControlSettings, updateSettings: updateTimerControlSettings } = useTimerControlSettings();
  const { settings: timerDisplaySettings, updateSettings: updateTimerDisplaySettings } = useTimerDisplaySettings();
  const { timerState, actions } = useSharedTimer({
    emitTimerUpdate: emitStageTimerUpdate,
    controller: true,
    tickIntervalMs: 1000,
    renderTickIntervalMs: null,
  });
  const { commitTimerState } = actions;
  const latestTimerStateRef = React.useRef(timerState);
  const latestDisplaySettingsRef = React.useRef(null);
  const lastManualItemNoticeRef = React.useRef('');
  const lastBehindNoticeBucketRef = React.useRef(-1);
  const criticalTimerAlertKeysRef = React.useRef(new Set());
  const scheduleClearedDuringRunRef = React.useRef(false);
  const timerControlWindowActive = useWindowActive();
  const controlSettings = timerControlSettings || DEFAULT_TIMER_CONTROL_SETTINGS;
  const latestControlSettingsRef = React.useRef(controlSettings);

  React.useEffect(() => {
    const handleTimerRejected = (event) => {
      showToast({
        title: 'Timer update not applied',
        message: event?.detail?.reason || 'The timer changed on another controller. The latest state has been restored.',
        variant: 'warning',
      });
    };
    window.addEventListener('stage-timer-rejected', handleTimerRejected);
    return () => window.removeEventListener('stage-timer-rejected', handleTimerRejected);
  }, [showToast]);

  const {
    mode,
    durationMinutes,
    targetTime,
    targetHourFormat,
    warningSeconds,
    criticalSeconds,
    overrunMode,
    useSets,
    sets = DEFAULT_TIMER_CONTROL_SETTINGS.sets,
    autoStartNext,
    indicatorEnabled,
    indicatorSeconds,
    indicatorLabel,
    scheduleTitle,
    scheduleEventStartTime,
    scheduleIdealEndTime,
    scheduleNotificationsEnabled,
  } = controlSettings;

  React.useEffect(() => {
    latestControlSettingsRef.current = controlSettings;
  }, [controlSettings]);

  const restoredScheduleRef = React.useRef(false);
  React.useEffect(() => {
    if (restoredScheduleRef.current) return;
    restoredScheduleRef.current = true;

    const storedSchedule = readTimerScheduleSnapshot();
    if (!storedSchedule) {
      if (controlSettings.sets?.length > 0) saveTimerScheduleSnapshot(controlSettings);
      return;
    }

    const currentHasSchedule = Array.isArray(controlSettings.sets) && controlSettings.sets.length > 0;
    const storedIsNewer = Number(storedSchedule.settingsUpdatedAt) > Number(controlSettings.settingsUpdatedAt || 0);
    if (!currentHasSchedule || storedIsNewer) {
      latestControlSettingsRef.current = storedSchedule;
      updateTimerControlSettings(storedSchedule);
    } else {
      saveTimerScheduleSnapshot(controlSettings);
    }
  }, [controlSettings, updateTimerControlSettings]);

  const setTimerControlSettings = React.useCallback((partial) => {
    const nextSettings = {
      ...latestControlSettingsRef.current,
      ...partial,
      settingsUpdatedAt: Date.now(),
    };
    latestControlSettingsRef.current = nextSettings;
    saveTimerScheduleSnapshot(nextSettings);
    updateTimerControlSettings(partial);
  }, [updateTimerControlSettings]);

  const applyTimerControlSettings = React.useCallback((partial) => {
    setTimerControlSettings(partial);

    const current = latestTimerStateRef.current;
    const isActive = current.running || current.paused;
    if (!isActive) return;

    const liveUpdates = {};
    if (Object.prototype.hasOwnProperty.call(partial, 'warningSeconds')) {
      liveUpdates.warningMs = secondsToMs(partial.warningSeconds);
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'criticalSeconds')) {
      liveUpdates.criticalMs = secondsToMs(partial.criticalSeconds);
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'overrunMode')) {
      liveUpdates.overrunMode = Boolean(partial.overrunMode);
      if (partial.overrunMode === false) {
        liveUpdates.overrunStartedAt = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'autoStartNext')) {
      liveUpdates.autoStartNext = partial.autoStartNext !== false;
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'indicatorEnabled')) {
      liveUpdates.indicatorEnabled = Boolean(partial.indicatorEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'indicatorSeconds')) {
      liveUpdates.indicatorDurationMs = secondsToMs(partial.indicatorSeconds);
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'indicatorLabel')) {
      liveUpdates.indicatorLabel = partial.indicatorLabel;
      if (current.phase === 'indicator') {
        liveUpdates.label = partial.indicatorLabel;
      }
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'scheduleTitle')) {
      liveUpdates.scheduleTitle = partial.scheduleTitle;
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'scheduleIdealEndTime')) {
      liveUpdates.scheduleIdealEndAt = partial.scheduleIdealEndTime
        ? resolveScheduleTime(partial.scheduleIdealEndTime, current.scheduleStartedAt || Date.now())
        : null;
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'scheduleNotificationsEnabled')) {
      liveUpdates.scheduleNotificationsEnabled = partial.scheduleNotificationsEnabled !== false;
    }

    if (Object.keys(liveUpdates).length > 0) {
      commitTimerState({
        ...current,
        ...liveUpdates,
      });
    }
  }, [commitTimerState, setTimerControlSettings]);

  const displaySettings = React.useMemo(() => {
    const settings = {
      ...DEFAULT_TIMER_DISPLAY,
      ...(timerDisplaySettings || {}),
    };
    settings.otherItemsScale = timerDisplaySettings?.otherItemsScale ?? timerDisplaySettings?.globalClockScale ?? DEFAULT_TIMER_DISPLAY.otherItemsScale;
    settings.globalClockScale = settings.otherItemsScale;
    return settings;
  }, [timerDisplaySettings]);

  React.useEffect(() => {
    latestDisplaySettingsRef.current = displaySettings;
  }, [displaySettings]);

  const active = timerState.running || timerState.paused;
  const activeTimerUsesSets = active && Array.isArray(timerState.sets) && timerState.sets.length > 0;
  const scheduleNow = usePreviewClock(useSets || activeTimerUsesSets, active ? 5_000 : 30_000);
  const projectionItems = activeTimerUsesSets ? timerState.sets : sets;
  const currentScheduleRemainingMs = activeTimerUsesSets && timerState.mode !== 'countup'
    ? getRemainingMs(timerState, scheduleNow)
    : null;
  const scheduleProjection = React.useMemo(() => calculateScheduleProjection({
    items: projectionItems,
    active: activeTimerUsesSets,
    activeIndex: timerState.activeSetIndex,
    now: scheduleNow,
    currentRemainingMs: currentScheduleRemainingMs,
    currentIsTransition: timerState.phase === 'indicator',
    transitionMs: indicatorEnabled ? secondsToMs(indicatorSeconds) : 0,
    idealEndAt: activeTimerUsesSets ? timerState.scheduleIdealEndAt : null,
    idealEndTime: activeTimerUsesSets ? '' : scheduleIdealEndTime,
  }), [
    activeTimerUsesSets,
    currentScheduleRemainingMs,
    indicatorEnabled,
    indicatorSeconds,
    projectionItems,
    scheduleIdealEndTime,
    scheduleNow,
    timerState.activeSetIndex,
    timerState.phase,
    timerState.scheduleIdealEndAt,
  ]);

  React.useEffect(() => {
    latestTimerStateRef.current = timerState;
  }, [timerState]);

  const surfaceScheduleNotice = React.useCallback((title, message, variant = 'warning') => {
    showToast({ title, message, variant });
    if (!timerControlWindowActive && typeof window.Notification === 'function' && window.Notification.permission === 'granted') {
      try { new window.Notification(title, { body: message }); } catch { /* In-app notification already surfaced. */ }
    }
  }, [showToast, timerControlWindowActive]);

  const handleTimingAlertsChange = React.useCallback(async (enabled) => {
    applyTimerControlSettings({ scheduleNotificationsEnabled: enabled });
    if (enabled && typeof window.Notification === 'function' && window.Notification.permission === 'default') {
      try { await window.Notification.requestPermission(); } catch { /* In-app alerts remain available. */ }
    }
  }, [applyTimerControlSettings]);

  React.useEffect(() => {
    if (!activeTimerUsesSets || timerState.phase !== 'timer' || timerState.scheduleNotificationsEnabled === false) return;
    const currentItem = timerState.sets?.[timerState.activeSetIndex];
    if (!currentItem || isTimedScheduleItem(currentItem)) return;
    const noticeKey = `${timerState.scheduleStartedAt || ''}:${currentItem.id}`;
    if (lastManualItemNoticeRef.current === noticeKey) return;
    lastManualItemNoticeRef.current = noticeKey;
    surfaceScheduleNotice(
      'Manual schedule item',
      `${currentItem.label} has no duration. Select Next when it is complete.`,
      'info'
    );
  }, [
    activeTimerUsesSets,
    surfaceScheduleNotice,
    timerState.activeSetIndex,
    timerState.phase,
    timerState.scheduleNotificationsEnabled,
    timerState.scheduleStartedAt,
    timerState.sets,
  ]);

  React.useEffect(() => {
    const varianceMs = scheduleProjection.varianceMs;
    const notificationsEnabled = activeTimerUsesSets && timerState.scheduleNotificationsEnabled !== false;
    const hasIdealEnd = scheduleProjection.status !== 'unconfigured'
      && Number.isFinite(scheduleProjection.idealEndAt);
    if (!notificationsEnabled || !hasIdealEnd || !Number.isFinite(varianceMs) || varianceMs < 60_000) {
      lastBehindNoticeBucketRef.current = -1;
      return;
    }
    const bucket = Math.floor(varianceMs / (5 * 60_000));
    if (lastBehindNoticeBucketRef.current >= bucket) return;
    lastBehindNoticeBucketRef.current = bucket;
    const qualifier = scheduleProjection.isEstimate ? 'at least ' : '';
    surfaceScheduleNotice(
      'Schedule running behind',
      `${timerState.scheduleTitle || 'The schedule'} is ${qualifier}${formatScheduleVariance(varianceMs)} behind the ideal end time.`
    );
  }, [
    activeTimerUsesSets,
    scheduleProjection.idealEndAt,
    scheduleProjection.isEstimate,
    scheduleProjection.status,
    scheduleProjection.varianceMs,
    surfaceScheduleNotice,
    timerState.scheduleNotificationsEnabled,
    timerState.scheduleTitle,
  ]);

  const timerAlertIntensity = React.useMemo(
    () => getTimerIntensity(timerState, scheduleNow),
    [scheduleNow, timerState]
  );

  React.useEffect(() => {
    const notificationsEnabled = activeTimerUsesSets && timerState.scheduleNotificationsEnabled !== false;
    const currentItem = timerState.sets?.[timerState.activeSetIndex];
    const canAlert = notificationsEnabled
      && timerState.phase === 'timer'
      && isTimedScheduleItem(currentItem)
      && timerAlertIntensity === 'critical'
      && Number(timerState.criticalMs) > 0;
    if (!canAlert) return;

    const alertKey = `${timerState.scheduleStartedAt || ''}:${currentItem.id}`;
    if (criticalTimerAlertKeysRef.current.has(alertKey)) return;
    criticalTimerAlertKeysRef.current.add(alertKey);
    const remainingSeconds = Math.max(0, Math.ceil((getRemainingMs(timerState, scheduleNow) || 0) / 1000));
    surfaceScheduleNotice(
      'Timer critical',
      `${currentItem.label} has ${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'} remaining.`,
      'error'
    );
  }, [
    activeTimerUsesSets,
    scheduleNow,
    surfaceScheduleNotice,
    timerAlertIntensity,
    timerState,
  ]);

  const applyTimerDisplaySettings = React.useCallback((partial) => {
    const displayUpdatedAt = Date.now();
    const normalizedPartial = { ...partial, displayUpdatedAt };
    if (Object.prototype.hasOwnProperty.call(normalizedPartial, 'otherItemsScale')) {
      normalizedPartial.globalClockScale = normalizedPartial.otherItemsScale;
    }
    const nextDisplay = {
      ...(latestDisplaySettingsRef.current || DEFAULT_TIMER_DISPLAY),
      ...normalizedPartial,
    };
    latestDisplaySettingsRef.current = nextDisplay;
    updateTimerDisplaySettings(normalizedPartial);
    commitTimerState({
      ...latestTimerStateRef.current,
      display: nextDisplay,
    });
  }, [commitTimerState, updateTimerDisplaySettings]);

  const applyTimerLabel = React.useCallback((label) => {
    applyTimerDisplaySettings({ label });

    const current = latestTimerStateRef.current;
    if ((current.running || current.paused) && current.phase === 'timer' && (!current.sets || current.sets.length === 0)) {
      commitTimerState({
        ...current,
        label,
      });
    }
  }, [applyTimerDisplaySettings, commitTimerState]);

  const buildDisplay = React.useCallback(() => ({
    ...displaySettings,
  }), [displaySettings]);

  const getTargetTimestamp = React.useCallback(() => {
    if (!targetTime) return null;
    const [hours, minutes] = targetTime.split(':').map((part) => Number(part));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    if (next.getTime() <= Date.now()) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime();
  }, [targetTime]);

  const canStartTimer = !active
    && (useSets ? sets.length > 0 : (mode !== 'target' || Boolean(targetTime)));

  const handleStart = React.useCallback(() => {
    const display = buildDisplay();
    if (useSets) {
      scheduleClearedDuringRunRef.current = false;
      if (scheduleNotificationsEnabled && typeof window.Notification === 'function' && window.Notification.permission === 'default') {
        try { void window.Notification.requestPermission(); } catch { /* In-app alerts remain available. */ }
      }
      actions.startTimerSet({
        sets,
        warningMs: secondsToMs(warningSeconds),
        criticalMs: secondsToMs(criticalSeconds),
        overrunMode: false,
        autoStartNext,
        indicatorEnabled,
        indicatorDurationMs: secondsToMs(indicatorSeconds),
        indicatorLabel,
        scheduleTitle,
        scheduleIdealEndAt: resolveScheduleTime(scheduleIdealEndTime),
        scheduleNotificationsEnabled,
        display,
      });
      return;
    }

    actions.startTimer({
      mode,
      durationMs: minutesToMs(durationMinutes),
      targetTime: mode === 'target' ? getTargetTimestamp() : null,
      label: display.label,
      warningMs: secondsToMs(warningSeconds),
      criticalMs: secondsToMs(criticalSeconds),
      overrunMode,
      display,
    });
  }, [
    actions,
    autoStartNext,
    buildDisplay,
    criticalSeconds,
    durationMinutes,
    getTargetTimestamp,
    indicatorEnabled,
    indicatorLabel,
    indicatorSeconds,
    mode,
    overrunMode,
    scheduleIdealEndTime,
    scheduleNotificationsEnabled,
    scheduleTitle,
    sets,
    useSets,
    warningSeconds,
  ]);

  const handleStop = React.useCallback(() => {
    const current = latestTimerStateRef.current;
    const runtimeSchedule = Array.isArray(current.sets) ? current.sets : [];
    if ((current.running || current.paused)
      && runtimeSchedule.length > 0
      && sets.length === 0
      && !scheduleClearedDuringRunRef.current) {
      setTimerControlSettings({
        useSets: true,
        sets: runtimeSchedule,
        scheduleTitle: current.scheduleTitle || scheduleTitle,
        scheduleEventStartTime,
        scheduleIdealEndTime,
        scheduleNotificationsEnabled: current.scheduleNotificationsEnabled !== false,
        autoStartNext: current.autoStartNext !== false,
        indicatorEnabled: Boolean(current.indicatorEnabled),
        indicatorSeconds: Math.max(0, Number(current.indicatorDurationMs) || 0) / 1000,
        indicatorLabel: current.indicatorLabel || indicatorLabel,
        warningSeconds: Math.max(0, Number(current.warningMs) || 0) / 1000,
        criticalSeconds: Math.max(0, Number(current.criticalMs) || 0) / 1000,
      });
    }
    actions.stopTimer();
  }, [
    actions,
    indicatorLabel,
    scheduleEventStartTime,
    scheduleIdealEndTime,
    scheduleTitle,
    setTimerControlSettings,
    sets.length,
  ]);

  const toggleTimerPlayback = React.useCallback(() => {
    if (timerState.running) {
      if (timerState.awaitingNext) {
        actions.advanceSchedule();
        return;
      }
      if (timerState.paused) {
        actions.resumeTimer();
      } else {
        actions.pauseTimer();
      }
      return;
    }

    if (canStartTimer) {
      handleStart();
    }
  }, [actions, canStartTimer, handleStart, timerState.awaitingNext, timerState.paused, timerState.running]);

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== ' ' && event.code !== 'Space') return;
      if (isCommandFocusProtected(event.target, document.activeElement)) return;

      event.preventDefault();
      toggleTimerPlayback();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTimerPlayback]);

  const handleOpenProjectOutput = React.useCallback(() => {
    showModal({
      title: 'Project Time Display',
      headerDescription: 'Send the timer and clock display to this monitor or an external display.',
      component: 'ProjectOutput',
      variant: 'info',
      size: 'lg',
      className: 'max-w-4xl',
      actions: [],
      customLayout: true,
      initialOutputKey: 'time',
    });
  }, [showModal]);

  const handleOpenTimeDisplay = React.useCallback(() => {
    window.electronAPI?.display?.openOutputWindow?.('time');
  }, []);

  const handleOpenDisplaySettings = React.useCallback(() => {
    let draftDisplaySettings = { ...displaySettings };
    showModal({
      title: 'Timer Display',
      headerDescription: 'Choose the information shown with the timer.',
      icon: <Settings2 className="h-5 w-5" />,
      variant: 'info',
      size: 'lg',
      className: 'max-w-3xl',
      component: 'TimerDisplaySettings',
      actions: [
        { label: 'Cancel', value: 'cancel', variant: 'outline' },
        {
          label: 'Save settings',
          value: 'save',
          variant: 'default',
          autoFocus: true,
          onSelect: () => applyTimerDisplaySettings(draftDisplaySettings),
        },
      ],
      displaySettings,
      onDraftDisplaySettingsChange: (nextSettings) => {
        draftDisplaySettings = nextSettings;
      },
    });
  }, [applyTimerDisplaySettings, displaySettings, showModal]);

  const handleControlViewChange = React.useCallback((nextView) => {
    setTimerControlSettings({ useSets: nextView === 'schedule' });
  }, [setTimerControlSettings]);

  const handleClearSchedule = React.useCallback(async () => {
    if (sets.length === 0) return;
    const result = await showModal({
      title: 'Clear schedule?',
      description: activeTimerUsesSets
        ? 'Remove the saved schedule for future runs? The schedule currently running will continue unchanged.'
        : `Remove all ${sets.length} ${sets.length === 1 ? 'item' : 'items'} and reset the schedule setup?`,
      variant: 'warn',
      size: 'xs',
      actions: [
        { label: 'Cancel', value: 'cancel', variant: 'outline' },
        { label: 'Clear schedule', value: 'clear', variant: 'destructive', autoFocus: true },
      ],
    });
    if (result !== 'clear') return;

    scheduleClearedDuringRunRef.current = activeTimerUsesSets;
    setTimerControlSettings({
      useSets: true,
      sets: [],
      scheduleTitle: DEFAULT_TIMER_CONTROL_SETTINGS.scheduleTitle,
      scheduleEventStartTime: '',
      scheduleIdealEndTime: '',
      scheduleNotificationsEnabled: DEFAULT_TIMER_CONTROL_SETTINGS.scheduleNotificationsEnabled,
      autoStartNext: DEFAULT_TIMER_CONTROL_SETTINGS.autoStartNext,
      indicatorEnabled: DEFAULT_TIMER_CONTROL_SETTINGS.indicatorEnabled,
      indicatorSeconds: DEFAULT_TIMER_CONTROL_SETTINGS.indicatorSeconds,
      indicatorLabel: DEFAULT_TIMER_CONTROL_SETTINGS.indicatorLabel,
      overrunMode: false,
    });
    showToast({
      title: 'Schedule cleared',
      message: activeTimerUsesSets
        ? 'The saved schedule was cleared. The current run was left unchanged.'
        : 'The timer is ready for a new schedule.',
      variant: 'success',
    });
  }, [activeTimerUsesSets, sets.length, setTimerControlSettings, showModal, showToast]);

  const scheduleItems = activeTimerUsesSets ? timerState.sets : sets;
  const visibleScheduleTitle = activeTimerUsesSets
    ? (timerState.scheduleTitle || scheduleTitle)
    : scheduleTitle;

  const editableSchedule = React.useMemo(() => normalizeScheduleDocument({
    title: visibleScheduleTitle,
    eventStartTime: scheduleEventStartTime,
    idealEndTime: scheduleIdealEndTime,
    autoStartNext,
    notificationsEnabled: scheduleNotificationsEnabled,
    indicator: {
      enabled: indicatorEnabled,
      durationSeconds: indicatorSeconds,
      label: indicatorLabel,
    },
    items: scheduleItems,
  }), [
    autoStartNext,
    indicatorEnabled,
    indicatorLabel,
    indicatorSeconds,
    scheduleEventStartTime,
    scheduleIdealEndTime,
    scheduleNotificationsEnabled,
    scheduleItems,
    visibleScheduleTitle,
  ]);

  const handleApplySchedule = React.useCallback((scheduleInput) => {
    const schedule = normalizeScheduleDocument(scheduleInput);
    scheduleClearedDuringRunRef.current = false;
    if (schedule.notificationsEnabled && typeof window.Notification === 'function' && window.Notification.permission === 'default') {
      try { void window.Notification.requestPermission(); } catch { /* In-app alerts remain available. */ }
    }
    setTimerControlSettings({
      useSets: true,
      sets: schedule.items,
      scheduleTitle: schedule.title,
      scheduleEventStartTime: schedule.eventStartTime,
      scheduleIdealEndTime: schedule.idealEndTime,
      scheduleNotificationsEnabled: schedule.notificationsEnabled,
      autoStartNext: schedule.autoStartNext,
      indicatorEnabled: schedule.indicator.enabled,
      indicatorSeconds: schedule.indicator.durationSeconds,
      indicatorLabel: schedule.indicator.label,
      overrunMode: false,
    });

    const current = latestTimerStateRef.current;
    if (current.running || current.paused) {
      const activeId = current.sets?.[current.activeSetIndex]?.id;
      const nextActiveIndex = schedule.items.findIndex((item) => item.id === activeId);
      if (nextActiveIndex >= 0) {
        const activeItem = schedule.items[nextActiveIndex];
        const liveUpdates = {
          sets: schedule.items,
          activeSetIndex: nextActiveIndex,
          scheduleTitle: schedule.title,
          scheduleIdealEndAt: schedule.idealEndTime
            ? resolveScheduleTime(schedule.idealEndTime, current.scheduleStartedAt || Date.now())
            : null,
          scheduleNotificationsEnabled: schedule.notificationsEnabled,
          autoStartNext: schedule.autoStartNext,
          indicatorEnabled: schedule.indicator.enabled,
          indicatorDurationMs: secondsToMs(schedule.indicator.durationSeconds),
          indicatorLabel: schedule.indicator.label,
        };
        if (current.phase === 'timer') liveUpdates.label = activeItem.label;
        if (current.phase === 'indicator') liveUpdates.label = schedule.indicator.label;
        commitTimerState({ ...current, ...liveUpdates });
      } else {
        showToast({
          title: 'Schedule saved for the next run',
          message: 'The live item was removed, so the currently running schedule was left unchanged.',
          variant: 'warning',
        });
      }
    }

    showToast({
      title: 'Schedule ready',
      message: `${schedule.title} has ${schedule.items.length} ${schedule.items.length === 1 ? 'item' : 'items'}.`,
      variant: 'success',
    });
  }, [commitTimerState, setTimerControlSettings, showToast]);

  const handleOpenScheduleCreator = React.useCallback(() => {
    const isEditingSchedule = scheduleItems.length > 0;
    showModal({
      title: isEditingSchedule ? 'Edit Schedule' : 'Schedule Creator',
      headerDescription: isEditingSchedule ? 'Update this timer schedule.' : 'Create a timer schedule.',
      icon: <CalendarClock className="h-5 w-5" />,
      variant: 'info',
      size: 'lg',
      className: 'h-full',
      component: 'ScheduleCreator',
      customLayout: true,
      actions: [],
      initialSchedule: editableSchedule,
      isEditingSchedule,
      onApplySchedule: handleApplySchedule,
    });
  }, [editableSchedule, handleApplySchedule, scheduleItems.length, showModal]);

  const theme = {
    columnBorderClass: darkMode ? 'border-gray-800' : 'border-gray-200/80',
    dividerClass: darkMode ? 'border-gray-800' : 'border-gray-200/80',
    mutedText: darkMode ? 'text-gray-400' : 'text-gray-500',
    inputClass: darkMode
      ? 'bg-gray-700 border-gray-600 text-gray-100 text-xs md:text-xs'
      : 'bg-white border-gray-300 text-xs md:text-xs',
    selectTriggerClass: darkMode
      ? 'bg-gray-700 border-gray-600 text-gray-200 text-xs md:text-xs'
      : 'bg-white border-gray-300 text-xs md:text-xs',
    selectContentClass: darkMode
      ? 'bg-gray-700 border-gray-600 text-gray-200'
      : 'bg-white border-gray-300',
    outlineButtonClass: darkMode
      ? 'bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-700 hover:text-white'
      : '',
    headerIconButtonClass: 'text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300',
    subtleButtonClass: darkMode
      ? 'bg-gray-700 hover:bg-gray-600 text-gray-100 disabled:bg-gray-700 disabled:text-gray-500'
      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:text-gray-400',
    surfaceClass: darkMode
      ? 'border-gray-800 bg-gray-800/35'
      : 'border-gray-200 bg-white',
    getSwitchProps: (disabled = false) => getTimerToggleProps(darkMode, disabled),
  };

  return (
    <TimerControlLayout
      darkMode={darkMode}
      theme={theme}
      useSets={useSets}
      active={active}
      activeTimerUsesSets={activeTimerUsesSets}
      timerState={timerState}
      actions={actions}
      preview={<TimerPreview timerState={timerState} displaySettings={displaySettings} scheduleMode={useSets} scheduleItems={scheduleItems} />}
      canStartTimer={canStartTimer}
      handleStart={handleStart}
      handleStop={handleStop}
      handleControlViewChange={handleControlViewChange}
      handleOpenProjectOutput={handleOpenProjectOutput}
      handleOpenTimeDisplay={handleOpenTimeDisplay}
      handleOpenDisplaySettings={handleOpenDisplaySettings}
      handleOpenScheduleCreator={handleOpenScheduleCreator}
      handleClearSchedule={handleClearSchedule}
      handleTimingAlertsChange={handleTimingAlertsChange}
      mode={mode}
      durationMinutes={durationMinutes}
      targetTime={targetTime}
      targetHourFormat={targetHourFormat}
      warningSeconds={warningSeconds}
      criticalSeconds={criticalSeconds}
      overrunMode={overrunMode}
      scheduleItems={scheduleItems}
      hasSavedSchedule={sets.length > 0}
      visibleScheduleTitle={visibleScheduleTitle}
      scheduleIdealEndTime={scheduleIdealEndTime}
      scheduleProjection={scheduleProjection}
      autoStartNext={autoStartNext}
      indicatorEnabled={indicatorEnabled}
      indicatorSeconds={indicatorSeconds}
      indicatorLabel={indicatorLabel}
      scheduleNotificationsEnabled={scheduleNotificationsEnabled}
      displaySettings={displaySettings}
      setTimerControlSettings={setTimerControlSettings}
      applyTimerControlSettings={applyTimerControlSettings}
      applyTimerDisplaySettings={applyTimerDisplaySettings}
      applyTimerLabel={applyTimerLabel}
    />
  );
};

export default TimerControlModule;
