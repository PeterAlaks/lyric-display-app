import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  ListChecks,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimePicker } from '@/components/ui/time-picker';
import {
  calculateScheduleProjection,
  inferSchedulePosition,
  isTimedScheduleItem,
  resolveActualScheduleStart,
  resolveScheduleTime,
} from '../../shared/scheduleUtils.js';
import { formatDuration } from '../utils/timerUtils.js';

const formatClock = (timestamp) => new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(timestamp));

const formatDateTime = (timestamp) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(timestamp));

const timeOfDay = (timestamp) => {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const formatOffset = (ms) => {
  const safeMs = Math.max(0, Number(ms) || 0);
  const minutes = Math.floor(safeMs / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1_000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  }
  if (minutes > 0) return `${minutes}m${seconds ? ` ${seconds}s` : ''}`;
  return `${Math.max(1, seconds)}s`;
};

const itemChoiceValue = (index) => `item:${index}`;
const transitionChoiceValue = (fromIndex) => `transition:${fromIndex}`;

const getSuggestedChoice = (position) => {
  if (position.kind === 'transition') return transitionChoiceValue(position.segment.fromItemIndex);
  if (position.kind === 'finished') return 'finished';
  return itemChoiceValue(position.suggestedItemIndex || 0);
};

const ScheduleStartReconciliationWizard = ({
  schedule,
  scheduledStartAt,
  hourFormat = '12',
  darkMode = false,
  getCanCommit,
  onConfirm,
  onClose,
}) => {
  const [step, setStep] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());
  const [startAnswer, setStartAnswer] = React.useState('');
  const [actualStartTime, setActualStartTime] = React.useState(schedule.eventStartTime || timeOfDay(scheduledStartAt));
  const [actualStartAt, setActualStartAt] = React.useState(scheduledStartAt);
  const [selectedChoice, setSelectedChoice] = React.useState('');
  const [selectionTouched, setSelectionTouched] = React.useState(false);
  const [timingMode, setTimingMode] = React.useState('planned');
  const [customItemTime, setCustomItemTime] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const transitionMs = schedule.indicator.enabled ? schedule.indicator.durationSeconds * 1_000 : 0;
  const position = React.useMemo(() => inferSchedulePosition({
    items: schedule.items,
    scheduledStartAt,
    actualStartAt,
    transitionMs,
    now,
  }), [actualStartAt, now, schedule.items, scheduledStartAt, transitionMs]);

  React.useEffect(() => {
    if (selectionTouched) return;
    setSelectedChoice(getSuggestedChoice(position));
    if (['item', 'manual', 'transition'].includes(position.kind)) {
      setTimingMode('planned');
      if (Number.isFinite(Number(position.segment?.startAt))) setCustomItemTime(timeOfDay(position.segment.startAt));
    } else if (position.kind !== 'finished') {
      setTimingMode('now');
      setCustomItemTime(timeOfDay(now));
    }
  }, [now, position, selectionTouched]);

  const parsedActualStartAt = startAnswer === 'other'
    ? resolveActualScheduleStart(actualStartTime, scheduledStartAt, now)
    : scheduledStartAt;
  const actualStartError = startAnswer === 'other' && (
    !Number.isFinite(parsedActualStartAt)
      ? 'Enter a valid actual start time.'
      : (parsedActualStartAt > now ? 'The actual start cannot be in the future.' : '')
  );

  const selectedParts = selectedChoice.split(':');
  const selectedType = selectedParts[0];
  const selectedIndex = Math.max(0, Number(selectedParts[1]) || 0);
  const selectedItem = selectedType === 'item' ? schedule.items[selectedIndex] : null;
  const selectedSegment = selectedType === 'item'
    ? position.timeline.itemTimings[selectedIndex]
    : position.timeline.segments.find((segment) => (
      segment.type === 'transition' && segment.fromItemIndex === selectedIndex
    ));
  const plannedStartAvailable = Number.isFinite(Number(selectedSegment?.startAt));
  const plannedTimingUsable = plannedStartAvailable
    && Number(selectedSegment.startAt) <= now
    && !(selectedType === 'transition' && Number(selectedSegment.endAt) <= now);
  const customStartAt = customItemTime
    ? resolveActualScheduleStart(customItemTime, actualStartAt, now)
    : null;
  const customStartError = timingMode === 'custom' && (
    !Number.isFinite(customStartAt)
      ? 'Enter a valid item start time.'
      : (customStartAt > now ? 'The item start cannot be in the future.' : '')
  );
  const phaseStartAt = timingMode === 'now'
    ? now
    : (timingMode === 'custom' ? customStartAt : selectedSegment?.startAt);
  const phaseDurationMs = selectedType === 'transition'
    ? transitionMs
    : (isTimedScheduleItem(selectedItem) ? selectedItem.durationMs : null);
  const phaseEndAt = Number.isFinite(Number(phaseDurationMs)) && Number.isFinite(Number(phaseStartAt))
    ? Number(phaseStartAt) + Number(phaseDurationMs)
    : null;
  const phaseRemainingMs = Number.isFinite(phaseEndAt) ? phaseEndAt - now : null;
  const assumedCompletedCount = selectedChoice === 'finished'
    ? schedule.items.length
    : (selectedType === 'transition' ? selectedIndex + 1 : selectedIndex);
  const reviewIdealEndAt = schedule.idealEndTime
    ? resolveScheduleTime(schedule.idealEndTime, scheduledStartAt)
    : null;
  const reviewProjection = selectedChoice === 'finished' ? null : calculateScheduleProjection({
    items: schedule.items,
    active: true,
    activeIndex: selectedIndex,
    now,
    currentRemainingMs: phaseRemainingMs,
    currentIsTransition: selectedType === 'transition',
    currentIsUnbounded: !Number.isFinite(phaseRemainingMs) || phaseRemainingMs < 0,
    transitionMs,
    idealEndAt: reviewIdealEndAt,
  });
  const projectionVarianceLabel = !reviewProjection || !Number.isFinite(reviewProjection.varianceMs)
    ? 'No ideal end target'
    : (reviewProjection.varianceMs > 0
      ? `${reviewProjection.isEstimate ? 'At least ' : ''}${formatOffset(reviewProjection.varianceMs)} behind`
      : (reviewProjection.varianceMs < -60_000
        ? `${formatOffset(Math.abs(reviewProjection.varianceMs))} available`
        : 'On track'));

  const chooseStartAnswer = (answer) => {
    setStartAnswer(answer);
    setError('');
    if (answer === 'on-time') {
      setActualStartAt(scheduledStartAt);
      setStep(1);
      return;
    }
    if (answer === 'not-started') {
      setActualStartAt(now);
      setSelectedChoice(itemChoiceValue(0));
      setSelectionTouched(true);
      setTimingMode('now');
      setStep(2);
    }
  };

  const continueWithActualStart = () => {
    if (actualStartError) {
      setError(actualStartError);
      return;
    }
    setActualStartAt(parsedActualStartAt);
    setSelectionTouched(false);
    setStep(1);
  };

  const choosePosition = (value) => {
    setSelectedChoice(value);
    setSelectionTouched(true);
    setError('');
    if (value === 'finished') return;
    const [type, rawIndex] = value.split(':');
    const index = Number(rawIndex) || 0;
    const segment = type === 'item'
      ? position.timeline.itemTimings[index]
      : position.timeline.segments.find((candidate) => candidate.type === 'transition' && candidate.fromItemIndex === index);
    const canUsePlannedTiming = Number.isFinite(Number(segment?.startAt))
      && Number(segment.startAt) <= now
      && !(type === 'transition' && Number(segment.endAt) <= now);
    if (canUsePlannedTiming) {
      setTimingMode('planned');
      setCustomItemTime(timeOfDay(segment.startAt));
    } else {
      setTimingMode('now');
      setCustomItemTime(timeOfDay(now));
    }
  };

  const continueToReview = () => {
    if (!selectedChoice) {
      setError('Choose the item or transition that is currently happening.');
      return;
    }
    if (selectedChoice !== 'finished' && !Number.isFinite(Number(phaseStartAt))) {
      setError(customStartError || 'Choose when the current item began.');
      return;
    }
    if (customStartError) {
      setError(customStartError);
      return;
    }
    setError('');
    setStep(2);
  };

  const confirm = async () => {
    if (busy) return;
    if (getCanCommit && !getCanCommit()) {
      setError('Live control changed or is reconnecting. Wait for it to become ready, then try again.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (selectedChoice === 'finished') {
        await onConfirm?.({ action: 'finished', scheduledStartAt, actualStartAt, joinedAt: now });
      } else {
        const phase = selectedType === 'transition' ? 'indicator' : 'timer';
        const activeSetIndex = selectedType === 'transition' ? selectedIndex : selectedIndex;
        const assumedThrough = selectedType === 'transition' ? selectedIndex : selectedIndex - 1;
        await onConfirm?.({
          action: 'start',
          scheduledStartAt,
          actualStartAt,
          joinedAt: now,
          phase,
          activeSetIndex,
          phaseStartAt: Number(phaseStartAt),
          timingMode,
          scheduleAssumedCompletedIds: schedule.items
            .slice(0, Math.max(0, assumedThrough + 1))
            .map((item) => item.id),
        });
      }
      onClose?.({ action: selectedChoice === 'finished' ? 'finished' : 'started' });
    } catch (confirmError) {
      setError(confirmError?.message || 'The schedule could not be synchronized.');
      setBusy(false);
    }
  };

  const surface = darkMode ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-white';
  const inset = darkMode ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const selectedClass = darkMode
    ? 'border-blue-400 bg-blue-500/10 ring-1 ring-blue-400/30'
    : 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20';
  const optionClass = darkMode
    ? 'border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800'
    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50';

  const expectedText = position.kind === 'item'
    ? `${schedule.items[position.suggestedItemIndex]?.label || 'the current item'} · ${formatDuration(position.remainingMs)} remaining`
    : position.kind === 'manual'
      ? `${schedule.items[position.suggestedItemIndex]?.label || 'a manual item'} · position needs confirmation`
      : position.kind === 'transition'
        ? `Transition to ${schedule.items[position.suggestedItemIndex]?.label || 'the next item'} · ${formatDuration(position.remainingMs)} remaining`
        : position.kind === 'gap'
          ? `Waiting for ${schedule.items[position.suggestedItemIndex]?.label || 'the next item'}`
          : position.kind === 'finished'
            ? `The planned schedule ended ${formatOffset(position.elapsedAfterEndMs)} ago`
            : 'The first schedule item';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`border-b py-3 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <ol className="grid w-full grid-cols-3" aria-label="Schedule synchronization progress">
          {['Event start', 'Current position', 'Review'].map((label, index) => (
            <li key={label} className={`flex min-w-0 items-center justify-center gap-2 px-1 text-center text-[10px] font-semibold ${index <= step ? (darkMode ? 'text-blue-300' : 'text-blue-700') : muted}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${index <= step ? 'bg-blue-600 text-white' : (darkMode ? 'bg-slate-800' : 'bg-slate-100')}`}>{index + 1}</span>
              <span className="truncate">{label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {error && (
          <div className={`mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${darkMode ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`} role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {step === 0 && (
          <div className="mx-auto max-w-2xl space-y-5">
            <section className={`rounded-2xl border p-4 ${inset}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Scheduled start has passed</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div><p className={`text-[10px] ${muted}`}>Scheduled</p><p className="mt-1 text-sm font-semibold">{formatDateTime(scheduledStartAt)}</p></div>
                <div><p className={`text-[10px] ${muted}`}>Current time</p><p className="mt-1 text-sm font-semibold">{formatDateTime(now)}</p></div>
                <div><p className={`text-[10px] ${muted}`}>Difference</p><p className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-300">{formatOffset(now - scheduledStartAt)} late</p></div>
              </div>
            </section>

            <div>
              <h3 className="text-sm font-semibold">Did the event begin at its scheduled time?</h3>
              <p className={`mt-1 text-xs ${muted}`}>This establishes the event timeline before LyricDisplay joins it.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => chooseStartAnswer('on-time')} className={`rounded-xl border p-4 text-left transition-colors ${optionClass}`}>
                <Check className="h-4 w-4 text-emerald-500" /><p className="mt-3 text-xs font-semibold">Yes, on time</p><p className={`mt-1 text-[10px] ${muted}`}>{formatClock(scheduledStartAt)}</p>
              </button>
              <button type="button" onClick={() => chooseStartAnswer('other')} className={`rounded-xl border p-4 text-left transition-colors ${startAnswer === 'other' ? selectedClass : optionClass}`}>
                <Clock3 className="h-4 w-4 text-blue-500" /><p className="mt-3 text-xs font-semibold">Another time</p><p className={`mt-1 text-[10px] ${muted}`}>Enter the actual start</p>
              </button>
              <button type="button" onClick={() => chooseStartAnswer('not-started')} className={`rounded-xl border p-4 text-left transition-colors ${optionClass}`}>
                <RotateCcw className="h-4 w-4 text-slate-500" /><p className="mt-3 text-xs font-semibold">Not started yet</p><p className={`mt-1 text-[10px] ${muted}`}>Begin from item one now</p>
              </button>
            </div>

            {startAnswer === 'other' && (
              <section className={`rounded-xl border p-4 ${surface}`}>
                <label className="space-y-2">
                  <span className="text-xs font-semibold">Actual event start</span>
                  <TimePicker
                    value={actualStartTime}
                    onChange={setActualStartTime}
                    hourFormat={hourFormat}
                    darkMode={darkMode}
                    allowClear={false}
                    ariaLabel="Actual event start"
                  />
                </label>
                {Number.isFinite(parsedActualStartAt) && !actualStartError && <p className={`mt-2 text-[10px] ${muted}`}>{formatDateTime(parsedActualStartAt)}</p>}
                <div className="mt-4 flex justify-end"><Button size="sm" onClick={continueWithActualStart}>Continue <ArrowRight className="h-4 w-4" /></Button></div>
              </section>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="mx-auto max-w-3xl space-y-4">
            <section className={`rounded-xl border p-4 ${inset}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Expected current position</p>
              <p className="mt-1 text-sm font-semibold">{expectedText}</p>
              <p className={`mt-1 text-[10px] ${muted}`}>{position.exact ? 'Calculated from the timed schedule.' : 'A manual or unbounded item requires operator confirmation.'}</p>
            </section>

            <div>
              <h3 className="text-sm font-semibold">What is happening now?</h3>
              <p className={`mt-1 text-xs ${muted}`}>The suggestion is preselected. Choose a different item if the live event has moved away from plan.</p>
            </div>

            <div className={`max-h-72 space-y-1 overflow-y-auto rounded-xl border p-2 ${darkMode ? 'border-slate-700 bg-slate-950/30' : 'border-slate-200 bg-slate-50/60'}`} role="radiogroup" aria-label="Current schedule position">
              {schedule.items.map((item, index) => {
                const value = itemChoiceValue(index);
                const selected = selectedChoice === value;
                const timing = position.timeline.itemTimings[index];
                return (
                  <React.Fragment key={item.id}>
                    <button type="button" role="radio" aria-checked={selected} onClick={() => choosePosition(value)} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${selected ? selectedClass : optionClass}`}>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>{index + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{item.label}</span><span className={`mt-0.5 block text-[9px] ${muted}`}>{isTimedScheduleItem(item) ? formatDuration(item.durationMs) : 'Manual item'}{timing?.startAt ? ` · expected ${formatClock(timing.startAt)}` : ''}</span></span>
                      {value === getSuggestedChoice(position) && <span className="rounded-full bg-blue-600/10 px-2 py-1 text-[9px] font-semibold text-blue-600 dark:text-blue-300">Suggested</span>}
                    </button>
                    {index < schedule.items.length - 1 && transitionMs > 0 && position.timeline.segments.some((segment) => segment.type === 'transition' && segment.fromItemIndex === index) && (
                      <button type="button" role="radio" aria-checked={selectedChoice === transitionChoiceValue(index)} onClick={() => choosePosition(transitionChoiceValue(index))} className={`ml-8 flex w-[calc(100%_-_2rem)] items-center gap-2 rounded-lg border px-3 py-2 text-left text-[10px] transition-colors ${selectedChoice === transitionChoiceValue(index) ? selectedClass : optionClass}`}>
                        <ArrowRight className="h-3 w-3" /> Transition to {schedule.items[index + 1].label}
                      </button>
                    )}
                  </React.Fragment>
                );
              })}
              <button type="button" role="radio" aria-checked={selectedChoice === 'finished'} onClick={() => choosePosition('finished')} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${selectedChoice === 'finished' ? selectedClass : optionClass}`}>
                <Check className="h-4 w-4" /><span className="text-xs font-semibold">The event has already finished</span>
              </button>
            </div>

            {selectedChoice && selectedChoice !== 'finished' && (
              <section className={`rounded-xl border p-4 ${surface}`}>
                <h4 className="text-xs font-semibold">When did {selectedType === 'transition' ? 'this transition' : `“${selectedItem?.label}”`} begin?</h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <button type="button" disabled={!plannedTimingUsable} onClick={() => { setSelectionTouched(true); setTimingMode('planned'); }} className={`rounded-lg border px-3 py-2 text-left text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${timingMode === 'planned' ? selectedClass : optionClass}`}><span className="block font-semibold">Use planned progress</span>{plannedStartAvailable && <span className={muted}>{plannedTimingUsable ? formatClock(selectedSegment.startAt) : 'Not valid for the current time'}</span>}</button>
                  <button type="button" onClick={() => { setSelectionTouched(true); setTimingMode('now'); }} className={`rounded-lg border px-3 py-2 text-left text-[10px] ${timingMode === 'now' ? selectedClass : optionClass}`}><span className="block font-semibold">Just now</span><span className={muted}>Start from zero</span></button>
                  <button type="button" onClick={() => { setSelectionTouched(true); setTimingMode('custom'); if (!customItemTime) setCustomItemTime(timeOfDay(now)); }} className={`rounded-lg border px-3 py-2 text-left text-[10px] ${timingMode === 'custom' ? selectedClass : optionClass}`}><span className="block font-semibold">Another time</span><span className={muted}>Enter exact time</span></button>
                </div>
                {timingMode === 'custom' && (
                  <div className="mt-3"><TimePicker value={customItemTime} onChange={setCustomItemTime} hourFormat={hourFormat} darkMode={darkMode} allowClear={false} ariaLabel="Current item start" /></div>
                )}
                {Number.isFinite(phaseRemainingMs) && (
                  <p className={`mt-3 text-[10px] font-medium ${phaseRemainingMs < 0 ? 'text-amber-600 dark:text-amber-300' : muted}`}>
                    {phaseRemainingMs < 0 ? `${formatDuration(Math.abs(phaseRemainingMs))} overtime at confirmation` : `${formatDuration(phaseRemainingMs)} remaining at the current time`}
                  </p>
                )}
              </section>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto max-w-2xl space-y-5">
            <div className="flex items-start gap-3"><ListChecks className="mt-0.5 h-5 w-5 text-blue-500" /><div><h3 className="text-sm font-semibold">Review the live schedule position</h3><p className={`mt-1 text-xs ${muted}`}>Only this final state will be sent to the timer and outputs.</p></div></div>
            <dl className={`overflow-hidden rounded-2xl border ${surface}`}>
              {[
                ['Scheduled start', formatDateTime(scheduledStartAt)],
                ['Actual event start', formatDateTime(actualStartAt)],
                ['LyricDisplay joins', formatDateTime(now)],
                ['Current position', selectedChoice === 'finished' ? 'Event finished' : (selectedType === 'transition' ? `Transition to ${schedule.items[selectedIndex + 1]?.label || 'next item'}` : selectedItem?.label)],
                ['Current phase began', selectedChoice === 'finished' ? '—' : formatDateTime(phaseStartAt)],
                ['Timer state', selectedChoice === 'finished' ? 'Mark complete' : (Number.isFinite(phaseRemainingMs) ? (phaseRemainingMs < 0 ? `${formatDuration(Math.abs(phaseRemainingMs))} overtime` : `${formatDuration(phaseRemainingMs)} remaining`) : 'Manual count-up')],
                ['Projected finish', reviewProjection ? `${formatDateTime(reviewProjection.projectedEndAt)}${reviewProjection.isEstimate ? ' or later' : ''}` : 'Already complete'],
                ['Ideal-end position', selectedChoice === 'finished' ? 'Complete' : projectionVarianceLabel],
              ].map(([label, value]) => (
                <div key={label} className={`grid grid-cols-[140px_1fr] gap-4 border-b px-4 py-3 last:border-b-0 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}><dt className={`text-[10px] font-medium ${muted}`}>{label}</dt><dd className="text-xs font-semibold">{value}</dd></div>
              ))}
            </dl>
            {selectedChoice !== 'finished' && assumedCompletedCount > 0 && <p className={`text-[10px] leading-relaxed ${muted}`}>{assumedCompletedCount} earlier schedule {assumedCompletedCount === 1 ? 'item is' : 'items are'} recorded as assumed completed. Missed alerts will not replay.</p>}
          </div>
        )}
      </div>

      <div className={`flex items-center justify-between border-t px-5 py-3 ${darkMode ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50/60'}`}>
        <div>
          {step > 0 ? <Button type="button" size="sm" variant="ghost" onClick={() => { setError(''); setStep(step - 1); }} disabled={busy}><ArrowLeft className="h-4 w-4" /> Back</Button> : <Button type="button" size="sm" variant="ghost" onClick={() => onClose?.({ dismissed: true })}>Cancel</Button>}
        </div>
        {step === 1 && <Button type="button" size="sm" onClick={continueToReview}>Review <ArrowRight className="h-4 w-4" /></Button>}
        {step === 2 && <Button type="button" size="sm" onClick={confirm} disabled={busy}>{selectedChoice === 'finished' ? <Check className="h-4 w-4" /> : <Play className="h-4 w-4" />}{busy ? 'Synchronizing…' : (selectedChoice === 'finished' ? 'Mark finished' : 'Sync and start')}</Button>}
      </div>
    </div>
  );
};

export default ScheduleStartReconciliationWizard;
