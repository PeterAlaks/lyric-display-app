export const TRANSITION_ANIMATION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'scale', label: 'Scale' },
  { value: 'slide', label: 'Slide' },
  { value: 'blur', label: 'Blur' },
];

export const TRANSITION_ANIMATION_VALUES = TRANSITION_ANIMATION_OPTIONS.map(({ value }) => value);

export const MIN_TRANSITION_DURATION_MS = 100;
export const MAX_TRANSITION_DURATION_MS = 2000;

export const DEFAULT_APPEARANCE_TRANSITIONS = {
  timerStateTransitionAnimation: 'fade',
  timerStateTransitionDuration: 300,
  backgroundMediaTransitionAnimation: 'fade',
  backgroundMediaTransitionDuration: 300,
  outputVisibilityTransitionAnimation: 'fade',
  outputVisibilityTransitionDuration: 300,
};

export const normalizeTransitionAnimation = (value, fallback = 'fade') => (
  TRANSITION_ANIMATION_VALUES.includes(value) ? value : fallback
);

export const normalizeTransitionDuration = (value, fallback = 300) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(Math.min(MAX_TRANSITION_DURATION_MS, Math.max(MIN_TRANSITION_DURATION_MS, numeric)));
};

export const normalizeAppearanceTransitions = (appearance = {}) => ({
  timerStateTransitionAnimation: normalizeTransitionAnimation(
    appearance?.timerStateTransitionAnimation,
    DEFAULT_APPEARANCE_TRANSITIONS.timerStateTransitionAnimation
  ),
  timerStateTransitionDuration: normalizeTransitionDuration(
    appearance?.timerStateTransitionDuration,
    DEFAULT_APPEARANCE_TRANSITIONS.timerStateTransitionDuration
  ),
  backgroundMediaTransitionAnimation: normalizeTransitionAnimation(
    appearance?.backgroundMediaTransitionAnimation,
    DEFAULT_APPEARANCE_TRANSITIONS.backgroundMediaTransitionAnimation
  ),
  backgroundMediaTransitionDuration: normalizeTransitionDuration(
    appearance?.backgroundMediaTransitionDuration,
    DEFAULT_APPEARANCE_TRANSITIONS.backgroundMediaTransitionDuration
  ),
  outputVisibilityTransitionAnimation: normalizeTransitionAnimation(
    appearance?.outputVisibilityTransitionAnimation,
    DEFAULT_APPEARANCE_TRANSITIONS.outputVisibilityTransitionAnimation
  ),
  outputVisibilityTransitionDuration: normalizeTransitionDuration(
    appearance?.outputVisibilityTransitionDuration,
    DEFAULT_APPEARANCE_TRANSITIONS.outputVisibilityTransitionDuration
  ),
});

export const getTransitionVariants = (animation) => {
  switch (normalizeTransitionAnimation(animation, 'none')) {
    case 'fade':
      return {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
      };
    case 'scale':
      return {
        hidden: { opacity: 0, scale: 0.9 },
        visible: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.9 },
      };
    case 'slide':
      return {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -30 },
      };
    case 'blur':
      return {
        hidden: { opacity: 0, filter: 'blur(8px)' },
        visible: { opacity: 1, filter: 'blur(0px)' },
        exit: { opacity: 0, filter: 'blur(8px)' },
      };
    default:
      return null;
  }
};
