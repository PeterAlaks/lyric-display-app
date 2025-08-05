// Project: Lyric Display App
// File: src/utils/parseLyrics.js

/**
 * Parses a .txt file and extracts lyric lines
 * @param {File} file - A plain text file with one lyric line per row
 * @returns {Promise<string[]>} - Resolves to an array of lyric lines
 */
export const parseLyrics = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text
        .split(/\r?\n/)      // Split on new lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0); // Remove empty lines
      resolve(lines);
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsText(file);
  });
};
