import React from 'react';
import { useLocation } from 'react-router-dom';
import useSocket from '../hooks/useSocket';
import useSharedTimer from '../hooks/useSharedTimer';
import { formatGlobalClock, isTimerVisiblyActive, splitClockPeriod } from '../utils/timerUtils';
import { useTimerDisplaySettings } from '../hooks/useStoreSelectors';
import { paintToCss } from '../utils/paint';
import ProjectionExitHint from '../components/ProjectionExitHint';

const PERIOD_STYLE = {
  fontSize: '0.38em',
  marginLeft: '0.12em',
  verticalAlign: 'baseline',
  lineHeight: 1,
};

const ClockValue = ({ value }) => {
  const { time, period } = splitClockPeriod(value);

  return (
    <>
      {time}
      {period && <span style={PERIOD_STYLE}>{period}</span>}
    </>
  );
};

const getDisplayUpdatedAt = (display) => {
  const updatedAt = Number(display?.displayUpdatedAt);
  return Number.isFinite(updatedAt) ? updatedAt : 0;
};

const AUTO_FIT_CACHE_LIMIT = 80;
const autoFitCache = new Map();

const getTextFitShape = (text) => String(text || '')
  .replace(/[0-9]/g, '0')
  .replace(/[A-Z]/g, 'A')
  .replace(/[a-z]/g, 'a');

const getFontFitKey = (display) => [
  display.timerFontFamily || display.fontFamily || 'Bebas Neue',
  display.timerBold === false ? '400' : '700',
  display.timerItalic ? 'italic' : 'normal',
  display.timerUnderline ? 'underline' : 'none',
  display.timerAlign || 'center',
].join('|');

const rememberAutoFit = (key, value) => {
  if (autoFitCache.has(key)) {
    autoFitCache.delete(key);
  }
  autoFitCache.set(key, value);
  while (autoFitCache.size > AUTO_FIT_CACHE_LIMIT) {
    autoFitCache.delete(autoFitCache.keys().next().value);
  }
};

const useAutoFitText = ({ enabled = true, fitKey }) => {
  const [containerEl, setContainerEl] = React.useState(null);
  const [textEl, setTextEl] = React.useState(null);
  const [fontSize, setFontSize] = React.useState(null);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    if (!enabled || !containerEl) return undefined;

    const updateSize = () => {
      const width = Math.round(containerEl.clientWidth);
      const height = Math.round(containerEl.clientHeight);
      setContainerSize((current) => (
        current.width === width && current.height === height
          ? current
          : { width, height }
      ));
    };

    let frame = null;
    const scheduleSize = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        updateSize();
      });
    };

    updateSize();
    const observer = new ResizeObserver(scheduleSize);
    observer.observe(containerEl);
    window.addEventListener('resize', scheduleSize);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', scheduleSize);
    };
  }, [containerEl, enabled]);

  React.useLayoutEffect(() => {
    if (!enabled || !containerEl || !textEl) return undefined;
    if (containerSize.width <= 0 || containerSize.height <= 0) return undefined;

    const fit = () => {
      const availableWidth = containerSize.width * 0.995;
      const availableHeight = containerSize.height * 0.98;
      if (availableWidth <= 0 || availableHeight <= 0) return;

      const cacheKey = `${fitKey}|${Math.round(availableWidth)}x${Math.round(availableHeight)}`;
      const cached = autoFitCache.get(cacheKey);
      if (cached) {
        setFontSize((current) => (current === cached ? current : cached));
        return;
      }

      const previousFontSize = textEl.style.fontSize;
      let low = 24;
      let high = 1000;
      let best = low;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        textEl.style.fontSize = `${mid}px`;
        const rect = textEl.getBoundingClientRect();
        if (rect.width <= availableWidth && rect.height <= availableHeight) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      textEl.style.fontSize = previousFontSize;
      rememberAutoFit(cacheKey, best);
      setFontSize(best);
    };

    let frame = null;
    const scheduleFit = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        fit();
      });
    };

    frame = window.requestAnimationFrame(() => {
      frame = null;
      fit();
    });

    const fontsReady = document.fonts?.ready;
    fontsReady?.then?.(scheduleFit).catch?.(() => {});

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [containerEl, containerSize.height, containerSize.width, enabled, fitKey, textEl]);

  return {
    containerRef: setContainerEl,
    textRef: setTextEl,
    fontSize,
  };
};

