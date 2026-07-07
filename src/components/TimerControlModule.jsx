import React from 'react';
import { AppWindowMac, ChevronDown, MonitorUp, Pause, Play, Plus, SkipForward, Square, Timer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { ColorPicker } from '@/components/ui/color-picker';
import { PaintPicker } from '@/components/ui/paint-picker';
import { useControlSocket } from '../context/ControlSocketProvider';
import useModal from '../hooks/useModal';
import useSharedTimer from '../hooks/useSharedTimer';
import {
  DEFAULT_TIMER_CONTROL_SETTINGS,
  DEFAULT_TIMER_DISPLAY,
  MAX_TIMER_SETS,
  formatGlobalClock,
  getTimerDisplay,
  getTimerIntensity,
  getTimerProgress,
  minutesToMs,
  msToMinutesInput,
  secondsToMs,
  splitClockPeriod,
} from '../utils/timerUtils';
import { paintToCss } from '../utils/paint';
import { useDarkModeState, useTimerControlSettings, useTimerDisplaySettings } from '../hooks/useStoreSelectors';
import FontSelect from './FontSelect';

const QUICK_MINUTES = [1, 3, 5, 10, 15, 30];
const TARGET_PERIODS = ['AM', 'PM'];
const TARGET_12_HOUR_MIN = 1;
const TARGET_12_HOUR_MAX = 12;
const TARGET_24_HOUR_MIN = 0;
const TARGET_24_HOUR_MAX = 24;
const TARGET_MINUTE_MIN = 0;
const TARGET_MINUTE_MAX = 60;
const PERIOD_STYLE = {
  fontSize: '0.42em',
  marginLeft: '0.12em',
  verticalAlign: 'baseline',
  lineHeight: 1,
};

const createTimerSet = (index = 0) => ({
  id: `timer-set-${Date.now()}-${index}`,
  label: `Timer ${index + 1}`,
  durationMs: minutesToMs(5),
});

const toTargetTimeParts = (value, hourFormat = '12') => {
  if (!value) {
    return { hour: '', minute: '', period: '' };
  }
  const [rawHours, rawMinutes] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(rawHours) || !Number.isFinite(rawMinutes)) {
    return { hour: '', minute: '', period: '' };
  }
  const normalizedHours = ((rawHours % 24) + 24) % 24;
  return {
    hour: hourFormat === '24'
      ? String(normalizedHours).padStart(2, '0')
      : String(normalizedHours % 12 || 12),
    minute: String(rawMinutes).padStart(2, '0'),
    period: normalizedHours >= 12 ? 'PM' : 'AM',
  };
};

const getCurrentTargetTimeParts = (hourFormat = '12') => {
  const now = new Date();
  return {
    hour: hourFormat === '24'
      ? String(now.getHours()).padStart(2, '0')
      : String(now.getHours() % 12 || 12),
    minute: String(now.getMinutes()).padStart(2, '0'),
    period: now.getHours() >= 12 ? 'PM' : 'AM',
  };
};

const fromTargetTimeParts = ({ hour, minute, period }, hourFormat = '12') => {
  const hourNumber = Math.trunc(Number(hour));
  const minuteNumber = Math.trunc(Number(minute));
  if (!Number.isFinite(hourNumber)
    || !Number.isFinite(minuteNumber)
    || minuteNumber < TARGET_MINUTE_MIN
    || minuteNumber > TARGET_MINUTE_MAX) {
    return '';
  }

  const formatTotalMinutes = (totalMinutes) => {
    const normalizedTotalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    const normalizedHour = Math.floor(normalizedTotalMinutes / 60);
    const normalizedMinute = normalizedTotalMinutes % 60;
    return `${String(normalizedHour).padStart(2, '0')}:${String(normalizedMinute).padStart(2, '0')}`;
  };

  if (hourFormat === '24') {
    if (hourNumber < TARGET_24_HOUR_MIN || hourNumber > TARGET_24_HOUR_MAX) return '';
    return formatTotalMinutes((hourNumber * 60) + minuteNumber);
  }
  if (hourNumber < TARGET_12_HOUR_MIN || hourNumber > TARGET_12_HOUR_MAX) return '';
  if (!period) return '';
  const baseHour = period === 'PM' ? (hourNumber % 12) + 12 : hourNumber % 12;
  return formatTotalMinutes((baseHour * 60) + minuteNumber);
};

