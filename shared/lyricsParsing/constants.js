import {
  DEFAULT_SECTION_TAG_PHRASES,
  normalizeSectionTagPhrases,
} from '../sectionTagPhrases.js';

export const BRACKET_PAIRS = [
  ['[', ']'],
  ['(', ')'],
  ['{', '}'],
  ['<', '>'],
];

// Default config values - can be overridden by user preferences
export const NORMAL_GROUP_CONFIG = {
  ENABLED: true,
  MAX_LINE_LENGTH: 45,
  CROSS_BLANK_LINE_GROUPING: true,
  MAX_LINES_PER_GROUP: 2,
};

export const STRUCTURE_TAGS_CONFIG = {
  ENABLED: true,
  MODE: 'isolate',
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const structureTagPatternCache = new Map();

const buildPhraseAlternation = (phrases) => phrases
  .sort((a, b) => b.length - a.length)
  .map((phrase) => escapeRegExp(phrase).replace(/[ -]+/g, '[- ]?'))
  .join('|');

export const createStructureTagPatterns = (phrases = DEFAULT_SECTION_TAG_PHRASES) => {
  const normalizedPhrases = normalizeSectionTagPhrases(phrases);
  const cacheKey = normalizedPhrases.map((phrase) => phrase.toLocaleLowerCase()).join('\u0000');
  const cachedPatterns = structureTagPatternCache.get(cacheKey);
  if (cachedPatterns) return cachedPatterns;

  const phraseAlternation = buildPhraseAlternation(normalizedPhrases);
  const patterns = [];

  if (phraseAlternation) {
    patterns.push(
      // [Verse], (Verse), [Verse 1:], [Chorus: Artist], etc.
      new RegExp(`^\\s*[\\[\\(\\{<](?:${phraseAlternation})(?:\\s+\\d+)?(?:\\s*[-\\u2013]\\s*[^\\]\\)\\}>:]+)?(?:\\s*:\\s*[^\\]\\)\\}>]*)?\\s*[\\]\\)\\}>]\\s*`, 'i'),
      // Verse 1:, Chorus: Artist, etc.
      new RegExp(`^\\s*(?:${phraseAlternation})(?:\\s+\\d+)?(?:\\s*[-\\u2013]\\s*[^:]+)?\\s*:\\s*`, 'i'),
      // Standalone names with optional Arabic or Roman numbering.
      new RegExp(`^\\s*(?:${phraseAlternation})(?:\\s+(?:\\d+|[IVXLC]+))?\\s*:?\\s*$`, 'i'),
      // Repeat Chorus, Chorus x2, etc.
      new RegExp(`^\\s*(?:Repeat\\s+)?(?:${phraseAlternation})(?:\\s+\\d+)?(?:\\s*x\\d+)?\\s*:?\\s*$`, 'i'),
    );
  }

  // Numeric shorthand: V1, C2, B1, PC, etc. Single-letter forms require numbers.
  patterns.push(/^\s*(?:(?:V|C|B|O|I|R)\d+|(?:PC|HC)\d*)\s*:?$/i);
  if (structureTagPatternCache.size >= 32) structureTagPatternCache.clear();
  structureTagPatternCache.set(cacheKey, patterns);
  return patterns;
};

// Backward-compatible default patterns for callers that do not use parsing preferences.
export const STRUCTURE_TAG_PATTERNS = createStructureTagPatterns();

export const TIME_TAG_REGEX = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g;
export const ENHANCED_TIME_TAG_REGEX = /<(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?>/g;
export const META_TAG_REGEX = /^\s*\[\s*(ti|ar|al|by|offset|length|au|lr|re|tool|ve|id|#)\s*:.*\]\s*$/i;

export const TIMESTAMP_LIKE_PATTERNS = [
  /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g,
  /<\d{1,2}:\d{2}(?:\.\d{1,3})?>/g,
  /\(\d{1,2}:\d{2}(?:\.\d{1,3})?\)/g,
  /^\d{1,2}:\d{2}\s+/gm,
];
