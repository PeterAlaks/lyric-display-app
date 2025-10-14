// shared/lyricsParsing.js
// Enhanced utilities for parsing TXT and LRC lyric content with intelligent line splitting

import { preprocessText, enhancedTextProcessing, splitLongLine, validateProcessing } from './intelligentLineSplitting.js';

const BRACKET_PAIRS = [
  ['[', ']'],
  ['(', ')'],
  ['{', '}'],
  ['<', '>'],
];

const TIME_TAG_REGEX = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g;
const META_TAG_REGEX = /^\s*\[(ti|ar|al|by|offset):.*\]\s*$/i;

const TIMESTAMP_LIKE_PATTERNS = [
  /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g,
  /\(\d{1,2}:\d{2}(?:\.\d{1,3})?\)/g,
  /^\d{1,2}:\d{2}\s+/gm,
];

/**
 * Determine if a lyric line should be treated as a translation line based on bracket delimiters.
 * @param {string} line
 * @returns {boolean}
 */
export function isTranslationLine(line) {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  if (trimmed.length <= 2) return false;
  return BRACKET_PAIRS.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
}

/**
 * Remove timestamp-like patterns from text (useful for TXT files that may contain them)
 * @param {string} text
 * @returns {string}
 */
function stripTimestampPatterns(text) {
  if (!text || typeof text !== 'string') return text;

  let cleaned = text;
  TIMESTAMP_LIKE_PATTERNS.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  return cleaned;
}

/**
 * Apply intelligent line splitting to an array of raw lines
 * IMPORTANT: Preserves translation line relationships
 * @param {string[]} rawLines
 * @param {object} options
 * @returns {string[]}
 */
function applyIntelligentSplitting(rawLines, options = {}) {
  const { enableSplitting = true, splitConfig = {} } = options;

  if (!enableSplitting) return rawLines;

  const result = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line || typeof line !== 'string') continue;

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isTranslationLine(trimmed)) {
      result.push(trimmed);
      continue;
    }

    const nextLine = rawLines[i + 1];
    const nextIsTrans = nextLine && isTranslationLine(nextLine.trim());

    if (nextIsTrans) {
      result.push(trimmed);
      continue;
    }

    const segments = splitLongLine(trimmed, splitConfig);
    result.push(...segments);
  }

  return result;
}

/**
 * Groups clusters of raw lines into either individual strings or grouped translation objects.
 * @param {Array<{ line: string, originalIndex: number }[]>} clusters
 * @returns {Array<string | object>}
 */
function flattenClusters(clusters) {
  const result = [];

  clusters.forEach((cluster, clusterIndex) => {
    if (cluster.length === 2 && isTranslationLine(cluster[1].line)) {
      const groupedLine = {
        type: 'group',
        id: `group_${clusterIndex}_${cluster[0].originalIndex}`,
        mainLine: cluster[0].line,
        translation: cluster[1].line,
        displayText: `${cluster[0].line}\n${cluster[1].line}`,
        searchText: `${cluster[0].line} ${cluster[1].line}`,
        originalIndex: cluster[0].originalIndex,
      };
      result.push(groupedLine);
    } else {
      cluster.forEach((item) => {
        result.push(item.line);
      });
    }
  });

  return result;
}

/**
 * Split raw text into clusters separated by blank lines and convert into processed lyric lines.
 * Enhanced with intelligent line splitting.
 * @param {string} rawText
 * @param {object} options - { enableSplitting: boolean, splitConfig: object }
 * @returns {Array<string | object>}
 */
export function processRawTextToLines(rawText = '', options = {}) {
  const { enableSplitting = true, splitConfig = {} } = options;

  let cleaned = preprocessText(rawText);
  cleaned = stripTimestampPatterns(cleaned);
  const allLines = cleaned.split(/\r?\n/);
  const preClusters = [];
  let currentCluster = [];

  for (let i = 0; i < allLines.length; i += 1) {
    const line = allLines[i].trim();

    if (line.length > 0) {
      currentCluster.push(line);
    } else if (currentCluster.length > 0) {
      preClusters.push([...currentCluster]);
      currentCluster = [];
    }
  }

  if (currentCluster.length > 0) {
    preClusters.push(currentCluster);
  }

  const finalClusters = [];

  for (const cluster of preClusters) {
    const processedCluster = [];

    for (let i = 0; i < cluster.length; i++) {
      const line = cluster[i];
      const nextLine = cluster[i + 1];
      const nextIsTrans = nextLine && isTranslationLine(nextLine);

      if (isTranslationLine(line)) {
        processedCluster.push(line);
        continue;
      }

      if (enableSplitting && line.length > (splitConfig.MAX_LENGTH || 70)) {
        const segments = splitLongLine(line, splitConfig);

        for (let j = 0; j < segments.length - 1; j++) {
          processedCluster.push(segments[j]);
        }

        processedCluster.push(segments[segments.length - 1]);
      } else {
        processedCluster.push(line);
      }
    }

    const indexedCluster = processedCluster.map((line, idx) => ({
      line,
      originalIndex: idx,
    }));

    finalClusters.push(indexedCluster);
  }

  return flattenClusters(finalClusters);
}

