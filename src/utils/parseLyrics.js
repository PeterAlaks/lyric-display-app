// Project: LyricDisplay App
// File: src/utils/parseLyrics.js

import { isStructureTag } from '../../shared/lyricsParsing/structureTags.js';
import { parseTxtContent } from '../../shared/lyricsParsing/txtParser.js';
import { processRawTextToLines } from '../../shared/lyricsParsing/txtProcessor.js';

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

const STAGE_ONLY_LINE_REGEX = /^\s*\/\//;
const STAGE_ONLY_LINE_PREFIX_REGEX = /^\s*\/\/\s*/;

const isStageOnlyLine = (lineText) => {
  return typeof lineText === 'string' && STAGE_ONLY_LINE_REGEX.test(lineText);
};

const stripStageOnlyPrefix = (lineText) => {
  if (typeof lineText !== 'string') return '';
  return lineText.replace(STAGE_ONLY_LINE_PREFIX_REGEX, '');
};

const resolveRawLineText = (line) => {
  if (typeof line === 'string') return line;
  if (line && line.type === 'group') return line.displayText;
  if (line && line.type === 'normal-group') {
    if (Array.isArray(line.lines) && line.lines.length > 0) {
      return line.lines.join('\n');
    }
    return line.displayText || [line.line1, line.line2].filter(Boolean).join('\n');
  }
  return '';
};

const formatTextForTarget = (text, target = 'output') => {
  if (typeof text !== 'string' || !text) return '';

  const lines = text.split('\n');

  if (target === 'stage') {
    return lines
      .map((lineText) => (isStageOnlyLine(lineText) ? stripStageOnlyPrefix(lineText) : lineText))
      .join('\n');
  }

  return lines
    .filter((lineText) => !isStageOnlyLine(lineText))
    .join('\n');
};

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
  if (line && line.type === 'normal-group') {
    if (Array.isArray(line.lines) && line.lines.length > 0) {
      return line.lines.join('\n');
    }
    return line.displayText || [line.line1, line.line2].filter(Boolean).join('\n');
  }
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
  if (line && line.type === 'normal-group') {
    if (Array.isArray(line.lines) && line.lines.length > 0) {
      return line.lines.join(' ');
    }
    return line.searchText || [line.line1, line.line2].filter(Boolean).join(' ');
  }
  return '';
};

/**
 * Helper function to get output text for display
 * @param {string|object} line - Line item (string, group, or normal-group object)
 * @param {'output'|'stage'} [target='output'] - Rendering target
 * @returns {string} - Text to send to output displays
 */
export const getLineOutputText = (line, target = 'output') => {
  const rawText = resolveRawLineText(line);
  return formatTextForTarget(rawText, target);
};

export const isStructureTagLyricLine = (line, sectionTagPhrases) => {
  if (!line || typeof line !== 'string') return false;
  return isStructureTag(line, sectionTagPhrases);
};

export const findNavigableLyricLineIndex = (
  lyrics,
  startIndex,
  direction = 1,
  { skipSectionTitles = false, sectionTagPhrases } = {}
) => {
  if (!Array.isArray(lyrics) || lyrics.length === 0) return null;

  const step = direction < 0 ? -1 : 1;
  let index = Math.min(lyrics.length - 1, Math.max(0, Number(startIndex) || 0));

  while (index >= 0 && index < lyrics.length) {
    if (!skipSectionTitles || !isStructureTagLyricLine(lyrics[index], sectionTagPhrases)) {
      return index;
    }
    index += step;
  }

  return null;
};
