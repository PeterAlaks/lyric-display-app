// Lyrics as they arrive from hymnals, lyric sites, chord sheets, and SongSelect, rewritten
// into the plain `[Section]` + stanza text the TXT parser reads. Every rule here needs
// strong evidence before it changes anything, so ordinary lyric text passes through as is.

import { isLdsongContent } from './ldsong.js';
import { isVisuallyBlankLine } from './lineClassification.js';
import { parseRepeatableSectionMarker } from './repeatableSections.js';
import { isStructureTag } from './structureTags.js';
import { formatSongMetadataHeaderLines, readSongMetadataHeaderLine, splitSongCredits } from './songMetadata.js';

// "1 When upon…", "2. Are you…", "3) When you…", or a number alone on its line.
// "10,000 reasons" and "3:16" do not match: the number must be followed by a space.
const STANZA_NUMBER_REGEX = /^(\d{1,2})[.):]?(?:\s+(\S.*))?$/;
// A repeat call at the end of a lyric line: "…as the days go by. [Refrain]".
const TRAILING_CALL_REGEX = /^(.*?\S)\s*([[(][^[\]()]+[\])])$/;
const VERSE_LABEL_REGEX = /^[[({<]?\s*verse\b\s*(\d+)?/i;

const CCLI_SONG_REGEX = /^CCLI\s+Song\s*(?:#|No\.?|Number)?\s*:?\s*(\d{3,12})\b/i;
const CCLI_LICENSE_REGEX = /^CCLI\s+Licen[cs]e\b/i;
const SONGSELECT_TERMS_REGEX = /^For use solely with the SongSelect/i;
const COPYRIGHT_REGEX = /^(?:©|\(c\)(?=\s)|copyright\b)\s*©?\s*(.+)$/i;
const PUBLIC_DOMAIN_REGEX = /^public domain\.?$/i;

const CHORD_TOKEN_REGEX = /^\(?[A-G](?:#|b|♯|♭)?(?:maj|min|m|M|sus|dim|aug|add|°|ø|\+)?\d{0,2}(?:(?:sus|add|maj|b|#|-)\d{1,2})*(?:\/[A-G](?:#|b|♯|♭)?)?\)?$/;
const CHORD_FILLER_REGEX = /^(?:\||\|\||\/|-|x\d+|N\.?C\.?)$/i;

const verseNumberOf = (label) => {
  const match = String(label || '').trim().match(VERSE_LABEL_REGEX);
  return match ? Number(match[1] || 0) : null;
};

const sameSection = (a, b) => Boolean(a && b && (a.key === b.key || a.baseKey === b.baseKey));

function cleanLines(text) {
  return String(text)
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => (isVisuallyBlankLine(line) ? '' : line.replace(/[ \t]/g, ' ').trim()));
}

// A line made only of chord symbols, e.g. "G   C/G   D7  Em". Chord sheets put these
// above the lyric they belong to; they are never sung.
function isChordLine(line) {
  const tokens = line.split(/\s+/).filter(Boolean);
  const chords = tokens.filter((token) => CHORD_TOKEN_REGEX.test(token));
  return chords.length > 0 && tokens.every((token) => CHORD_TOKEN_REGEX.test(token) || CHORD_FILLER_REGEX.test(token));
}

function removeChordLines(lines) {
  const chordLines = lines.filter((line) => line && isChordLine(line));
  // One short chord-looking line ("A") is not enough to call this a chord sheet.
  const isChordSheet = chordLines.length >= 2 || chordLines.some((line) => line.split(/\s+/).length >= 2);
  if (!isChordSheet) return { lines, removed: 0 };
  return { lines: lines.filter((line) => !line || !isChordLine(line)), removed: chordLines.length };
}

// SongSelect ends a copied song with its CCLI number, writers, copyright, and terms; other
// sites add a copyright line. These become song details instead of lyric slides.
function extractCredits(lines, isTag) {
  const metadata = {};
  const kept = [];
  const footerStart = lines.findIndex((line) => CCLI_SONG_REGEX.test(line));

  lines.forEach((line, index) => {
    if (!line) {
      kept.push(line);
      return;
    }
    const ccli = line.match(CCLI_SONG_REGEX);
    const copyright = line.match(COPYRIGHT_REGEX);
    if (ccli) {
      metadata.ccliSongNumber = ccli[1];
    } else if (copyright || PUBLIC_DOMAIN_REGEX.test(line)) {
      if (!metadata.copyright) metadata.copyright = copyright ? copyright[1].trim() : 'Public Domain';
    } else if (CCLI_LICENSE_REGEX.test(line) || SONGSELECT_TERMS_REGEX.test(line)) {
      // The church's own licence and the terms of use are not song details.
    } else if (footerStart !== -1 && index > footerStart) {
      if (!metadata.artists) metadata.artists = splitSongCredits(line);
    } else {
      kept.push(line);
    }
  });

  // SongSelect also puts the title alone above the first section.
  if (footerStart !== -1) {
    const first = kept.findIndex(Boolean);
    const next = kept.findIndex((line, index) => index > first && line);
    if (first !== -1 && next > first + 1 && isTag(kept[next]) && !isTag(kept[first])) {
      metadata.title = kept[first];
      kept.splice(first, 1);
    }
  }

  return { lines: kept, metadata };
}

// Hymnals number their stanzas instead of naming them. Numbers count as stanzas only when
// they run 1, 2, 3… and the first starts a block, so a lyric that opens with a number stays.
function findStanzaNumbers(lines, isTag) {
  const stanzas = new Map();
  let expected = 1;
  let previous = null;
  lines.forEach((line, index) => {
    if (!line) {
      previous = '';
      return;
    }
    const match = line.match(STANZA_NUMBER_REGEX);
    const startsBlock = previous === null || previous === '' || isTag(previous);
    if (match && Number(match[1]) === expected && (expected > 1 || startsBlock) && !(match[2] && isTag(match[2]))) {
      stanzas.set(index, { number: expected, text: match[2] || '' });
      expected += 1;
    }
    previous = line;
  });
  return stanzas.size >= 2 ? stanzas : new Map();
}

function tokenize(lines, stanzas, isTag, report) {
  const tokens = [];
  const pushLyric = (text) => {
    const call = text.match(TRAILING_CALL_REGEX);
    const marker = call ? parseRepeatableSectionMarker(call[2]) : null;
    if (!marker) {
      tokens.push({ type: 'line', text });
      return;
    }
    tokens.push({ type: 'line', text: call[1] });
    tokens.push({ type: 'call', marker });
  };

  lines.forEach((line, index) => {
    if (!line) {
      tokens.push({ type: 'blank' });
      return;
    }
    const stanza = stanzas.get(index);
    if (stanza) {
      const label = `Verse ${stanza.number}`;
      tokens.push({ type: 'header', text: `[${label}]`, marker: parseRepeatableSectionMarker(`[${label}]`), verse: stanza.number });
      report.verseNumbers += 1;
      if (stanza.text) pushLyric(stanza.text);
      return;
    }
    if (isTag(line)) {
      tokens.push({ type: 'header', text: line, marker: parseRepeatableSectionMarker(line), verse: verseNumberOf(line) });
      return;
    }
    pushLyric(line);
  });
  return tokens;
}

// A repeat call ends its stanza, so lyrics after it start a new verse. A stanza that ends by
// calling the section it would otherwise belong to cannot be part of that section either.
function nameStanzasAroundCalls(tokens, report) {
  const out = [];
  let section = null;
  let blockStart = -1;
  let blockFollowsHeader = false;
  let afterCall = false;
  let sawHeader = false;
  let leadingUnnamed = false;
  let lastVerse = 0;

  const verseHeader = () => {
    lastVerse = Math.max(lastVerse, leadingUnnamed ? 1 : 0) + 1;
    report.namedStanzas += 1;
    const label = `Verse ${lastVerse}`;
    return { type: 'header', text: `[${label}]`, marker: parseRepeatableSectionMarker(`[${label}]`), verse: lastVerse };
  };

  for (const token of tokens) {
    if (token.type === 'blank') {
      out.push(token);
      blockStart = -1;
    } else if (token.type === 'header') {
      out.push(token);
      section = token;
      sawHeader = true;
      afterCall = false;
      blockStart = -1;
      if (token.verse != null) lastVerse = Math.max(lastVerse, token.verse || lastVerse + 1);
    } else if (token.type === 'line') {
      if (afterCall) {
        section = verseHeader();
        out.push(section);
        afterCall = false;
      }
      if (blockStart === -1) {
        blockStart = out.length;
        blockFollowsHeader = out[out.length - 1]?.type === 'header';
      }
      if (!sawHeader) leadingUnnamed = true;
      out.push(token);
    } else if (token.type === 'call') {
      if (blockStart !== -1 && !blockFollowsHeader && sameSection(section?.marker, token.marker)) {
        section = verseHeader();
        out.splice(blockStart, 0, section);
      }
      out.push(token);
      afterCall = true;
      blockStart = -1;
    }
  }

  if (report.namedStanzas > 0 && leadingUnnamed) {
    out.unshift({ type: 'header', text: '[Verse 1]', verse: 1 });
    report.namedStanzas += 1;
  }
  return out;
}

function renderTokens(tokens) {
  const out = [];
  const blank = () => {
    if (out.length > 0 && out[out.length - 1] !== '') out.push('');
  };
  for (const token of tokens) {
    if (token.type === 'blank') blank();
    else if (token.type === 'header') {
      blank();
      out.push(token.text);
    } else if (token.type === 'call') {
      blank();
      out.push(`[${token.marker.label}]`);
      out.push('');
    } else out.push(token.text);
  }
  while (out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** Put `# Key: value` credit lines above lyric text, joining a header block it already starts with. */
export function prependSongCreditsHeader(text, metadata) {
  const header = formatSongMetadataHeaderLines(metadata);
  if (header.length === 0) return text;
  const startsWithHeader = Boolean(readSongMetadataHeaderLine(String(text).split('\n')[0])?.field);
  return `${header.join('\n')}\n${startsWithHeader ? '' : '\n'}${text}`;
}

/**
 * Rewrite pasted or imported lyric text so its structure is explicit. Song credits found in
 * the text are returned as `metadata`; with `credits: 'header'` they also head the text.
 * @param {string} text
 * @param {{ sectionTagPhrases?: string[], credits?: 'header' | 'drop' }} options
 * @returns {{ text: string, metadata: object, report: { verseNumbers: number, namedStanzas: number, chordLines: number, credits: string[] } }}
 */
export function normalizePastedLyrics(text, { sectionTagPhrases, credits: creditsMode = 'header' } = {}) {
  const source = String(text ?? '');
  const report = { verseNumbers: 0, namedStanzas: 0, chordLines: 0, credits: [] };
  if (!source.trim() || isLdsongContent(source)) return { text: source, metadata: {}, report };

  const isTag = (line) => isStructureTag(line, sectionTagPhrases);
  const chords = removeChordLines(cleanLines(source));
  report.chordLines = chords.removed;
  const credits = extractCredits(chords.lines, isTag);
  report.credits = Object.keys(credits.metadata);

  const lines = credits.lines;
  const tokens = nameStanzasAroundCalls(tokenize(lines, findStanzaNumbers(lines, isTag), isTag, report), report);
  const body = renderTokens(tokens);
  return {
    text: creditsMode === 'header' ? prependSongCreditsHeader(body, credits.metadata) : body,
    metadata: credits.metadata,
    report,
  };
}
