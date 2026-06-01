const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const createSolidPaint = (color = '#000000') => ({
  type: 'solid',
  color,
});

export const createLinearGradientPaint = ({
  angle = 135,
  stops = [
    { color: '#111827', position: 0 },
    { color: '#000000', position: 100 },
  ],
} = {}) => ({
  type: 'linear',
  angle,
  stops,
});

export const isValidHexColor = (value) => (
  typeof value === 'string' && HEX_COLOR_PATTERN.test(value)
);

const expandHex = (hex) => {
  if (!isValidHexColor(hex)) return null;
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  if (normalized.length === 3) {
    return normalized.split('').map((char) => `${char}${char}`).join('');
  }
  return normalized;
};

export const hexToRgba = (hex, alpha = 1) => {
  const expanded = expandHex(hex);
  if (!expanded) return hex;

  const safeAlpha = Math.min(1, Math.max(0, Number(alpha)));
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${Number.isFinite(safeAlpha) ? safeAlpha : 1})`;
};

export const colorWithOpacity = (color, opacity = 1) => {
  if (!isValidHexColor(color)) return color || 'transparent';
  return hexToRgba(color, opacity);
};

export const normalizePaint = (paint, fallbackColor = '#000000') => {
  if (!paint || typeof paint !== 'object' || Array.isArray(paint)) {
    return createSolidPaint(fallbackColor);
  }

  if (paint.type === 'linear') {
    const stops = Array.isArray(paint.stops)
      ? paint.stops
        .map((stop, index) => ({
          color: isValidHexColor(stop?.color) ? stop.color : (index === 0 ? fallbackColor : '#000000'),
          position: Math.min(100, Math.max(0, Number(stop?.position ?? (index === 0 ? 0 : 100)))),
        }))
        .slice(0, 4)
      : [];

    return createLinearGradientPaint({
      angle: Math.min(360, Math.max(0, Number(paint.angle ?? 135))),
      stops: stops.length >= 2 ? stops : [
        { color: fallbackColor, position: 0 },
        { color: '#000000', position: 100 },
      ],
    });
  }

  return createSolidPaint(isValidHexColor(paint.color) ? paint.color : fallbackColor);
};

export const getSolidPaintColor = (paint, fallbackColor = '#000000') => {
  const normalized = normalizePaint(paint, fallbackColor);
  return normalized.type === 'solid' ? normalized.color : fallbackColor;
};

export const paintToCss = (paint, fallbackColor = '#000000', opacity = 1) => {
  const normalized = normalizePaint(paint, fallbackColor);
  const safeOpacity = Math.min(1, Math.max(0, Number(opacity)));
  const alpha = Number.isFinite(safeOpacity) ? safeOpacity : 1;

  if (normalized.type === 'linear') {
    const stops = normalized.stops
      .map((stop) => `${colorWithOpacity(stop.color, alpha)} ${stop.position}%`)
      .join(', ');

    return `linear-gradient(${normalized.angle}deg, ${stops})`;
  }

  return colorWithOpacity(normalized.color, alpha);
};
