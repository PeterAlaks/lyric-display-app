import { preprocessText, splitLongLine } from '../../shared/lineSplitting.js';
import { NORMAL_GROUP_CONFIG, STRUCTURE_TAGS_CONFIG, STRUCTURE_TAG_PATTERNS, BRACKET_PAIRS } from '../../shared/lyricsParsing.js';
import { RELIGIOUS_WORDS, LATIN_LETTER_REGEX, ENGLISH_HINT_REGEXES } from '../constants/lyricsFormat.js';

/**
 * Normalize smart/typographic characters to their plain ASCII equivalents.
 * Handles curly quotes, em/en dashes, ellipsis characters, non-breaking spaces, etc.
 * @param {string} line
 * @returns {string}
 */
const normalizeTypographicCharacters = (line) => {
  if (!line) return '';
  return line
    // Smart single quotes → straight apostrophe
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    // Smart double quotes → straight double quote
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Em dash / en dash → hyphen with spaces
    .replace(/[\u2013\u2014]/g, ' - ')
    // Horizontal ellipsis character → three dots
    .replace(/\u2026/g, '...')
    // Non-breaking space → regular space
    .replace(/\u00A0/g, ' ')
    // Figure space, thin space, hair space, etc. → regular space
    .replace(/[\u2007\u2009\u200A\u202F\u205F]/g, ' ')
    // Fullwidth characters (common in CJK input) for basic ASCII range
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
};

/**
 * Normalize LRC metadata tags to consistent formatting.
 * Fixes inconsistent spacing and casing in tags like [ti:], [ar:], etc.
 * @param {string} line
 * @returns {string}
 */
