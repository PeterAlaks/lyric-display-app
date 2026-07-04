// Project: LyricDisplay App
// File: src/utils/scripture.js
// Reference parsing, book matching, and projection payload helpers for the
// scripture module. Verses are fetched from bible-api.com (public domain
// translations) and cached per translation/book/chapter.

import {
  BIBLE_BOOKS,
  SCRIPTURE_API_BASE_URL,
  getScriptureTranslation,
} from '../constants/scripture.js';

const normalizeBookToken = (value) => {
  if (typeof value !== 'string') return '';
  let normalized = value.toLowerCase().replace(/[.\s]+/g, ' ').trim();
  // Support roman-numeral ordinals for numbered books ("II John" -> "2 John").
  normalized = normalized.replace(/^(i{1,3})\s+(?=[a-z])/, (match, roman) => `${roman.length} `);
  return normalized.replace(/\s+/g, '');
};

const NORMALIZED_BOOKS = BIBLE_BOOKS.map((book) => ({
  ...book,
  normalizedName: normalizeBookToken(book.name),
  normalizedAliases: book.aliases.map(normalizeBookToken),
}));

/**
 * Find books whose name or alias matches the (partial) query.
 * Exact matches rank first, then name prefixes, alias prefixes, and finally
 * substring matches.
 * @param {string} bookQuery
 * @returns {Array<{name: string, chapters: number}>}
 */
export function matchBooks(bookQuery) {
  const token = normalizeBookToken(bookQuery);
  if (!token) return [];

  const ranked = [];
  NORMALIZED_BOOKS.forEach((book, index) => {
    let rank = null;
    if (book.normalizedName === token || book.normalizedAliases.includes(token)) {
      rank = 0;
    } else if (book.normalizedName.startsWith(token)) {
      rank = 1;
    } else if (book.normalizedAliases.some((alias) => alias.startsWith(token))) {
      rank = 2;
    } else if (token.length >= 3 && book.normalizedName.includes(token)) {
      rank = 3;
    }
    if (rank !== null) {
      ranked.push({ book, rank, index });
    }
  });

  ranked.sort((a, b) => (a.rank - b.rank) || (a.index - b.index));
  return ranked.map(({ book }) => ({ name: book.name, chapters: book.chapters }));
}

const REFERENCE_REGEX = /^\s*([123]?\s*[a-z][a-z\s.]*?)\.?\s*(?:(\d{1,3})(?:\s*:\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?)?)?\s*$/i;

/**
 * Parse a free-form scripture query into its parts. Supports any combination
 * of book, chapter, and verse(s): "joh", "John 3", "1 john 1:9",
 * "John 3:16-20". Returns null for empty input.
 * @param {string} input
 * @returns {{bookQuery: string, chapter: number|null, verseStart: number|null, verseEnd: number|null}|null}
 */
export function parseScriptureQuery(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return null;

  const match = raw.match(REFERENCE_REGEX);
  if (!match) {
    return { bookQuery: raw, chapter: null, verseStart: null, verseEnd: null };
  }

  const chapter = match[2] ? parseInt(match[2], 10) : null;
  let verseStart = match[3] ? parseInt(match[3], 10) : null;
  let verseEnd = match[4] ? parseInt(match[4], 10) : null;
  if (verseStart !== null && verseEnd !== null && verseEnd < verseStart) {
    [verseStart, verseEnd] = [verseEnd, verseStart];
  }

  return {
    bookQuery: match[1].trim(),
    chapter,
    verseStart,
    verseEnd: verseEnd ?? (verseStart !== null ? verseStart : null),
  };
}

export const cleanVerseText = (text) => (typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '');

/**
 * Compress a list of verse numbers into a compact range label,
 * e.g. [16,17,18,20] -> "16-18,20".
 * @param {number[]} verseNumbers
 * @returns {string}
 */
export function compressVerseRanges(verseNumbers) {
  const sorted = [...new Set(verseNumbers)].sort((a, b) => a - b);
  if (sorted.length === 0) return '';

  const parts = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i += 1) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = current;
    prev = current;
  }
  return parts.join(',');
}

const chapterCache = new Map();
const CHAPTER_CACHE_LIMIT = 100;

/**
 * Fetch one chapter of scripture from bible-api.com, with in-memory caching.
 * @param {{translationId: string, bookName: string, chapter: number, signal?: AbortSignal}} params
 * @returns {Promise<{verses: Array<{verse: number, text: string}>, reference: string, translationName: string}>}
 */
