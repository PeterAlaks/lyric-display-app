import * as React from "react";
import { createPortal } from "react-dom";
import { Droplet, SquareDashed } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { cn } from "@/lib/utils";
import {
  createLinearGradientPaint,
  createSolidPaint,
  getSolidPaintColor,
  normalizePaint,
  paintToCss,
} from "@/utils/paint";

const STOP_LABELS = ['Start', 'End'];

const clampGradientAngle = (value) => Math.min(360, Math.max(0, Number(value) || 0));

const GradientAngleDial = ({ value, onChange, darkMode }) => {
  const angle = clampGradientAngle(value);
  const dialAngle = angle === 360 ? 0 : angle;
  const radians = dialAngle * (Math.PI / 180);
  const handlePosition = {
    left: `${50 + (Math.sin(radians) * 30)}%`,
    top: `${50 - (Math.cos(radians) * 30)}%`,
  };

  const updateFromPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (bounds.left + (bounds.width / 2));
    const y = event.clientY - (bounds.top + (bounds.height / 2));
    const degrees = (Math.atan2(x, -y) * 180) / Math.PI;
    onChange(Math.round((degrees + 360) % 360));
  };

  const handlePointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateFromPointer(event);
  };

  const handlePointerMove = (event) => {
    if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
    updateFromPointer(event);
  };

  const handleKeyDown = (event) => {
    const step = event.shiftKey ? 15 : 1;
    let nextAngle = null;

    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') nextAngle = angle + step;
    if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') nextAngle = angle - step;
    if (event.key === 'Home') nextAngle = 0;
    if (event.key === 'End') nextAngle = 360;
    if (nextAngle === null) return;

    event.preventDefault();
    onChange(clampGradientAngle(nextAngle));
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Gradient angle"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={angle}
      aria-valuetext={`${angle} degrees`}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => event.currentTarget.releasePointerCapture?.(event.pointerId)}
      onPointerCancel={(event) => event.currentTarget.releasePointerCapture?.(event.pointerId)}
      className={cn(
        "relative h-[30px] w-[30px] shrink-0 touch-none cursor-pointer rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        darkMode ? "border-gray-500 bg-gray-700" : "border-gray-400 bg-white"
      )}
    >
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute left-1/2 top-1/2 h-px w-2 origin-left rounded-full", darkMode ? "bg-blue-300" : "bg-blue-600")}
        style={{ transform: `translateY(-50%) rotate(${dialAngle - 90}deg)` }}
      />
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full", darkMode ? "bg-blue-200" : "bg-blue-700")}
      />
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute h-[4px] w-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full border", darkMode ? "border-blue-200 bg-gray-800" : "border-blue-700 bg-white")}
        style={handlePosition}
      />
    </div>
  );
};

const activeButtonClass = (darkMode) => (
  darkMode
    ? "!bg-white !text-gray-900 hover:!bg-white !border-gray-300 !transition-none"
    : "!bg-black !text-white hover:!bg-black !border-gray-300 !transition-none"
);

const inactiveButtonClass = (darkMode) => (
  darkMode
    ? "!bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700 !transition-none"
    : "!bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100 !transition-none"
);

