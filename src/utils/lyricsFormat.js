// utils/lyricsFormat.js
// Enhanced utilities for formatting and reconstructing lyrics text

import { preprocessText, splitLongLine } from '../../shared/lineSplitting.js';
import { NORMAL_GROUP_CONFIG, STRUCTURE_TAGS_CONFIG, STRUCTURE_TAG_PATTERNS, BRACKET_PAIRS } from '../../shared/lyricsParsing.js';

const RELIGIOUS_WORDS = ['jesus', 'jehovah', 'god', 'yahweh', 'lord', 'christ', 'holy ghost',
  'holy spirit', 'bible', 'amen', 'hallelujah', 'hosanna', 'savior', 'saviour', 'redeemer', 'messiah'];

const LATIN_LETTER_REGEX = /[A-Za-z]/;
const ENGLISH_HINT_WORDS = [...RELIGIOUS_WORDS, 'the', 'and', 'for', 'with', 'praise', 'glory', 'grace', 'mercy', 'love', 'king', 'queen', 'strength', 'light', 'power', 'redeemer', 'savior', 'saviour', 'spirit', 'amen', 'hallelujah', 'we', 'you', 'your', 'our', 'their', 'his', 'her', 'who', 'what', 'where', 'when', 'why', 'how', 'this', 'that', 'these', 'those', 'shall', 'will', 'hope', 'faith', 'joy', 'peace', 'deliver', 'deliverer', 'rescue', 'comfort', 'comforter', 'guide', 'helper'];

const ENGLISH_HINT_REGEXES = ENGLISH_HINT_WORDS.map((word) => new RegExp(`\\b${word}\\b`, 'i'));

const normalizePunctuation = (line) => {
  if (!line) return '';

  return line
    .replace(/^[.,\-]+/, '')
    .replace(/^\.+/, '')
    .replace(/^[\u2024\u2025\u2026]+/, '')
    .replace(/[.\u2024\u2025\u2026]/g, '');
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
 * Enhanced formatLyrics with optional intelligent line splitting
 * @param {string} text - Raw lyrics text
 * @param {object} options - { enableSplitting: boolean, splitConfig: object }
 * @returns {string} - Formatted lyrics text
 */
export const formatLyrics = (text, options = {}) => {
  if (!text) return '';

  const {
    enableSplitting = false,
    splitConfig = {
      TARGET_LENGTH: 60,
      MIN_LENGTH: 40,
      MAX_LENGTH: 80,
      OVERFLOW_TOLERANCE: 15,
    }
  } = options;

  let workingText = enableSplitting ? preprocessText(text) : text;

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

    const punctuationNormalized = normalizePunctuation(trimmedInput);

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
        .map((segment) => capitalizeReligiousTerms(capitalizeFirstCharacter(segment)));

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