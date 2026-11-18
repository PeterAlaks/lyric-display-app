// Enhanced utilities for intelligently breaking long lyric lines into displayable segments
import { normalizeLineSplittingConfig } from './preferenceOptions.js';
import { isVisuallyBlankLine } from './lineClassification.js';

/**
 * Configuration for line splitting behavior
 */
const SPLIT_CONFIG = {
    TARGET_LENGTH: 60,
    MIN_LENGTH: 40,
    MAX_LENGTH: 80,
    OVERFLOW_TOLERANCE: 15,
};

/**
 * Problematic characters to strip from lyrics
 */
const PROBLEMATIC_CHARS_REGEX = /[\u200B-\u200D\uFEFF\u00AD\u2060]+/g;
const EXCESSIVE_WHITESPACE_REGEX = /[ \t]+/g;
const EXCESSIVE_NEWLINES_REGEX = /\n{3,}/g;

/**
 * Break priority markers (higher = preferred break point)
 */
const BREAK_MARKERS = [
    { pattern: /[.!?]+\s+/g, priority: 10, preserve: true },
    { pattern: /[,;:]+\s+/g, priority: 8, preserve: true },
    { pattern: /\s+/g, priority: 2, preserve: false },
];

/**
 * Patterns to detect and preserve (don't break within these)
 */
const PRESERVE_PATTERNS = [
    /\[[\d:.,]+\]/g,
    /\b\d{1,2}:\d{2}\b/g,
    /https?:\/\/\S+/gi,
    /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
];

/**
 * Pre-process raw text to remove problematic characters and normalize spacing
 * @param {string} text
 * @returns {string}
 */
export function preprocessText(text) {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text.replace(/\r\n?/g, '\n');
    cleaned = cleaned.replace(PROBLEMATIC_CHARS_REGEX, '');
    cleaned = cleaned.replace(EXCESSIVE_WHITESPACE_REGEX, ' ');
    // Blank out invisible-only lines before collapsing so they count as stanza breaks.
    cleaned = cleaned.split('\n').map(line => (isVisuallyBlankLine(line) ? '' : line.trim())).join('\n');
    cleaned = cleaned.replace(EXCESSIVE_NEWLINES_REGEX, '\n\n');

    return cleaned;
}

/**
 * Find all potential break points in a line with their priorities
 * @param {string} line
 * @returns {Array<{index: number, priority: number, preserveChar: boolean}>}
 */
function findBreakPoints(line) {
    const breakPoints = [];
    const preserveRanges = [];

    PRESERVE_PATTERNS.forEach(pattern => {
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);
        while ((match = regex.exec(line)) !== null) {
            preserveRanges.push({ start: match.index, end: match.index + match[0].length });
        }
    });

    BREAK_MARKERS.forEach(({ pattern, priority, preserve }) => {
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);

        while ((match = regex.exec(line)) !== null) {
            const breakIndex = match.index + match[0].length;

            const inPreservedRange = preserveRanges.some(
                range => breakIndex > range.start && breakIndex < range.end
            );

            if (!inPreservedRange) {
                breakPoints.push({
                    index: breakIndex,
                    priority,
                    preserveChar: preserve,
                });
            }
        }
    });

    breakPoints.sort((a, b) => a.index - b.index);

    return breakPoints;
}

/**
 * Find the best break point near a target position
 * @param {Array<{index: number, priority: number}>} breakPoints
 * @param {number} targetIndex - Ideal break position
 * @param {number} minIndex - Minimum acceptable position
 * @param {number} maxIndex - Maximum acceptable position
 * @returns {number|null} - Best break index or null
 */