const PaintPicker = React.forwardRef(({
  value,
  fallbackColor = '#000000',
  onChange,
  className,
  disabled,
  showValue = false,
  darkMode = false,
  presentation = "default",
  popoverAlign = "start",
  popoverSide = "top",
  ...props
}, ref) => {
  const normalizedValue = React.useMemo(() => normalizePaint(value, fallbackColor), [fallbackColor, value]);
  const [localPaint, setLocalPaint] = React.useState(normalizedValue);
  const [open, setOpen] = React.useState(false);
  const contentRef = React.useRef(null);
  const sheetMode = presentation === "sheet";

  React.useEffect(() => {
    setLocalPaint(normalizedValue);
  }, [normalizedValue]);

  React.useEffect(() => {
    if (!open) return undefined;

    const blockOutsideScroll = (event) => {
      const target = event.target;
      if (contentRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-popover-scroll-lock-allow="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const opts = { passive: false, capture: true };
    window.addEventListener('wheel', blockOutsideScroll, opts);
    window.addEventListener('touchmove', blockOutsideScroll, opts);

    return () => {
      window.removeEventListener('wheel', blockOutsideScroll, opts);
      window.removeEventListener('touchmove', blockOutsideScroll, opts);
    };
  }, [open]);

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen || sheetMode) {
      setLocalPaint(normalizedValue);
    }
  };

  const commitPaint = (paint) => {
    const normalized = normalizePaint(paint, fallbackColor);
    setLocalPaint(normalized);
    if (!sheetMode) {
      onChange?.(normalized);
    }
  };

  const applyPaint = () => {
    onChange?.(normalizePaint(localPaint, fallbackColor));
    setOpen(false);
  };

  const setMode = (mode) => {
    if (mode === localPaint.type) return;

    if (mode === 'linear') {
      const baseColor = getSolidPaintColor(localPaint, fallbackColor);
      commitPaint(createLinearGradientPaint({
        angle: 135,
        stops: [
          { color: baseColor, position: 0 },
          { color: '#000000', position: 100 },
        ],
      }));
      return;
    }

    const solidColor = localPaint.type === 'linear'
      ? localPaint.stops[0]?.color
      : localPaint.color;
    commitPaint(createSolidPaint(solidColor || fallbackColor));
  };

  const updateSolidColor = (color) => {
    commitPaint(createSolidPaint(color));
  };

  const updateGradientStop = (stopIndex, color) => {
    if (localPaint.type !== 'linear') return;

    const nextStops = localPaint.stops.map((stop, index) => (
      index === stopIndex ? { ...stop, color } : stop
    ));
    commitPaint({ ...localPaint, stops: nextStops });
  };

  const updateGradientAngle = (rawValue) => {
    if (localPaint.type !== 'linear') return;
    const nextAngle = clampGradientAngle(rawValue);
    commitPaint({ ...localPaint, angle: nextAngle });
  };

  const reverseGradient = () => {
    if (localPaint.type !== 'linear') return;
    commitPaint({
      ...localPaint,
      stops: [...localPaint.stops].reverse().map((stop, index) => ({
        ...stop,
        position: index === 0 ? 0 : 100,
      })),
    });
  };

  const previewBackground = paintToCss(localPaint, fallbackColor);

  const paintPanel = (
    <div className={`${presentation === 'sheet' ? 'mx-auto max-w-sm' : ''} space-y-3`}>
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMode('solid')}
          className={cn(localPaint.type === 'solid' ? activeButtonClass(darkMode) : inactiveButtonClass(darkMode))}
        >
          <Droplet className="mr-1.5 h-4 w-4" />
          Solid
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMode('linear')}
          className={cn(localPaint.type === 'linear' ? activeButtonClass(darkMode) : inactiveButtonClass(darkMode))}
        >
          <SquareDashed className="mr-1.5 h-4 w-4" />
          Gradient
        </Button>
      </div>

      <div data-paint-picker-preview className="h-8 w-full rounded-xl border border-border" style={{ background: previewBackground }} />

      {localPaint.type === 'solid' && (
        <div className="space-y-2">
          <div className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Colour
          </div>
          <ColorPicker
            value={localPaint.color}
            onChange={updateSolidColor}
            darkMode={darkMode}
            showHex
            presentation={presentation}
            className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}
          />
        </div>
      )}

      {localPaint.type === 'linear' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Stops
            </div>
            {STOP_LABELS.map((label, index) => (
              <div
                key={label}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border p-2",
                  darkMode ? "border-gray-700 bg-gray-900/30" : "border-gray-200 bg-gray-50"
                )}
              >
                <span className={`w-10 text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {label}
                </span>
                <ColorPicker
                  value={localPaint.stops[index]?.color || fallbackColor}
                  onChange={(color) => updateGradientStop(index, color)}
                  darkMode={darkMode}
                  showHex
                  presentation={presentation}
                  className={cn(
                    "min-w-0 flex-1",
                    darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'
                  )}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Angle
            </div>
            <div className="flex items-center gap-3">
              <GradientAngleDial
                value={localPaint.angle}
                onChange={updateGradientAngle}
                darkMode={darkMode}
              />
              <Input
                type="number"
                value={localPaint.angle}
                onChange={(event) => updateGradientAngle(event.target.value)}
                min={0}
                max={360}
                aria-label="Gradient angle in degrees"
                className={`min-w-0 flex-1 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={reverseGradient}
                className={cn("shrink-0", darkMode ? inactiveButtonClass(darkMode) : "")}
              >
                Reverse
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 items-center gap-2 rounded-md border border-input bg-transparent text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            showValue ? "w-full px-3 py-2" : "w-12 justify-center p-1.5",
            className
          )}
          {...props}
        >
          <div
            data-paint-picker-preview
            className={cn(
              "rounded border border-border shrink-0",
              showValue ? "h-5 w-5" : "h-6 w-full"
            )}
            style={{ background: previewBackground }}
          />
          {showValue && (
            <span className="flex-1 truncate text-left font-mono text-xs">
              {localPaint.type === 'linear'
                ? 'Gradient'
                : localPaint.color.toUpperCase()}
            </span>
          )}
        </button>
      </PopoverTrigger>

      {sheetMode && open && typeof document !== 'undefined' ? createPortal(
        <div
          className="fixed inset-0 z-[2350] bg-black/35 p-2"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleOpenChange(false);
          }}
        >
          <div
            ref={contentRef}
            data-popover-scroll-lock-allow="true"
            className={`flex h-full flex-col overflow-hidden rounded-lg border shadow-2xl ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
          >
            <div className={`flex items-center justify-between border-b px-4 py-3 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Choose Fill</div>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${darkMode ? 'border-gray-700 text-gray-200 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {paintPanel}
            </div>
            <div className={`border-t p-3 ${darkMode ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-gray-50'}`}>
              <Button
                type="button"
                onClick={applyPaint}
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>,
        document.body
      ) : (
        <PopoverContent
          ref={contentRef}
          data-popover-scroll-lock-allow="true"
          className={`w-[272px] p-3 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
          align={popoverAlign}
          side={popoverSide}
          avoidCollisions
          collisionPadding={12}
        >
          {paintPanel}
        </PopoverContent>
      )}
    </Popover>
  );
});

PaintPicker.displayName = "PaintPicker";

export { PaintPicker };
