import { preprocessText, splitLongLine } from '../../shared/lyricsParsing/lineSplitting.js';
import {
  BRACKET_PAIRS,
  STRUCTURE_TAGS_CONFIG,
} from '../../shared/lyricsParsing/constants.js';
import {
  isManualNormalGroupCandidate,
  isVisuallyBlankLine,
} from '../../shared/lyricsParsing/lineClassification.js';
import {
  lookupRepeatableSection,
  parseRepeatableSectionMarker,
  registerRepeatableSection,
} from '../../shared/lyricsParsing/repeatableSections.js';
import {
  extractStructureTags,
  isStructureTag,
} from '../../shared/lyricsParsing/structureTags.js';
import {
  DEFAULT_CAPITALIZED_WORDS,
  normalizeCapitalizedWords,
} from '../../shared/capitalizedWords.js';

const LATIN_LETTER_REGEX = /[A-Za-z]/;
const ENGLISH_HINT_WORDS = [...DEFAULT_CAPITALIZED_WORDS, 'the', 'and', 'for', 'with', 'praise', 'glory', 'grace', 'mercy', 'love', 'king', 'queen', 'strength', 'light', 'power', 'redeemer', 'savior', 'saviour', 'spirit', 'amen', 'hallelujah', 'we', 'you', 'your', 'our', 'their', 'his', 'her', 'who', 'what', 'where', 'when', 'why', 'how', 'this', 'that', 'these', 'those', 'shall', 'will', 'hope', 'faith', 'joy', 'peace', 'deliver', 'deliverer', 'rescue', 'comfort', 'comforter', 'guide', 'helper'];
const ENGLISH_HINT_REGEXES = ENGLISH_HINT_WORDS.map((word) => new RegExp(`\\b${word}\\b`, 'i'));

/**
 * Normalize smart/typographic characters to their plain ASCII equivalents.
 * Handles curly quotes, em/en dashes, ellipsis characters, non-breaking spaces, etc.
 * @param {string} line
 * @returns {string}
 */