/**
 * Parse plain text lyric content into processed lines with translation groupings.
 * Enhanced with intelligent line splitting.
 * @param {string} rawText
 * @param {object} options - { enableSplitting: boolean, splitConfig: object }
 * @returns {{ rawText: string, processedLines: Array<string | object> }}
 */
export function parseTxtContent(rawText = '', options = {}) {
  const processedLines = processRawTextToLines(rawText, options);

  const reconstructed = processedLines.map(line => {
    if (typeof line === 'string') return line;
    if (line && line.type === 'group') {
      return `${line.mainLine}\n${line.translation}`;
    }
    return '';
  }).join('\n\n');

  return { rawText: reconstructed, processedLines };
}

/**
 * Parse LRC content into visible lyric lines preserving ordering and translation groupings.
 * Enhanced with intelligent line splitting.
 * @param {string} rawText
 * @param {object} options - { enableSplitting: boolean, splitConfig: object }
 * @returns {{ rawText: string, processedLines: Array<string | object> }}
 */
export function parseLrcContent(rawText = '', options = {}) {
  const { enableSplitting = true, splitConfig = {} } = options;

  const lines = String(rawText).split(/\r?\n/);
  const entries = [];

  for (const line of lines) {
    if (!line?.trim()) continue;
    if (META_TAG_REGEX.test(line)) continue;

    let match;
    const times = [];
    TIME_TAG_REGEX.lastIndex = 0;

    while ((match = TIME_TAG_REGEX.exec(line)) !== null) {
      const mm = parseInt(match[1], 10) || 0;
      const ss = parseInt(match[2], 10) || 0;
      const cs = match[3] ? parseInt(match[3].slice(0, 2).padEnd(2, '0'), 10) : 0;
      const t = mm * 60 * 100 + ss * 100 + cs;
      times.push(t);
    }

    let text = line.replace(TIME_TAG_REGEX, '').trim();

    text = preprocessText(text);

    if (!text) continue;

    if (times.length === 0) {
      entries.push({ t: Number.MAX_SAFE_INTEGER, text });
    } else {
      times.forEach((t) => entries.push({ t, text }));
    }
  }

  entries.sort((a, b) => a.t - b.t);

  const processed = [];
  const seen = new Set();

  for (const entry of entries) {
    const key = `${entry.t}|${entry.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    processed.push(entry.text);
  }

  const splitLines = applyIntelligentSplitting(processed, { enableSplitting, splitConfig });

  const grouped = [];
  for (let i = 0; i < splitLines.length; i += 1) {
    const main = splitLines[i];
    const next = splitLines[i + 1];

    if (next && isTranslationLine(next)) {
      grouped.push({
        type: 'group',
        id: `lrc_group_${i}`,
        mainLine: main,
        translation: next,
        displayText: `${main}\n${next}`,
        searchText: `${main} ${next}`,
        originalIndex: i,
      });
      i += 1;
    } else {
      grouped.push(main);
    }
  }

  const visibleRawText = splitLines.join('\n');
  return { rawText: visibleRawText, processedLines: grouped };
}

/**
 * Enhanced processing specifically for online lyrics search results
 * Assumes more aggressive cleanup may be needed
 * @param {string} rawText
 * @param {object} options
 * @returns {{ rawText: string, processedLines: Array<string | object> }}
 */
export function parseOnlineLyricsContent(rawText = '', options = {}) {
  const enhancedOptions = {
    enableSplitting: true,
    splitConfig: {
      TARGET_LENGTH: 55,
      MIN_LENGTH: 35,
      MAX_LENGTH: 70,
      OVERFLOW_TOLERANCE: 12,
    },
    ...options,
  };

  return parseTxtContent(rawText, enhancedOptions);
}