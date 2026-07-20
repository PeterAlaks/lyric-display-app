import React from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  CirclePlay,
  ClipboardPaste,
  Clock3,
  Download,
  FileText,
  FileUp,
  GripVertical,
  Hand,
  ListChecks,
  Plus,
  TimerReset,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker, formatTimeLabel, isTimeValueInFuture } from '@/components/ui/time-picker';
import useModal from '../hooks/useModal';
import {
  MAX_SCHEDULE_ITEMS,
  calculateScheduleItemStartTimes,
  calculateScheduleProjection,
  isTimedScheduleItem,
  normalizeScheduleDocument,
  parseScheduleText,
  resolveScheduleTime,
} from '../../shared/scheduleUtils.js';
import { downloadScheduleFile, importScheduleFile } from '../utils/scheduleFiles.js';
import { getTimerToggleProps } from './timerToggleStyles.js';

const STEPS = [
  { label: 'Details', icon: CalendarClock },
  { label: 'Items', icon: ListChecks },
  { label: 'Automation', icon: TimerReset },
  { label: 'Review', icon: Check },
];

const IMPORT_OPTIONS = {
  ldsch: {
    accept: '.ldsch',
    buttonLabel: 'Choose .ldsch file',
    heading: 'LyricDisplay Schedule',
    description: 'Open a schedule previously saved by LyricDisplay.',
  },
  document: {
    accept: '.txt,.md,.markdown,.rtf,.docx',
    buttonLabel: 'Choose document',
    heading: 'Schedule document',
    description: 'Choose a plain text, Markdown, rich text, or Word document.',
  },
};

const IMPORT_METHODS = [
  { value: 'create', label: 'Create schedule', description: 'Start with a blank item', icon: Plus },
  { value: 'ldsch', label: 'LyricDisplay file', description: '.ldsch schedule', icon: CalendarClock },
  { value: 'document', label: 'Document', description: 'Text, Word, or Markdown', icon: FileText },
  { value: 'paste', label: 'Paste text', description: 'Type or paste a list', icon: ClipboardPaste },
];

const SCHEDULE_DROP_ANIMATION = {
  duration: 180,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
};

let itemSequence = 1;

const createBlankItem = (index = 0) => ({
  id: `schedule-item-${Date.now()}-${itemSequence += 1}`,
  label: `Schedule item ${index + 1}`,
  durationMs: 5 * 60_000,
  timed: true,
  notes: '',
  plannedStartTime: '',
});

const durationParts = (durationMs) => {
  const totalMinutes = Math.max(0, Number(durationMs) || 0) / 60_000;
  const hours = Math.floor(totalMinutes / 60);
  return { hours, minutes: Math.round((totalMinutes - (hours * 60)) * 100) / 100 };
};

const formatDurationSummary = (durationMs) => {
  const totalMinutes = Math.round(Math.max(0, Number(durationMs) || 0) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};

const formatClock = (timestamp) => new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(timestamp));