const TimeDisplay = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isPreviewMode = searchParams.get('preview') === 'true';
  const isProjectionMode = ['1', 'true'].includes((searchParams.get('projection') || '').toLowerCase());
  const showProjectionExitHint = ['1', 'true'].includes((searchParams.get('escapeHint') || '').toLowerCase());

  useSocket('stage', { preview: isPreviewMode, purpose: 'time-display' });
  const { timerState, displayValue, intensity, now, progress } = useSharedTimer({
    controller: false,
    renderTickIntervalMs: 1000,
  });
  const { settings: timerDisplaySettings } = useTimerDisplaySettings();

  const display = React.useMemo(() => {
    const localDisplay = timerDisplaySettings || {};
    const stateDisplay = timerState.display || {};
    return getDisplayUpdatedAt(stateDisplay) >= getDisplayUpdatedAt(localDisplay)
      ? { ...localDisplay, ...stateDisplay }
      : { ...stateDisplay, ...localDisplay };
  }, [timerDisplaySettings, timerState.display]);
  const hasActiveTimer = isTimerVisiblyActive(timerState, now);
  const shouldShowClock = !hasActiveTimer && display.showClockWhenIdle !== false;
  const clockValue = React.useMemo(() => formatGlobalClock(now, display), [display, now]);
  const clockParts = React.useMemo(() => splitClockPeriod(clockValue), [clockValue]);
  const showGlobalClock = display.showGlobalClock !== false;
  const showSecondaryText = display.showSecondaryText !== false;
  const isWaitingForTime = !hasActiveTimer && !showGlobalClock;
  const isIdleFullScreenClock = shouldShowClock && !isWaitingForTime;

  const value = isWaitingForTime ? 'Waiting for time...' : (isIdleFullScreenClock ? clockParts.time : displayValue);
  const label = !showSecondaryText || isWaitingForTime
    ? ''
    : shouldShowClock
    ? 'Current Time'
    : (timerState.phase === 'indicator' ? timerState.indicatorLabel : (timerState.label || display.label || 'Time Left:'));

  const accentColor = intensity === 'critical'
    ? (display.criticalColor || '#EF4444')
    : intensity === 'warning'
      ? (display.warningColor || '#F59E0B')
      : (display.accentColor || '#FFA500');

  const textColor = intensity === 'critical'
    ? (display.criticalColor || '#EF4444')
    : (display.textColor || '#FFFFFF');
  const timerFontSizeMode = display.timerFontSizeMode || 'auto';
  const autoFitEnabled = timerFontSizeMode !== 'manual';
  const autoFitKey = React.useMemo(() => [
    getTextFitShape(value),
    getFontFitKey(display),
    hasActiveTimer && showGlobalClock && showSecondaryText ? 'active-with-clock' : 'primary',
  ].join('|'), [display, hasActiveTimer, showGlobalClock, showSecondaryText, value]);
  const { containerRef, textRef, fontSize: autoFontSize } = useAutoFitText({
    enabled: autoFitEnabled,
    fitKey: autoFitKey,
  });
  const mainFontSize = autoFitEnabled ? (autoFontSize || 220) : (Number(display.timerFontSize) || 180);
  const otherItemsScale = Math.min(2, Math.max(0.08, Number(display.otherItemsScale ?? display.globalClockScale) || 0.1));
  const otherItemsFontSize = Math.max(16, mainFontSize * otherItemsScale);
  const otherItemsFontFamily = display.fontFamily || 'Bebas Neue';
  const alignItems = display.timerAlign === 'left'
    ? 'flex-start'
    : display.timerAlign === 'right'
      ? 'flex-end'
      : 'center';

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex items-center justify-center"
      style={{
        background: paintToCss(display.backgroundPaint, display.backgroundColor || '#000000'),
        fontFamily: otherItemsFontFamily,
        contain: 'layout paint style',
        isolation: 'isolate',
      }}
    >
      <ProjectionExitHint visible={isProjectionMode && showProjectionExitHint} />
      {label && (
      <div className="absolute inset-x-0 top-[7vh] flex justify-center px-[1vw]">
        <div
          className="font-bold leading-none text-center"
          style={{
            color: accentColor,
            fontSize: `${otherItemsFontSize}px`,
            fontFamily: otherItemsFontFamily,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            animation: intensity === 'critical' && timerState.running ? 'timerPulse 1s infinite' : 'none',
          }}
        >
          {label}
        </div>
      </div>
      )}

      <div className="w-full px-[1vw] pt-[3vh]">
        <div
          ref={containerRef}
          className="w-full flex flex-col justify-center overflow-hidden"
          style={{
            alignItems,
            height: hasActiveTimer && showGlobalClock && showSecondaryText ? '70vh' : '86vh',
            contain: 'layout paint',
          }}
        >
          <div
            ref={textRef}
            className="leading-none whitespace-nowrap"
            style={{
              color: textColor,
              fontFamily: display.timerFontFamily || display.fontFamily || 'Bebas Neue',
              fontSize: `${mainFontSize}px`,
              fontWeight: display.timerBold === false ? 400 : 700,
              fontStyle: display.timerItalic ? 'italic' : 'normal',
              textDecoration: display.timerUnderline ? 'underline' : 'none',
              textAlign: display.timerAlign || 'center',
              letterSpacing: 0,
              fontVariantNumeric: 'tabular-nums',
              fontFeatureSettings: '"tnum" 1, "lnum" 1',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: isWaitingForTime ? 0.45 : 1,
              animation: intensity === 'critical' && timerState.running ? 'timerPulse 1s infinite' : 'none',
              contain: 'layout paint',
            }}
          >
            {value}
          </div>
          {showSecondaryText && isIdleFullScreenClock && clockParts.period && (
            <div
              className="font-bold leading-none text-center"
              style={{
                color: accentColor,
                fontSize: `${otherItemsFontSize}px`,
                fontFamily: otherItemsFontFamily,
                marginTop: '0.08em',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {clockParts.period}
            </div>
          )}
        </div>

        {display.showProgress !== false && hasActiveTimer && (
          <div
            className="mx-auto mt-4 rounded-full overflow-hidden"
            style={{
              width: 'min(82vw, 1400px)',
              height: 'clamp(8px, 1.2vh, 18px)',
              backgroundColor: 'rgba(255,255,255,0.16)',
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
                backgroundColor: accentColor,
              }}
            />
          </div>
        )}

        {showSecondaryText && hasActiveTimer && timerState.sets?.length > 1 && (
          <div className="mt-8 flex justify-center">
            <div
              className="px-5 py-2 rounded bg-white/10 text-white/80 text-sm font-sans"
              style={{ fontFamily: otherItemsFontFamily }}
            >
              {timerState.phase === 'indicator'
                ? `Next: ${timerState.sets[timerState.activeSetIndex + 1]?.label || 'Timer'}`
                : `${timerState.activeSetIndex + 1} of ${timerState.sets.length}`}
            </div>
          </div>
        )}
        {showSecondaryText && showGlobalClock && hasActiveTimer && (
          <div
            className="mx-auto mt-2 w-full text-center font-mono font-semibold leading-none"
            style={{
              color: 'rgba(255,255,255,0.72)',
              fontSize: `${otherItemsFontSize}px`,
              fontFamily: otherItemsFontFamily,
              fontVariantNumeric: 'tabular-nums',
              fontFeatureSettings: '"tnum" 1, "lnum" 1',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <ClockValue value={clockValue} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes timerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default TimeDisplay;