const normalizeMetadataTag = (line) => {
  if (!line) return line;
  const trimmed = line.trim();
  // Match LRC metadata tags: [key: value] with optional extra spaces
  const metaMatch = trimmed.match(/^\[\s*(ti|ar|al|by|offset|length|au|lr|re|tool|ve|#)\s*:\s*(.*?)\s*\]$/i);
  if (!metaMatch) return line;
  const key = metaMatch[1].toLowerCase();
  const value = metaMatch[2].trim();
  return `[${key}:${value}]`;
};

/**
 * Check if a line is an LRC metadata tag
 * @param {string} line
 * @returns {boolean}
 */
const isMetadataTag = (line) => {
  if (!line) return false;
  return /^\s*\[(ti|ar|al|by|offset|length|au|lr|re|tool|ve|#):.*\]\s*$/i.test(line.trim());
};

/**
 * Repair orphaned/unmatched brackets from bad pastes.
 * Only repairs translation-style brackets, not timestamps or metadata.
 * @param {string} line
 * @returns {{ text: string, bracketsRepaired: number }}
 */
const repairOrphanedBrackets = (line) => {
  if (!line || typeof line !== 'string') return { text: line, bracketsRepaired: 0 };

  const trimmed = line.trim();
  if (trimmed.length === 0) return { text: line, bracketsRepaired: 0 };

  if (/^\[\d{1,2}:/.test(trimmed) || isMetadataTag(trimmed)) return { text: line, bracketsRepaired: 0 };

  if (STRUCTURE_TAG_PATTERNS.some(p => p.test(trimmed))) return { text: line, bracketsRepaired: 0 };

  let result = trimmed;
  let bracketsRepaired = 0;

  // Check parentheses balance
  const openParens = (result.match(/\(/g) || []).length;
  const closeParens = (result.match(/\)/g) || []).length;
  if (openParens > 0 && closeParens === 0 && openParens === 1) {

    result = result + ')';
    bracketsRepaired++;
  } else if (closeParens > 0 && openParens === 0 && closeParens === 1) {

    result = '(' + result;
    bracketsRepaired++;
  }

  // Check curly braces balance
  const openCurly = (result.match(/\{/g) || []).length;
  const closeCurly = (result.match(/\}/g) || []).length;
  if (openCurly > 0 && closeCurly === 0 && openCurly === 1) {
    result = result + '}';
    bracketsRepaired++;
  } else if (closeCurly > 0 && openCurly === 0 && closeCurly === 1) {
    result = '{' + result;
    bracketsRepaired++;
  }

  return { text: result, bracketsRepaired };
};

/**
 * Remove empty section tags (section tags followed by no lyrics content before the next section or end).
 * @param {string[]} lines
 * @returns {{ lines: string[], emptySectionsRemoved: number }}
 */
const removeEmptySectionTags = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) return { lines, emptySectionsRemoved: 0 };

  const isStructureTag = (line) => {
    if (!line || typeof line !== 'string') return false;
    return STRUCTURE_TAG_PATTERNS.some(p => p.test(line.trim()));
  };

  const result = [];
  let emptySectionsRemoved = 0;

  for (let i = 0; i < lines.length; i++) {
    const current = (lines[i] || '').trim();

    if (isStructureTag(current)) {

      let hasContent = false;
      for (let j = i + 1; j < lines.length; j++) {
        const ahead = (lines[j] || '').trim();
        if (ahead.length === 0) continue;
        if (isStructureTag(ahead)) break;
        hasContent = true;
        break;
      }

      if (!hasContent) {
        emptySectionsRemoved++;
        continue;
      }
    }

    result.push(lines[i]);
  }

  return { lines: result, emptySectionsRemoved };
};

/**
 * Collapse runs of 3+ consecutive blank lines down to 2 (one visual separator).
 * @param {string[]} lines
 * @returns {{ lines: string[], excessBlanksRemoved: number }}
 */
const collapseExcessiveBlankLines = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) return { lines, excessBlanksRemoved: 0 };

  const result = [];
  let consecutiveBlanks = 0;
  let excessBlanksRemoved = 0;

  for (const line of lines) {
    if ((line || '').trim().length === 0) {
      consecutiveBlanks++;
      if (consecutiveBlanks <= 2) {
        result.push(line);
      } else {
        excessBlanksRemoved++;
      }
    } else {
      consecutiveBlanks = 0;
      result.push(line);
    }
  }

  return { lines: result, excessBlanksRemoved };
};

const normalizePunctuation = (line) => {
  if (!line) return '';

  const standardTimestampRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g;
  const enhancedTimestampRegex = /<(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?>/g;
  const timestamps = [];
  let match;
  let workingLine = line;

  while ((match = standardTimestampRegex.exec(line)) !== null) {
    timestamps.push(match[0]);
  }

  while ((match = enhancedTimestampRegex.exec(line)) !== null) {
    timestamps.push(match[0]);
  }

  workingLine = workingLine.replace(standardTimestampRegex, '<<<TIMESTAMP>>>');
  workingLine = workingLine.replace(enhancedTimestampRegex, '<<<TIMESTAMP>>>');

  workingLine = workingLine
    .replace(/^[.,\-]+/, '')
    .replace(/^\.+/, '')
    .replace(/^[\u2024\u2025\u2026]+/, '')
    .replace(/[.\u2024\u2025\u2026]/g, '');

  timestamps.forEach((timestamp) => {
    workingLine = workingLine.replace('<<<TIMESTAMP>>>', timestamp);
  });

  return workingLine;
};

const capitalizeFirstCharacter = (line) => {
  if (!line) return line;
  const corrected = line.replace(/\bi\b/g, 'I');
  return corrected.charAt(0).toUpperCase() + corrected.slice(1);
};

const toTitleCase = (phrase) => {
  if (!phrase) return phrase;
  return phrase
    .split(/\s+/)
    .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part)
    .join(' ');
};

const capitalizeReligiousTerms = (line) => {
  if (!line) return line;

  return RELIGIOUS_WORDS.reduce((current, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    return current.replace(regex, (match) => toTitleCase(match));
  }, line);
};

const isBracketedTranslationLine = (line) => {
  if (!line || typeof line !== 'string') return false;

  const trimmed = line.trim();
  if (trimmed.length <= 2) return false;

  return BRACKET_PAIRS.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
};

const containsLatinCharacters = (text) => Boolean(text && LATIN_LETTER_REGEX.test(text));
const containsEnglishHintWord = (text) => Boolean(text && ENGLISH_HINT_REGEXES.some((regex) => regex.test(text)));

export const splitInlineTranslation = (line) => {
  if (typeof line !== 'string') return [line];

  const workingLine = line.trimEnd();
  if (!workingLine) return [line];

  const match = workingLine.match(/^(.*?)(\s*\(([^()]+)\))$/);
  if (!match) return [line];

  const mainCandidate = match[1];
  const parentheticalContent = match[3];

  if (!parentheticalContent || parentheticalContent.trim().length < 3) {
    return [line];
  }

  const translationHasLatin = containsLatinCharacters(parentheticalContent);
  const translationHasEnglishHint = containsEnglishHintWord(parentheticalContent);
  const mainHasLatin = containsLatinCharacters(mainCandidate);
  const mainHasEnglishHint = containsEnglishHintWord(mainCandidate);

  if (!translationHasLatin && !translationHasEnglishHint) {
    return [line];
  }

  if (mainHasEnglishHint) {
    return [line];
  }

  const mainLine = mainCandidate.trimEnd();
  if (!mainLine) {
    return [line];
  }

  const translationLine = `(${parentheticalContent.trim()})`;

  if (!mainHasLatin) {
    return [mainLine, translationLine];
  }

  if (translationHasEnglishHint) {
    return [mainLine, translationLine];
  }

  if (mainHasLatin) {
    return [line];
  }

  return [mainLine, translationLine];
};

/**
 * Extract and isolate structure tags from text (for cleanup operations)
 * @param {string} text
 * @returns {string}
 */
const extractStructureTags = (text) => {
  if (!text || typeof text !== 'string') return text;
  if (!STRUCTURE_TAGS_CONFIG.ENABLED) return text;

  const lines = text.split(/\r?\n/);
  const processedLines = [];

  for (const line of lines) {
    if (!line || line.trim().length === 0) {
      processedLines.push(line);
      continue;
    }

    let processed = false;

    for (const pattern of STRUCTURE_TAG_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const tag = match[0].trim();
        const remainder = line.substring(match[0].length).trim();

        if (STRUCTURE_TAGS_CONFIG.MODE === 'strip') {
          if (remainder) {
            processedLines.push(remainder);
          }
        } else if (STRUCTURE_TAGS_CONFIG.MODE === 'isolate') {
          processedLines.push(tag);
          if (remainder) {
            processedLines.push(remainder);
          }
        } else {
          processedLines.push(line);
        }

        processed = true;
        break;
      }
    }

    if (!processed) {
      processedLines.push(line);
    }
  }

  return processedLines.join('\n');
};

/**
 * Check if two lines could form a normal group (both within char limit, not bracketed)
 * Uses the same config as the parsing logic for consistency
 */
const couldFormNormalGroup = (line1, line2) => {
  if (!line1 || !line2) return false;
  const trimmed1 = line1.trim();
  const trimmed2 = line2.trim();
  if (trimmed1.length === 0 || trimmed2.length === 0) return false;
  if (isBracketedTranslationLine(trimmed1) || isBracketedTranslationLine(trimmed2)) return false;
  return trimmed1.length <= NORMAL_GROUP_CONFIG.MAX_LINE_LENGTH &&
    trimmed2.length <= NORMAL_GROUP_CONFIG.MAX_LINE_LENGTH;
};

/**
 * @param {string} line - Line to process
 * @returns {string} - Line with timestamps at the beginning with proper spacing
 */
const moveTimestampsToStart = (line) => {
  if (!line || typeof line !== 'string') return line;

  const standardTimestampRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g;
  const enhancedTimestampRegex = /<(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?>/g;

  const standardTimestamps = [];
  const enhancedTimestamps = [];
  let match;

  while ((match = standardTimestampRegex.exec(line)) !== null) {
    standardTimestamps.push(match[0]);
  }

  while ((match = enhancedTimestampRegex.exec(line)) !== null) {
    enhancedTimestamps.push(match[0]);
  }

  if (standardTimestamps.length === 0 && enhancedTimestamps.length === 0) {
    return line;
  }

  let lineWithoutTimestamps = line.replace(standardTimestampRegex, '').replace(enhancedTimestampRegex, '').trim();
  const allTimestamps = standardTimestamps.join('') + enhancedTimestamps.join('');

  if (lineWithoutTimestamps) {
    return allTimestamps + ' ' + lineWithoutTimestamps;
  }

  return allTimestamps;
};

/**
 * Enhanced formatLyrics with optional intelligent line splitting
 * @param {string} text - Raw lyrics text
 * @param {object} options - { enableSplitting: boolean, splitConfig: object }
 * @returns {string} - Formatted lyrics text
 */
export const formatLyrics = (text, options = {}) => {
  if (!text) return '';

  const {
    enableSplitting = false,
    capitalizeFirst = true,
    capitalizeReligious = true,
    normalizeTypographic = true,
    splitConfig = {
      TARGET_LENGTH: 60,
      MIN_LENGTH: 40,
      MAX_LENGTH: 80,
      OVERFLOW_TOLERANCE: 15,
    }
  } = options;

  let workingText = enableSplitting ? preprocessText(text) : text;

  if (normalizeTypographic) {
    workingText = normalizeTypographicCharacters(workingText);
  }

  if (STRUCTURE_TAGS_CONFIG.ENABLED) {
    workingText = extractStructureTags(workingText);
  }

  const lines = String(workingText).split(/\r?\n/);
  const formattedLines = [];

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    if (!rawLine || typeof rawLine !== 'string') continue;

    const trimmedInput = rawLine.trim();
    if (!trimmedInput) continue;

    const timestampNormalized = moveTimestampsToStart(trimmedInput);
    const punctuationNormalized = normalizePunctuation(timestampNormalized);

    const nextLine = lines[i + 1];
    const nextIsBracketed = nextLine && isBracketedTranslationLine(nextLine.trim());
    const nextNextLine = lines[i + 2];

    const shouldNotAddBlankLine = nextIsBracketed ||
      isBracketedTranslationLine(nextLine || '') ||
      couldFormNormalGroup(punctuationNormalized, nextLine);

    const nextAndNextNextFormTranslation = nextLine && nextNextLine &&
      !isBracketedTranslationLine(nextLine.trim()) &&
      isBracketedTranslationLine(nextNextLine.trim());

    let linesToProcess = [punctuationNormalized];
    if (enableSplitting && !nextIsBracketed && !isBracketedTranslationLine(punctuationNormalized)) {
      linesToProcess = splitLongLine(punctuationNormalized, splitConfig);
    }

    for (const processLine of linesToProcess) {
      const segments = splitInlineTranslation(processLine)
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => {
          let result = segment;
          if (capitalizeFirst) result = capitalizeFirstCharacter(result);
          if (capitalizeReligious) result = capitalizeReligiousTerms(result);
          return result;
        });

      if (segments.length === 0) continue;

      segments.forEach((segment) => {
        formattedLines.push(segment);
      });

      if (!shouldNotAddBlankLine && !nextAndNextNextFormTranslation) {
        formattedLines.push('');
      }
    }
  }

  while (formattedLines[formattedLines.length - 1] === '') {
    formattedLines.pop();
  }

  return formattedLines.join('\n');
};