function findBestBreakPoint(breakPoints, targetIndex, minIndex, maxIndex) {
    if (breakPoints.length === 0) return null;

    const candidates = breakPoints.filter(
        bp => bp.index >= minIndex && bp.index <= maxIndex
    );

    if (candidates.length === 0) return null;

    const scored = candidates.map(bp => {
        const distance = Math.abs(bp.index - targetIndex);
        const distanceScore = 1 / (distance + 1);
        const totalScore = bp.priority * 2 + distanceScore * 10;
        return { ...bp, score: totalScore };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].index;
}

/**
 * Capitalize the first character of a string
 * @param {string} text
 * @returns {string}
 */
function capitalizeFirst(text) {
    if (!text || typeof text !== 'string') return text;
    const trimmed = text.trim();
    if (trimmed.length === 0) return text;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Split a single long line into multiple shorter lines intelligently
 * @param {string} line
 * @param {object} config - Optional configuration overrides
 * @returns {string[]} - Array of split lines
 */
export function splitLongLine(line, config = {}) {
    if (!line || typeof line !== 'string') return [line];

    const cfg = normalizeLineSplittingConfig({ ...SPLIT_CONFIG, ...config });
    const trimmed = line.trim();

    if (trimmed.length <= cfg.MAX_LENGTH) return [trimmed];

    const result = [];
    let remaining = trimmed;

    let iterations = 0;
    const MAX_ITERATIONS = 100;

    while (remaining.length > cfg.MAX_LENGTH && iterations < MAX_ITERATIONS) {
        iterations++;

        const breakPoints = findBreakPoints(remaining);

        const minBreak = cfg.MIN_LENGTH;
        const maxBreak = Math.min(cfg.MAX_LENGTH + cfg.OVERFLOW_TOLERANCE, remaining.length);
        const targetBreak = cfg.TARGET_LENGTH;

        const breakIndex = findBestBreakPoint(breakPoints, targetBreak, minBreak, maxBreak);

        if (breakIndex) {

            const segment = remaining.substring(0, breakIndex).trim();
            if (segment) result.push(capitalizeFirst(segment));
            remaining = remaining.substring(breakIndex).trim();
        } else {
            const forcedBreak = remaining.lastIndexOf(' ', cfg.MAX_LENGTH);

            if (forcedBreak > cfg.MIN_LENGTH) {
                const segment = remaining.substring(0, forcedBreak).trim();
                if (segment) result.push(capitalizeFirst(segment));
                remaining = remaining.substring(forcedBreak).trim();
            } else {
                const segment = remaining.substring(0, cfg.MAX_LENGTH).trim();
                if (segment) result.push(capitalizeFirst(segment));
                remaining = remaining.substring(cfg.MAX_LENGTH).trim();
            }
        }
    }

    if (remaining.length > 0) {
        result.push(capitalizeFirst(remaining));
    }

    return result.length > 0 ? result : [trimmed];
}

/**
 * Process an array of lines, splitting long ones intelligently
 * @param {string[]} lines
 * @param {object} config - Optional configuration overrides
 * @returns {string[]} - Array of processed lines
 */
export function processLines(lines, config = {}) {
    if (!Array.isArray(lines)) return [];

    const result = [];

    for (const line of lines) {
        if (!line || typeof line !== 'string') continue;

        const trimmed = line.trim();
        if (!trimmed) continue;

        const segments = splitLongLine(trimmed, config);
        result.push(...segments);
    }

    return result;
}

/**
 * Enhanced text processing: preprocess + intelligent line splitting
 * @param {string} rawText
 * @param {object} options
 * @returns {string[]} - Array of processed lines
 */
export function enhancedTextProcessing(rawText, options = {}) {
    if (!rawText || typeof rawText !== 'string') return [];

    const cleaned = preprocessText(rawText);
    const initialLines = cleaned.split(/\r?\n/);
    const processed = processLines(initialLines, options.splitConfig);

    return processed;
}

/**
 * Calculate the "readability score" of a line (lower = more readable)
 * Useful for determining if line splitting improved the text
 * @param {string} line
 * @returns {number}
 */
export function calculateReadabilityScore(line) {
    if (!line || typeof line !== 'string') return 100;

    const length = line.trim().length;
    const cfg = SPLIT_CONFIG;

    let score = 0;

    if (length < cfg.MIN_LENGTH) {
        score += (cfg.MIN_LENGTH - length) * 0.5;
    } else if (length > cfg.MAX_LENGTH) {
        score += (length - cfg.MAX_LENGTH) * 2;
    } else if (length > cfg.TARGET_LENGTH) {
        score += (length - cfg.TARGET_LENGTH) * 0.3;
    }

    return score;
}

/**
 * Validate that processed lines maintain overall content integrity
 * @param {string} original
 * @param {string[]} processed
 * @returns {boolean}
 */
export function validateProcessing(original, processed) {
    if (!original || !Array.isArray(processed)) return false;

    const originalCleaned = original.replace(/\s+/g, ' ').trim().toLowerCase();
    const processedCombined = processed.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();

    const similarity = Math.min(originalCleaned.length, processedCombined.length) /
        Math.max(originalCleaned.length, processedCombined.length);

    return similarity > 0.95;
}

// --- Restoring the line breaks of hymn stanzas stored as one run of text ---
//
// Hymn texts copied without their line breaks still show where lines began: most hymns
// capitalize every line start, the rest end lines at punctuation, and every stanza of a
// hymn shares one meter, so its lines run to a similar length and count.

// Words hymns capitalize wherever they fall, so a capital alone does not start a line.
const REVERENT_WORDS = new Set([
  'i', 'o', 'oh', 'god', 'lord', 'christ', 'jesus', 'he', 'his', 'him', 'thee', 'thou', 'thy', 'thine',
  'me', 'my', 'mine', 'you', 'your', 'yours', 'father', 'son', 'spirit', 'holy', 'ghost', 'savior',
  'saviour', 'king', 'lamb', 'word', 'heaven', "heav'n", 'almighty', 'jehovah', 'emmanuel', 'immanuel',
  'israel', 'zion', 'jerusalem', 'bethlehem', 'mary', 'david', 'jordan', 'calvary', 'trinity',
  'redeemer', 'shepherd', 'master', 'prince', 'creator', 'friend', 'hosanna', 'alleluia', 'hallelujah', 'amen',
]);
const LEADING_WORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'into', 'upon',
  'thy', 'my', 'our', 'your', 'their', 'its', 'and', 'or', 'nor',
]);
const MAX_RESTORED_LINE_LENGTH = 120;

