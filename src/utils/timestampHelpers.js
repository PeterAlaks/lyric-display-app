/**
 * Utility functions for working with lyric timestamps
 */

/**
 * Check if timestamps array contains valid, usable timestamps
 * @param {Array<number | null>} timestamps - Array of timestamps in centiseconds
 * @returns {boolean} - True if there are valid timestamps that can be used for intelligent autoplay
 */
export function hasValidTimestamps(timestamps) {
  if (!Array.isArray(timestamps) || timestamps.length === 0) {
    return false;
  }

  const validCount = timestamps.filter(t => t !== null && typeof t === 'number' && t >= 0).length;

  const threshold = Math.max(2, Math.floor(timestamps.length * 0.3));

  return validCount >= threshold;
}

/**
 * Calculate the delay in milliseconds between two timestamp indices
 * @param {Array<number | null>} timestamps - Array of timestamps in centiseconds
 * @param {number} currentIndex - Current line index
 * @param {number} nextIndex - Next line index
 * @returns {number | null} - Delay in milliseconds, or null if cannot be calculated
 */
export function calculateTimestampDelay(timestamps, currentIndex, nextIndex) {
  if (!Array.isArray(timestamps) || currentIndex < 0 || nextIndex < 0) {
    return null;
  }

  const currentTime = timestamps[currentIndex];
  const nextTime = timestamps[nextIndex];

  if (
    currentTime === null ||
    nextTime === null ||
    typeof currentTime !== 'number' ||
    typeof nextTime !== 'number' ||
    currentTime < 0 ||
    nextTime < 0
  ) {
    return null;
  }

  const delayInMs = (nextTime - currentTime) * 10;

  if (delayInMs < 100 || delayInMs > 30000) {
    return null;
  }

  return delayInMs;
}

/**
 * Find the next valid timestamp index starting from a given index
 * @param {Array<number | null>} timestamps - Array of timestamps
 * @param {number} startIndex - Index to start searching from
 * @param {boolean} skipBlankLines - Whether to skip blank lines
 * @param {Function} isLineBlank - Function to check if a line is blank
 * @param {Array} lyrics - Array of lyric lines
 * @returns {number | null} - Next valid index or null if not found
 */
export function findNextValidTimestampIndex(timestamps, startIndex, skipBlankLines, isLineBlank, lyrics) {
  if (!Array.isArray(timestamps) || startIndex < 0) {
    return null;
  }

  for (let i = startIndex; i < timestamps.length; i++) {

    if (skipBlankLines && lyrics && lyrics[i] && isLineBlank(lyrics[i])) {
      continue;
    }

    const timestamp = timestamps[i];
    if (timestamp !== null && typeof timestamp === 'number' && timestamp >= 0) {
      return i;
    }
  }

  return null;
}

/**
 * Format timestamp for display (centiseconds to MM:SS.CS)
 * @param {number} centiseconds - Timestamp in centiseconds
 * @returns {string} - Formatted timestamp string
 */
export function formatTimestamp(centiseconds) {
  if (typeof centiseconds !== 'number' || centiseconds < 0) {
    return '--:--';
  }

  const totalSeconds = Math.floor(centiseconds / 100);
  const cs = centiseconds % 100;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}