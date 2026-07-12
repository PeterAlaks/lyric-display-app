import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  FolderOpen,
  Globe,
  Keyboard,
  ListMusic,
  MonitorUp,
  MousePointer2,
  Power,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { FIRST_RUN_TOUR_STEP_EVENT, getTourCardPosition } from '../utils/firstRunTour';

const TOUR_STEPS = [
  {
    id: 'welcome',
    kind: 'welcome',
    icon: Sparkles,
    eyebrow: 'Welcome to LyricDisplay',
    title: 'Your lyrics, live in minutes',
    description: 'Let’s walk through the essentials for preparing lyrics, styling an output, and presenting with confidence.',
  },
  {
    id: 'load',
    selector: '[data-tour="load-lyrics"]',
    icon: FolderOpen,
    eyebrow: 'Bring in a song',
    title: 'Start with your lyrics',
    description: 'Load a lyrics file, drag one into the workspace, or create a song from scratch. LyricDisplay also supports online search from the globe button above.',
    tip: 'Shortcut: Ctrl/Cmd + O',
    placement: 'right',
  },
  {
    id: 'online-lyrics',
    selector: '[data-tour="online-lyrics"]',
    icon: Globe,
    eyebrow: 'Skip the copy and paste',
    title: 'Find lyrics from inside the app',
    description: 'Search trusted online providers, compare available results, and import a song directly into your workspace.',
    tip: 'Shortcut: Ctrl/Cmd + Shift + O',
    placement: 'bottom',
  },
  {
    id: 'setlist',
    selector: '[data-tour="setlist-manager"]',
    icon: ListMusic,
    eyebrow: 'Plan the whole event',
    title: 'Build and run a setlist',
    description: 'Collect songs in service order, switch between them quickly, and export a setlist for another LyricDisplay operator.',
    tip: 'Shortcut: Ctrl/Cmd + Shift + S',
    placement: 'bottom',
  },
  {
    id: 'workspace',
    selector: '[data-tour="lyrics-workspace"]',
    icon: MousePointer2,
    eyebrow: 'Operate the show',
    title: 'Select the line your audience sees',
    description: 'Your lyrics appear here. Click a line—or use the arrow keys—to advance it across every active output in real time.',
    tip: 'The empty workspace also accepts drag-and-drop files.',
    placement: 'top',
    compactTarget: true,
  },
  {
    id: 'style',
    selector: '[data-tour="output-settings"]',
    icon: SlidersHorizontal,
    eyebrow: 'Make it yours',
    title: 'Style every output independently',
    description: 'Switch between Output 1, Output 2, and Stage here. The controls below let you tune typography, spacing, transitions, backgrounds, and more.',
    tip: 'Add more outputs with the + tab when your setup grows.',
    placement: 'right',
  },
  {
    id: 'project',
    selector: '[data-tour="project-output"]',
    icon: MonitorUp,
    eyebrow: 'Choose a destination',
    title: 'Project to the right display',
    description: 'Use Project to Display to send an output to a connected screen. For OBS, vMix, or browser-source workflows, open the Integration Guide from Help.',
    placement: 'bottom',
  },
  {
    id: 'go-live',
    selector: '[data-tour="master-output"]',
    icon: Power,
    eyebrow: 'Your safety switch',
    title: 'Go live when you are ready',
    description: 'This master switch controls whether lyrics are visible on audience outputs. Keep it off while preparing, then turn it on when the service or event begins.',
    tip: 'Space toggles the display output on and off.',
    placement: 'right',
  },
  {
    id: 'complete',
    kind: 'complete',
    icon: CheckCircle2,
    eyebrow: 'Setup complete',
    title: 'You’re ready to present',
    description: 'Load a song, select a line, and switch the display on. Timers, mobile control, video creation, OBS setup, and production checks are ready when you need them.',
  },
];

const SPOTLIGHT_PADDING = 7;
const VIEWPORT_MARGIN = 10;
const EXIT_ANIMATION_MS = 220;

const getSpotlightRect = (element, compactTarget) => {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  let top = rect.top;
  let height = rect.height;
  if (compactTarget && rect.height > 260) {
    top = rect.top + Math.max(24, rect.height * 0.28);
    height = Math.min(220, rect.height * 0.42);
  }

  const left = Math.max(VIEWPORT_MARGIN, rect.left - SPOTLIGHT_PADDING);
  const paddedTop = Math.max(VIEWPORT_MARGIN, top - SPOTLIGHT_PADDING);
  const right = Math.min(window.innerWidth - VIEWPORT_MARGIN, rect.right + SPOTLIGHT_PADDING);
  const bottom = Math.min(window.innerHeight - VIEWPORT_MARGIN, top + height + SPOTLIGHT_PADDING);

  return {
    left,
    top: paddedTop,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - paddedTop),
  };
};

