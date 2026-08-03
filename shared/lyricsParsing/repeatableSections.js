import { isSongSeparator } from './separators.js';
import { isStructureTag } from './structureTags.js';

const REPEATABLE_SECTION_INLINE_TOKEN_REGEX = /(\[[^\]]+\]|\{[^}]+\}|<[^>]+>|\([^)]+\))/g;

/**
 * Parse a marker that can be used as a reusable section definition/call.
 * Supported reusable sections: Chorus, Refrain
 * @param {string} line
 * @returns {{ key: 'chorus' | 'refrain', label: string } | null}
 */
function parseRepeatableSectionMarker(line = '') {
  const trimmed = String(line).trim();
  if (!trimmed || !isStructureTag(trimmed)) return null;

  const wrappedMatch = trimmed.match(/^[\[\(\{<]\s*(.+?)\s*[\]\)\}>]\s*$/);
  const candidateRaw = wrappedMatch ? wrappedMatch[1] : trimmed;
  const candidate = candidateRaw.replace(/\s*:\s*$/, '').trim();
  const normalized = candidate
    .split(':')[0]
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const match = normalized.match(/^(chorus|refrain)(?:\s+\d+)?$/i);
  if (!match) return null;

  const key = match[1].toLowerCase();
  if (key !== 'chorus' && key !== 'refrain') return null;

  return {
    key,
    label: key === 'chorus' ? 'Chorus' : 'Refrain',
  };
}

/**
 * Split inline reusable section calls into standalone lines.
 * Example: "line text [Refrain]" => ["line text", "[Refrain]"]
 * @param {string} line
 * @returns {string[]}
 */
function splitLineByRepeatableSectionMarkers(line = '') {
  if (typeof line !== 'string') return [''];
  if (!line.trim()) return [''];

  const segments = [];
  let cursor = 0;
  let foundMarker = false;
  REPEATABLE_SECTION_INLINE_TOKEN_REGEX.lastIndex = 0;

  let match;
  while ((match = REPEATABLE_SECTION_INLINE_TOKEN_REGEX.exec(line)) !== null) {
    const token = match[0];
    const marker = parseRepeatableSectionMarker(token);
    if (!marker) continue;

    const before = line.slice(cursor, match.index).trim();
    if (before) segments.push(before);

    segments.push(`[${marker.label}]`);
    cursor = match.index + token.length;
    foundMarker = true;
  }

  if (!foundMarker) {
    return [line];
  }

  const after = line.slice(cursor).trim();
  if (after) segments.push(after);

  return segments.length > 0 ? segments : [''];
}

function findNextNonEmptyLineIndex(lines = [], startIndex = 0) {
  for (let i = startIndex; i < lines.length; i += 1) {
    if (typeof lines[i] !== 'string') continue;
    if (lines[i].trim().length > 0) return i;
  }
  return -1;
}

function collectRepeatableSectionBody(lines = [], startIndex = 0) {
  const body = [];

  for (let i = startIndex; i < lines.length; i += 1) {
    const current = typeof lines[i] === 'string' ? lines[i].trim() : '';
    if (!current) {
      if (body.length > 0) {
        body.push('');
      }
      continue;
    }

    if (isSongSeparator(current) || isStructureTag(current)) {
      break;
    }

    body.push(current);
  }

  while (body.length > 0 && body[0].trim().length === 0) body.shift();
  while (body.length > 0 && body[body.length - 1].trim().length === 0) body.pop();

  return body;
}

/**
 * Expand Chorus/Refrain marker calls using earlier explicit section text.
 * Marker-only calls are expanded only when a prior definition exists.
 * @param {string} text
 * @returns {string}
 */
export function expandRepeatableSectionReferences(text) {
  if (!text || typeof text !== 'string') return text;

  const rawLines = text.split(/\r?\n/);
  const normalizedLines = [];

  rawLines.forEach((line) => {
    const segments = splitLineByRepeatableSectionMarkers(line);
    normalizedLines.push(...segments);
  });

  const expandedLines = [];
  const sectionCache = new Map();

  for (let i = 0; i < normalizedLines.length; i += 1) {
    const currentRaw = typeof normalizedLines[i] === 'string' ? normalizedLines[i] : '';
    const current = currentRaw.trim();

    if (!current) {
      expandedLines.push('');
      continue;
    }

    const marker = parseRepeatableSectionMarker(current);
    if (!marker) {
      expandedLines.push(currentRaw);
      continue;
    }

    expandedLines.push(currentRaw);

    const nextNonEmptyIndex = findNextNonEmptyLineIndex(normalizedLines, i + 1);
    const nextNonEmptyLine = nextNonEmptyIndex >= 0 ? String(normalizedLines[nextNonEmptyIndex] || '').trim() : '';
    const hasContentAfterMarker = Boolean(
      nextNonEmptyLine &&
      !isStructureTag(nextNonEmptyLine) &&
      !isSongSeparator(nextNonEmptyLine)
    );

    // Any marker that has explicit body lines is treated as a definition/redefinition.
    // Marker-only lines are the only ones expanded as repeatable calls.
    if (hasContentAfterMarker) {
      const bodyLines = collectRepeatableSectionBody(normalizedLines, i + 1);
      if (bodyLines.length > 0) {
        sectionCache.set(marker.key, [...bodyLines]);
      }
      continue;
    }

    const cachedBody = sectionCache.get(marker.key);
    if (Array.isArray(cachedBody) && cachedBody.length > 0) {
      expandedLines.push(...cachedBody);
    }
  }

  return expandedLines.join('\n');
}
