import { isStructureTag } from './structureTags.js';

const REPEATABLE_SECTION_INLINE_TOKEN_REGEX = /(\[[^\]]+\]|\{[^}]+\}|<[^>]+>|\([^)]+\))/g;

export function isSongSeparator(line) {
  if (!line || typeof line !== 'string') return false;
  return /^[\*\-_]{2,}/.test(line.trim());
}

// Song parts that can be written once and repeated with a bare marker. A numbered call
// ("Chorus 2") falls back to the unnumbered part only where numbering usually means
// "sing it again" rather than different words.
const REPEATABLE_SECTION_TYPES = [
  { pattern: /^pre[\s-]?chorus$/, key: 'pre-chorus', label: 'Pre-Chorus' },
  { pattern: /^post[\s-]?chorus$/, key: 'post-chorus', label: 'Post-Chorus' },
  { pattern: /^chorus$/, key: 'chorus', label: 'Chorus', numberFallback: true },
  { pattern: /^refrain$/, key: 'refrain', label: 'Refrain', numberFallback: true },
  { pattern: /^verse$/, key: 'verse', label: 'Verse' },
  { pattern: /^bridge$/, key: 'bridge', label: 'Bridge' },
  { pattern: /^tag$/, key: 'tag', label: 'Tag' },
  { pattern: /^hook$/, key: 'hook', label: 'Hook' },
];

/**
 * Parse a marker that can be used as a reusable section definition/call.
 * @param {string} line
 * @returns {{ key: string, baseKey: string, number: number|null, numberFallback: boolean, label: string } | null}
 */
export function parseRepeatableSectionMarker(line = '') {
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

  const match = normalized.match(/^(.+?)(?:\s+(\d+))?$/);
  if (!match) return null;
  const type = REPEATABLE_SECTION_TYPES.find(({ pattern }) => pattern.test(match[1]));
  if (!type) return null;

  const number = match[2] ? Number(match[2]) : null;
  return {
    key: number ? `${type.key} ${number}` : type.key,
    baseKey: type.key,
    number,
    numberFallback: Boolean(type.numberFallback),
    label: number ? `${type.label} ${number}` : type.label,
  };
}

/**
 * Record a section body. The first numbered definition also serves unnumbered calls
 * until an unnumbered definition replaces it.
 * @param {Map<string, any>} registry
 */
export function registerRepeatableSection(registry, marker, body) {
  registry.set(marker.key, body);
  if (marker.number && !registry.has(marker.baseKey)) {
    registry.set(marker.baseKey, body);
  }
}

/**
 * @param {Map<string, any>} registry
 * @returns {any} The registered body for a bare marker call, if any.
 */
export function lookupRepeatableSection(registry, marker) {
  if (registry.has(marker.key)) return registry.get(marker.key);
  if (marker.number && marker.numberFallback) return registry.get(marker.baseKey);
  return undefined;
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
 * Expand bare section marker calls (Chorus, Bridge, Verse 1, ...) using earlier explicit section text.
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
        registerRepeatableSection(sectionCache, marker, [...bodyLines]);
      }
      continue;
    }

    const cachedBody = lookupRepeatableSection(sectionCache, marker);
    if (Array.isArray(cachedBody) && cachedBody.length > 0) {
      expandedLines.push(...cachedBody);
    }
  }

  return expandedLines.join('\n');
}
