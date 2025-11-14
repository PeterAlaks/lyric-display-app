// shared/lyricsParsing.js
// Enhanced utilities for parsing TXT and LRC lyric content with intelligent line splitting

import { preprocessText, enhancedTextProcessing, splitLongLine, validateProcessing } from './lineSplitting.js';

export const BRACKET_PAIRS = [
  ['[', ']'],
  ['(', ')'],
  ['{', '}'],
  ['<', '>'],
];

export const NORMAL_GROUP_CONFIG = {
  ENABLED: true,
  MAX_LINE_LENGTH: 45,
  CROSS_BLANK_LINE_GROUPING: true,
};

export const STRUCTURE_TAGS_CONFIG = {
  ENABLED: true,
  MODE: 'isolate',
};

// Common structure tag patterns
export const STRUCTURE_TAG_PATTERNS = [
  // [Verse], [Verse 1], [Verse 1:], [Chorus], etc.
  /^\s*\[(Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Pre Chorus|Hook|Refrain|Interlude|Break)(\s+\d+)?\s*:?\]\s*/i,

  // Verse 1:, Chorus:, etc. (WITH colon at start of line)
  /^\s*(Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Pre Chorus|Hook|Refrain|Interlude|Break)(\s+\d+)?\s*:\s*/i,

  // (Verse 1), (Chorus), etc.
  /^\s*\((Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Pre Chorus|Hook|Refrain|Interlude|Break)(\s+\d+)?\s*:?\)\s*/i,

  // Verse 1, Chorus, Bridge, etc. (WITHOUT colon, standalone on line)
  /^\s*(Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Pre Chorus|Hook|Refrain|Interlude|Break)(\s+\d+)?\s*$/i,
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

  if (isStructureTag(trimmed)) return false;

  return BRACKET_PAIRS.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
}

/**
 * Check if a line is eligible for normal grouping (not bracketed, within character limit)
 * @param {string} line
 * @returns {boolean}
 */
function isNormalGroupCandidate(line) {
  if (!line || typeof line !== 'string') return false;
  if (!NORMAL_GROUP_CONFIG.ENABLED) return false;
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  if (isTranslationLine(trimmed)) return false;
  return trimmed.length <= NORMAL_GROUP_CONFIG.MAX_LINE_LENGTH;
}

/**
 * Check if a line is a song separator (multiple asterisks, dashes, or underscores used to mark song boundaries)
 * @param {string} line
 * @returns {boolean}
 */
function isSongSeparator(line) {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  return /^[\*\-_]{2,}/.test(trimmed);
}

/**
 * Check if a line is a structure tag (Verse, Chorus, etc.)
 * @param {string} line
 * @returns {boolean}
 */
