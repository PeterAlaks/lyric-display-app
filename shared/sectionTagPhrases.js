export const DEFAULT_SECTION_TAG_PHRASES = Object.freeze([
  'Verse',
  'Vamp',
  'Chorus',
  'Hook',
  'Refrain',
  'Bridge',
  'Intro',
  'Outro',
  'Pre-Chorus',
  'Post-Chorus',
  'Pre-Hook',
  'Post-Hook',
  'Interlude',
  'Break',
  'Instrumental',
  'Solo',
  'Rap',
  'Rap Verse',
  'Spoken',
  'Coda',
  'Backing Vocals',
  'Ad-Lib',
  'Ad-Libs',
  'Outro Chorus',
  'Final Chorus',
  'Ending Chorus',
]);

export const MAX_SECTION_TAG_PHRASE_LENGTH = 80;

const SECTION_TAG_PHRASE_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N} '\u2019&/-]*[\p{L}\p{N}])?$/u;

const toTitleCase = (value) => value
  .toLocaleLowerCase()
  .replace(/(^|[\s/-])(\p{L})/gu, (_match, separator, letter) => (
    `${separator}${letter.toLocaleUpperCase()}`
  ));

export const normalizeSectionTagPhrase = (value) => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (
    !trimmed
    || trimmed.length > MAX_SECTION_TAG_PHRASE_LENGTH
    || !SECTION_TAG_PHRASE_PATTERN.test(trimmed)
  ) {
    return null;
  }

  return toTitleCase(trimmed);
};

export const normalizeSectionTagPhrases = (
  values,
  fallback = DEFAULT_SECTION_TAG_PHRASES,
) => {
  const source = Array.isArray(values) ? values : fallback;
  const seen = new Set();

  return source.reduce((phrases, value) => {
    const normalized = normalizeSectionTagPhrase(value);
    if (!normalized) return phrases;

    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) return phrases;

    seen.add(key);
    phrases.push(normalized);
    return phrases;
  }, []);
};
