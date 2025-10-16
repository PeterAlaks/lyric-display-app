// shared/intelligentLineSplitting.js
// Enhanced utilities for intelligently breaking long lyric lines into displayable segments

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

    let cleaned = text;
    cleaned = cleaned.replace(PROBLEMATIC_CHARS_REGEX, '');
    cleaned = cleaned.replace(EXCESSIVE_WHITESPACE_REGEX, ' ');
    cleaned = cleaned.replace(EXCESSIVE_NEWLINES_REGEX, '\n\n');
    cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');

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

    const cfg = { ...SPLIT_CONFIG, ...config };
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