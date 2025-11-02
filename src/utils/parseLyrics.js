// Project: LyricDisplay App
// File: src/utils/parseLyrics.js

import { parseTxtContent, processRawTextToLines } from '../../shared/lyricsParsing.js';

/**
 * Parses a .txt file and extracts the raw text and processed lyric lines.
 * @param {File} file - A plain text file
 * @param {object} options - Parsing options including enableSplitting
 * @returns {Promise<{rawText: string, processedLines: Array}>} - Resolves to an object
 */
export const parseLyrics = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const rawText = event.target.result;
        const parsed = parseTxtContent(rawText, options);
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsText(file);
  });
};

export { processRawTextToLines, parseTxtContent };

/**
 * Checks if a line is a translation (starts and ends with supported brackets)
 * Supported brackets: [], (), {}, <>
 * @param {string} line - Line to check
 * @returns {boolean} - True if line is a translation
 */
/**
 * Helper function to get display text from any line type
 * @param {string|object} line - Line item (string, group, or normal-group object)
 * @returns {string} - Text to display
 */
export const getLineDisplayText = (line) => {
  if (typeof line === 'string') return line;
  if (line && line.type === 'group') return line.displayText;
  if (line && line.type === 'normal-group') return line.displayText;
  return '';
};

/**
 * Helper function to get searchable text from any line type
 * @param {string|object} line - Line item (string, group, or normal-group object)
 * @returns {string} - Text to search within
 */
export const getLineSearchText = (line) => {
  if (typeof line === 'string') return line;
  if (line && line.type === 'group') return line.searchText;
  if (line && line.type === 'normal-group') return line.searchText;
  return '';
};

/**
 * Helper function to get output text for display
 * @param {string|object} line - Line item (string, group, or normal-group object)
 * @returns {string} - Text to send to output displays
 */
export const getLineOutputText = (line) => {
  if (typeof line === 'string') return line;
  if (line && line.type === 'group') return line.displayText;
  if (line && line.type === 'normal-group') return line.displayText;
  return '';
};
