const TIMESTAMP_REGEX = /^\s*(\[\d{1,2}:\d{2}(?:\.\d{1,2})?\])+/;
const METADATA_TAG_REGEX = /^\s*\[[a-z]+:/i;
const CHORUS_TAG_REGEX = /^\s*\[chorus\s*:\s*/i;
const CHORUS_END_TAG_REGEX = /^\s*\[\/chorus\]/i;
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

/**
 * Removes timestamps from the beginning of a line
 * @param {string} line - The line to process
 * @returns {string} - Line without timestamps
 */
function removeTimestamps(line) {
  return line.replace(TIMESTAMP_REGEX, '').trim();
}

/**
 * Checks if a line is a metadata tag
 * @param {string} line - The line to check
 * @returns {boolean}
 */
function isMetadataTag(line) {
  return METADATA_TAG_REGEX.test(line.trim());
}

/**
 * Checks if a line is a chorus start tag
 * @param {string} line - The line to check
 * @returns {boolean}
 */
function isChorusStartTag(line) {
  return CHORUS_TAG_REGEX.test(line.trim());
}

/**
 * Checks if a line is a chorus end tag
 * @param {string} line - The line to check
 * @returns {boolean}
 */
function isChorusEndTag(line) {
  return CHORUS_END_TAG_REGEX.test(line.trim());
}

/**
 * Checks if a string contains invalid filename characters
 * @param {string} text - The text to check
 * @returns {boolean}
 */
function hasInvalidFilenameChars(text) {
  return INVALID_FILENAME_CHARS.test(text);
}

/**
 * Extracts the first valid lyric line from content
 * Handles timestamps, metadata tags, and chorus structure
 * If [ti:] metadata tag exists, extracts and returns its content as the title
 * @param {string} content - The lyrics content
 * @returns {string|null} - The first valid line or null if none found
 */
export function extractFirstValidLine(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const lines = content.split('\n');
  let insideChorus = false;
  let chorusFirstLine = null;
  let regularFirstLine = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      continue;
    }

    const titleMatch = trimmedLine.match(/^\s*\[ti\s*:\s*([^\]]+)\]/i);
    if (titleMatch && titleMatch[1]) {
      const titleContent = titleMatch[1].trim();
      if (titleContent && !hasInvalidFilenameChars(titleContent)) {
        return titleContent;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      continue;
    }

    if (isChorusStartTag(trimmedLine)) {
      insideChorus = true;
      continue;
    }

    if (isChorusEndTag(trimmedLine)) {
      insideChorus = false;
      continue;
    }

    if (isMetadataTag(trimmedLine)) {
      continue;
    }

    const lineWithoutTimestamps = removeTimestamps(trimmedLine);

    if (!lineWithoutTimestamps) {
      continue;
    }

    if (hasInvalidFilenameChars(lineWithoutTimestamps)) {
      continue;
    }

    if (insideChorus && !chorusFirstLine) {
      chorusFirstLine = lineWithoutTimestamps;
      continue;
    }

    if (!regularFirstLine && !insideChorus) {
      regularFirstLine = lineWithoutTimestamps;
    }

    if (regularFirstLine && chorusFirstLine) {
      break;
    }
  }

  return chorusFirstLine || regularFirstLine || null;
}

/**
 * Checks if the content has a complete chorus definition
 * (i.e., has both start and end tags with content in between)
 * @param {string} content - The lyrics content
 * @returns {boolean}
 */
export function hasCompleteChorus(content) {
  if (!content || typeof content !== 'string') {
    return false;
  }

  const lines = content.split('\n');
  let hasStart = false;
  let hasEnd = false;
  let hasContentInChorus = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (isChorusStartTag(trimmedLine)) {
      hasStart = true;
      continue;
    }

    if (isChorusEndTag(trimmedLine)) {
      hasEnd = true;
      break;
    }

    if (hasStart && !hasEnd) {
      const lineWithoutTimestamps = removeTimestamps(trimmedLine);
      if (lineWithoutTimestamps && !isMetadataTag(trimmedLine)) {
        hasContentInChorus = true;
      }
    }
  }

  return hasStart && hasEnd && hasContentInChorus;
}