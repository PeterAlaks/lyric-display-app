export const DEFAULT_CAPITALIZED_WORDS = Object.freeze([
  'Jesus',
  'Jehovah',
  'God',
  'Yahweh',
  'Lord',
  'Christ',
  'Holy Ghost',
  'Holy Spirit',
  'Bible',
  'Amen',
  'Hallelujah',
  'Hosanna',
  'Savior',
  'Saviour',
  'Redeemer',
  'Messiah',
]);

export const MAX_CAPITALIZED_WORD_LENGTH = 80;

const CAPITALIZED_WORD_PATTERN = /^[\p{L}\p{N}]+(?:[ '\u2019-][\p{L}\p{N}]+)*$/u;

const toTitleCase = (value) => value
  .toLocaleLowerCase()
  .replace(/(^|[\s-])(\p{L})/gu, (_match, separator, letter) => (
    `${separator}${letter.toLocaleUpperCase()}`
  ));

export const normalizeCapitalizedWord = (value) => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (
    !trimmed
    || trimmed.length > MAX_CAPITALIZED_WORD_LENGTH
    || !CAPITALIZED_WORD_PATTERN.test(trimmed)
  ) {
    return null;
  }

  return toTitleCase(trimmed);
};

export const normalizeCapitalizedWords = (
  values,
  fallback = DEFAULT_CAPITALIZED_WORDS,
) => {
  const source = Array.isArray(values) ? values : fallback;
  const seen = new Set();

  return source.reduce((words, value) => {
    const normalized = normalizeCapitalizedWord(value);
    if (!normalized) return words;

    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) return words;

    seen.add(key);
    words.push(normalized);
    return words;
  }, []);
};