const SortableScheduleItem = ({ id, disabled, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return children({
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    isDragging,
    style: {
      transform: transform ? CSS.Transform.toString(transform) : undefined,
      transition: transition || undefined,
      opacity: isDragging ? 0.28 : undefined,
      willChange: transform ? 'transform' : undefined,
    },
  });
};

const ScheduleCreatorWizard = ({ initialSchedule, darkMode = false, onApply, onClose }) => {
  const { showModal } = useModal();
  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState(() => normalizeScheduleDocument(initialSchedule));
  const [importMethod, setImportMethod] = React.useState('ldsch');
  const [pasteText, setPasteText] = React.useState('');
  const [parseInfo, setParseInfo] = React.useState(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [downloaded, setDownloaded] = React.useState(false);
  const [validationNow, setValidationNow] = React.useState(Date.now());
  const [activeItemId, setActiveItemId] = React.useState(null);
  const [activeOverlayWidth, setActiveOverlayWidth] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  React.useEffect(() => {
    const interval = window.setInterval(() => setValidationNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const inputClass = darkMode
    ? 'h-9 border-slate-700 bg-slate-950/55 text-[11px] text-slate-100 shadow-sm placeholder:text-slate-500 focus-visible:ring-blue-500/40 md:text-[11px]'
    : 'h-9 border-slate-300 bg-white text-[11px] text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-blue-500/30 md:text-[11px]';
  const mutedText = darkMode ? 'text-slate-400' : 'text-slate-500';
  const panelClass = darkMode
    ? 'border-slate-700/80 bg-slate-900/55 shadow-black/10'
    : 'border-slate-200 bg-white shadow-slate-950/5';
  const insetClass = darkMode ? 'border-slate-700/70 bg-slate-950/35' : 'border-slate-200 bg-slate-50/85';
  const outlineButtonClass = darkMode ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800' : 'border-slate-300 bg-white hover:bg-slate-50';
  const fieldLabelClass = `block text-[11px] font-semibold tracking-wide ${darkMode ? 'text-slate-300' : 'text-slate-600'}`;
  const cardHeaderClass = darkMode ? 'border-slate-700/70 bg-slate-950/20' : 'border-slate-200 bg-slate-50/70';
  const hairlineBorder = darkMode ? 'border-slate-800' : 'border-slate-200';
  const hairlineDivide = darkMode ? 'divide-slate-800' : 'divide-slate-200';
  const rowHoverClass = darkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50';
  const numberBadgeClass = darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500';
  const scheduleSwitchProps = getTimerToggleProps(darkMode);
  const itemTitleClass = darkMode
    ? 'h-8 min-w-0 flex-1 border border-transparent bg-transparent px-2 text-xs font-medium text-slate-100 shadow-none focus-visible:border-slate-700 focus-visible:bg-slate-950/50 focus-visible:ring-1 focus-visible:ring-blue-500/30 md:text-xs'
    : 'h-8 min-w-0 flex-1 border border-transparent bg-transparent px-2 text-xs font-medium text-slate-900 shadow-none focus-visible:border-slate-200 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-blue-500/30 md:text-xs';
  const microFieldClass = darkMode
    ? 'border-slate-700/70 bg-slate-950/30 px-2 text-[10px] text-slate-300 shadow-none placeholder:text-slate-600 focus-visible:border-blue-400 focus-visible:ring-1 focus-visible:ring-blue-500/30 md:text-[10px]'
    : 'border-slate-200 bg-white px-2 text-[10px] text-slate-600 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/20 md:text-[10px]';
  const durationFieldClass = `${microFieldClass} h-8 w-20 text-center font-medium`;

  const updateDraft = React.useCallback((updates) => {
    setDraft((current) => ({ ...current, ...updates }));
  }, []);

  const updateItem = React.useCallback((id, updates) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }));
  }, []);

  const updateItemDuration = React.useCallback((item, part, value) => {
    const current = durationParts(item.durationMs);
    const nextHours = part === 'hours' ? Math.max(0, Number(value) || 0) : current.hours;
    const nextMinutes = part === 'minutes' ? Math.max(0, Number(value) || 0) : current.minutes;
    const durationMs = Math.round(((nextHours * 60) + nextMinutes) * 60_000);
    updateItem(item.id, { durationMs: Math.max(1_000, durationMs), timed: true });
  }, [updateItem]);

  const toggleItemTiming = React.useCallback((item, timed) => {
    updateItem(item.id, timed
      ? { timed: true, durationMs: item.durationMs || 5 * 60_000 }
      : { timed: false, durationMs: null });
  }, [updateItem]);

  const addItem = React.useCallback(() => {
    setDraft((current) => {
      if (current.items.length >= MAX_SCHEDULE_ITEMS) return current;
      return { ...current, items: [...current.items, createBlankItem(current.items.length)] };
    });
  }, []);

  const removeItem = React.useCallback((id) => {
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  }, []);

  const confirmRemoveItem = React.useCallback(async (item) => {
    const result = await showModal({
      title: 'Delete schedule item?',
      description: `Remove “${item.label || 'Untitled item'}” from this schedule?`,
      variant: 'warn',
      size: 'xs',
      actions: [
        { label: 'Cancel', value: 'cancel', variant: 'outline' },
        { label: 'Delete', value: 'delete', variant: 'destructive', autoFocus: true },
      ],
    });
    if (result === 'delete') removeItem(item.id);
  }, [removeItem, showModal]);

  const confirmClearItems = React.useCallback(async () => {
    if (draft.items.length === 0) return;
    const result = await showModal({
      title: 'Clear all schedule items?',
      description: `Remove all ${draft.items.length} ${draft.items.length === 1 ? 'item' : 'items'} from this schedule?`,
      variant: 'warn',
      size: 'xs',
      actions: [
        { label: 'Cancel', value: 'cancel', variant: 'outline' },
        { label: 'Clear items', value: 'clear', variant: 'destructive', autoFocus: true },
      ],
    });
    if (result !== 'clear') return;
    setDraft((current) => ({ ...current, items: [] }));
    setParseInfo(null);
    setActiveItemId(null);
  }, [draft.items.length, showModal]);

  const handleCreateSchedule = React.useCallback(async () => {
    if (draft.items.length > 0) {
      const result = await showModal({
        title: 'Create a new schedule?',
        description: 'This replaces the current item list with one blank schedule item. Your schedule details are kept.',
        variant: 'warn',
        size: 'xs',
        actions: [
          { label: 'Cancel', value: 'cancel', variant: 'outline' },
          { label: 'Create schedule', value: 'create', variant: 'default', autoFocus: true },
        ],
      });
      if (result !== 'create') return;
    }

    setDraft((current) => ({ ...current, items: [createBlankItem(0)] }));
    setParseInfo(null);
    setPasteText('');
    setDownloaded(false);
    setError('');
    setStep(1);
  }, [draft.items.length, showModal]);

  const handleDragStart = React.useCallback(({ active }) => {
    setActiveItemId(active?.id ?? null);
    setActiveOverlayWidth(active?.rect?.current?.initial?.width ?? null);
  }, []);

  const handleDragCancel = React.useCallback(() => {
    setActiveItemId(null);
    setActiveOverlayWidth(null);
  }, []);

  const handleDragEnd = React.useCallback(({ active, over }) => {
    setActiveItemId(null);
    setActiveOverlayWidth(null);
    if (!over || !active || active.id === over.id) return;

    setDraft((current) => {
      const fromIndex = current.items.findIndex((item) => item.id === active.id);
      const toIndex = current.items.findIndex((item) => item.id === over.id);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return current;
      return { ...current, items: arrayMove(current.items, fromIndex, toIndex) };
    });
  }, []);

  const applyImportResult = React.useCallback((result) => {
    setDraft(normalizeScheduleDocument(result.schedule));
    setParseInfo(result);
    setError('');
    setDownloaded(false);
    setStep(1);
  }, []);

  const handleFile = React.useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      applyImportResult(await importScheduleFile(file));
    } catch (importError) {
      setError(importError?.message || 'Could not import this schedule');
    } finally {
      setBusy(false);
    }
  }, [applyImportResult]);

  const handleParsePaste = React.useCallback(() => {
    setError('');
    try {
      const result = parseScheduleText(pasteText, { title: draft.title });
      if (result.schedule.items.length === 0) throw new Error(result.warnings[0] || 'No schedule items were found');
      applyImportResult({ ...result, sourceName: 'Pasted text', sourceType: 'text' });
    } catch (parseError) {
      setError(parseError?.message || 'Could not identify a schedule in that text');
    }
  }, [applyImportResult, draft.title, pasteText]);

  const handleNotificationsChange = React.useCallback(async (enabled) => {
    updateDraft({ notificationsEnabled: enabled });
    if (enabled && typeof window.Notification === 'function' && window.Notification.permission === 'default') {
      try { await window.Notification.requestPermission(); } catch { /* In-app alerts remain available. */ }
    }
  }, [updateDraft]);

  const handleDownload = React.useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await downloadScheduleFile(draft);
      if (!result?.canceled) setDownloaded(true);
    } catch (downloadError) {
      setError(downloadError?.message || 'Could not download the schedule');
    } finally {
      setBusy(false);
    }
  }, [draft]);

  const handleApply = React.useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      await onApply?.(normalizeScheduleDocument(draft));
      onClose?.({ action: 'apply' });
    } catch (applyError) {
      setError(applyError?.message || 'Could not apply the schedule');
    } finally {
      setBusy(false);
    }
  }, [draft, onApply, onClose]);

  const timedItems = draft.items.filter(isTimedScheduleItem);
  const manualItems = draft.items.length - timedItems.length;
  const transitionMs = draft.indicator.enabled ? draft.indicator.durationSeconds * 1_000 : 0;
  const eventStartValid = !draft.eventStartTime || isTimeValueInFuture(draft.eventStartTime, validationNow);
  const projectionStartAt = eventStartValid ? (resolveScheduleTime(draft.eventStartTime) ?? validationNow) : validationNow;
  const projection = calculateScheduleProjection({
    items: draft.items,
    now: projectionStartAt,
    transitionMs,
    idealEndTime: draft.idealEndTime,
  });
  const itemStartTimes = eventStartValid
    ? calculateScheduleItemStartTimes({
      items: draft.items,
      eventStartTime: draft.eventStartTime,
      transitionMs,
    })
    : [];
  const labelsValid = draft.items.every((item) => item.label.trim());
  const canContinue = step === 0
    ? Boolean(draft.title.trim()) && eventStartValid
    : (step === 1 ? draft.items.length > 0 && labelsValid : true);

  const blockedReason = step === 0
    ? (!draft.title.trim()
      ? 'Add a schedule title to continue'
      : (!eventStartValid ? 'Event start time must be later than the current time' : ''))
    : (step === 1 || step === 3)
      ? (draft.items.length === 0
        ? 'Add at least one schedule item'
        : (!labelsValid
          ? 'Give every item a title'
          : (!eventStartValid ? 'Event start time must be later than the current time' : '')))
      : '';
  const canReorder = draft.items.length > 1;
  const activeItem = activeItemId ? draft.items.find((item) => item.id === activeItemId) : null;
  const activeItemIndex = activeItem ? draft.items.findIndex((item) => item.id === activeItem.id) : -1;

  const renderItemEditor = (item, index, drag = {}, isDragOverlay = false) => {
    const parts = durationParts(item.durationMs);
    const timed = isTimedScheduleItem(item);
    const itemStartTime = itemStartTimes[index];
    const handleClass = darkMode
      ? 'text-slate-500 hover:bg-blue-500/10 hover:text-blue-300'
      : 'text-slate-400 hover:bg-blue-50 hover:text-blue-600';

    return (
      <div
        ref={drag.setNodeRef}
        style={drag.style}
        className={`px-4 py-3 transition-[background-color,box-shadow,opacity] ${isDragOverlay
          ? `pointer-events-none rounded-xl border shadow-2xl ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`
          : rowHoverClass}`}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            ref={drag.setActivatorNodeRef}
            disabled={!canReorder || isDragOverlay}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${handleClass} ${canReorder ? 'cursor-grab opacity-100 active:cursor-grabbing' : 'cursor-not-allowed opacity-40'} ${isDragOverlay ? 'cursor-grabbing' : ''}`}
            aria-label={`Reorder ${item.label}`}
            title={canReorder ? 'Drag to reorder' : 'Add another item to enable reordering'}
            {...(!isDragOverlay && canReorder ? drag.attributes : {})}
            {...(!isDragOverlay && canReorder ? drag.listeners : {})}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${numberBadgeClass}`}>{index + 1}</span>

          <Input
            value={item.label}
            onChange={(event) => updateItem(item.id, { label: event.target.value })}
            className={itemTitleClass}
            aria-label={`Item ${index + 1} title`}
            readOnly={isDragOverlay}
          />

          <button
            type="button"
            onClick={() => toggleItemTiming(item, !timed)}
            disabled={isDragOverlay}
            aria-pressed={timed}
            title={timed ? 'Timed item — click to make manual' : 'Manual item — click to set a duration'}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${timed
              ? (darkMode ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25' : 'bg-blue-50 text-blue-700 hover:bg-blue-100')
              : (darkMode ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'bg-amber-50 text-amber-700 hover:bg-amber-100')}`}
          >
            {timed ? <Clock3 className="h-3 w-3" /> : <Hand className="h-3 w-3" />}
            {timed ? formatDurationSummary(item.durationMs) : 'Manual'}
          </button>

          {!isDragOverlay && (
            <button
              type="button"
              onClick={() => confirmRemoveItem(item)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-500/10"
              aria-label={`Delete ${item.label}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
          {itemStartTime && (
            <span className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium ${darkMode ? 'border-slate-700 bg-slate-800/70 text-slate-300' : 'border-slate-200 bg-slate-100/80 text-slate-600'}`}>
              <CalendarClock className="h-3 w-3" /> Starts {formatTimeLabel(itemStartTime)}
            </span>
          )}

          {timed ? (
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium ${mutedText}`}>Duration</span>
              <label className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={parts.hours}
                  onChange={(event) => updateItemDuration(item, 'hours', event.target.value)}
                  className={durationFieldClass}
                  aria-label={`${item.label} hours`}
                  readOnly={isDragOverlay}
                />
                <span className={`text-[10px] ${mutedText}`}>h</span>
              </label>
              <label className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={parts.minutes}
                  onChange={(event) => updateItemDuration(item, 'minutes', event.target.value)}
                  className={durationFieldClass}
                  aria-label={`${item.label} minutes`}
                  readOnly={isDragOverlay}
                />
                <span className={`text-[10px] ${mutedText}`}>m</span>
              </label>
            </div>
          ) : (
            <span className={`flex items-center gap-1.5 text-[10px] ${mutedText}`}>
              <Hand className="h-3 w-3 shrink-0" /> Manual advancement
            </span>
          )}
        </div>

        <Input
          value={item.notes}
          onChange={(event) => updateItem(item.id, { notes: event.target.value })}
          className={`${microFieldClass} mt-2.5 h-8 w-full`}
          placeholder="Short note or cue — person responsible, handoff, or reminder"
          aria-label={`Short note or cue for ${item.label}`}
          readOnly={isDragOverlay}
        />
      </div>
    );
  };

  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden">
      <div className={`shrink-0 border-b px-4 py-3 sm:px-6 ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50/80'}`}>
        <ol className={`grid grid-cols-4 gap-1 rounded-xl border p-1 ${darkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-white/80'}`} aria-label="Schedule creation progress">
          {STEPS.map((stepMeta, index) => {
            const complete = index < step;
            const current = index === step;
            const StepIcon = stepMeta.icon;
            return (
              <li key={stepMeta.label} className="min-w-0">
                <button
                  type="button"
                  onClick={() => { if (index < step) setStep(index); }}
                  disabled={index > step}
                  aria-current={current ? 'step' : undefined}
                  aria-label={`${stepMeta.label}${complete ? ' (complete)' : current ? ' (current step)' : ''}`}
                  className={`flex h-9 w-full min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:cursor-not-allowed ${current
                    ? 'bg-blue-600 text-white shadow-sm'
                    : complete
                      ? (darkMode ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100')
                      : (darkMode ? 'text-slate-500' : 'text-slate-400')}`}
                >
                  <StepIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{stepMeta.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-6 [scrollbar-gutter:stable] sm:px-6">
        <div className="mx-auto w-full max-w-[720px]">
          {error && (
            <div className={`mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs leading-relaxed ${darkMode ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`} role="alert">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              {error}
            </div>
          )}

          {step === 0 && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 sm:col-span-2">
                  <span className={fieldLabelClass}>Schedule title</span>
                  <Input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} className={inputClass} placeholder="Sunday Service" />
                </label>
                <div className="space-y-1.5">
                  <span className={fieldLabelClass}>Event start time <span className={`font-normal ${mutedText}`}>(optional)</span></span>
                  <TimePicker
                    value={draft.eventStartTime}
                    onChange={(eventStartTime) => updateDraft({ eventStartTime })}
                    darkMode={darkMode}
                    ariaLabel="Event start time"
                    placeholder="Select event start"
                    disablePast
                  />
                </div>
                <div className="space-y-1.5">
                  <span className={fieldLabelClass}>Ideal end time <span className={`font-normal ${mutedText}`}>(optional)</span></span>
                  <TimePicker
                    value={draft.idealEndTime}
                    onChange={(idealEndTime) => updateDraft({ idealEndTime })}
                    darkMode={darkMode}
                    ariaLabel="Ideal end time"
                    placeholder="Select ideal end"
                    relativePreview
                  />
                </div>
              </div>

              <div className={`space-y-4 border-t pt-6 ${hairlineBorder}`}>
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <div>
                    <h4 className="text-xs font-semibold">Add schedule items</h4>
                    <p className={`mt-0.5 text-[11px] ${mutedText}`}>Choose one source for this schedule.</p>
                  </div>
                </div>

                <div role="radiogroup" aria-label="Schedule source" className="grid gap-2.5 sm:grid-cols-4">
                  {IMPORT_METHODS.map((method) => {
                    const MethodIcon = method.icon;
                    const selected = importMethod === method.value;
                    return (
                      <button
                        key={method.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => { setImportMethod(method.value); setError(''); }}
                        className={`relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-150 ${
                          selected
                            ? (darkMode ? 'border-blue-400/50 bg-blue-500/10 shadow-sm' : 'border-blue-400 bg-blue-50/70 shadow-sm')
                            : (darkMode ? 'border-slate-700 bg-slate-950/30 hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50')
                        }`}
                      >
                        {selected && (
                          <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected ? 'bg-blue-600 text-white' : (darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600')}`}>
                          <MethodIcon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-xs font-semibold">{method.label}</span>
                          <span className={`mt-0.5 block text-[10px] leading-snug ${mutedText}`}>{method.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {importMethod === 'paste' ? (
                  <div className={`rounded-xl border p-3.5 ${insetClass}`}>
                    <label className="block space-y-1.5">
                      <span className={fieldLabelClass}>Schedule text</span>
                      <Textarea
                        value={pasteText}
                        onChange={(event) => setPasteText(event.target.value)}
                        className={`min-h-32 resize-y text-[11px] leading-relaxed ${inputClass}`}
                        placeholder={'1. Opening prayer\n2. Praise and worship — 30 mins\n3. Announcements — 10 min'}
                      />
                    </label>
                    <Button type="button" size="sm" className="mt-3" onClick={handleParsePaste} disabled={!pasteText.trim() || busy}>
                      Use schedule text
                    </Button>
                  </div>
                ) : importMethod === 'create' ? (
                  <div className={`flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center ${insetClass}`}>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-500 shadow-sm'}`}>
                      <Plus className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-xs font-semibold">Create a schedule manually</h5>
                      <p className={`mt-1 text-[11px] leading-relaxed ${mutedText}`}>Start with one blank item, then add and reorder the rest.</p>
                    </div>
                    <Button type="button" size="sm" onClick={handleCreateSchedule} disabled={busy}>
                      <Plus className="h-4 w-4" /> Create schedule
                    </Button>
                  </div>
                ) : (
                  <>
                    <div
                      role="button"
                      tabIndex={busy ? -1 : 0}
                      aria-disabled={busy || undefined}
                      onClick={() => { if (!busy) fileInputRef.current?.click(); }}
                      onKeyDown={(event) => {
                        if (!busy && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${busy ? 'cursor-not-allowed opacity-60' : ''} ${insetClass}`}
                    >
                      <div className={`flex h-11 w-11 items-center justify-center rounded-full ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-500 shadow-sm'}`}>
                        <FileUp className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-semibold">{IMPORT_OPTIONS[importMethod].heading}</h5>
                        <p className={`mt-1 text-[11px] leading-relaxed ${mutedText}`}>{IMPORT_OPTIONS[importMethod].description}</p>
                      </div>
                      <span className={`inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium shadow-sm ${outlineButtonClass}`}>
                        <FileUp className="h-4 w-4" /> {IMPORT_OPTIONS[importMethod].buttonLabel}
                      </span>
                    </div>
                    <input ref={fileInputRef} type="file" accept={IMPORT_OPTIONS[importMethod].accept} onChange={handleFile} className="hidden" />
                  </>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" className={`${outlineButtonClass} text-red-600 hover:text-red-700`} onClick={confirmClearItems} disabled={draft.items.length === 0}>
                  <Trash2 className="h-4 w-4" /> Clear items
                </Button>
                <Button type="button" size="sm" onClick={addItem} disabled={draft.items.length >= MAX_SCHEDULE_ITEMS}>
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              </div>

              {parseInfo && (
                <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${darkMode ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50/70'}`}>
                  <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${darkMode ? 'text-emerald-300' : 'text-emerald-600'}`} />
                  <div className="min-w-0 text-xs">
                    <p><span className="font-semibold">{parseInfo.sourceName || 'Imported schedule'}</span><span className={mutedText}> · {parseInfo.stats?.itemCount || draft.items.length} items found</span></p>
                    {parseInfo.warnings?.map((warning) => <p key={warning} className={`mt-1 leading-relaxed ${mutedText}`}>{warning}</p>)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setParseInfo(null)}
                    className={`ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${darkMode ? 'text-emerald-300/70 hover:bg-emerald-400/10 hover:text-emerald-200' : 'text-emerald-700/60 hover:bg-emerald-100 hover:text-emerald-800'}`}
                    aria-label="Dismiss import summary"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {draft.items.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <SortableContext items={draft.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                    <div className={`overflow-hidden rounded-2xl border shadow-sm ${panelClass}`}>
                      <div className={`divide-y ${hairlineDivide}`}>
                        {draft.items.map((item, index) => (
                          <SortableScheduleItem key={item.id} id={item.id} disabled={!canReorder}>
                            {(drag) => renderItemEditor(item, index, drag)}
                          </SortableScheduleItem>
                        ))}
                      </div>
                    </div>
                  </SortableContext>
                  {activeItem && (
                    typeof document !== 'undefined'
                      ? createPortal(
                        <DragOverlay adjustScale={false} dropAnimation={SCHEDULE_DROP_ANIMATION} zIndex={1400}>
                          {renderItemEditor(activeItem, activeItemIndex, {
                            style: { width: activeOverlayWidth ? `${activeOverlayWidth}px` : undefined },
                          }, true)}
                        </DragOverlay>,
                        document.body
                      )
                      : (
                        <DragOverlay adjustScale={false} dropAnimation={SCHEDULE_DROP_ANIMATION} zIndex={1400}>
                          {renderItemEditor(activeItem, activeItemIndex, {}, true)}
                        </DragOverlay>
                      )
                  )}
                </DndContext>
              ) : (
                <button type="button" onClick={addItem} className={`flex w-full flex-col items-center rounded-2xl border border-dashed px-6 py-12 transition-colors ${darkMode ? 'border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800/40' : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'}`}>
                  <span className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}><Plus className="h-5 w-5" /></span>
                  <span className="text-xs font-semibold">Add the first schedule item</span>
                  <span className={`mt-1 text-[11px] ${mutedText}`}>Or go back and import one from a file</span>
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <div className={`overflow-hidden rounded-2xl border shadow-sm ${panelClass}`}>
                <div className={`divide-y ${hairlineDivide}`}>
                  <div className="flex items-start gap-3 p-4">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${darkMode ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-600'}`}><CirclePlay className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">Auto-start the next timed item</p>
                      <p className={`mt-1 text-[11px] leading-relaxed ${mutedText}`}>Manual items always wait for the operator.</p>
                    </div>
                    <Switch checked={draft.autoStartNext} onCheckedChange={(checked) => updateDraft({ autoStartNext: checked })} {...scheduleSwitchProps} />
                  </div>

                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${darkMode ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-50 text-violet-600'}`}><TimerReset className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">Transition indicator</p>
                        <p className={`mt-1 text-[11px] leading-relaxed ${mutedText}`}>Show a short up-next countdown between schedule items.</p>
                      </div>
                      <Switch checked={draft.indicator.enabled} onCheckedChange={(checked) => updateDraft({ indicator: { ...draft.indicator, enabled: checked } })} {...scheduleSwitchProps} />
                    </div>
                    <div className={`grid transition-all duration-200 ease-out ${draft.indicator.enabled ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="grid gap-3 pl-12 pt-4 sm:grid-cols-[1fr_120px]">
                          <label className="space-y-1.5"><span className={fieldLabelClass}>Indicator label</span><Input value={draft.indicator.label} onChange={(event) => updateDraft({ indicator: { ...draft.indicator, label: event.target.value } })} className={inputClass} /></label>
                          <label className="space-y-1.5"><span className={fieldLabelClass}>Duration (seconds)</span><Input type="number" min="0" value={draft.indicator.durationSeconds} onChange={(event) => updateDraft({ indicator: { ...draft.indicator, durationSeconds: event.target.value } })} className={inputClass} /></label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${darkMode ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-600'}`}><BellRing className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">Timing alerts</p>
                      <p className={`mt-1 text-[11px] leading-relaxed ${mutedText}`}>Notify the operator when a manual item begins or the projected finish runs late.</p>
                    </div>
                    <Switch checked={draft.notificationsEnabled} onCheckedChange={handleNotificationsChange} {...scheduleSwitchProps} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-gradient-to-br from-blue-500 via-blue-400 to-emerald-400 p-px shadow-sm">
                <section className={`overflow-hidden rounded-[15px] ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
                  <div className={`flex items-start justify-between gap-4 border-b p-4 ${cardHeaderClass}`}>
                    <div className="min-w-0">
                      <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${mutedText}`}>Ready to apply</p>
                      <h4 className="mt-1 truncate text-base font-semibold tracking-tight">{draft.title}</h4>
                      <p className={`mt-1 text-xs ${mutedText}`}>{draft.items.length} items · {timedItems.length} timed · {manualItems} manual</p>
                    </div>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${darkMode ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-600'}`}><CalendarClock className="h-5 w-5" /></div>
                  </div>

                  <dl className={`grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0 ${hairlineDivide}`}>
                    {[
                      ['Program time', formatDurationSummary(projection.knownRemainingMs + projection.transitionRemainingMs), Clock3],
                      ['Projected end', `${formatClock(projection.projectedEndAt)}${projection.isEstimate ? ' +' : ''}`, CalendarClock],
                      ['Ideal end', formatTimeLabel(draft.idealEndTime), CheckCircle2],
                      ['Transition', draft.indicator.enabled ? `${draft.indicator.durationSeconds}s` : 'Off', TimerReset],
                    ].map(([label, value, Icon]) => (
                      <div key={label} className="p-4">
                        <dt className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide ${mutedText}`}>
                          <Icon className="h-3 w-3" /> {label}
                        </dt>
                        <dd className="mt-1.5 text-sm font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>

              <section className={`rounded-2xl border p-4 ${insetClass}`}>
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold">Schedule behavior</p>
                    <p className={`mt-1 leading-relaxed ${mutedText}`}>
                      {draft.autoStartNext ? 'Timed items advance automatically.' : 'The operator advances every item.'}
                      {' '}{draft.indicator.enabled ? `A ${draft.indicator.durationSeconds}-second transition appears between items.` : 'Transitions are disabled.'}
                    </p>
                    {manualItems > 0 && <p className={`mt-1 leading-relaxed ${mutedText}`}>The projected finish is a minimum because {manualItems} manual {manualItems === 1 ? 'item has' : 'items have'} no fixed duration.</p>}
                  </div>
                </div>
              </section>

              <Button type="button" size="sm" variant="outline" className={outlineButtonClass} onClick={handleDownload} disabled={busy || draft.items.length === 0}>
                <Download className="h-4 w-4" /> {downloaded ? 'Saved .ldsch file' : 'Save a .ldsch copy'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className={`min-h-[78px] shrink-0 border-t px-4 py-4 sm:px-6 sm:py-5 ${darkMode ? 'border-slate-800 bg-slate-950/45' : 'border-slate-200 bg-slate-50'}`}>
        {blockedReason && !busy && (
          <p className={`mb-2 text-center text-[11px] sm:text-right ${mutedText}`}>{blockedReason}</p>
        )}
        <div className="flex items-center justify-between gap-3">
          <Button type="button" size="sm" variant="ghost" onClick={step === 0 ? () => onClose?.({ dismissed: true }) : () => setStep((current) => current - 1)}>
            {step === 0 ? 'Cancel' : <><ArrowLeft className="h-4 w-4" /> Back</>}
          </Button>
          <span className={`hidden text-[10px] font-medium sm:block ${mutedText}`}>Step {step + 1} of {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <Button type="button" size="sm" onClick={() => setStep((current) => current + 1)} disabled={!canContinue || busy}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={handleApply} disabled={draft.items.length === 0 || !labelsValid || !eventStartValid || busy}>
              <Check className="h-4 w-4" /> Apply schedule
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleCreatorWizard;
