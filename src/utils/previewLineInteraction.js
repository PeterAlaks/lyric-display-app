export const PREVIEW_LINE_COMMIT_WINDOW_MS = 500;

export const isPreviewLinesEnabled = ({ preferenceEnabled, liveSafetyEnabled }) => (
  Boolean(preferenceEnabled) || Boolean(liveSafetyEnabled)
);

export function resolvePreviewLineClick({
  currentPreviewLine,
  currentLiveLine,
  clickedLine,
  previewedAt,
  clickedAt,
  commitWindowMs = PREVIEW_LINE_COMMIT_WINDOW_MS,
}) {
  if (currentLiveLine === clickedLine) {
    return {
      action: 'keep-live',
      nextPreviewLine: null,
      nextPreviewedAt: null,
    };
  }

  if (currentPreviewLine !== clickedLine) {
    return {
      action: 'preview',
      nextPreviewLine: clickedLine,
      nextPreviewedAt: clickedAt,
    };
  }

  const elapsed = clickedAt - previewedAt;
  const isQuickSecondClick = Number.isFinite(previewedAt)
    && Number.isFinite(clickedAt)
    && Number.isFinite(elapsed)
    && elapsed >= 0
    && elapsed <= commitWindowMs;

  return {
    action: isQuickSecondClick ? 'commit' : 'clear',
    nextPreviewLine: null,
    nextPreviewedAt: null,
  };
}
