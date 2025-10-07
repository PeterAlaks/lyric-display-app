// Project: LyricDisplay App
// File: src/utils/parseLyrics.js

/**
 * Parses a .txt file and extracts the raw text and processed lyric lines.
 * Supports grouping only when there are exactly 2 consecutive lines where the second line is enclosed in brackets:
 * [], (), {}, <>
 * @param {File} file - A plain text file
 * @returns {Promise<{rawText: string, processedLines: Array}>} - Resolves to an object
 */
export const parseLyrics = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const rawText = event.target.result;

      // Process the raw text to create clusters and then group translations
      const processedLines = processRawTextToLines(rawText);

      resolve({ rawText, processedLines });
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsText(file);
  });
};

/**
 * Processes raw text into clusters and applies grouping rules
 * @param {string} rawText - The original file content
 * @returns {Array} - Array of strings and group objects
 */
export function processRawTextToLines(rawText) {
  // Split by lines but preserve structure to identify clusters
  const allLines = rawText.split(/\r?\n/);

  // Identify clusters: groups of consecutive non-empty lines separated by empty lines
  const clusters = [];
  let currentCluster = [];

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();

    if (line.length > 0) {
      // Non-empty line - add to current cluster
      currentCluster.push({ line, originalIndex: i });
    } else {
      // Empty line - close current cluster if it has content
      if (currentCluster.length > 0) {
        clusters.push([...currentCluster]);
        currentCluster = [];
      }
    }
  }

  // Don't forget the last cluster if file doesn't end with empty line
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Now process each cluster according to grouping rules
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
        originalIndex: cluster[0].originalIndex
      };
      result.push(groupedLine);
    } else {
      // Add all lines in cluster individually
      cluster.forEach(item => {
        result.push(item.line);
      });
    }
  });

  return result;
}

/**
 * Checks if a line is a translation (starts and ends with supported brackets)
 * Supported brackets: [], (), {}, <>
 * @param {string} line - Line to check
 * @returns {boolean} - True if line is a translation
 */
function isTranslationLine(line) {
  if (!line || typeof line !== 'string') return false;

  const trimmed = line.trim();
  if (trimmed.length <= 2) return false; // Must have content inside brackets

  const bracketPairs = [
    ['[', ']'],
    ['(', ')'],
    ['{', '}'],
    ['<', '>']
  ];

  return bracketPairs.some(
    ([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close)
  );
}

/**
 * Helper function to get display text from any line type
 * @param {string|object} line - Line item (string or group object)
 * @returns {string} - Text to display
 */
export const getLineDisplayText = (line) => {
  if (typeof line === 'string') return line;
  if (line && line.type === 'group') return line.displayText;
  return '';
};

/**
 * Helper function to get searchable text from any line type
 * @param {string|object} line - Line item (string or group object)
 * @returns {string} - Text to search within
 */
export const getLineSearchText = (line) => {
  if (typeof line === 'string') return line;
  if (line && line.type === 'group') return line.searchText;
  return '';
};

/**
 * Helper function to get output text for display
 * @param {string|object} line - Line item (string or group object)
 * @returns {string} - Text to send to output displays
 */
export const getLineOutputText = (line) => {
  if (typeof line === 'string') return line;
  if (line && line.type === 'group') return line.displayText;
  return '';
};