function isStructureTag(line) {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  return STRUCTURE_TAG_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Extract and isolate structure tags from text.
 * Handles cases where tags are on their own line or combined with lyrics.
 * @param {string} text
 * @returns {string}
 */
function extractStructureTags(text) {
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
 * Groups clusters of raw lines into either individual strings, translation groups, or normal groups.
 * Handles both translation grouping (bracketed) and normal grouping (two-line pairs).
 * @param {Array<{ line: string, originalIndex: number }[]>} clusters
 * @returns {Array<string | object>}
 */
function flattenClusters(clusters) {
  const result = [];

  clusters.forEach((cluster, clusterIndex) => {
    if (cluster.length === 2 && isTranslationLine(cluster[1].line) && !isTranslationLine(cluster[0].line)) {
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
      return;
    }

    if (cluster.length >= 2 && NORMAL_GROUP_CONFIG.ENABLED) {
      let i = 0;
      while (i < cluster.length) {
        const currentItem = cluster[i];
        const nextItem = cluster[i + 1];
        const nextNextItem = cluster[i + 2];

        if (nextItem && isTranslationLine(nextItem.line) && !isTranslationLine(currentItem.line)) {
          const translationGroup = {
            type: 'group',
            id: `group_${clusterIndex}_${currentItem.originalIndex}`,
            mainLine: currentItem.line,
            translation: nextItem.line,
            displayText: `${currentItem.line}\n${nextItem.line}`,
            searchText: `${currentItem.line} ${nextItem.line}`,
            originalIndex: currentItem.originalIndex,
          };
          result.push(translationGroup);
          i += 2;
          continue;
        }

        if (nextItem && nextNextItem && isTranslationLine(nextNextItem.line) && !isTranslationLine(nextItem.line)) {
          result.push(currentItem.line);
          const translationGroup = {
            type: 'group',
            id: `group_${clusterIndex}_${nextItem.originalIndex}`,
            mainLine: nextItem.line,
            translation: nextNextItem.line,
            displayText: `${nextItem.line}\n${nextNextItem.line}`,
            searchText: `${nextItem.line} ${nextNextItem.line}`,
            originalIndex: nextItem.originalIndex,
          };
          result.push(translationGroup);
          i += 3;
          continue;
        }

        if (
          nextItem &&
          isNormalGroupCandidate(currentItem.line) &&
          isNormalGroupCandidate(nextItem.line) &&
          !isTranslationLine(nextItem.line) &&
          !isStructureTag(currentItem.line) &&
          !isStructureTag(nextItem.line)
        ) {

          const normalGroup = {
            type: 'normal-group',
            id: `normal_group_${clusterIndex}_${currentItem.originalIndex}`,
            line1: currentItem.line,
            line2: nextItem.line,
            displayText: `${currentItem.line}\n${nextItem.line}`,
            searchText: `${currentItem.line} ${nextItem.line}`,
            originalIndex: currentItem.originalIndex,
          };
          result.push(normalGroup);
          i += 2;
        } else {
          result.push(currentItem.line);
          i += 1;
        }
      }
    } else {
      cluster.forEach((item) => {
        result.push(item.line);
      });
    }
  });

  return result;
}

/**
 * Merge eligible single-line items across blank line boundaries.
 * Only merges consecutive standalone strings that are both normal group candidates.
 * Preserves all existing groups and multi-line structures.
 * Excludes structure tags from grouping.
 * @param {Array<string | object>} processedLines
 * @returns {Array<string | object>}
 */
function mergeAcrossBlankLines(processedLines) {
  if (!NORMAL_GROUP_CONFIG.ENABLED || !NORMAL_GROUP_CONFIG.CROSS_BLANK_LINE_GROUPING) {
    return processedLines;
  }

  const result = [];
  let i = 0;

  while (i < processedLines.length) {
    const current = processedLines[i];
    const next = processedLines[i + 1];

    const currentIsString = typeof current === 'string';
    const nextIsString = typeof next === 'string';

    const currentIsStructureTag = currentIsString && isStructureTag(current);
    const nextIsStructureTag = nextIsString && isStructureTag(next);
    const currentIsSongSeparator = currentIsString && isSongSeparator(current);
    const nextIsSongSeparator = nextIsString && isSongSeparator(next);

    if (
      currentIsString &&
      nextIsString &&
      !currentIsStructureTag &&
      !nextIsStructureTag &&
      !currentIsSongSeparator &&
      !nextIsSongSeparator &&
      isNormalGroupCandidate(current) &&
      isNormalGroupCandidate(next)
    ) {

      const crossBlankGroup = {
        type: 'normal-group',
        id: `cross_blank_group_${i}`,
        line1: current,
        line2: next,
        displayText: `${current}\n${next}`,
        searchText: `${current} ${next}`,
        originalIndex: i,
      };
      result.push(crossBlankGroup);
      i += 2;
    } else {
      result.push(current);
      i += 1;
    }
  }

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
  cleaned = extractStructureTags(cleaned);
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

  const clusteredResult = flattenClusters(finalClusters);

  return mergeAcrossBlankLines(clusteredResult);
}

/**
 * Parse plain text lyric content into processed lines with translation and normal groupings.
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
    if (line && line.type === 'normal-group') {
      return `${line.line1}\n${line.line2}`;
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
 * @returns {{ rawText: string, processedLines: Array<string | object>, timestamps: Array<number | null> }}
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
      entries.push({ t: null, text });
    } else {
      times.forEach((t) => entries.push({ t, text }));
    }
  }

  entries.sort((a, b) => {
    if (a.t === null && b.t === null) return 0;
    if (a.t === null) return 1;
    if (b.t === null) return -1;
    return a.t - b.t;
  });

  const processed = [];
  const timestamps = [];
  const seen = new Set();

  for (const entry of entries) {
    const key = `${entry.t}|${entry.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    processed.push(entry.text);
    timestamps.push(entry.t);
  }

  const splitLines = applyIntelligentSplitting(processed, { enableSplitting, splitConfig });

  const grouped = [];
  const groupedTimestamps = [];
  for (let i = 0; i < splitLines.length; i += 1) {
    const main = splitLines[i];
    const next = splitLines[i + 1];

    if (next && isTranslationLine(next) && !isTranslationLine(main)) {
      grouped.push({
        type: 'group',
        id: `lrc_group_${i}`,
        mainLine: main,
        translation: next,
        displayText: `${main}\n${next}`,
        searchText: `${main} ${next}`,
        originalIndex: i,
      });
      groupedTimestamps.push(timestamps[i] !== undefined ? timestamps[i] : null);
      i += 1;
    } else {
      grouped.push(main);
      groupedTimestamps.push(timestamps[i] !== undefined ? timestamps[i] : null);
    }
  }

  const visibleRawText = splitLines.join('\n');
  return { rawText: visibleRawText, processedLines: grouped, timestamps: groupedTimestamps };
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
      TARGET_LENGTH: 60,
      MIN_LENGTH: 40,
      MAX_LENGTH: 80,
      OVERFLOW_TOLERANCE: 15,
    },
    ...options,
  };

  return parseTxtContent(rawText, enhancedOptions);
}