const formatTargetTimePreview = (value, hourFormat = '12') => {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '';
  const next = new Date();
  next.setHours(hours, minutes, 0, 0);
  const dayLabel = next.getTime() <= Date.now() ? 'Tomorrow' : 'Today';
  if (dayLabel === 'Tomorrow') {
    next.setDate(next.getDate() + 1);
  }
  return `${dayLabel} at ${next.toLocaleTimeString([], {
    hour: hourFormat === '24' ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: hourFormat !== '24',
  })}`;
};

const clampTargetPart = (value, min, max) => {
  if (value === '') return '';
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return '';
  return String(Math.min(max, Math.max(min, number)));
};

const TargetNumberInput = ({ value, onChange, min, max, placeholder, ariaLabel, disabled, inputClass }) => (
  <Input
    type="number"
    min={min}
    max={max}
    step="1"
    inputMode="numeric"
    value={value}
    onChange={(event) => onChange(clampTargetPart(event.target.value, min, max))}
    placeholder={placeholder}
    aria-label={ariaLabel}
    disabled={disabled}
    className={`${inputClass} text-center tabular-nums`}
  />
);

const TargetTimePicker = ({ value, onChange, disabled, inputClass, selectTriggerClass, mutedText, darkMode, hourFormat, onHourFormatChange }) => {
  const parts = React.useMemo(() => toTargetTimeParts(value, hourFormat), [hourFormat, value]);
  const preview = React.useMemo(() => formatTargetTimePreview(value, hourFormat), [hourFormat, value]);
  const selectContentClass = darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300';
  const hourMin = hourFormat === '24' ? TARGET_24_HOUR_MIN : TARGET_12_HOUR_MIN;
  const hourMax = hourFormat === '24' ? TARGET_24_HOUR_MAX : TARGET_12_HOUR_MAX;

  const updatePart = (part, partValue) => {
    if (partValue === '') {
      onChange('');
      return;
    }

    const fallback = getCurrentTargetTimeParts(hourFormat);
    const nextParts = {
      hour: parts.hour || fallback.hour,
      minute: parts.minute || '00',
      period: parts.period || fallback.period,
      [part]: partValue,
    };
    onChange(fromTargetTimeParts(nextParts, hourFormat));
  };

  return (
    <div className="space-y-2">
      <Select value={hourFormat} onValueChange={onHourFormatChange} disabled={disabled}>
        <SelectTrigger className={selectTriggerClass}>
          <SelectValue placeholder="Time format" />
        </SelectTrigger>
        <SelectContent className={selectContentClass}>
          <SelectItem value="12">12-hour time</SelectItem>
          <SelectItem value="24">24-hour time</SelectItem>
        </SelectContent>
      </Select>
      <div className={`grid gap-2 ${hourFormat === '24' ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[1fr_1fr_1fr]'}`}>
        <TargetNumberInput
          value={parts.hour}
          onChange={(nextHour) => updatePart('hour', nextHour)}
          min={hourMin}
          max={hourMax}
          placeholder="HH"
          ariaLabel="Target hour"
          disabled={disabled}
          inputClass={inputClass}
        />
        <TargetNumberInput
          value={parts.minute}
          onChange={(nextMinute) => updatePart('minute', nextMinute)}
          min={TARGET_MINUTE_MIN}
          max={TARGET_MINUTE_MAX}
          placeholder="MM"
          ariaLabel="Target minute"
          disabled={disabled}
          inputClass={inputClass}
        />
        {hourFormat === '12' && (
          <Select value={parts.period || undefined} onValueChange={(nextPeriod) => updatePart('period', nextPeriod)} disabled={disabled}>
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder="AM" />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              {TARGET_PERIODS.map((period) => (
                <SelectItem key={period} value={period}>{period}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <span className={`text-xs ${mutedText}`}>{preview}</span>
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            className={`text-xs font-medium transition-colors ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
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

const isTimerShortcutEditableTarget = (target) => {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest([
    'input',
    'textarea',
    'select',
    'button',
    'a[href]',
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="checkbox"]',
    '[role="combobox"]',
    '[role="menuitem"]',
    '[role="option"]',
    '[role="slider"]',
    '[role="spinbutton"]',
    '[role="switch"]',
    '[role="textbox"]',
  ].join(',')));
};

const TimerPreview = React.memo(({ timerState, displaySettings }) => {
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

  return (
    <>
      <div
        className="rounded-lg min-h-[255px] flex flex-col items-center justify-center px-6"
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

      {showSecondaryText && displaySettings.showGlobalClock && (
        <div
          className="mt-3 w-full rounded-lg border px-6 py-4 flex items-center justify-between"
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
    </>
  );
});

TimerPreview.displayName = 'TimerPreview';

const TimerControlModule = () => {
  const { emitStageTimerUpdate } = useControlSocket();
  const { showModal } = useModal();
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
  const styleControlsRef = React.useRef(null);
  const globalTimeFormatRef = React.useRef(null);
  const [styleControlsExpanded, setStyleControlsExpanded] = React.useState(false);
  const [globalTimeFormatExpanded, setGlobalTimeFormatExpanded] = React.useState(false);
  const controlSettings = timerControlSettings || DEFAULT_TIMER_CONTROL_SETTINGS;

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
  } = controlSettings;
  const maxTimerSetsReached = sets.length >= MAX_TIMER_SETS;

  const setTimerControlSettings = React.useCallback((partial) => {
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

  const active = timerState.running || timerState.paused;
  const activeTimerUsesSets = active && Array.isArray(timerState.sets) && timerState.sets.length > 0;
  const setRuntimeOptionsEnabled = useSets || activeTimerUsesSets;
  const showSecondaryText = displaySettings.showSecondaryText !== false;

  React.useEffect(() => {
    latestTimerStateRef.current = timerState;
  }, [timerState]);

  const scrollSectionIntoView = React.useCallback((sectionRef) => {
    window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  }, []);

  const toggleStyleControls = React.useCallback(() => {
    if (!styleControlsExpanded) scrollSectionIntoView(styleControlsRef);
    setStyleControlsExpanded((expanded) => !expanded);
  }, [scrollSectionIntoView, styleControlsExpanded]);

  const toggleGlobalTimeFormat = React.useCallback(() => {
    if (!globalTimeFormatExpanded) scrollSectionIntoView(globalTimeFormatRef);
    setGlobalTimeFormatExpanded((expanded) => !expanded);
  }, [globalTimeFormatExpanded, scrollSectionIntoView]);

  const applyTimerDisplaySettings = React.useCallback((partial) => {
    const displayUpdatedAt = Date.now();
    const normalizedPartial = { ...partial, displayUpdatedAt };
    if (Object.prototype.hasOwnProperty.call(normalizedPartial, 'otherItemsScale')) {
      normalizedPartial.globalClockScale = normalizedPartial.otherItemsScale;
    }
    const nextDisplay = {
      ...displaySettings,
      ...normalizedPartial,
    };
    updateTimerDisplaySettings(normalizedPartial);
    commitTimerState({
      ...latestTimerStateRef.current,
      display: nextDisplay,
    });
  }, [commitTimerState, displaySettings, updateTimerDisplaySettings]);

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

  const canStartTimer = !active && (mode !== 'target' || Boolean(targetTime));

  const handleStart = React.useCallback(() => {
    const display = buildDisplay();
    if (useSets) {
      actions.startTimerSet({
        sets,
        warningMs: secondsToMs(warningSeconds),
        criticalMs: secondsToMs(criticalSeconds),
        overrunMode,
        autoStartNext,
        indicatorEnabled,
        indicatorDurationMs: secondsToMs(indicatorSeconds),
        indicatorLabel,
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
    sets,
    useSets,
    warningSeconds,
  ]);

  const toggleTimerPlayback = React.useCallback(() => {
    if (timerState.running) {
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
  }, [actions, canStartTimer, handleStart, timerState.paused, timerState.running]);

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== ' ' && event.code !== 'Space') return;
      if (isTimerShortcutEditableTarget(event.target)) return;

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

  const updateSet = (id, updates) => {
    const nextSets = sets.map((set) => (set.id === id ? { ...set, ...updates } : set));
    setTimerControlSettings({ sets: nextSets });

    const current = latestTimerStateRef.current;
    const isActive = current.running || current.paused;
    if (!isActive || !Array.isArray(current.sets) || current.sets.length === 0) return;

    const runtimeSetIndex = current.sets.findIndex((set) => set.id === id);
    if (runtimeSetIndex === -1) return;

    const runtimeUpdates = {};
    if (Object.prototype.hasOwnProperty.call(updates, 'label')) {
      runtimeUpdates.label = updates.label;
    }
    if (
      Object.prototype.hasOwnProperty.call(updates, 'durationMs')
      && runtimeSetIndex > current.activeSetIndex
    ) {
      runtimeUpdates.durationMs = updates.durationMs;
    }
    if (Object.keys(runtimeUpdates).length === 0) return;

    const nextRuntimeSets = current.sets.map((set, index) => (
      index === runtimeSetIndex ? { ...set, ...runtimeUpdates } : set
    ));
    const activeSet = nextRuntimeSets[current.activeSetIndex];
    const liveUpdates = { sets: nextRuntimeSets };
    if (current.phase === 'timer' && activeSet?.id === id && Object.prototype.hasOwnProperty.call(runtimeUpdates, 'label')) {
      liveUpdates.label = runtimeUpdates.label;
    }

    commitTimerState({
      ...current,
      ...liveUpdates,
    });
  };

  const addSet = () => {
    if (maxTimerSetsReached) return;
    setTimerControlSettings({
      sets: [...sets, createTimerSet(sets.length)],
    });
  };

  const removeSet = (id) => {
    setTimerControlSettings({
      sets: sets.length <= 1 ? sets : sets.filter((set) => set.id !== id),
    });
  };

  const panelClass = darkMode ? 'text-gray-100' : 'text-gray-900';
  const columnBorderClass = darkMode ? 'border-gray-800' : 'border-gray-200/80';
  const dividerClass = darkMode ? 'border-gray-800' : 'border-gray-200/80';
  const mutedText = darkMode ? 'text-gray-400' : 'text-gray-500';
  const inputClass = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-100 text-xs md:text-xs'
    : 'bg-white border-gray-300 text-xs md:text-xs';
  const selectTriggerClass = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-200 text-xs md:text-xs'
    : 'bg-white border-gray-300 text-xs md:text-xs';
  const selectContentClass = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-200'
    : 'bg-white border-gray-300';
  const outlineButtonClass = darkMode
    ? 'bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-700 hover:text-white'
    : '';
  const headerIconButtonClass = 'text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300';
  const subtleButtonClass = darkMode
    ? 'bg-gray-700 hover:bg-gray-600 text-gray-100 disabled:bg-gray-700 disabled:text-gray-500'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:text-gray-400';
  const sectionToggleClass = darkMode
    ? 'text-gray-100 hover:bg-gray-800/70'
    : 'text-gray-900 hover:bg-gray-100';
  const switchBaseClasses = `!h-8 !w-16 !border-0 shadow-sm transition-colors ${darkMode
    ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
    : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
    }`;
  const switchThumbClass = '!h-6 !w-7 data-[state=checked]:!translate-x-8 data-[state=unchecked]:!translate-x-1';
  const getSwitchProps = (disabled = false) => ({
    className: `${switchBaseClasses} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`,
    thumbClassName: switchThumbClass,
  });

  return (
    <div
      className={`h-full overflow-y-auto ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-[#f8fafc] text-gray-900'}`}
      style={{ scrollbarGutter: 'stable' }}
    >
      <div className="min-h-full p-5 space-y-5">
        <div className={`flex items-center justify-between border-b pb-4 ${dividerClass}`}>
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5" />
            <h1 className="text-lg font-semibold">Timer Control</h1>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content="Project time display to this monitor or an external display" side="bottom">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={headerIconButtonClass}
                onClick={handleOpenProjectOutput}
                aria-label="Project Time Display"
              >
                <MonitorUp className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Open time display window" side="bottom">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={headerIconButtonClass}
                onClick={handleOpenTimeDisplay}
                aria-label="Open Time Display"
              >
                <AppWindowMac className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="grid justify-center grid-cols-[minmax(240px,280px)_minmax(0,640px)_minmax(240px,280px)] gap-5">
          <section className={`min-w-0 space-y-4 lg:border-r lg:pr-5 ${columnBorderClass} ${panelClass}`}>
            <div>
              <h2 className="text-xs font-semibold">Timer Setup</h2>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Mode</label>
              <Select value={mode} onValueChange={(value) => setTimerControlSettings({ mode: value })} disabled={useSets}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="countdown">Countdown</SelectItem>
                  <SelectItem value="countup">Count up</SelectItem>
                  <SelectItem value="target">Until time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!useSets && mode !== 'target' && mode !== 'countup' && (
              <div className="space-y-2">
                <label className="text-xs font-medium">Duration</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={durationMinutes}
                    onChange={(event) => setTimerControlSettings({ durationMinutes: event.target.value })}
                    className={inputClass}
                  />
                  <span className={`self-center text-xs ${mutedText}`}>minutes</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_MINUTES.map((minutes) => (
                    <button
                      key={minutes}
                      onClick={() => setTimerControlSettings({ durationMinutes: minutes })}
                      className={`h-8 rounded text-xs font-medium transition-colors disabled:opacity-50 ${subtleButtonClass}`}
                    >
                      {minutes}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!useSets && mode === 'target' && (
              <div className="space-y-2">
                <label className="text-xs font-medium">Target Time</label>
                <TargetTimePicker
                  value={targetTime}
                  onChange={(value) => setTimerControlSettings({ targetTime: value })}
                  disabled={false}
                  inputClass={inputClass}
                  selectTriggerClass={selectTriggerClass}
                  mutedText={mutedText}
                  darkMode={darkMode}
                  hourFormat={targetHourFormat}
                  onHourFormatChange={(value) => setTimerControlSettings({ targetHourFormat: value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium">Display Label</label>
              <Input
                value={displaySettings.label || ''}
                onChange={(event) => applyTimerLabel(event.target.value)}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">Warn At</label>
                <Input type="number" min="0" value={warningSeconds} onChange={(event) => applyTimerControlSettings({ warningSeconds: event.target.value })} className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Critical At</label>
                <Input type="number" min="0" value={criticalSeconds} onChange={(event) => applyTimerControlSettings({ criticalSeconds: event.target.value })} className={inputClass} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs">Continue as overrun</span>
              <Switch checked={overrunMode} onCheckedChange={(checked) => applyTimerControlSettings({ overrunMode: checked })} {...getSwitchProps(false)} />
            </div>

          </section>

          <section className={`min-w-0 flex flex-col ${panelClass}`}>
            <TimerPreview timerState={timerState} displaySettings={displaySettings} />

            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {!timerState.running ? (
                  <Button onClick={handleStart} disabled={active || (mode === 'target' && !targetTime)} className="w-full bg-green-600 hover:bg-green-700 text-white">
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </Button>
                ) : timerState.paused ? (
                  <Button onClick={actions.resumeTimer} className="w-full bg-green-600 hover:bg-green-700 text-white">
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </Button>
                ) : (
                  <Button onClick={actions.pauseTimer} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </Button>
                )}
                <Button variant="destructive" onClick={actions.stopTimer} disabled={!active} className="w-full">
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Button variant="outline" className={outlineButtonClass} onClick={() => actions.addTime(-60000)} disabled={!active || timerState.mode === 'countup'}>-1m</Button>
                <Button variant="outline" className={outlineButtonClass} onClick={() => actions.addTime(60000)} disabled={!active || timerState.mode === 'countup'}>+1m</Button>
                <Button variant="outline" className={outlineButtonClass} onClick={() => actions.addTime(300000)} disabled={!active || timerState.mode === 'countup'}>+5m</Button>
                <Button variant="outline" className={outlineButtonClass} onClick={actions.skipToNextSet} disabled={!active || !timerState.sets?.[timerState.activeSetIndex + 1]}>
                  <SkipForward className="w-4 h-4 mr-2" />
                  Skip
                </Button>
              </div>
            </div>

            <section ref={styleControlsRef} className={`mt-5 border-t pt-3 ${dividerClass}`}>
              <button
                type="button"
                onClick={toggleStyleControls}
                className={`flex w-full items-center justify-between rounded px-2 py-3 text-left transition-colors ${sectionToggleClass}`}
                aria-expanded={styleControlsExpanded}
                aria-controls="timer-style-controls"
              >
                <span className="text-xs font-semibold">Styling</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${styleControlsExpanded ? 'rotate-180' : ''}`} />
              </button>

              {styleControlsExpanded && (
                <div id="timer-style-controls" className="mt-3 space-y-4">
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-2 min-w-0">
                        <label className="block text-xs font-medium truncate">Timer</label>
                        <ColorPicker
                          value={displaySettings.textColor}
                          onChange={(value) => applyTimerDisplaySettings({ textColor: value })}
                          darkMode={darkMode}
                          showHex
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-2 min-w-0">
                        <label className="block text-xs font-medium truncate">Label/accent</label>
                        <ColorPicker
                          value={displaySettings.accentColor}
                          onChange={(value) => applyTimerDisplaySettings({ accentColor: value })}
                          darkMode={darkMode}
                          showHex
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-2 min-w-0">
                        <label className="block text-xs font-medium truncate">Background</label>
                        <PaintPicker
                          value={displaySettings.backgroundPaint}
                          fallbackColor={displaySettings.backgroundColor || '#000000'}
                          onChange={(value) => applyTimerDisplaySettings({
                            backgroundPaint: value,
                            ...(value?.type === 'solid' ? { backgroundColor: value.color } : {}),
                          })}
                          darkMode={darkMode}
                          showValue
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2 min-w-0">
                      <label className="block text-xs font-medium truncate">Timer Font</label>
                      <FontSelect
                        value={displaySettings.timerFontFamily}
                        onChange={(value) => applyTimerDisplaySettings({ timerFontFamily: value })}
                        darkMode={darkMode}
                        containerClassName="relative w-full min-w-0"
                        triggerClassName={`w-full min-w-0 ${inputClass}`}
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <label className="block text-xs font-medium truncate">Secondary text font</label>
                      <FontSelect
                        value={displaySettings.fontFamily}
                        onChange={(value) => applyTimerDisplaySettings({ fontFamily: value })}
                        darkMode={darkMode}
                        containerClassName="relative w-full min-w-0"
                        triggerClassName={`w-full min-w-0 ${inputClass}`}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Size</label>
                      <Select
                        value={displaySettings.timerFontSizeMode}
                        onValueChange={(value) => applyTimerDisplaySettings({ timerFontSizeMode: value })}
                      >
                        <SelectTrigger className={selectTriggerClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          <SelectItem value="auto">Auto-fit width</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Manual px</label>
                      <Input
                        type="number"
                        min="48"
                        max="420"
                        disabled={displaySettings.timerFontSizeMode !== 'manual'}
                        value={displaySettings.timerFontSize}
                        onChange={(event) => applyTimerDisplaySettings({ timerFontSize: event.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Alignment</label>
                      <Select
                        value={displaySettings.timerAlign}
                        onValueChange={(value) => applyTimerDisplaySettings({ timerAlign: value })}
                      >
                        <SelectTrigger className={selectTriggerClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Secondary text scale</label>
                      <Input
                        type="number"
                        min="0.08"
                        max="2"
                        step="0.01"
                        value={displaySettings.otherItemsScale}
                        onChange={(event) => applyTimerDisplaySettings({ otherItemsScale: event.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => applyTimerDisplaySettings({ timerBold: !displaySettings.timerBold })} className={`h-9 rounded text-xs font-bold transition-colors ${displaySettings.timerBold ? 'bg-blue-600 text-white' : subtleButtonClass}`}>B</button>
                    <button type="button" onClick={() => applyTimerDisplaySettings({ timerItalic: !displaySettings.timerItalic })} className={`h-9 rounded text-xs italic transition-colors ${displaySettings.timerItalic ? 'bg-blue-600 text-white' : subtleButtonClass}`}>I</button>
                    <button type="button" onClick={() => applyTimerDisplaySettings({ timerUnderline: !displaySettings.timerUnderline })} className={`h-9 rounded text-xs underline transition-colors ${displaySettings.timerUnderline ? 'bg-blue-600 text-white' : subtleButtonClass}`}>U</button>
                  </div>
                </div>
              )}
            </section>
          </section>

          <section className={`min-w-0 space-y-5 lg:border-l lg:pl-5 ${columnBorderClass} ${panelClass}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold">Timer Sets</h2>
                <p className={`text-xs ${mutedText}`}>Run multiple timers in sequence.</p>
              </div>
              <Switch checked={useSets} onCheckedChange={(checked) => setTimerControlSettings({ useSets: checked })} {...getSwitchProps(false)} />
            </div>

            {useSets && (
              <div className="space-y-2">
                {sets.map((set, index) => (
                  <div key={set.id} className={`rounded-md p-2 space-y-2 ${darkMode ? 'bg-gray-900/35' : 'bg-white/65'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs w-5 ${mutedText}`}>{index + 1}</span>
                      <Input value={set.label} onChange={(event) => updateSet(set.id, { label: event.target.value })} className={inputClass} />
                      <button disabled={sets.length <= 1} onClick={() => removeSet(set.id)} className={`p-2 rounded ${darkMode ? 'hover:bg-gray-700 disabled:opacity-40' : 'hover:bg-gray-200 disabled:opacity-40'}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 pl-7">
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={msToMinutesInput(set.durationMs)}
                        onChange={(event) => updateSet(set.id, { durationMs: minutesToMs(event.target.value) })}
                        className={inputClass}
                      />
                      <span className={`text-xs ${mutedText}`}>minutes</span>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className={outlineButtonClass} onClick={addSet} disabled={maxTimerSetsReached}>
                  <Plus className="w-4 h-4 mr-2" />
                  {maxTimerSetsReached ? `Max ${MAX_TIMER_SETS} Timers` : 'Add Timer'}
                </Button>
              </div>
            )}

            <div className={`space-y-3 pt-4 border-t ${dividerClass}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs">Auto-start next</span>
                <Switch checked={autoStartNext} onCheckedChange={(checked) => applyTimerControlSettings({ autoStartNext: checked })} disabled={!setRuntimeOptionsEnabled} {...getSwitchProps(!setRuntimeOptionsEnabled)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Indicator period</span>
                <Switch checked={indicatorEnabled} onCheckedChange={(checked) => applyTimerControlSettings({ indicatorEnabled: checked })} disabled={!setRuntimeOptionsEnabled} {...getSwitchProps(!setRuntimeOptionsEnabled)} />
              </div>
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <Input disabled={!setRuntimeOptionsEnabled || !indicatorEnabled} value={indicatorLabel} onChange={(event) => applyTimerControlSettings({ indicatorLabel: event.target.value })} className={inputClass} />
                <Input type="number" min="0" disabled={!setRuntimeOptionsEnabled || !indicatorEnabled} value={indicatorSeconds} onChange={(event) => applyTimerControlSettings({ indicatorSeconds: event.target.value })} className={inputClass} />
              </div>
            </div>

            <div className={`space-y-3 pt-4 border-t ${dividerClass}`}>
              <h2 className="text-xs font-semibold">Display</h2>
              <div className="space-y-2">
                <label className="text-xs font-medium">Format</label>
                <Select
                  value={displaySettings.format}
                  onValueChange={(value) => applyTimerDisplaySettings({ format: value })}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value="auto">M:SS / H:MM:SS</SelectItem>
                    <SelectItem value="mmss">MM:SS</SelectItem>
                    <SelectItem value="hhmmss">H:MM:SS</SelectItem>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="verbose">Verbose</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Progress bar</span>
                <Switch checked={displaySettings.showProgress} onCheckedChange={(checked) => applyTimerDisplaySettings({ showProgress: checked })} {...getSwitchProps(false)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Secondary text</span>
                <Switch checked={showSecondaryText} onCheckedChange={(checked) => applyTimerDisplaySettings({ showSecondaryText: checked })} {...getSwitchProps(false)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Show global time</span>
                <Switch
                  checked={displaySettings.showGlobalClock}
                  onCheckedChange={(checked) => applyTimerDisplaySettings({ showGlobalClock: checked })}
                  disabled={!showSecondaryText}
                  {...getSwitchProps(!showSecondaryText)}
                />
              </div>
              <section ref={globalTimeFormatRef} className={`border-t pt-2 ${dividerClass}`}>
                <button
                  type="button"
                  onClick={toggleGlobalTimeFormat}
                  className={`flex w-full items-center justify-between rounded px-2 py-3 text-left transition-colors ${sectionToggleClass}`}
                  aria-expanded={globalTimeFormatExpanded}
                  aria-controls="global-time-format-controls"
                >
                  <span className="text-xs font-medium">Global Time Format</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${globalTimeFormatExpanded ? 'rotate-180' : ''}`} />
                </button>

                {globalTimeFormatExpanded && (
                  <div id="global-time-format-controls" className="mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">12-hour clock</span>
                      <Switch checked={displaySettings.clockHour12} onCheckedChange={(checked) => applyTimerDisplaySettings({ clockHour12: checked })} {...getSwitchProps(false)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Show seconds</span>
                      <Switch checked={displaySettings.clockShowSeconds} onCheckedChange={(checked) => applyTimerDisplaySettings({ clockShowSeconds: checked })} {...getSwitchProps(false)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Show AM/PM</span>
                      <Switch
                        checked={displaySettings.clockShowPeriod}
                        onCheckedChange={(checked) => applyTimerDisplaySettings({ clockShowPeriod: checked })}
                        disabled={!displaySettings.clockHour12}
                        {...getSwitchProps(!displaySettings.clockHour12)}
                      />
                    </div>
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TimerControlModule;