const bareWord = (word) => word.replace(/^[^A-Za-z]+/, '').replace(/[^A-Za-z']+$/, '').replace(/'s$/, '').toLowerCase();
const startsCapitalized = (word) => /^["'“‘(\[]*[A-Z]/.test(word);
const endsSentence = (word) => /[.!?]["”’')\]]*$/.test(word);
const endsClause = (word) => /[;:.!?]["”’')\]]*$/.test(word);
const endsPhrase = (word) => /[,—–-]["”’')\]]*$/.test(word);

function describeHymnStyle(stanzas) {
  const words = stanzas.flatMap((stanza) => stanza.split(/\s+/).filter(Boolean));
  // Hymns that capitalize every line start have ordinary words capitalized mid-sentence.
  const midSentenceCapitals = words.filter((word, index) => (
    index > 0 && startsCapitalized(word) && !REVERENT_WORDS.has(bareWord(word)) && !endsSentence(words[index - 1])
  )).length;
  return {
    capitalizedLines: midSentenceCapitals / Math.max(1, words.join(' ').length / 40) >= 0.25,
    lowercaseWords: new Set(words.filter((word) => /^["'“‘(\[]*[a-z]/.test(word)).map(bareWord)),
  };
}

// How likely a line starts at `word`; negative scores are breaks to avoid.
function lineStartScore(previous, word, style) {
  let score = endsClause(previous) ? 2 : endsPhrase(previous) ? 0.8 : 0;
  // A line never ends on a vocative "O" or a word that leads into the next one ("the", "of", "thy"),
  // and often starts with an "O" after a clause ends.
  if (/^(o|oh)$/i.test(previous) || LEADING_WORDS.has(previous.toLowerCase())) return -8;
  if (endsClause(previous) && /^["'“‘(]*(O|Oh)[,!]?$/.test(word)) return score + 1.5;
  if (!style.capitalizedLines) return score > 0 ? score : -8;
  // Some texts lowercase a few line starts, so punctuation still counts for a little.
  if (!startsCapitalized(word)) return score > 0 ? score - 2.5 : -8;
  const bare = bareWord(word);
  if (REVERENT_WORDS.has(bare)) return score + (score > 0 ? -0.5 : -1);
  // A word written in lowercase elsewhere in the hymn is capitalized here only to start a line.
  return score + (style.lowercaseWords.has(bare) ? 2.5 : 1.2);
}

function lineLengthCost(length, target) {
  if (!target) return length < 12 ? 6 : length < 18 ? 2 : length > 42 ? (length - 42) / 5 : 0;
  const deviation = (length - target) / target;
  return 7 * deviation * deviation + (length < 10 ? 4 : 0);
}

// Best split of one stanza, optionally into exactly `lineCount` lines.
function splitStanzaIntoLines(stanza, style, target, lineCount = null) {
  const words = stanza.split(/\s+/).filter(Boolean);
  const best = Array.from({ length: words.length + 1 }, () => new Map());
  best[0].set(0, { score: 0, from: null });

  for (let end = 1; end <= words.length; end += 1) {
    const startScore = end === words.length ? 0 : lineStartScore(words[end - 1], words[end], style);
    let length = -1;
    for (let start = end - 1; start >= 0; start -= 1) {
      length += words[start].length + 1;
      if (length > MAX_RESTORED_LINE_LENGTH && start < end - 1) break;
      for (const [count, entry] of best[start]) {
        const nextCount = lineCount ? count + 1 : 0;
        if (lineCount && nextCount > lineCount) continue;
        const score = entry.score + startScore - lineLengthCost(length, target);
        const current = best[end].get(nextCount);
        if (!current || score > current.score) best[end].set(nextCount, { score, from: [start, count] });
      }
    }
  }

  let node = best[words.length].get(lineCount || 0);
  if (!node) return null;
  const score = node.score;
  const lines = [];
  let end = words.length;
  while (node.from) {
    const [start, count] = node.from;
    lines.unshift(words.slice(start, end).join(' '));
    end = start;
    node = best[start].get(count);
  }
  return { lines, score };
}

const middleValue = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const mostCommon = (values) => {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
};

/**
 * Restore the line breaks of hymn stanzas that were stored as one run of text each. Pass
 * every stanza of one hymn together, since they share a meter.
 * @param {string[]} stanzas
 * @returns {string[][]} The lines of each stanza.
 */
export function restoreVerseLineBreaks(stanzas) {
  const texts = (Array.isArray(stanzas) ? stanzas : []).map((stanza) => String(stanza ?? '').replace(/\s+/g, ' ').trim());
  const present = texts.filter(Boolean);
  if (present.length === 0) return texts.map(() => []);

  const style = describeHymnStyle(present);
  // A first pass finds the hymn's usual line length; the second aims every line at it.
  const firstPass = present.map((text) => splitStanzaIntoLines(text, style, null).lines);
  const target = Math.min(48, Math.max(18, middleValue(firstPass.flat().map((line) => line.length))));
  const splits = present.map((text) => splitStanzaIntoLines(text, style, target));
  const usualLineCount = mostCommon(splits.map((split) => split.lines.length));

  let index = 0;
  return texts.map((text) => {
    if (!text) return [];
    const split = splits[index];
    index += 1;
    if (split.lines.length === usualLineCount) return split.lines;
    // Prefer the hymn's usual line count when it fits this stanza almost as well.
    const matched = splitStanzaIntoLines(text, style, target, usualLineCount);
    return matched && matched.score >= split.score - 3 ? matched.lines : split.lines;
  });
}
