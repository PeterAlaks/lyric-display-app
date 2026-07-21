import * as React from 'react'
import { Check, ChevronDown, Clock3, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const TIME_VALUE_PATTERN = /^(\d{2}):(\d{2})$/

export const timeValueToMinutes = (value) => {
  const match = TIME_VALUE_PATTERN.exec(String(value || ''))
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return (hours * 60) + minutes
}

export const isTimeValueInFuture = (value, referenceTime = Date.now()) => {
  const minutes = timeValueToMinutes(value)
  if (minutes === null) return false

  const reference = new Date(referenceTime)
  const selected = new Date(referenceTime)
  selected.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return selected.getTime() > reference.getTime()
}

export const parseTimeValue = (value, hourFormat = '12') => {
  const totalMinutes = timeValueToMinutes(value)
  if (totalMinutes === null) return { hour: '', minute: '', period: 'AM' }

  const hour24 = Math.floor(totalMinutes / 60)
  return {
    hour: hourFormat === '24' ? String(hour24).padStart(2, '0') : String(hour24 % 12 || 12),
    minute: String(totalMinutes % 60).padStart(2, '0'),
    period: hour24 >= 12 ? 'PM' : 'AM',
  }
}

export const formatTimeValue = ({ hour, minute, period }, hourFormat = '12') => {
  if (hour === '' || minute === '') return ''

  const hourNumber = Math.trunc(Number(hour))
  const minuteNumber = Math.trunc(Number(minute))
  if (!Number.isFinite(hourNumber) || !Number.isFinite(minuteNumber) || minuteNumber < 0 || minuteNumber > 59) return ''

  if (hourFormat === '24') {
    if (hourNumber < 0 || hourNumber > 23) return ''
    return `${String(hourNumber).padStart(2, '0')}:${String(minuteNumber).padStart(2, '0')}`
  }

  if (hourNumber < 1 || hourNumber > 12 || !['AM', 'PM'].includes(period)) return ''
  const hour24 = period === 'PM' ? (hourNumber % 12) + 12 : hourNumber % 12
  return `${String(hour24).padStart(2, '0')}:${String(minuteNumber).padStart(2, '0')}`
}

export const formatTimeLabel = (value, hourFormat = '12', emptyLabel = 'Not set') => {
  const parts = parseTimeValue(value, hourFormat)
  if (!parts.hour || !parts.minute) return emptyLabel
  return hourFormat === '24'
    ? `${parts.hour}:${parts.minute}`
    : `${Number(parts.hour)}:${parts.minute} ${parts.period}`
}

export const formatRelativeTimePreview = (value, hourFormat = '12', referenceTime = Date.now()) => {
  const minutes = timeValueToMinutes(value)
  if (minutes === null) return ''

  const selected = new Date(referenceTime)
  selected.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  const dayLabel = selected.getTime() <= referenceTime ? 'Tomorrow' : 'Today'
  return `${dayLabel} at ${formatTimeLabel(value, hourFormat)}`
}

const timeFromOffset = (offsetMinutes, referenceTime = Date.now()) => {
  const selected = new Date(referenceTime + (offsetMinutes * 60_000))
  return `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`
}

const clampPart = (value, min, max) => {
  if (value === '') return ''
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return ''
  return String(Math.min(max, Math.max(min, number)))
}

const TimePicker = React.forwardRef(({
  value = '',
  onChange,
  disabled = false,
  hourFormat: controlledHourFormat,
  defaultHourFormat = '12',
  onHourFormatChange,
  disablePast = false,
  invalidMessage = 'Choose a time later than the current time.',
  placeholder = 'Select time',
  ariaLabel = 'Time',
  relativePreview = false,
  allowClear = true,
  className,
  contentClassName,
  darkMode = false,
}, forwardedRef) => {
  const [open, setOpen] = React.useState(false)
  const [internalHourFormat, setInternalHourFormat] = React.useState(defaultHourFormat)
  const [referenceTime, setReferenceTime] = React.useState(Date.now())
  const hourFormat = controlledHourFormat || internalHourFormat
  const [parts, setParts] = React.useState(() => parseTimeValue(value, hourFormat))

  React.useEffect(() => {
    setParts(parseTimeValue(value, hourFormat))
  }, [hourFormat, value])

  React.useEffect(() => {
    if (!disablePast) return undefined
    setReferenceTime(Date.now())
    const interval = window.setInterval(() => setReferenceTime(Date.now()), 15_000)
    return () => window.clearInterval(interval)
  }, [disablePast])

  const invalid = Boolean(value) && disablePast && !isTimeValueInFuture(value, referenceTime)
  const surfaceClass = darkMode
    ? 'border-slate-700 bg-slate-950 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900'
  const mutedClass = darkMode ? 'text-slate-400' : 'text-slate-500'
  const inputSurfaceClass = darkMode
    ? 'border-slate-700 bg-slate-900 text-slate-100 focus:border-blue-400 focus:ring-blue-500/30'
    : 'border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-blue-500/20'

  const commitParts = React.useCallback((nextParts) => {
    setParts(nextParts)
    const nextValue = formatTimeValue(nextParts, hourFormat)
    if (nextValue) onChange?.(nextValue)
  }, [hourFormat, onChange])

  const updatePart = (part, rawValue) => {
    const numericValue = String(rawValue).replace(/\D/g, '').slice(0, 2)
    const fallback = parseTimeValue(timeFromOffset(1), hourFormat)
    commitParts({
      hour: parts.hour || fallback.hour,
      minute: parts.minute || '00',
      period: parts.period || fallback.period,
      [part]: numericValue,
    })
  }

  const normalizeParts = () => {
    if (parts.hour === '' || parts.minute === '') {
      setParts(parseTimeValue(value, hourFormat))
      return
    }
    const normalized = {
      ...parts,
      hour: clampPart(parts.hour, hourFormat === '24' ? 0 : 1, hourFormat === '24' ? 23 : 12),
      minute: clampPart(parts.minute, 0, 59),
    }
    commitParts(normalized)
  }

  const changeHourFormat = (nextFormat) => {
    if (!controlledHourFormat) setInternalHourFormat(nextFormat)
    onHourFormatChange?.(nextFormat)
  }

  const preview = relativePreview
    ? formatRelativeTimePreview(value, hourFormat, referenceTime)
    : formatTimeLabel(value, hourFormat, '')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={forwardedRef}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-md border px-3 text-left text-[11px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
            invalid
              ? (darkMode ? 'border-red-400/60 bg-red-500/5 focus-visible:ring-red-400/40' : 'border-red-400 bg-red-50/30 focus-visible:ring-red-400/30')
              : (darkMode ? 'border-slate-700 bg-slate-950/55 focus-visible:ring-blue-500/40' : 'border-slate-300 bg-white focus-visible:ring-blue-500/30'),
            className
          )}
        >
          <Clock3 className={cn('h-3.5 w-3.5 shrink-0', invalid ? 'text-red-500' : mutedClass)} />
          <span className={cn('min-w-0 flex-1 truncate tabular-nums', value ? (darkMode ? 'text-slate-100' : 'text-slate-900') : mutedClass)}>
            {value ? formatTimeLabel(value, hourFormat) : placeholder}
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0', mutedClass)} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn('z-[1600] w-[290px] rounded-xl p-0 shadow-xl', surfaceClass, contentClassName)}
      >
        <div className={cn('flex items-center justify-between border-b px-4 py-3', darkMode ? 'border-slate-800' : 'border-slate-200')}>
          <p className="text-xs font-semibold">Select time</p>
          <div className={cn('flex rounded-lg p-1', darkMode ? 'bg-slate-800' : 'bg-slate-100')}>
            {['12', '24'].map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => changeHourFormat(format)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition-colors',
                  hourFormat === format
                    ? (darkMode ? 'bg-slate-950 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm')
                    : mutedClass
                )}
              >
                {format}h
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 px-4 pb-2.5 pt-4">
          <div className="flex items-center justify-center gap-2" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) normalizeParts()
          }}>
            <input
              type="text"
              inputMode="numeric"
              value={parts.hour}
              onChange={(event) => updatePart('hour', event.target.value)}
              placeholder="HH"
              aria-label={`${ariaLabel} hour`}
              className={cn('h-14 w-20 rounded-lg border text-center text-xl font-semibold tabular-nums outline-none ring-0 transition-shadow focus:ring-2', inputSurfaceClass)}
            />
            <span className={cn('pb-1 text-xl font-semibold', mutedClass)}>:</span>
            <input
              type="text"
              inputMode="numeric"
              value={parts.minute}
              onChange={(event) => updatePart('minute', event.target.value)}
              placeholder="MM"
              aria-label={`${ariaLabel} minute`}
              className={cn('h-14 w-20 rounded-lg border text-center text-xl font-semibold tabular-nums outline-none ring-0 transition-shadow focus:ring-2', inputSurfaceClass)}
            />
            {hourFormat === '12' && (
              <div className={cn('grid h-14 w-12 grid-rows-2 gap-0.5 rounded-lg p-0.5', darkMode ? 'bg-slate-800' : 'bg-slate-100')}>
                {['AM', 'PM'].map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => commitParts({ ...parts, period })}
                    className={cn(
                      'rounded text-[9px] font-bold transition-colors',
                      parts.period === period
                        ? 'bg-blue-600 text-white shadow-sm'
                        : mutedClass
                    )}
                  >
                    {period}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-4">
            {invalid ? (
              <p className={cn('text-[10px] leading-relaxed', darkMode ? 'text-red-300' : 'text-red-600')}>{invalidMessage}</p>
            ) : preview ? (
              <p className={cn('text-[10px] leading-relaxed', mutedClass)}>{preview}</p>
            ) : (
              <p className={cn('text-[10px] leading-relaxed', mutedClass)}>Choose an hour and minute.</p>
            )}
          </div>
        </div>

        <div className={cn('flex items-center justify-between border-t px-3 py-2.5', darkMode ? 'border-slate-800' : 'border-slate-200')}>
          {allowClear && value ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange?.('')} className={cn('h-7 px-2 text-[10px]', mutedClass)}>
              <X className="h-3 w-3" /> Clear
            </Button>
          ) : <span />}
          <Button type="button" size="sm" onClick={() => setOpen(false)} disabled={invalid || !value} className="h-7 px-2.5 text-[10px]">
            <Check className="h-3 w-3" /> Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
})
TimePicker.displayName = 'TimePicker'

export { TimePicker }
