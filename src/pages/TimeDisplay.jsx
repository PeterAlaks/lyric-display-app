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

const useAutoFitText = (text, enabled = true) => {
  const [containerEl, setContainerEl] = React.useState(null);
  const [textEl, setTextEl] = React.useState(null);
  const [fontSize, setFontSize] = React.useState(null);

  React.useLayoutEffect(() => {
    if (!enabled || !containerEl || !textEl) return undefined;

    const fit = () => {
      const availableWidth = containerEl.clientWidth * 0.995;
      const availableHeight = containerEl.clientHeight * 0.98;
      if (availableWidth <= 0 || availableHeight <= 0) return;

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
    const observer = new ResizeObserver(scheduleFit);
    observer.observe(containerEl);
    window.addEventListener('resize', scheduleFit);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', scheduleFit);
    };
  }, [containerEl, textEl, text, enabled]);

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
  const { containerRef, textRef, fontSize: autoFontSize } = useAutoFitText(value, autoFitEnabled);
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
