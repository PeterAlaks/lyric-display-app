export const START_FIRST_RUN_TOUR_EVENT = 'first-run-tour:start';
export const FIRST_RUN_TOUR_STEP_EVENT = 'first-run-tour:step-change';

export function shouldShowTelemetryConsent({
  consentDecided,
  hasSeenWelcome,
  isControlPanel,
  tourActive,
}) {
  return Boolean(
    isControlPanel
    && consentDecided === false
    && hasSeenWelcome
    && !tourActive
  );
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function getTourCardPosition({
  targetRect,
  cardWidth = 400,
  cardHeight = 280,
  viewportWidth,
  viewportHeight,
  preferred = 'right',
  gap = 18,
  margin = 16,
}) {
  const maxX = Math.max(margin, viewportWidth - cardWidth - margin);
  const maxY = Math.max(margin, viewportHeight - cardHeight - margin);

  if (!targetRect) {
    return {
      left: clamp((viewportWidth - cardWidth) / 2, margin, maxX),
      top: clamp((viewportHeight - cardHeight) / 2, margin, maxY),
      placement: 'center',
    };
  }

  const centeredX = clamp(
    targetRect.left + (targetRect.width - cardWidth) / 2,
    margin,
    maxX
  );
  const centeredY = clamp(
    targetRect.top + (targetRect.height - cardHeight) / 2,
    margin,
    maxY
  );
  const candidates = {
    right: {
      left: targetRect.right + gap,
      top: centeredY,
      fits: targetRect.right + gap + cardWidth <= viewportWidth - margin,
      room: viewportWidth - targetRect.right,
    },
    left: {
      left: targetRect.left - gap - cardWidth,
      top: centeredY,
      fits: targetRect.left - gap - cardWidth >= margin,
      room: targetRect.left,
    },
    bottom: {
      left: centeredX,
      top: targetRect.bottom + gap,
      fits: targetRect.bottom + gap + cardHeight <= viewportHeight - margin,
      room: viewportHeight - targetRect.bottom,
    },
    top: {
      left: centeredX,
      top: targetRect.top - gap - cardHeight,
      fits: targetRect.top - gap - cardHeight >= margin,
      room: targetRect.top,
    },
  };

  const orderedPlacements = [
    preferred,
    ...Object.keys(candidates).filter((placement) => placement !== preferred),
  ];
  const placement = orderedPlacements.find((name) => candidates[name]?.fits)
    || Object.entries(candidates).sort((a, b) => b[1].room - a[1].room)[0][0];
  const candidate = candidates[placement];

  return {
    left: clamp(candidate.left, margin, maxX),
    top: clamp(candidate.top, margin, maxY),
    placement,
  };
}
