import { parseLrcContent } from '../../shared/lyricsParsing.js';

/**
 * Parse .lrc file into { rawText, processedLines }
 * - processedLines: array of lyric strings ordered by time
 * - rawText: strictly the displayed text, no timestamps (for editing)
 * @param {File} file
 * @param {object} options - Parsing options including enableSplitting
 */
export const parseLrc = (file, options = {}) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const raw = event.target.result || '';
      resolve(parseLrcContent(raw, options));
    } catch (error) {
      reject(error);
    }
  };
  reader.onerror = (error) => reject(error);
  reader.readAsText(file);
});

export function parseLrcText(raw, options = {}) {
  return parseLrcContent(raw || '', options);
}