export async function fetchScriptureChapter({ translationId, bookName, chapter, signal }) {
  const cacheKey = `${translationId}|${bookName}|${chapter}`;
  if (chapterCache.has(cacheKey)) {
    return chapterCache.get(cacheKey);
  }

  const reference = encodeURIComponent(`${bookName} ${chapter}`);
  const url = `${SCRIPTURE_API_BASE_URL}/${reference}?translation=${encodeURIComponent(translationId)}`;
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON body; fall through to status handling below.
  }

  if (!response.ok || !data || data.error || !Array.isArray(data.verses)) {
    const message = data?.error
      ? `${data.error}`
      : `Could not load ${bookName} ${chapter} (${response.status || 'network error'}).`;
    throw new Error(message);
  }

  const verses = data.verses
    .map((verse) => ({ verse: verse.verse, text: cleanVerseText(verse.text) }))
    .filter((verse) => Number.isInteger(verse.verse) && verse.text.length > 0);

  const result = {
    verses,
    reference: data.reference || `${bookName} ${chapter}`,
    translationName: data.translation_name || '',
  };

  if (chapterCache.size >= CHAPTER_CACHE_LIMIT) {
    chapterCache.delete(chapterCache.keys().next().value);
  }
  chapterCache.set(cacheKey, result);
  return result;
}

// Matches the reference lines emitted by buildScriptureProjection,
// e.g. "John 3:16 KJV" or "1 Corinthians 13:4 WEBBE".
const REFERENCE_LINE_REGEX = /^[123]?\s?[A-Za-z][A-Za-z .]* \d{1,3}:\d{1,3} [A-Z][A-Z-]{1,9}$/;

export const isScriptureReferenceLine = (text) =>
  typeof text === 'string' && REFERENCE_LINE_REGEX.test(text.trim());

/**
 * Combine several lines' output texts into one display block. Scripture
 * reference lines are dropped from every block except the last, so a
 * multi-verse selection shows a single reference at the bottom.
 * @param {string[]} texts - per-line output texts (may contain newlines)
 * @returns {string}
 */
export function combineOutputTexts(texts) {
  const blocks = (texts || []).filter((text) => typeof text === 'string' && text.length > 0);
  return blocks
    .map((text, index) => (
      index === blocks.length - 1
        ? text
        : text
          .split('\n')
          .filter((line) => !isScriptureReferenceLine(line))
          .join('\n')
    ))
    .filter((text) => text.length > 0)
    .join('\n');
}

const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

export const toSuperscriptNumber = (value) =>
  String(value).replace(/\d/g, (digit) => SUPERSCRIPT_DIGITS[Number(digit)]);

// Parser overrides for projected scripture: each verse block (separated by a
// blank line) collapses into a single group, and nothing merges across verses.
export const SCRIPTURE_GROUPING_CONFIG = {
  enableAutoLineGrouping: true,
  enableTranslationGrouping: false,
  enableCrossBlankLineGrouping: false,
  maxLinesPerGroup: 12,
  maxLineLength: 1000,
};

/**
 * Build the lyrics-pipeline payload for a set of verses so scripture is
 * displayed, grouped, and styled exactly like loaded lyrics. Each verse is
 * emitted as its own blank-line-separated block — verse text (with a
 * superscript verse number) followed by its reference (e.g. "John 3:16 KJV")
 * — so the parser groups every verse, and its reference, into one line group.
 * @param {{bookName: string, chapter: number, verses: Array<{verse: number, text: string}>, wholeChapter?: boolean, translationId: string, translationName?: string}} params
 * @returns {{content: string, label: string, title: string, origin: string}}
 */
export function buildScriptureProjection({ bookName, chapter, verses, wholeChapter = false, translationId, translationName }) {
  const translation = getScriptureTranslation(translationId);
  const abbreviation = translation?.abbreviation || (translationId || '').toUpperCase();
  const referenceLabel = wholeChapter
    ? `${bookName} ${chapter}`
    : `${bookName} ${chapter}:${compressVerseRanges(verses.map((verse) => verse.verse))}`;

  const content = verses
    .map((verse) => `${toSuperscriptNumber(verse.verse)} ${verse.text}\n${bookName} ${chapter}:${verse.verse} ${abbreviation}`)
    .join('\n\n');

  return {
    content,
    label: `${referenceLabel} (${abbreviation})`,
    title: `${referenceLabel} (${abbreviation})`,
    origin: `Scripture · ${translationName || translation?.name || abbreviation}`,
  };
}
