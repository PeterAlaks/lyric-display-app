// Song metadata embedded in lyric files: `# Key: value` header blocks written by the
// EasyWorship/PowerPoint importers (or by hand), and LRC `[ti:]`-style ID tags.

const HEADER_LINE_REGEX = /^\s*#\s*([A-Za-z][A-Za-z .#()]*?)\s*:\s*(.*?)\s*$/;

const HEADER_FIELD_BY_KEY = new Map([
  ['title', 'title'],
  ['song title', 'title'],
  ['author', 'artists'],
  ['authors', 'artists'],
  ['artist', 'artists'],
  ['artists', 'artists'],
  ['writer', 'artists'],
  ['writers', 'artists'],
  ['songwriter', 'artists'],
  ['songwriters', 'artists'],
  ['copyright', 'copyright'],
  ['administrator', 'administrator'],
  ['admin', 'administrator'],
  ['ccli', 'ccliSongNumber'],
  ['ccli #', 'ccliSongNumber'],
  ['ccli number', 'ccliSongNumber'],
  ['ccli song', 'ccliSongNumber'],
  ['ccli song #', 'ccliSongNumber'],
  ['ccli song number', 'ccliSongNumber'],
  ['album', 'album'],
  ['year', 'year'],
]);

// Provenance headers written by LyricDisplay importers. They are stripped from the
// lyrics but carry nothing worth showing.
const PROVENANCE_KEY_REGEX = /^(imported from\b.*|source file)$/;

const LRC_TAG_REGEX = /^\s*\[\s*(ti|ar|al|au)\s*:\s*(.*?)\s*\]\s*$/i;
const LRC_FIELD_BY_TAG = { ti: 'title', ar: 'artists', au: 'artists', al: 'album' };

const MAX_FIELD_LENGTH = 240;

const normalizeKey = (key) => key.toLowerCase().replace(/\s+/g, ' ').replace(/\.+$/, '').trim();

export function splitSongCredits(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(/\s*[,;|&/]\s*/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function assignField(metadata, field, rawValue) {
  const value = String(rawValue || '').trim().slice(0, MAX_FIELD_LENGTH);
  if (!value) return;

  if (field === 'artists') {
    const names = splitSongCredits(value);
    if (names.length === 0) return;
    metadata.artists = [...(metadata.artists || []), ...names.filter((name) => !metadata.artists?.includes(name))];
    return;
  }
  if (field === 'ccliSongNumber') {
    const digits = value.match(/\d{1,12}/)?.[0];
    if (digits) metadata.ccliSongNumber = digits;
    return;
  }
  if (field === 'year') {
    const year = value.match(/\b\d{4}\b/)?.[0];
    if (year) metadata.year = Number(year);
    return;
  }
  if (!metadata[field]) metadata[field] = value;
}

/**
 * Split a leading `# Key: value` header block from lyric text. Only a block at the very top
 * of the file is recognized, and only when every line in it uses a known key, so lyric lines
 * that happen to start with "#" are never removed.
 * @param {string} text
 * @returns {{ songMetadata: object|null, content: string, headerText: string }}
 */
export function extractSongMetadataHeader(text) {
  const source = typeof text === 'string' ? text : '';
  const lines = source.replace(/^﻿/, '').split(/\r?\n/);

  let index = 0;
  while (index < lines.length && !lines[index].trim()) index += 1;

  const metadata = {};
  const headerStart = index;
  let recognized = 0;

  while (index < lines.length) {
    const match = lines[index].match(HEADER_LINE_REGEX);
    if (!match) break;
    const key = normalizeKey(match[1]);
    const field = HEADER_FIELD_BY_KEY.get(key);
    if (!field && !PROVENANCE_KEY_REGEX.test(key)) break;
    if (field) assignField(metadata, field, match[2]);
    recognized += 1;
    index += 1;
  }

  if (recognized === 0) {
    return { songMetadata: null, content: source, headerText: '' };
  }

  const headerText = lines.slice(headerStart, index).join('\n');
  while (index < lines.length && !lines[index].trim()) index += 1;

  return {
    songMetadata: Object.keys(metadata).length > 0 ? metadata : null,
    content: lines.slice(index).join('\n'),
    headerText,
  };
}

/**
 * Read LRC ID tags ([ti:], [ar:], [au:], [al:]) into song metadata.
 * @param {string} text
 * @returns {object|null}
 */
export function extractLrcSongMetadata(text) {
  if (typeof text !== 'string' || !text) return null;
  const metadata = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(LRC_TAG_REGEX);
    if (match) assignField(metadata, LRC_FIELD_BY_TAG[match[1].toLowerCase()], match[2]);
  }
  return Object.keys(metadata).length > 0 ? metadata : null;
}

// CCLI song and licence numbers are numeric identifiers.
export function normalizeCcliNumber(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 12);
}

/**
 * The credit fields a passive display may show. Song metadata can carry local file paths
 * and grouping plans, so displays only ever receive this subset.
 */
export function toDisplaySongCredits(metadata, { ccliLicenseNumber = '' } = {}) {
  const source = metadata && typeof metadata === 'object' ? metadata : {};
  const text = (value) => (typeof value === 'string' ? value.trim().slice(0, MAX_FIELD_LENGTH) : '');
  return {
    title: text(source.title),
    artists: Array.isArray(source.artists)
      ? source.artists.map(text).filter(Boolean).slice(0, 12)
      : [],
    copyright: text(source.copyright),
    administrator: text(source.administrator),
    ccliSongNumber: normalizeCcliNumber(source.ccliSongNumber),
    ccliLicenseNumber: normalizeCcliNumber(ccliLicenseNumber),
  };
}

const COPYRIGHT_PREFIX_REGEX = /^(©|\(c\)|copyright\b|public domain\b)/i;

/**
 * Compact CCLI-style footer text: title and writers, then copyright and CCLI numbers.
 * @param {object} credits - Display song credits.
 * @returns {string[]} Zero to two lines.
 */
export function formatSongCreditLines(credits) {
  if (!credits || typeof credits !== 'object') return [];
  const title = typeof credits.title === 'string' ? credits.title.trim() : '';
  const artists = Array.isArray(credits.artists) ? credits.artists.filter(Boolean).join(', ') : '';
  const copyright = typeof credits.copyright === 'string' ? credits.copyright.trim() : '';
  const songNumber = normalizeCcliNumber(credits.ccliSongNumber);
  const licenseNumber = normalizeCcliNumber(credits.ccliLicenseNumber);

  const lines = [
    [title, artists].filter(Boolean).join(' · '),
    [
      copyright && (COPYRIGHT_PREFIX_REGEX.test(copyright) ? copyright : `© ${copyright}`),
      songNumber && `CCLI Song # ${songNumber}`,
      licenseNumber && `CCLI License # ${licenseNumber}`,
    ].filter(Boolean).join(' · '),
  ];
  return lines.filter(Boolean);
}

/**
 * Merge metadata found in a lyric file into metadata assembled by a loader.
 * With `override`, header values replace guesses such as filename-derived titles;
 * otherwise they only fill fields the base metadata leaves empty.
 */
export function applySongMetadataHeader(base, header, { override = false } = {}) {
  const result = { ...(base || {}) };
  if (!header || typeof header !== 'object') return result;

  for (const [field, value] of Object.entries(header)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    const current = result[field];
    const isEmpty = current === null
      || current === undefined
      || current === ''
      || (Array.isArray(current) && current.length === 0);
    if (override || isEmpty) result[field] = Array.isArray(value) ? [...value] : value;
  }
  return result;
}
