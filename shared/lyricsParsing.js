// shared/lyricsParsing.js
// Utilities for parsing TXT and LRC lyric content in both renderer and Electron main processes.

const BRACKET_PAIRS = [
  ['[', ']'],
  ['(', ')'],
  ['{', '}'],
  ['<', '>'],
];

const TIME_TAG_REGEX = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g;
const META_TAG_REGEX = /^\s*\[(ti|ar|al|by|offset):.*\]\s*$/i;

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
 * @param {string} rawText
 * @returns {Array<string | object>}
 */
export function processRawTextToLines(rawText = '') {
  const allLines = String(rawText).split(/\r?\n/);

  const clusters = [];
  let currentCluster = [];

  for (let i = 0; i < allLines.length; i += 1) {
    const line = allLines[i].trim();

    if (line.length > 0) {
      currentCluster.push({ line, originalIndex: i });
    } else if (currentCluster.length > 0) {
      clusters.push([...currentCluster]);
      currentCluster = [];
    }
  }

  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  return flattenClusters(clusters);
}

/**
 * Parse plain text lyric content into processed lines with translation groupings.
 * @param {string} rawText
 * @returns {{ rawText: string, processedLines: Array<string | object> }}
 */
export function parseTxtContent(rawText = '') {
  const processedLines = processRawTextToLines(rawText);
  return { rawText, processedLines };
}

/**
 * Parse LRC content into visible lyric lines preserving ordering and translation groupings.
 * @param {string} rawText
 * @returns {{ rawText: string, processedLines: Array<string | object> }}
 */
export function parseLrcContent(rawText = '') {
  const lines = String(rawText).split(/\r?\n/);
  const entries = [];

  for (const line of lines) {
    if (!line?.trim()) continue;
    if (META_TAG_REGEX.test(line)) continue;

    let match;
    const times = [];
    TIME_TAG_REGEX.lastIndex = 0;

    // Collect all timestamps on a line.
    // eslint-disable-next-line no-cond-assign
    while ((match = TIME_TAG_REGEX.exec(line)) !== null) {
      const mm = parseInt(match[1], 10) || 0;
      const ss = parseInt(match[2], 10) || 0;
      const cs = match[3] ? parseInt(match[3].slice(0, 2).padEnd(2, '0'), 10) : 0;
      const t = mm * 60 * 100 + ss * 100 + cs;
      times.push(t);
    }

    const text = line.replace(TIME_TAG_REGEX, '').trim();
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

  const grouped = [];
  for (let i = 0; i < processed.length; i += 1) {
    const main = processed[i];
    const next = processed[i + 1];
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

  const visibleRawText = processed.join('\n');
  return { rawText: visibleRawText, processedLines: grouped };
}
