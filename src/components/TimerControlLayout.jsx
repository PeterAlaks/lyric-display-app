import React from 'react';
import {
  AppWindowMac,
  CalendarClock,
  MonitorUp,
  Pause,
  PencilLine,
  Play,
  Plus,
  Settings2,
  SkipForward,
  Square,
  Timer,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { ColorPicker } from '@/components/ui/color-picker';
import { PaintPicker } from '@/components/ui/paint-picker';
import { TimePicker } from '@/components/ui/time-picker';
import FontSelect from './FontSelect';
import { isTimedScheduleItem } from '../../shared/scheduleUtils.js';

const QUICK_MINUTES = [1, 3, 5, 10, 15, 30];

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

const TimerControlLayout = ({
  darkMode,
  theme,
  useSets,
  active,
  activeTimerUsesSets,
  timerState,
  actions,
  preview,
  canStartTimer,
  handleStart,
  handleStop,
  handleControlViewChange,
  handleOpenProjectOutput,
  handleOpenTimeDisplay,
  handleOpenDisplaySettings,
  handleOpenScheduleCreator,
  handleClearSchedule,
  handleTimingAlertsChange,
  mode,
  durationMinutes,
  targetTime,
  targetHourFormat,
  warningSeconds,
  criticalSeconds,
  overrunMode,
  scheduleItems,
  hasSavedSchedule,
  visibleScheduleTitle,
  scheduleIdealEndTime,
  scheduleProjection,
  autoStartNext,
  indicatorEnabled,
  indicatorSeconds,
  indicatorLabel,
  scheduleNotificationsEnabled,
  displaySettings,
  setTimerControlSettings,
  applyTimerControlSettings,
  applyTimerDisplaySettings,
  applyTimerLabel,
}) => {
  const {
    columnBorderClass,
    dividerClass,
    mutedText,
    inputClass,
    selectTriggerClass,
    selectContentClass,
    outlineButtonClass,
    headerIconButtonClass,
    subtleButtonClass,
    surfaceClass,
    getSwitchProps,
  } = theme;

  return (
    <div
      className={`h-full overflow-y-auto ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-[#f8fafc] text-gray-900'}`}
      style={{ scrollbarGutter: 'stable' }}
    >
      <div className="mx-auto min-h-full max-w-[1240px] space-y-5 p-5">
        <header className={`grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b pb-4 ${dividerClass}`}>
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Timer Control</h1>
          </div>

          <div
            className={`relative grid grid-cols-2 items-center rounded-full border p-1 ${darkMode ? 'border-gray-700 bg-gray-950/60' : 'border-gray-200 bg-gray-100/80'}`}
            role="tablist"
            aria-label="Timer control mode"
          >
            <span
              aria-hidden="true"
              className={`absolute bottom-1 left-1 top-1 w-[calc(50%_-_0.25rem)] rounded-full shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${darkMode ? 'bg-gray-700' : 'bg-white'}`}
              style={{ transform: useSets ? 'translateX(100%)' : 'translateX(0)' }}
            />
            {[
              { value: 'manual', label: 'Manual' },
              { value: 'schedule', label: 'Schedule' },
            ].map((view) => {
              const selected = (useSets ? 'schedule' : 'manual') === view.value;
              return (
                <button
                  key={view.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => handleControlViewChange(view.value)}
                  className={`relative z-10 min-w-24 rounded-full px-4 py-1.5 text-xs font-medium transition-colors duration-200 ${selected
                    ? (darkMode ? 'text-white' : 'text-gray-950')
                    : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800')}`}
                >
                  <span className="inline-flex items-center gap-2">
                    {view.label}
                    {view.value === 'schedule' && activeTimerUsesSets && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Schedule running" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-1">
            <Tooltip content="Project time display to this monitor or an external display" side="bottom">
              <Button type="button" variant="ghost" size="icon" className={headerIconButtonClass} onClick={handleOpenProjectOutput} aria-label="Project Time Display">
                <MonitorUp className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Open time display window" side="bottom">
              <Button type="button" variant="ghost" size="icon" className={headerIconButtonClass} onClick={handleOpenTimeDisplay} aria-label="Open Time Display">
                <AppWindowMac className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Timer display settings" side="bottom">
              <Button type="button" variant="ghost" size="icon" className={headerIconButtonClass} onClick={handleOpenDisplaySettings} aria-label="Timer display settings">
                <Settings2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        </header>

        <main className="grid grid-cols-[minmax(280px,320px)_minmax(380px,1fr)_minmax(260px,300px)] items-stretch gap-5">
          <section className={`min-w-0 self-stretch space-y-4 border-r pr-5 ${columnBorderClass}`}>
            {!useSets ? (
              <ManualControls
                darkMode={darkMode}
                theme={theme}
                mode={mode}
                durationMinutes={durationMinutes}
                targetTime={targetTime}
                targetHourFormat={targetHourFormat}
                warningSeconds={warningSeconds}
                criticalSeconds={criticalSeconds}
                overrunMode={overrunMode}
                displaySettings={displaySettings}
                setTimerControlSettings={setTimerControlSettings}
                applyTimerControlSettings={applyTimerControlSettings}
                applyTimerLabel={applyTimerLabel}
              />
            ) : (
              <ScheduleControls
                darkMode={darkMode}
                theme={theme}
                activeTimerUsesSets={activeTimerUsesSets}
                scheduleItems={scheduleItems}
                hasSavedSchedule={hasSavedSchedule}
                visibleScheduleTitle={visibleScheduleTitle}
                scheduleIdealEndTime={scheduleIdealEndTime}
                scheduleProjection={scheduleProjection}
                targetHourFormat={targetHourFormat}
                autoStartNext={autoStartNext}
                indicatorEnabled={indicatorEnabled}
                indicatorSeconds={indicatorSeconds}
                indicatorLabel={indicatorLabel}
                scheduleNotificationsEnabled={scheduleNotificationsEnabled}
                warningSeconds={warningSeconds}
                criticalSeconds={criticalSeconds}
                handleOpenScheduleCreator={handleOpenScheduleCreator}
                handleClearSchedule={handleClearSchedule}
                handleTimingAlertsChange={handleTimingAlertsChange}
                setTimerControlSettings={setTimerControlSettings}
                applyTimerControlSettings={applyTimerControlSettings}
              />
            )}
          </section>

          <section className="min-w-0">
            {preview}
            <TimerTransport
              useSets={useSets}
              active={active}
              activeTimerUsesSets={activeTimerUsesSets}
              timerState={timerState}
              actions={actions}
              canStartTimer={canStartTimer}
              handleStart={handleStart}
              handleStop={handleStop}
              outlineButtonClass={outlineButtonClass}
            />
          </section>

          <StylingControls
            darkMode={darkMode}
            theme={theme}
            displaySettings={displaySettings}
            applyTimerDisplaySettings={applyTimerDisplaySettings}
          />
        </main>
      </div>
    </div>
  );
};

const ManualControls = ({
  darkMode,
  theme,
  mode,
  durationMinutes,
  targetTime,
  targetHourFormat,
  warningSeconds,
  criticalSeconds,
  overrunMode,
  displaySettings,
  setTimerControlSettings,
  applyTimerControlSettings,
  applyTimerLabel,
}) => {
  const { mutedText, inputClass, selectTriggerClass, selectContentClass, subtleButtonClass, surfaceClass, getSwitchProps } = theme;
  return (
    <>
      <div>
        <h2 className="text-sm font-semibold">Manual timer</h2>
        <p className={`mt-1 text-[11px] ${mutedText}`}>Set up a one-off countdown, count up, or target time.</p>
      </div>
      <div className={`space-y-4 rounded-xl border p-3 ${surfaceClass}`}>
        <div className="space-y-2">
          <label className="text-xs font-medium">Timer mode</label>
          <Select value={mode} onValueChange={(value) => setTimerControlSettings({ mode: value })}>
            <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem value="countdown">Countdown</SelectItem>
              <SelectItem value="countup">Count up</SelectItem>
              <SelectItem value="target">Until time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode !== 'target' && mode !== 'countup' && (
          <div className="space-y-2">
            <label className="text-xs font-medium">Duration</label>
            <div className="flex gap-2">
              <Input type="number" min="0" step="0.5" value={durationMinutes} onChange={(event) => setTimerControlSettings({ durationMinutes: event.target.value })} className={inputClass} />
              <span className={`self-center text-xs ${mutedText}`}>minutes</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_MINUTES.map((minutes) => (
                <button key={minutes} type="button" onClick={() => setTimerControlSettings({ durationMinutes: minutes })} className={`h-8 rounded text-[11px] font-medium transition-colors ${subtleButtonClass}`}>
                  {minutes}m
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === 'target' && (
          <div className="space-y-2">
            <label className="text-xs font-medium">Target time</label>
            <TimePicker
              value={targetTime}
              onChange={(value) => setTimerControlSettings({ targetTime: value })}
              darkMode={darkMode}
              hourFormat={targetHourFormat}
              onHourFormatChange={(value) => setTimerControlSettings({ targetHourFormat: value })}
              ariaLabel="Target time"
              placeholder="Select target time"
              relativePreview
            />
          </div>
        )}
        <div className="space-y-2">
          <label className="text-xs font-medium">Display label</label>
          <Input value={displaySettings.label || ''} onChange={(event) => applyTimerLabel(event.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-2"><span className="text-xs font-medium">Warn at</span><Input type="number" min="0" value={warningSeconds} onChange={(event) => applyTimerControlSettings({ warningSeconds: event.target.value })} className={inputClass} /></label>
          <label className="space-y-2"><span className="text-xs font-medium">Critical at</span><Input type="number" min="0" value={criticalSeconds} onChange={(event) => applyTimerControlSettings({ criticalSeconds: event.target.value })} className={inputClass} /></label>
        </div>
        <div className={`flex items-center justify-between border-t pt-3 ${theme.dividerClass}`}>
          <div>
            <p className="text-xs font-medium">Continue as overrun</p>
            <p className={`mt-0.5 text-[10px] ${mutedText}`}>Count beyond zero instead of ending.</p>
          </div>
          <Switch checked={overrunMode} onCheckedChange={(checked) => applyTimerControlSettings({ overrunMode: checked })} {...getSwitchProps(false)} />
        </div>
      </div>
    </>
  );
};

const ScheduleControls = ({
  darkMode,
  theme,
  activeTimerUsesSets,
  scheduleItems,
  hasSavedSchedule,
  visibleScheduleTitle,
  scheduleIdealEndTime,
  scheduleProjection,
  targetHourFormat,
  autoStartNext,
  indicatorEnabled,
  indicatorSeconds,
  indicatorLabel,
  scheduleNotificationsEnabled,
  warningSeconds,
  criticalSeconds,
  handleOpenScheduleCreator,
  handleClearSchedule,
  handleTimingAlertsChange,
  setTimerControlSettings,
  applyTimerControlSettings,
}) => {
  const { mutedText, inputClass, outlineButtonClass, surfaceClass, getSwitchProps } = theme;
  const timedCount = scheduleItems.filter(isTimedScheduleItem).length;
  const scheduleControlsDisabled = scheduleItems.length === 0;
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0 text-blue-500" />
            <h2 className="truncate text-sm font-semibold">{visibleScheduleTitle || 'Service Schedule'}</h2>
          </div>
          <p className={`mt-1 text-[11px] ${mutedText}`}>{scheduleItems.length} {scheduleItems.length === 1 ? 'item' : 'items'} / {timedCount} timed</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${activeTimerUsesSets
          ? (darkMode ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700')
          : (darkMode ? 'bg-blue-400/10 text-blue-300' : 'bg-blue-50 text-blue-700')}`}>
          {activeTimerUsesSets ? 'Running' : (hasSavedSchedule ? 'Ready' : 'Empty')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className={`min-w-0 flex-1 text-[11px] ${outlineButtonClass}`} onClick={handleOpenScheduleCreator}>
          {scheduleItems.length > 0 ? <PencilLine className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {scheduleItems.length > 0 ? (activeTimerUsesSets ? 'Edit running schedule' : 'Edit schedule') : 'Create schedule'}
        </Button>
        {hasSavedSchedule && (
          <Tooltip content="Clear saved schedule" side="bottom">
            <Button variant="outline" size="icon" className={`h-8 w-8 ${outlineButtonClass}`} onClick={handleClearSchedule} aria-label="Clear saved schedule">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        )}
      </div>

      {scheduleItems.length > 0 && (
        <div className={`rounded-xl border p-3 ${surfaceClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-[9px] font-semibold uppercase tracking-wide ${mutedText}`}>Projected end</p>
              <p className="mt-1 text-sm font-semibold">{formatScheduleClock(scheduleProjection.projectedEndAt)}{scheduleProjection.isEstimate ? ' or later' : ''}</p>
            </div>
            {scheduleProjection.status !== 'unconfigured' && (
              <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${scheduleProjection.status === 'behind'
                ? (darkMode ? 'bg-amber-400/10 text-amber-200' : 'bg-amber-50 text-amber-700')
                : (darkMode ? 'bg-emerald-400/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700')}`}>
                {scheduleProjection.status === 'behind' ? 'Behind' : 'On track'}
              </span>
            )}
          </div>
          {Number.isFinite(scheduleProjection.varianceMs) && (
            <p className={`mt-2 text-[10px] leading-relaxed ${mutedText}`}>
              {scheduleProjection.varianceMs > 0
                ? `${scheduleProjection.isEstimate ? 'At least ' : ''}${formatScheduleVariance(scheduleProjection.varianceMs)} behind the ideal end.`
                : (scheduleProjection.varianceMs < -60_000
                  ? `${formatScheduleVariance(scheduleProjection.varianceMs)} available before the ideal end.`
                  : 'Aligned with the ideal end time.')}
            </p>
          )}
        </div>
      )}

      <div className="space-y-4" aria-disabled={scheduleControlsDisabled || undefined}>
        <div className="space-y-2">
          <label className="text-xs font-medium">Ideal end time</label>
          <TimePicker
            value={scheduleIdealEndTime}
            onChange={(value) => applyTimerControlSettings({ scheduleIdealEndTime: value })}
            disabled={scheduleControlsDisabled}
            darkMode={darkMode}
            hourFormat={targetHourFormat}
            onHourFormatChange={(value) => setTimerControlSettings({ targetHourFormat: value })}
            ariaLabel="Ideal end time"
            placeholder="Select ideal end"
            relativePreview
          />
        </div>

        <div className={`rounded-xl border px-3 ${surfaceClass}`}>
          <h3 className="py-3 text-[11px] font-semibold">Schedule behavior</h3>
          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200/80'}`}>
            <div className="flex min-h-11 items-center justify-between gap-3 py-3">
              <span className="text-[11px]">Auto-start timed items</span>
              <Switch disabled={scheduleControlsDisabled} checked={autoStartNext} onCheckedChange={(checked) => applyTimerControlSettings({ autoStartNext: checked })} {...getSwitchProps(scheduleControlsDisabled)} />
            </div>
            <div className="py-3">
              <div className="flex min-h-6 items-center justify-between gap-3">
                <span className="text-[11px]">Transition indicator</span>
                <Switch disabled={scheduleControlsDisabled} checked={indicatorEnabled} onCheckedChange={(checked) => applyTimerControlSettings({ indicatorEnabled: checked })} {...getSwitchProps(scheduleControlsDisabled)} />
              </div>
              {indicatorEnabled && (
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_72px] gap-2">
                  <label className="min-w-0 space-y-1"><span className={`text-[9px] font-medium ${mutedText}`}>Text</span><Input disabled={scheduleControlsDisabled} value={indicatorLabel} onChange={(event) => applyTimerControlSettings({ indicatorLabel: event.target.value })} className={inputClass} /></label>
                  <label className="space-y-1"><span className={`text-[9px] font-medium ${mutedText}`}>Seconds</span><Input disabled={scheduleControlsDisabled} type="number" min="0" value={indicatorSeconds} onChange={(event) => applyTimerControlSettings({ indicatorSeconds: event.target.value })} className={inputClass} /></label>
                </div>
              )}
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3 py-3">
              <span className="text-[11px]">Timing alerts</span>
              <Switch disabled={scheduleControlsDisabled} checked={scheduleNotificationsEnabled} onCheckedChange={handleTimingAlertsChange} {...getSwitchProps(scheduleControlsDisabled)} />
            </div>
            <div className="grid grid-cols-2 gap-2 py-3">
              <label className="space-y-1"><span className={`text-[9px] font-medium ${mutedText}`}>Warn at</span><Input disabled={scheduleControlsDisabled} type="number" min="0" value={warningSeconds} onChange={(event) => applyTimerControlSettings({ warningSeconds: event.target.value })} className={inputClass} /></label>
              <label className="space-y-1"><span className={`text-[9px] font-medium ${mutedText}`}>Critical at</span><Input disabled={scheduleControlsDisabled} type="number" min="0" value={criticalSeconds} onChange={(event) => applyTimerControlSettings({ criticalSeconds: event.target.value })} className={inputClass} /></label>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const TimerTransport = ({ useSets, active, activeTimerUsesSets, timerState, actions, canStartTimer, handleStart, handleStop, outlineButtonClass }) => (
  <div className="mt-3 space-y-3">
    <div className="grid grid-cols-2 gap-2">
      {!timerState.running ? (
        <Button onClick={handleStart} disabled={!canStartTimer} className="w-full bg-green-600 text-xs text-white hover:bg-green-700"><Play className="h-4 w-4" />{useSets ? 'Start schedule' : 'Start'}</Button>
      ) : timerState.awaitingNext ? (
        <Button onClick={actions.advanceSchedule} className="w-full bg-green-600 text-xs text-white hover:bg-green-700"><SkipForward className="h-4 w-4" />Next item</Button>
      ) : timerState.paused ? (
        <Button onClick={actions.resumeTimer} className="w-full bg-green-600 text-xs text-white hover:bg-green-700"><Play className="h-4 w-4" />Resume</Button>
      ) : (
        <Button onClick={actions.pauseTimer} className="w-full bg-amber-600 text-xs text-white hover:bg-amber-700"><Pause className="h-4 w-4" />Pause</Button>
      )}
      <Button variant="destructive" onClick={handleStop} disabled={!active} className="w-full text-xs"><Square className="h-4 w-4" />Stop</Button>
    </div>
    <div className={`grid gap-2 ${(useSets || activeTimerUsesSets) ? 'grid-cols-4' : 'grid-cols-3'}`}>
      <Button variant="outline" className={`text-[11px] ${outlineButtonClass}`} onClick={() => actions.addTime(-60000)} disabled={!active || timerState.mode === 'countup'}>-1m</Button>
      <Button variant="outline" className={`text-[11px] ${outlineButtonClass}`} onClick={() => actions.addTime(60000)} disabled={!active || timerState.mode === 'countup'}>+1m</Button>
      <Button variant="outline" className={`text-[11px] ${outlineButtonClass}`} onClick={() => actions.addTime(300000)} disabled={!active || timerState.mode === 'countup'}>+5m</Button>
      {(useSets || activeTimerUsesSets) && (
        <Button variant="outline" className={`text-[11px] ${outlineButtonClass}`} onClick={actions.advanceSchedule} disabled={!activeTimerUsesSets}>
          <SkipForward className="h-4 w-4" />{timerState.sets?.[timerState.activeSetIndex + 1] ? 'Next' : 'Finish'}
        </Button>
      )}
    </div>
  </div>
);

const StylingControls = ({ darkMode, theme, displaySettings, applyTimerDisplaySettings }) => {
  const { columnBorderClass, mutedText, inputClass, selectTriggerClass, selectContentClass, subtleButtonClass, surfaceClass } = theme;
  return (
    <section className={`min-w-0 self-stretch space-y-4 border-l pl-5 ${columnBorderClass}`}>
      <h2 className="text-sm font-semibold">Styling</h2>
      <div className={`space-y-3 rounded-xl border p-3 ${surfaceClass}`}>
        <h3 className="text-[11px] font-semibold">Colour palette</h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="block min-w-0 space-y-2"><span className="block truncate text-[10px] font-medium">Timer</span><ColorPicker value={displaySettings.textColor} onChange={(value) => applyTimerDisplaySettings({ textColor: value })} darkMode={darkMode} showHex className={inputClass} /></label>
          <label className="block min-w-0 space-y-2"><span className="block truncate text-[10px] font-medium">Label and accent</span><ColorPicker value={displaySettings.accentColor} onChange={(value) => applyTimerDisplaySettings({ accentColor: value })} darkMode={darkMode} showHex className={inputClass} /></label>
        </div>
        <label className="block min-w-0 space-y-2"><span className="block text-[10px] font-medium">Background</span><PaintPicker value={displaySettings.backgroundPaint} fallbackColor={displaySettings.backgroundColor || '#000000'} onChange={(value) => applyTimerDisplaySettings({ backgroundPaint: value, ...(value?.type === 'solid' ? { backgroundColor: value.color } : {}) })} darkMode={darkMode} showValue className={inputClass} /></label>
      </div>
      <div className={`space-y-3 rounded-xl border p-3 ${surfaceClass}`}>
        <h3 className="text-[11px] font-semibold">Typography</h3>
        <label className="block min-w-0 space-y-2"><span className="block text-[10px] font-medium">Timer font</span><FontSelect value={displaySettings.timerFontFamily} onChange={(value) => applyTimerDisplaySettings({ timerFontFamily: value })} darkMode={darkMode} containerClassName="relative w-full min-w-0" triggerClassName={`w-full min-w-0 ${inputClass}`} /></label>
        <label className="block min-w-0 space-y-2"><span className="block text-[10px] font-medium">Secondary text font</span><FontSelect value={displaySettings.fontFamily} onChange={(value) => applyTimerDisplaySettings({ fontFamily: value })} darkMode={darkMode} containerClassName="relative w-full min-w-0" triggerClassName={`w-full min-w-0 ${inputClass}`} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-2"><span className="text-[10px] font-medium">Timer size</span><Select value={displaySettings.timerFontSizeMode} onValueChange={(value) => applyTimerDisplaySettings({ timerFontSizeMode: value })}><SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="auto">Auto-fit</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent></Select></label>
          <label className="space-y-2"><span className="text-[10px] font-medium">Manual px</span><Input type="number" min="48" max="420" disabled={displaySettings.timerFontSizeMode !== 'manual'} value={displaySettings.timerFontSize} onChange={(event) => applyTimerDisplaySettings({ timerFontSize: event.target.value })} className={inputClass} /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-2"><span className="text-[10px] font-medium">Alignment</span><Select value={displaySettings.timerAlign} onValueChange={(value) => applyTimerDisplaySettings({ timerAlign: value })}><SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select></label>
          <label className="space-y-2"><span className="text-[10px] font-medium">Secondary scale</span><Input type="number" min="0.08" max="2" step="0.01" value={displaySettings.otherItemsScale} onChange={(event) => applyTimerDisplaySettings({ otherItemsScale: event.target.value })} className={inputClass} /></label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => applyTimerDisplaySettings({ timerBold: !displaySettings.timerBold })} className={`h-8 rounded text-[11px] font-bold transition-colors ${displaySettings.timerBold ? 'bg-blue-600 text-white' : subtleButtonClass}`}>B</button>
          <button type="button" onClick={() => applyTimerDisplaySettings({ timerItalic: !displaySettings.timerItalic })} className={`h-8 rounded text-[11px] italic transition-colors ${displaySettings.timerItalic ? 'bg-blue-600 text-white' : subtleButtonClass}`}>I</button>
          <button type="button" onClick={() => applyTimerDisplaySettings({ timerUnderline: !displaySettings.timerUnderline })} className={`h-8 rounded text-[11px] underline transition-colors ${displaySettings.timerUnderline ? 'bg-blue-600 text-white' : subtleButtonClass}`}>U</button>
        </div>
      </div>
    </section>
  );
};

export default TimerControlLayout;