const TYPOGRAPHIC_CHARACTER_REGEX = /[‘-‟–—…      ！-～]/g;

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
  const metaMatch = trimmed.match(/^\[\s*(ti|ar|al|by|offset|length|au|lr|re|tool|ve|id|#)\s*:\s*(.*?)\s*\]$/i);
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
  return /^\s*\[\s*(ti|ar|al|by|offset|length|au|lr|re|tool|ve|id|#)\s*:.*\]\s*$/i.test(line.trim());
};

/**
 * Repair orphaned/unmatched brackets from bad pastes.
 * Only repairs translation-style brackets, not timestamps or metadata.
 * @param {string} line
 * @returns {{ text: string, bracketsRepaired: number }}
 */
const repairOrphanedBrackets = (line, sectionTagPhrases) => {
  if (!line || typeof line !== 'string') return { text: line, bracketsRepaired: 0 };

  const trimmed = line.trim();
  if (trimmed.length === 0) return { text: line, bracketsRepaired: 0 };

  if (/^\[\d{1,2}:/.test(trimmed) || isMetadataTag(trimmed)) return { text: line, bracketsRepaired: 0 };

  if (isStructureTag(trimmed, sectionTagPhrases)) return { text: line, bracketsRepaired: 0 };

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
 * Section lines that point at other content ("Repeat Chorus", "Chorus x2") rather than
 * heading a body of lyrics.
 * @param {string} line
 * @returns {boolean}
 */
const isSectionInstructionTag = (line) => {
  const trimmed = (line || '').trim();
  return /\brepeat\b/i.test(trimmed) || /(?:^|\s)[x×]\s*\d+\s*[\]\)\}>]?\s*:?\s*$/i.test(trimmed);
};

/**
 * Remove empty section tags (section tags followed by no lyrics content before the next section or end).
 * Keeps repeat instructions and Chorus/Refrain calls that reuse an earlier definition.
 * @param {string[]} lines
 * @returns {{ lines: string[], emptySectionsRemoved: number }}
 */
const removeEmptySectionTags = (lines, sectionTagPhrases) => {
  if (!Array.isArray(lines) || lines.length === 0) return { lines, emptySectionsRemoved: 0 };

  const result = [];
  const definedRepeatableSections = new Map();
  let emptySectionsRemoved = 0;

  for (let i = 0; i < lines.length; i++) {
    const current = (lines[i] || '').trim();

    if (isStructureTag(current, sectionTagPhrases)) {

      let hasContent = false;
      for (let j = i + 1; j < lines.length; j++) {
        const ahead = (lines[j] || '').trim();
        if (isVisuallyBlankLine(ahead)) continue;
        if (isStructureTag(ahead, sectionTagPhrases)) break;
        hasContent = true;
        break;
      }

      const repeatableMarker = parseRepeatableSectionMarker(current);
      if (hasContent) {
        if (repeatableMarker) registerRepeatableSection(definedRepeatableSections, repeatableMarker, true);
      } else {
        const isReference = isSectionInstructionTag(current)
          || Boolean(repeatableMarker && lookupRepeatableSection(definedRepeatableSections, repeatableMarker));
        if (!isReference) {
          emptySectionsRemoved++;
          continue;
        }
      }
    }

    result.push(lines[i]);
  }

  return { lines: result, emptySectionsRemoved };
};

/**
 * Collapse every run of blank lines to a single separator and drop leading blanks.
 * @param {string[]} lines
 * @returns {{ lines: string[], excessBlanksRemoved: number }}
 */
const collapseExcessiveBlankLines = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) return { lines, excessBlanksRemoved: 0 };

  const result = [];
  let previousWasBlank = true;
  let excessBlanksRemoved = 0;

  for (const line of lines) {
    if (isVisuallyBlankLine(line)) {
      if (previousWasBlank) {
        excessBlanksRemoved++;
      } else {
        result.push('');
      }
      previousWasBlank = true;
    } else {
      previousWasBlank = false;
      result.push(line);
    }
  }

  return { lines: result, excessBlanksRemoved };
};

/**
 * Count blank lines beyond the first in each run between content lines.
 * @param {string[]} lines
 * @returns {number}
 */
const countExcessInteriorBlankLines = (lines) => {
  let excess = 0;
  let run = 0;
  let seenContent = false;
  for (const line of lines) {
    if (isVisuallyBlankLine(line)) {
      run++;
      continue;
    }
    if (seenContent && run > 1) excess += run - 1;
    seenContent = true;
    run = 0;
  }
  return excess;
};

const normalizePunctuation = (line) => {
  if (!line) return '';

  const standardTimestampRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  const enhancedTimestampRegex = /<(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?>/g;
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
    .replace(/(?:\.{2,}|[\u2024\u2025\u2026]+)$/g, '')
    .replace(/[ \t]{2,}/g, ' ');

  timestamps.forEach((timestamp) => {
    workingLine = workingLine.replace('<<<TIMESTAMP>>>', timestamp);
  });

  return workingLine;
};

const isBracketedTranslationLine = (line) => {
  if (!line || typeof line !== 'string') return false;

  const trimmed = line.trim();
  if (trimmed.length <= 2) return false;

  return BRACKET_PAIRS.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
};

const capitalizeFirstCharacter = (line, sectionTagPhrases) => {
  if (!line) return line;
  const corrected = line.replace(/\bi\b/g, 'I');

  const capitalizeVisibleContent = (value) => {
    const trimmed = value.trim();
    if (isMetadataTag(trimmed) || isStructureTag(trimmed, sectionTagPhrases)) {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    if (!isBracketedTranslationLine(trimmed)) {
      // Skip leading quotes and punctuation, e.g. "hello" -> "Hello"; digits stop the search.
      return value.replace(/^([^\p{L}\p{N}]*)(\p{L})/u, (_match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase()}`);
    }

    const leadingWhitespaceLength = value.indexOf(trimmed);
    const leadingWhitespace = value.slice(0, leadingWhitespaceLength);
    const trailingWhitespace = value.slice(leadingWhitespaceLength + trimmed.length);
    const innerContent = trimmed.slice(1, -1);
    const firstLetterIndex = innerContent.search(/\p{L}/u);
    if (firstLetterIndex === -1) return value;

    const capitalizedInner = innerContent.slice(0, firstLetterIndex)
      + innerContent.charAt(firstLetterIndex).toLocaleUpperCase()
      + innerContent.slice(firstLetterIndex + 1);
    return `${leadingWhitespace}${trimmed.charAt(0)}${capitalizedInner}${trimmed.slice(-1)}${trailingWhitespace}`;
  };

  const timestampPrefixMatch = corrected.match(/^((?:\[\d{1,2}:\d{2}(?:\.\d{1,3})?\])+)(\s*)/);
  if (timestampPrefixMatch) {
    const prefix = `${timestampPrefixMatch[1]}${timestampPrefixMatch[2] || ''}`;
    const rest = corrected.slice(timestampPrefixMatch[0].length);
    if (!rest) return corrected;
    return prefix + capitalizeVisibleContent(rest);
  }
  return capitalizeVisibleContent(corrected);
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const capitalizeReligiousTerms = (line, capitalizedWords) => {
  if (!line) return line;

  return capitalizedWords.reduce((current, word) => {
    const escapedWord = escapeRegExp(word).replace(/\s+/g, '\\s+');
    const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapedWord})(?=$|[^\\p{L}\\p{N}_])`, 'giu');
    return current.replace(regex, (_match, prefix) => `${prefix}${word}`);
  }, line);
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
 * Check if two lines could form a normal group (both within char limit, not bracketed)
 * Uses the same config as the parsing logic for consistency
 */
const couldFormNormalGroup = (line1, line2, groupingConfig) => {
  if (!line1 || !line2) return false;
  if (groupingConfig?.enableAutoLineGrouping === false) return false;
  const trimmed1 = line1.trim();
  const trimmed2 = line2.trim();
  if (trimmed1.length === 0 || trimmed2.length === 0) return false;
  if (isBracketedTranslationLine(trimmed1) || isBracketedTranslationLine(trimmed2)) return false;
  return isManualNormalGroupCandidate(trimmed1, groupingConfig)
    && isManualNormalGroupCandidate(trimmed2, groupingConfig);
};

/**
 * Decide whether a blank line separates two consecutive formatted blocks.
 * Section headings start a stanza and stay attached to the lyrics they introduce.
 */
const needsStanzaBreak = (previous, current, next, groupingConfig) => {
  if (current.isTag) return true;
  if (previous.isTag && !previous.isInstruction) return false;
  if (current.breakBefore) return true;

  const previousLine = previous.lines[previous.lines.length - 1];
  const currentLine = current.lines[0];
  if (isBracketedTranslationLine(currentLine)) return false;
  if (couldFormNormalGroup(previousLine, currentLine, groupingConfig)) return false;

  // Keep a line attached when the next line is its bracketed translation pair.
  const currentStartsTranslationPair = current.lines.length === 1
    && next
    && !next.breakBefore
    && isBracketedTranslationLine(next.lines[0]);
  return !currentStartsTranslationPair;
};

/**
 * @param {string} line - Line to process
 * @returns {string} - Line with timestamps at the beginning with proper spacing
 */
const moveTimestampsToStart = (line) => {
  if (!line || typeof line !== 'string') return line;

  const standardTimestampRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  const standardTimestamps = [];
  let match;

  while ((match = standardTimestampRegex.exec(line)) !== null) {
    standardTimestamps.push(match[0]);
  }

  if (standardTimestamps.length === 0) {
    return line;
  }

  let lineWithoutTimestamps = line.replace(standardTimestampRegex, '').trim();
  const allTimestamps = standardTimestamps.join('');

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
    capitalizedWords = DEFAULT_CAPITALIZED_WORDS,
    normalizeTypographic = true,
    groupingConfig,
    splitConfig = {
      TARGET_LENGTH: 60,
      MIN_LENGTH: 40,
      MAX_LENGTH: 80,
      OVERFLOW_TOLERANCE: 15,
    }
  } = options;

  const normalizedCapitalizedWords = normalizeCapitalizedWords(capitalizedWords);

  let workingText = enableSplitting ? preprocessText(text) : text;

  if (normalizeTypographic) {
    workingText = normalizeTypographicCharacters(workingText);
  }

  if (STRUCTURE_TAGS_CONFIG.ENABLED) {
    workingText = extractStructureTags(workingText, groupingConfig);
  }

  const sectionTagPhrases = groupingConfig?.sectionTagPhrases;

  // Pass 1: normalize source lines and remember where the source separated stanzas.
  const sourceLines = [];
  let breakPending = false;
  String(workingText).split(/\r\n?|\n/).forEach((rawLine) => {
    if (isVisuallyBlankLine(rawLine)) {
      breakPending = sourceLines.length > 0;
      return;
    }

    const normalized = normalizePunctuation(moveTimestampsToStart(rawLine.trim())).trim();
    // Punctuation-only lines disappear without swallowing a surrounding stanza break.
    if (!normalized) return;

    sourceLines.push({ text: normalized, breakBefore: breakPending });
    breakPending = false;
  });

  // Pass 2: split and capitalize each source line into its display lines.
  const blocks = [];
  let carriedBreak = false;
  sourceLines.forEach((source, index) => {
    const next = sourceLines[index + 1];
    const nextIsTranslation = Boolean(next && !next.breakBefore && isBracketedTranslationLine(next.text));
    const pieces = enableSplitting && !nextIsTranslation && !isBracketedTranslationLine(source.text)
      ? splitLongLine(source.text, splitConfig)
      : [source.text];

    const lines = pieces
      .flatMap((piece) => splitInlineTranslation(piece))
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        let result = segment;
        if (capitalizeFirst) result = capitalizeFirstCharacter(result, sectionTagPhrases);
        if (capitalizeReligious) result = capitalizeReligiousTerms(result, normalizedCapitalizedWords);
        return result;
      });

    if (lines.length === 0) {
      carriedBreak = carriedBreak || source.breakBefore;
      return;
    }

    const isTag = isStructureTag(source.text, sectionTagPhrases);
    blocks.push({
      lines,
      breakBefore: source.breakBefore || carriedBreak,
      isTag,
      isInstruction: isTag && isSectionInstructionTag(source.text),
    });
    carriedBreak = false;
  });

  // Pass 3: lay blocks out with exactly one blank line between stanzas.
  const output = [];
  blocks.forEach((block, index) => {
    if (index > 0 && needsStanzaBreak(blocks[index - 1], block, blocks[index + 1], groupingConfig)) {
      output.push('');
    }
    output.push(...block.lines);
  });

  return output.join('\n');
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
    // Count source characters; replacements such as ellipsis -> "..." change string length.
    stats.typographicCharsNormalized = (workingText.match(TYPOGRAPHIC_CHARACTER_REGEX) || []).length;
    workingText = normalizeTypographicCharacters(workingText);
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
  const sourceExcessBlanks = countExcessInteriorBlankLines(metaNormalizedLines);

  // --- Pass 3: Core formatLyrics pipeline ---
  const formatted = formatLyrics(workingText, { ...options, normalizeTypographic: false });

  // --- Pass 4: Post-format intelligent passes on the result ---
  let resultLines = formatted.split('\n');

  // 4a: Repair orphaned brackets
  let totalBrackets = 0;
  resultLines = resultLines.map((line) => {
    const trimmed = (line || '').trim();
    if (trimmed.length === 0) return line;
    const { text: fixed, bracketsRepaired } = repairOrphanedBrackets(
      line,
      options.groupingConfig?.sectionTagPhrases,
    );
    totalBrackets += bracketsRepaired;
    return fixed;
  });
  stats.bracketsRepaired = totalBrackets;

  // 4b: Remove empty section tags
  const emptySections = removeEmptySectionTags(
    resultLines,
    options.groupingConfig?.sectionTagPhrases,
  );
  resultLines = emptySections.lines;
  stats.emptySectionsRemoved = emptySections.emptySectionsRemoved;

  // 4c: Collapse excessive blank lines
  const blanks = collapseExcessiveBlankLines(resultLines);
  resultLines = blanks.lines;
  stats.excessBlanksRemoved = sourceExcessBlanks + blanks.excessBlanksRemoved;

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
      if (Array.isArray(line.lines) && line.lines.length > 0) {
        return line.lines.join('\n');
      }
      return [line.line1, line.line2].filter(Boolean).join('\n');
    }
    return '';
  }).join('\n\n');
};
