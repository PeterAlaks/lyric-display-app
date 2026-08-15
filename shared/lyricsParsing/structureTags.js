import { createStructureTagPatterns, STRUCTURE_TAGS_CONFIG } from './constants.js';
import { getEffectiveGroupingConfig } from './runtimeConfig.js';

/**
 * Convert a structure tag line into a label (includes artist/descriptor if present).
 * @param {string} line
 * @returns {string}
 */
export function getSectionLabelFromLine(line = '') {
  const cleaned = String(line)
    .replace(/^[\s\[\(\{<]+/, '')
    .replace(/[\]\)\}>]+$/, '')
    .replace(/\s*:\s*$/, '')
    .trim();

  return cleaned.replace(/\s+/g, ' ') || 'Section';
}

/**
 * Extract clean section label for quick-jump buttons (without artist/descriptor).
 * Removes everything after the colon in section markers like "[Chorus: Artist Name]" -> "Chorus"
 * @param {string} line
 * @returns {string}
 */
export function getCleanSectionLabel(line = '') {
  const cleaned = String(line)
    .replace(/^[\s\[\(\{<]+/, '')
    .replace(/[\]\)\}>]+$/, '')
    .trim();

  const cleanedNoArtist = cleaned.split(':')[0].trim();

  return cleanedNoArtist.replace(/\s+/g, ' ') || 'Section';
}

/**
 * Check if a line is a structure tag (Verse, Chorus, etc.)
 * @param {string} line
 * @returns {boolean}
 */
export function isStructureTag(line, sectionTagPhrases) {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  const phrases = sectionTagPhrases ?? getEffectiveGroupingConfig().sectionTagPhrases;
  return createStructureTagPatterns(phrases).some((pattern) => pattern.test(trimmed));
}

/**
 * Extract and isolate structure tags from text.
 * Handles cases where tags are on their own line or combined with lyrics.
 * @param {string} text
 * @returns {string}
 */
export function extractStructureTags(text, configOverride) {
  if (!text || typeof text !== 'string') return text;
  if (!STRUCTURE_TAGS_CONFIG.ENABLED) return text;

  const config = configOverride
    ? { ...getEffectiveGroupingConfig(), ...configOverride }
    : getEffectiveGroupingConfig();
  const structureTagMode = config.structureTagMode || STRUCTURE_TAGS_CONFIG.MODE;
  const structureTagPatterns = createStructureTagPatterns(config.sectionTagPhrases);

  const lines = text.split(/\r?\n/);
  const processedLines = [];

  for (const line of lines) {
    if (!line || line.trim().length === 0) {
      processedLines.push(line);
      continue;
    }

    let processed = false;

    for (const pattern of structureTagPatterns) {
      const match = line.match(pattern);
      if (!match) continue;

      const tag = match[0].trim();
      const remainder = line.substring(match[0].length).trim();

      if (structureTagMode === 'strip') {
        if (remainder) {
          processedLines.push(remainder);
        }
      } else if (structureTagMode === 'isolate') {
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

    if (!processed) {
      processedLines.push(line);
    }
  }

  return processedLines.join('\n');
}
