import * as React from 'react';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const DATE_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseDateValue = (value) => {
  const match = DATE_VALUE_PATTERN.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

export const formatDateValue = (date) => {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '';
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const formatDateLabel = (value, emptyLabel = 'Not set') => {
  const date = parseDateValue(value);
  if (!date) return emptyLabel;
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const startOfCalendarGrid = (month) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12, 0, 0, 0);
  first.setDate(first.getDate() - first.getDay());
  return first;
};

const buildCalendarDays = (month) => {
  const first = startOfCalendarGrid(month);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
};

const DatePicker = React.forwardRef(({
  value = '',
  onChange,
  disabled = false,
  min = '',
  max = '',
  placeholder = 'Select date',
  ariaLabel = 'Date',
  allowClear = true,
  darkMode = false,
  className,
  contentClassName,
}, forwardedRef) => {
  const [open, setOpen] = React.useState(false);
  const selectedDate = parseDateValue(value);
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const initial = selectedDate || new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1, 12, 0, 0, 0);
  });

  React.useEffect(() => {
    if (!open || !selectedDate) return;
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12, 0, 0, 0));
  }, [open, value]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = React.useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const todayValue = formatDateValue(new Date());
  const surfaceClass = darkMode
    ? 'border-slate-700 bg-slate-950 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900';
  const mutedClass = darkMode ? 'text-slate-400' : 'text-slate-500';
  const iconButtonClass = darkMode
    ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950';
  const weekdayLabels = React.useMemo(() => {
    const sunday = new Date(2026, 0, 4, 12, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + index);
      return new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(date);
    });
  }, []);

  const changeMonth = (delta) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12, 0, 0, 0));
  };

  const chooseDate = (date) => {
    const nextValue = formatDateValue(date);
    if ((min && nextValue < min) || (max && nextValue > max)) return;
    onChange?.(nextValue);
    setOpen(false);
  };

  const chooseToday = () => {
    const today = new Date();
    const todayString = formatDateValue(today);
    if ((min && todayString < min) || (max && todayString > max)) return;
    onChange?.(todayString);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={forwardedRef}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-md border px-3 text-left text-[11px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
            darkMode
              ? 'border-slate-700 bg-slate-950/55 focus-visible:ring-blue-500/40'
              : 'border-slate-300 bg-white focus-visible:ring-blue-500/30',
            className
          )}
        >
          <CalendarDays className={cn('h-3.5 w-3.5 shrink-0', mutedClass)} />
          <span className={cn('min-w-0 flex-1 truncate', value ? (darkMode ? 'text-slate-100' : 'text-slate-900') : mutedClass)}>
            {value ? formatDateLabel(value) : placeholder}
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0', mutedClass)} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className={cn('z-[1600] w-[310px] rounded-xl p-0 shadow-xl', surfaceClass, contentClassName)}>
        <div className={cn('flex items-center justify-between border-b px-3 py-3', darkMode ? 'border-slate-800' : 'border-slate-200')}>
          <button type="button" onClick={() => changeMonth(-1)} className={cn('rounded-lg p-2 transition-colors', iconButtonClass)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-xs font-semibold">{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(visibleMonth)}</p>
          <button type="button" onClick={() => changeMonth(1)} className={cn('rounded-lg p-2 transition-colors', iconButtonClass)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-7 gap-1" aria-hidden="true">
            {weekdayLabels.map((label, index) => <span key={`${label}-${index}`} className={cn('py-1 text-center text-[9px] font-semibold uppercase', mutedClass)}>{label}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label={new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(visibleMonth)}>
            {days.map((date) => {
              const dateValue = formatDateValue(date);
              const selected = dateValue === value;
              const today = dateValue === todayValue;
              const outsideMonth = date.getMonth() !== visibleMonth.getMonth();
              const unavailable = (min && dateValue < min) || (max && dateValue > max);
              return (
                <button
                  key={dateValue}
                  type="button"
                  role="gridcell"
                  aria-selected={selected}
                  aria-label={formatDateLabel(dateValue)}
                  disabled={Boolean(unavailable)}
                  onClick={() => chooseDate(date)}
                  className={cn(
                    'relative flex h-8 items-center justify-center rounded-lg text-[10px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-25',
                    selected
                      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-600'
                      : (darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'),
                    !selected && outsideMonth && mutedClass,
                    !selected && today && (darkMode ? 'ring-1 ring-inset ring-blue-400/60 text-blue-300' : 'ring-1 ring-inset ring-blue-500/50 text-blue-700')
                  )}
                >
                  {date.getDate()}
                  {selected && <Check className="absolute right-0.5 top-0.5 h-2.5 w-2.5" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className={cn('flex items-center justify-between border-t px-3 py-2.5', darkMode ? 'border-slate-800' : 'border-slate-200')}>
          {allowClear && value ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => { onChange?.(''); setOpen(false); }} className={cn('h-7 px-2 text-[10px]', mutedClass)}>
              <X className="h-3 w-3" /> Clear
            </Button>
          ) : <span />}
          <Button type="button" size="sm" variant="ghost" onClick={chooseToday} className="h-7 px-2.5 text-[10px]">
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
});

DatePicker.displayName = 'DatePicker';

export { DatePicker };
