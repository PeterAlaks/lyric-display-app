import { getSectionLabelFromLine, isStructureTag } from './structureTags.js';

/**
 * Derive section metadata from processed lyric lines without altering the lines.
 * @param {Array<string|object>} processedLines
 * @returns {{ sections: Array<{id: string, label: string, startLine: number, endLine: number|null}>, lineToSection: Record<number, string> }}
 */
export function deriveSectionsFromProcessedLines(processedLines = []) {
  const sections = [];
  const lineToSection = {};

  let currentSection = null;

  for (let i = 0; i < processedLines.length; i += 1) {
    const item = processedLines[i];
    const isTag = typeof item === 'string' && isStructureTag(item);

    if (isTag) {
      const label = getSectionLabelFromLine(item);
      let startLine = i + 1;

      while (
        startLine < processedLines.length &&
        typeof processedLines[startLine] === 'string' &&
        isStructureTag(processedLines[startLine])
      ) {
        startLine += 1;
      }

      if (startLine >= processedLines.length) {
        startLine = i;
      }

      const id = `section_${sections.length}_${i}`;

      currentSection = {
        id,
        label,
        startLine,
        endLine: startLine >= 0 ? startLine : null,
      };
      sections.push(currentSection);

      if (startLine >= 0) {
        lineToSection[startLine] = id;
      }
      continue;
    }

    if (currentSection) {
      currentSection.endLine = i;
      lineToSection[i] = currentSection.id;
    }
  }

  sections.forEach((section) => {
    if (section.endLine == null || section.endLine < section.startLine) {
      section.endLine = section.startLine;
    }
  });

  return { sections, lineToSection };
}

// Song part keywords and the letter operators press (with Shift) to jump to them.
// Pre-Chorus must be matched before Chorus.
const SECTION_HOTKEYS = [
  { pattern: /^pre[\s-]?chorus\b/, hotkey: 'P' },
  { pattern: /^(chorus|refrain)\b/, hotkey: 'C' },
  { pattern: /^verse\b/, hotkey: 'V' },
  { pattern: /^bridge\b/, hotkey: 'B' },
  { pattern: /^tag\b/, hotkey: 'T' },
  { pattern: /^intro\b/, hotkey: 'I' },
  { pattern: /^outro\b/, hotkey: 'O' },
  { pattern: /^ending\b/, hotkey: 'E' },
];

/**
 * @param {string} label - Section label such as "Chorus 2" or "Verse: Lead".
 * @returns {string|null} Upper-case hotkey letter.
 */
export function getSectionHotkey(label = '') {
  const normalized = String(label)
    .split(':')[0]
    .replace(/^[\s[({<]+|[\])}>]+$/g, '')
    .trim()
    .toLowerCase();
  return SECTION_HOTKEYS.find(({ pattern }) => pattern.test(normalized))?.hotkey || null;
}

/**
 * Find the next section of the hotkey's type after the current line, wrapping to the
 * first one in the song.
 * @param {Array<{label: string, startLine: number}>} sections
 * @param {number|null} currentLine
 * @param {string} hotkey
 */
export function findSectionJumpTarget(sections, currentLine, hotkey) {
  if (!Array.isArray(sections) || !hotkey) return null;
  const matches = sections
    .filter((section) => Number.isInteger(section?.startLine) && getSectionHotkey(section.label) === hotkey)
    .sort((a, b) => a.startLine - b.startLine);
  if (matches.length === 0) return null;

  const position = Number.isInteger(currentLine) ? currentLine : -1;
  return matches.find((section) => section.startLine > position) || matches[0];
}
