const VALID_PLACEMENTS = ['top', 'bottom', 'left', 'right'];

const FALLBACK_ORDERS = {
  top: ['top', 'bottom', 'right', 'left'],
  bottom: ['bottom', 'top', 'right', 'left'],
  left: ['left', 'right', 'top', 'bottom'],
  right: ['right', 'left', 'top', 'bottom'],
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const finiteOr = (value, fallback) => (
  Number.isFinite(Number(value)) ? Number(value) : fallback
);

export function getTooltipPosition({
  anchor,
  anchorRect,
  tooltipWidth,
  tooltipHeight,
  viewportWidth,
  viewportHeight,
  preferred = 'top',
  gap = 8,
  padding = 8,
}) {
  const safePadding = Math.max(0, finiteOr(padding, 8));
  const safeGap = Math.max(0, finiteOr(gap, 8));
  const safeViewportWidth = Math.max(safePadding * 2, finiteOr(viewportWidth, 0));
  const safeViewportHeight = Math.max(safePadding * 2, finiteOr(viewportHeight, 0));
  const width = Math.max(0, finiteOr(tooltipWidth, 0));
  const height = Math.max(0, finiteOr(tooltipHeight, 0));
  const hasAnchorRect = anchorRect
    && ['left', 'top', 'right', 'bottom'].every((key) => Number.isFinite(Number(anchorRect[key])));
  const anchorLeft = hasAnchorRect ? Number(anchorRect.left) : finiteOr(anchor?.x, safeViewportWidth / 2);
  const anchorRight = hasAnchorRect ? Number(anchorRect.right) : anchorLeft;
  const anchorTop = hasAnchorRect ? Number(anchorRect.top) : finiteOr(anchor?.y, safeViewportHeight / 2);
  const anchorBottom = hasAnchorRect ? Number(anchorRect.bottom) : anchorTop;
  const anchorX = clamp(
    (anchorLeft + anchorRight) / 2,
    safePadding,
    Math.max(safePadding, safeViewportWidth - safePadding)
  );
  const anchorY = clamp(
    (anchorTop + anchorBottom) / 2,
    safePadding,
    Math.max(safePadding, safeViewportHeight - safePadding)
  );
  const normalizedPreferred = VALID_PLACEMENTS.includes(preferred) ? preferred : 'top';

  const candidates = {
    top: {
      left: anchorX - width / 2,
      top: anchorTop - safeGap - height,
      room: anchorTop - safePadding,
      requiredRoom: height + safeGap,
    },
    bottom: {
      left: anchorX - width / 2,
      top: anchorBottom + safeGap,
      room: safeViewportHeight - safePadding - anchorBottom,
      requiredRoom: height + safeGap,
    },
    left: {
      left: anchorLeft - safeGap - width,
      top: anchorY - height / 2,
      room: anchorLeft - safePadding,
      requiredRoom: width + safeGap,
    },
    right: {
      left: anchorRight + safeGap,
      top: anchorY - height / 2,
      room: safeViewportWidth - safePadding - anchorRight,
      requiredRoom: width + safeGap,
    },
  };

  const orderedPlacements = FALLBACK_ORDERS[normalizedPreferred];
  const placement = orderedPlacements.find((name) => (
    candidates[name].room >= candidates[name].requiredRoom
  )) || orderedPlacements.reduce((best, name) => {
    const overflow = Math.max(0, candidates[name].requiredRoom - candidates[name].room);
    const bestOverflow = Math.max(0, candidates[best].requiredRoom - candidates[best].room);
    return overflow < bestOverflow ? name : best;
  }, orderedPlacements[0]);

  const candidate = candidates[placement];
  const maxLeft = Math.max(safePadding, safeViewportWidth - width - safePadding);
  const maxTop = Math.max(safePadding, safeViewportHeight - height - safePadding);

  return {
    left: clamp(candidate.left, safePadding, maxLeft),
    top: clamp(candidate.top, safePadding, maxTop),
    placement,
  };
}
