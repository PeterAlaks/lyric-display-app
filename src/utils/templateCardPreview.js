const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const TEMPLATE_CARD_HOVER_DELAY = 2000;
export const TEMPLATE_CARD_PREVIEW_ANIMATION_MS = 280;

export const getOutputPreviewPositionStyle = (position, expanded = false) => {
  const spacing = expanded ? 32 : 12;
  const baseStyle = { flexDirection: 'column' };

  if (position === 'upper') {
    return { ...baseStyle, justifyContent: 'flex-start', paddingTop: spacing };
  }
  if (position === 'center') {
    return { ...baseStyle, justifyContent: 'center' };
  }
  return { ...baseStyle, justifyContent: 'flex-end', paddingBottom: spacing };
};

export const calculateExpandedCardLayout = ({
  sourceRect,
  viewportWidth,
  viewportHeight,
  maxWidth = 620,
  detailHeight = 112,
  margin = 16,
}) => {
  const safeViewportWidth = Math.max(margin * 2 + 1, Number(viewportWidth) || 0);
  const safeViewportHeight = Math.max(margin * 2 + 1, Number(viewportHeight) || 0);
  const availableWidth = safeViewportWidth - (margin * 2);
  const availableHeight = safeViewportHeight - (margin * 2);
  const heightBoundWidth = Math.max(1, (availableHeight - detailHeight) * (16 / 9));
  const width = Math.max(1, Math.min(maxWidth, availableWidth, heightBoundWidth));
  const height = (width * (9 / 16)) + detailHeight;
  const sourceCenterX = sourceRect.left + (sourceRect.width / 2);
  const sourceCenterY = sourceRect.top + (sourceRect.height / 2);
  const left = clamp(sourceCenterX - (width / 2), margin, safeViewportWidth - width - margin);
  const top = clamp(sourceCenterY - (height / 2), margin, safeViewportHeight - height - margin);
  const targetCenterX = left + (width / 2);
  const targetCenterY = top + (height / 2);

  return {
    width,
    height,
    left,
    top,
    initialScale: clamp(sourceRect.width / width, 0.16, 0.92),
    initialTranslateX: sourceCenterX - targetCenterX,
    initialTranslateY: sourceCenterY - targetCenterY,
  };
};