const Shortcut = ({ children, darkMode }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
    darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
  }`}>
    <Keyboard className="h-3.5 w-3.5" />
    {children}
  </span>
);

export default function FirstRunTour({ darkMode = false, onFinish, onSkip }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [cardPosition, setCardPosition] = useState(null);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const cardRef = useRef(null);
  const dialogRef = useRef(null);
  const exitTimerRef = useRef(null);
  const exitStartedRef = useRef(false);
  const currentStep = TOUR_STEPS[stepIndex];
  const isCentered = !currentStep.selector || !targetRect;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const moveToStep = useCallback((nextIndex) => {
    setConfirmingSkip(false);
    setTargetRect(null);
    setCardPosition(null);
    setStepIndex(Math.min(Math.max(nextIndex, 0), TOUR_STEPS.length - 1));
  }, []);

  const closeWithAnimation = useCallback((outcome) => {
    if (exitStartedRef.current) return;
    exitStartedRef.current = true;
    setIsExiting(true);

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    exitTimerRef.current = window.setTimeout(() => {
      if (outcome === 'finish') {
        onFinish?.();
      } else {
        onSkip?.();
      }
    }, prefersReducedMotion ? 0 : EXIT_ANIMATION_MS);
  }, [onFinish, onSkip]);

  const handleNext = useCallback(() => {
    if (isLast) {
      closeWithAnimation('finish');
      return;
    }
    moveToStep(stepIndex + 1);
  }, [closeWithAnimation, isLast, moveToStep, stepIndex]);

  const handleBack = useCallback(() => {
    if (!isFirst) moveToStep(stepIndex - 1);
  }, [isFirst, moveToStep, stepIndex]);

  const requestSkip = useCallback(() => setConfirmingSkip(true), []);

  useLayoutEffect(() => {
    if (!currentStep.selector) {
      setTargetRect(null);
      return undefined;
    }

    let frameId;
    let resizeObserver;
    const updateLayout = () => {
      const element = document.querySelector(currentStep.selector);
      const nextTargetRect = getSpotlightRect(element, currentStep.compactTarget);
      setTargetRect(nextTargetRect);

      if (!nextTargetRect) {
        setCardPosition(null);
        return;
      }

      const cardRect = cardRef.current?.getBoundingClientRect();
      setCardPosition(getTourCardPosition({
        targetRect: nextTargetRect,
        cardWidth: cardRect?.width || 400,
        cardHeight: cardRect?.height || 280,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        preferred: currentStep.placement,
      }));
    };

    frameId = window.requestAnimationFrame(() => {
      updateLayout();
      const element = document.querySelector(currentStep.selector);
      if (element && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(updateLayout);
        resizeObserver.observe(element);
      }
    });
    window.addEventListener('resize', updateLayout);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateLayout);
      resizeObserver?.disconnect();
    };
  }, [currentStep]);

  useLayoutEffect(() => {
    if (!targetRect || !cardRef.current) return;
    const cardRect = cardRef.current.getBoundingClientRect();
    setCardPosition(getTourCardPosition({
      targetRect,
      cardWidth: cardRect.width,
      cardHeight: cardRect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      preferred: currentStep.placement,
    }));
  }, [confirmingSkip, currentStep.placement, stepIndex, targetRect]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      const preferredFocus = dialogRef.current?.querySelector('[data-tour-primary="true"]');
      (preferredFocus || dialogRef.current)?.focus?.();
    }, 40);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.clearTimeout(focusTimer);
      window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(FIRST_RUN_TOUR_STEP_EVENT, {
      detail: { stepId: currentStep.id },
    }));

    return () => {
      window.dispatchEvent(new CustomEvent(FIRST_RUN_TOUR_STEP_EVENT, {
        detail: { stepId: null },
      }));
    };
  }, [currentStep.id]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isExiting) {
        if (['Escape', 'ArrowRight', 'ArrowLeft', 'Tab'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (confirmingSkip) {
          setConfirmingSkip(false);
        } else {
          requestSkip();
        }
        return;
      }

      if (!confirmingSkip && event.key === 'ArrowRight') {
        event.preventDefault();
        handleNext();
        return;
      }
      if (!confirmingSkip && event.key === 'ArrowLeft' && !isFirst) {
        event.preventDefault();
        handleBack();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [confirmingSkip, handleBack, handleNext, isExiting, isFirst, requestSkip]);

  const progress = useMemo(
    () => TOUR_STEPS.map((step, index) => ({ id: step.id, complete: index < stepIndex, active: index === stepIndex })),
    [stepIndex]
  );
  const Icon = currentStep.icon;
  const cardStyle = isCentered
    ? undefined
    : {
      left: cardPosition?.left ?? 16,
      top: cardPosition?.top ?? 16,
      visibility: cardPosition ? 'visible' : 'hidden',
    };

  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] font-sans transition-opacity duration-200 ease-out ${isExiting ? 'opacity-0' : 'opacity-100'}`}
      data-first-run-tour="true"
    >
      {!targetRect && (
        <div className="absolute inset-0 bg-slate-950/72 backdrop-blur-[1px]" aria-hidden="true" />
      )}
      {targetRect && (
        <div
          className="pointer-events-none fixed rounded-2xl border-2 border-blue-400 bg-transparent transition-[top,left,width,height] duration-300 ease-out"
          style={{
            left: targetRect.left,
            top: targetRect.top,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: '0 0 0 5px rgba(96, 165, 250, 0.18), 0 0 0 9999px rgba(2, 6, 23, 0.72), 0 18px 60px rgba(0, 0, 0, 0.38)',
          }}
          aria-hidden="true"
        />
      )}

      <div className={isCentered ? 'absolute inset-0 flex items-center justify-center p-4' : ''}>
        <section
          ref={(node) => {
            cardRef.current = node;
            dialogRef.current = node;
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="first-run-tour-title"
          aria-describedby="first-run-tour-description"
          tabIndex={-1}
          style={cardStyle}
          className={`${isCentered ? 'relative w-full max-w-[540px]' : 'fixed w-[min(400px,calc(100vw-32px))]'} overflow-hidden rounded-3xl border shadow-2xl outline-none transition-[transform,opacity] duration-200 ease-out ${isExiting ? 'translate-y-2 scale-[0.97] opacity-0' : 'translate-y-0 scale-100 opacity-100 animate-in fade-in-0 zoom-in-95'} ${
            darkMode
              ? 'border-slate-700/80 bg-slate-900 text-white shadow-black/50'
              : 'border-white/80 bg-white text-slate-950 shadow-slate-950/25'
          }`}
        >
          <div className="h-1.5 w-full bg-linear-to-r from-blue-500 via-violet-500 to-fuchsia-500" />
          <div className={`${isCentered ? 'p-7 sm:p-9' : 'p-6'}`}>
            {confirmingSkip ? (
              <div className="space-y-5">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${darkMode ? 'bg-amber-400/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                  <X className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h2 id="first-run-tour-title" className="text-xl font-bold">Skip the product tour?</h2>
                  <p id="first-run-tour-description" className={`text-sm leading-6 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    You can always replay it later from Help → Take the Product Tour.
                  </p>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmingSkip(false)}
                    data-tour-primary="true"
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${darkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                  >
                    Continue tour
                  </button>
                  <button
                    type="button"
                    onClick={() => closeWithAnimation('skip')}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    Skip tour
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    currentStep.kind === 'complete'
                      ? darkMode ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                      : darkMode ? 'bg-blue-400/10 text-blue-300' : 'bg-blue-50 text-blue-700'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {!isLast && (
                    <button
                      type="button"
                      onClick={requestSkip}
                      className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                      Skip tour
                    </button>
                  )}
                </div>

                <div className="mt-5 space-y-2">
                  <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                    {currentStep.eyebrow}
                  </p>
                  <h2 id="first-run-tour-title" className={`${isCentered ? 'text-2xl sm:text-3xl' : 'text-xl'} font-bold tracking-tight`}>
                    {currentStep.title}
                  </h2>
                  <p id="first-run-tour-description" className={`text-sm leading-6 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {currentStep.description}
                  </p>
                </div>

                {currentStep.kind === 'welcome' && (
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {[
                      [FileText, 'Import'],
                      [SlidersHorizontal, 'Style'],
                      [MonitorUp, 'Present'],
                    ].map(([FeatureIcon, label]) => (
                      <div key={label} className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-xs font-semibold ${darkMode ? 'border-slate-700 bg-slate-800/70 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                        <FeatureIcon className="h-4 w-4" />
                        {label}
                      </div>
                    ))}
                  </div>
                )}

                {currentStep.kind === 'complete' && (
                  <div className={`mt-6 space-y-3 rounded-2xl border p-4 ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                    {['Load or create a song', 'Choose a line to display', 'Switch Display Output on'].map((label) => (
                      <div key={label} className={`flex items-center gap-3 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                        {label}
                      </div>
                    ))}
                  </div>
                )}

                {currentStep.tip && (
                  <div className="mt-5">
                    <Shortcut darkMode={darkMode}>{currentStep.tip}</Shortcut>
                  </div>
                )}

                <div className="mt-7 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5" aria-label={`Step ${stepIndex + 1} of ${TOUR_STEPS.length}`}>
                    {progress.map((item, index) => (
                      <span
                        key={item.id}
                        className={`h-1.5 rounded-full transition-all duration-300 ${item.active ? 'w-5 bg-blue-500' : item.complete ? 'w-1.5 bg-blue-400' : `w-1.5 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {!isFirst && (
                      <button
                        type="button"
                        onClick={handleBack}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleNext}
                      data-tour-primary="true"
                      className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:from-blue-500 hover:to-violet-500 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                    >
                      {isLast ? 'Start using LyricDisplay' : isFirst ? 'Take the tour' : 'Next'}
                      {!isLast && <ArrowRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <p className={`mt-4 text-center text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Use ← and → to move between steps · Replay from Help → Take the Product Tour
                </p>
              </>
            )}
          </div>
        </section>
      </div>
      <span className="sr-only" aria-live="polite">Step {stepIndex + 1} of {TOUR_STEPS.length}: {currentStep.title}</span>
    </div>,
    document.body
  );
}
