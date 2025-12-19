export const clampNumber = (value, min, max, { clampMin = true, clampMax = true } = {}) => {
  let next = value;

  if (clampMin && typeof min === 'number') {
    next = Math.max(min, next);
  }

  if (clampMax && typeof max === 'number') {
    next = Math.min(max, next);
  }

  return next;
};

export const sanitizeNumberInput = (
  rawValue,
  fallback,
  { min, max, parser = parseFloat, clampMin = true, clampMax = true } = {}
) => {
  const parsed = parser(rawValue);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return clampNumber(parsed, min, max, { clampMin, clampMax });
};

export const sanitizeIntegerInput = (rawValue, fallback, options = {}) =>
  sanitizeNumberInput(rawValue, fallback, { ...options, parser: (val) => parseInt(val, 10) });