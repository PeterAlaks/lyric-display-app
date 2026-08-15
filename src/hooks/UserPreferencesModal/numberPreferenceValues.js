export const normalizeNumberPreferenceValue = (rawValue, options = {}, useFallback = false) => {
  const {
    min,
    max,
    fallbackValue,
    parse = 'int',
  } = options;

  const parsedValue = parse === 'float'
    ? Number.parseFloat(rawValue)
    : Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsedValue) && !useFallback) return null;

  let normalized = Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
  if (!Number.isFinite(normalized)) return null;
  if (typeof min === 'number') normalized = Math.max(min, normalized);
  if (typeof max === 'number') normalized = Math.min(max, normalized);
  return normalized;
};