/**
 * Enhanced cleanup that runs the full formatLyrics pipeline plus additional
 * intelligent passes: typographic normalization, bracket repair, empty section
 * pruning, metadata normalization, and excess blank line collapsing.
 * Returns both the cleaned text and a stats object describing every change
 * that was made.
 *
 * @param {string} text - Raw lyrics text
 * @param {object} options - Same options as formatLyrics plus { enableSplitting }
 * @returns {{ text: string, stats: object }} - Cleaned text and change statistics
 */
export const formatLyricsWithStats = (text, options = {}) => {
  if (!text) return { text: '', stats: { totalChanges: 0 } };

  const stats = {
    typographicCharsNormalized: 0,
    metadataTagsNormalized: 0,
    bracketsRepaired: 0,
    emptySectionsRemoved: 0,
    excessBlanksRemoved: 0,
    totalChanges: 0,
  };

  const { normalizeTypographic = true } = options;

  // --- Pass 1: Typographic character normalization (before main format) ---
  let workingText = text;
  if (normalizeTypographic) {
    const typographicBefore = workingText;
    workingText = normalizeTypographicCharacters(workingText);
    if (workingText !== typographicBefore) {
      let charDiffs = 0;
      for (let i = 0; i < Math.max(typographicBefore.length, workingText.length); i++) {
        if (typographicBefore[i] !== workingText[i]) charDiffs++;
      }
      stats.typographicCharsNormalized = Math.max(1, charDiffs);
    }
  }

  // --- Pass 2: Metadata tag normalization (per-line, before main format) ---
  const preMetaLines = workingText.split(/\r?\n/);
  let metaNormCount = 0;
  const metaNormalizedLines = preMetaLines.map((line) => {
    if (isMetadataTag(line)) {
      const normalized = normalizeMetadataTag(line);
      if (normalized !== line.trim()) metaNormCount++;
      return normalized;
    }
    return line;
  });
  stats.metadataTagsNormalized = metaNormCount;
  workingText = metaNormalizedLines.join('\n');

  // --- Pass 3: Core formatLyrics pipeline ---
  const formatted = formatLyrics(workingText, { ...options, normalizeTypographic: false });

  // --- Pass 4: Post-format intelligent passes on the result ---
  let resultLines = formatted.split('\n');

  // 4a: Repair orphaned brackets
  let totalBrackets = 0;
  resultLines = resultLines.map((line) => {
    const trimmed = (line || '').trim();
    if (trimmed.length === 0) return line;
    const { text: fixed, bracketsRepaired } = repairOrphanedBrackets(line);
    totalBrackets += bracketsRepaired;
    return fixed;
  });
  stats.bracketsRepaired = totalBrackets;

  // 4b: Remove empty section tags
  const emptySections = removeEmptySectionTags(resultLines);
  resultLines = emptySections.lines;
  stats.emptySectionsRemoved = emptySections.emptySectionsRemoved;

  // 4c: Collapse excessive blank lines
  const blanks = collapseExcessiveBlankLines(resultLines);
  resultLines = blanks.lines;
  stats.excessBlanksRemoved = blanks.excessBlanksRemoved;

  // Strip trailing blank lines
  while (resultLines.length > 0 && (resultLines[resultLines.length - 1] || '').trim() === '') {
    resultLines.pop();
  }

  // Calculate total changes
  stats.totalChanges =
    stats.typographicCharsNormalized +
    stats.metadataTagsNormalized +
    stats.bracketsRepaired +
    stats.emptySectionsRemoved +
    stats.excessBlanksRemoved;

  return { text: resultLines.join('\n'), stats };
};

export const reconstructEditableText = (lyrics) => {
  if (!lyrics || lyrics.length === 0) return '';

  return lyrics.map(line => {
    if (typeof line === 'string') {
      return line;
    } else if (line && line.type === 'group') {
      return `${line.mainLine}\n${line.translation}`;
    } else if (line && line.type === 'normal-group') {
      return `${line.line1}\n${line.line2}`;
    }
    return '';
  }).join('\n\n');
};