/**
 * Local ChordPro parsing, transposition, and lyric sanitization.
 *
 * Dependency-free ESM shared by the Vite renderer and the Socket.IO backend.
 * The chart is operator-only; `parseChordProSource` also returns clean lyric
 * text so chord markup and directives never leak to audience outputs.
 *
 * Supported ChordPro subset:
 * - Inline chords: `[Am]Amazing [G]grace`
 * - Chords-over-lyrics: a chord-only line directly above a lyric line
 * - Directives: `{title:}`, `{artist:}`, `{key:}`, `{capo:}`, `{tempo:}`,
 *   `{comment:}` / `{c:}`, `{start_of_chorus}` / `{soc}`,
 *   `{start_of_verse: Verse 1}` / `{sov}`, `{start_of_tab}` / `{sot}`
 *   (plus matching `{end_of_*}` / `{eo*}` closers, `{define:}` ignored)
 * - Bracket section headers that are not chords: `[Verse 1]`
 */

const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_INDEX = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  'E#': 5, F: 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
};

// Root + quality/extensions + optional slash bass. Strict on purpose so that
// lyric bracket text like "[Chorus]" or "[Amazing grace]" never parses.
const CHORD_RE = /^[A-G](?:#|b)?(?:m(?!aj)|maj|min|dim|aug|sus|add|M)?\d*(?:[#b]\d+|sus\d*|add\d+|no\d+|M\d+|5|6|9|11|13)*(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?$/;

const DIRECTIVE_RE = /^\s*\{([^}:]+?)(?::\s*(.*?))?\}\s*$/;
const BRACKET_SECTION_RE = /^\s*\[([^\][\n]+)\]\s*$/;
const INLINE_CHORD_RE = /\[([^\][\n]*)\]/g;

// Diatonic (letter-based) scale-degree math for number charts. A single
// "#*|b*" alternation cannot be used here because the empty branch wins first,
// so accidentals are collected as one run and counted.
const LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const SHARP_GLYPH = '\u266F';
const FLAT_GLYPH = '\u266D';
const PITCH_RE = /^([A-Ga-g])\s*([#b]*)\s*(.*)$/;
const BASS_RE = /^[A-Ga-g][#b]*$/;

// Base pitch class of each natural (unaccented) note letter.
const LETTER_PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Scale intervals (semitones) from the tonic for natural major and natural
// minor. Number charts treat a minor-key song in its natural minor.
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

/** Split "F#m7" into its letter, its alteration count, and its quality tail. */
function splitPitch(token) {
  const match = String(token ?? '').trim().match(PITCH_RE);
  if (!match) return null;
  const accidentals = match[2] || '';
  return {
    letter: match[1].toUpperCase(),
    alter: (accidentals.match(/#/g) || []).length - (accidentals.match(/b/g) || []).length,
    rest: match[3] || '',
  };
}

/** Read the tonic out of a `{key:}` value: "C", "Am", "F#m", "Bb maj". */
function parseKeyTonic(key) {
  const first = String(key || '').trim().split(/\s+/)[0];
  if (!first) return null;
  const pitch = splitPitch(first);
  if (!pitch) return null;
  return {
    letter: pitch.letter,
    alter: pitch.alter,
    minor: /^(m|min|-)$/i.test(pitch.rest.trim()),
  };
}

const accidentalPrefix = (delta) => (
  delta > 0 ? SHARP_GLYPH.repeat(delta) : FLAT_GLYPH.repeat(-delta)
);

/** Semitone intervals for the song's tonality. */
function scaleIntervals(tonic) {
  return tonic && tonic.minor ? MINOR_INTERVALS : MAJOR_INTERVALS;
}

/** Expected accidental (sharps positive, flats negative) for `letter` inside key. */
function expectedAccidental(letter, tonic) {
  const intervals = scaleIntervals(tonic);
  const degreeIndex = (((LETTER_INDEX[letter] - LETTER_INDEX[tonic.letter]) + 7) % 7);
  const tonicPitch = (LETTER_PITCH[tonic.letter] ?? 0) + (tonic.alter || 0);
  const degreePitch = tonicPitch + intervals[degreeIndex];
  const base = LETTER_PITCH[letter] ?? 0;
  let delta = degreePitch - base;
  delta = ((delta % 12) + 12) % 12;
  if (delta > 6) delta -= 12;
  return delta;
}

/** Render one pitch as a degree number plus its quality tail: "1", "♭2", "3m7". */
function degreeLabel(pitch, tonic) {
  if (!pitch) return '';
  const number = (((LETTER_INDEX[pitch.letter] - LETTER_INDEX[tonic.letter]) + 7) % 7) + 1;
  const accidentalDelta = (pitch.alter || 0) - expectedAccidental(pitch.letter, tonic);
  const accidental = accidentalPrefix(accidentalDelta);
  // In a minor key the tonic triad is chord 1, so the "m" is implied and number
  // charts print a bare "1". Only the plain triad is elided, so "Am7" keeps its
  // extension and stays unambiguous.
  const isTonicMinor = tonic.minor
    && number === 1
    && accidentalDelta === 0
    && pitch.letter === tonic.letter
    && /^(m|min)$/i.test(pitch.rest.trim());
  return `${accidental}${number}${isTonicMinor ? '' : qualitySuffix(pitch.rest)}`;
}

/** Normalize a chord quality into the tail a number-chart player expects. */
function qualitySuffix(rest) {
  let suffix = String(rest || '').trim();
  if (!suffix) return '';
  // "Cmin" and "CM7" are spelled differently but read identically to players.
  // No word boundary: "min7" has none, and no other suffix token contains "min".
  suffix = suffix.replace(/min/gi, 'm');
  suffix = suffix.replace(/^M(?=\d|$)/, 'maj');
  if (/^sus$/i.test(suffix)) suffix = 'sus4';
  // A bare power chord would render as "15" or "55" and read as a page number.
  if (/^5$/.test(suffix)) return '(5)';
  // Altered extensions: "C7b5" -> "C7♭5".
  return suffix.replace(/(\d)b(\d)/g, `$1${FLAT_GLYPH}$2`);
}

/**
 * Render a chord symbol as a scale degree relative to `key` ("1 = tonic"), the
 * way a number chart is read: in C major, `G7` becomes `57`, `Am` becomes `6m`,
 * and `D/F#` becomes `2/♯4`. Minor keys need no special casing because the
 * degree comes from letter distance, not from the chromatic scale.
 *
 * Returns null when the key is missing or unreadable so callers can fall back
 * to the letter name instead of printing a wrong number.
 */
export function chordToScaleDegree(chord, key) {
  const tonic = parseKeyTonic(key);
  if (!tonic) return null;
  const token = String(chord ?? '').trim();
  if (!token) return null;

  let rootPart = token;
  let bassPart = '';
  const slashAt = rootPart.lastIndexOf('/');
  if (slashAt !== -1) {
    const maybeBass = rootPart.slice(slashAt + 1);
    if (BASS_RE.test(maybeBass)) {
      bassPart = maybeBass;
      rootPart = rootPart.slice(0, slashAt);
    }
  }

  const degree = degreeLabel(splitPitch(rootPart), tonic);
  if (!degree) return null;
  if (!bassPart) return degree;

  const bass = degreeLabel(splitPitch(bassPart), tonic);
  return bass ? `${degree}/${bass}` : degree;
}

/** @returns {boolean} true when the token looks like a musical chord symbol. */
export function isChordToken(token) {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > 40 || /\s/.test(trimmed)) return false;
  if (/^n\.?c\.?$/i.test(trimmed)) return true;
  return CHORD_RE.test(trimmed);
}

/** @returns {boolean} true when every whitespace-separated token is a chord. */
export function isChordLine(line) {
  if (!line || typeof line !== 'string') return false;
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(isChordToken);
}

function splitInlineChords(line) {
  const segments = [];
  let lastIndex = 0;
  let match;
  INLINE_CHORD_RE.lastIndex = 0;
  while ((match = INLINE_CHORD_RE.exec(line)) !== null) {
    const candidate = match[1].trim();
    if (!isChordToken(candidate)) continue; // keep non-chord brackets literal
    if (match.index > lastIndex) {
      segments.push({ chord: null, text: line.slice(lastIndex, match.index) });
    }
    segments.push({ chord: candidate, text: '' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    segments.push({ chord: null, text: line.slice(lastIndex) });
  }
  // Merge chord-only segments forward into the following text segment so each
  // segment reads as { chord, text } where the chord sounds over `text`.
  const merged = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (seg.chord && !seg.text && prev && prev.chord && !prev.text) {
      // Two adjacent chords with no lyric between: keep both (e.g. turnaround).
      merged.push(seg);
    } else if (seg.chord && !seg.text) {
      merged.push(seg);
    } else if (!seg.chord && prev && prev.chord && prev.text === '') {
      prev.text = seg.text;
    } else {
      merged.push(seg);
    }
  }
  return merged.filter((s) => s.chord || (s.text && s.text.length > 0));
}

function chordLineToSegments(chordLine, lyricLine) {
  // Map each chord token at its character offset to the lyric slice that
  // starts there and runs until the next chord offset.
  const positions = [];
  const tokenRe = /\S+/g;
  let m;
  while ((m = tokenRe.exec(chordLine)) !== null) {
    positions.push({ chord: m[0], at: m.index });
  }
  const lyrics = lyricLine ?? '';
  const segments = [];
  if (positions.length === 0) {
    if (lyrics) segments.push({ chord: null, text: lyrics });
    return segments;
  }
  if (positions[0].at > 0 && lyrics.slice(0, positions[0].at).length > 0) {
    segments.push({ chord: null, text: lyrics.slice(0, positions[0].at) });
  }
  positions.forEach((pos, i) => {
    const end = i + 1 < positions.length ? positions[i + 1].at : lyrics.length;
    segments.push({ chord: pos.chord, text: lyrics.slice(pos.at, end) });
  });
  return segments.filter((s) => s.chord || (s.text && s.text.length > 0));
}

const SECTION_DIRECTIVES = {
  start_of_chorus: 'Chorus', soc: 'Chorus',
  start_of_verse: 'Verse', sov: 'Verse',
  start_of_tab: 'Tab', sot: 'Tab',
  start_of_bridge: 'Bridge', sob: 'Bridge',
  start_of_intro: 'Intro', start_of_outro: 'Outro', start_of_interlude: 'Interlude',
};

const END_DIRECTIVES = new Set([
  'end_of_chorus', 'eoc', 'end_of_verse', 'eov', 'end_of_tab', 'eot',
  'end_of_bridge', 'end_of_intro', 'end_of_outro', 'end_of_interlude',
]);

function sectionHeaderForDirective(name, value) {
  const fallback = SECTION_DIRECTIVES[name];
  if (!fallback) return '';
  const label = String(value || '').trim() || fallback;
  return `[${label}]`;
}

/**
 * Parse ChordPro / chord-sheet text into a structured chart.
 * Never throws on weird input: unparseable lines become plain lyric lines.
 */
export function parseChordPro(text) {
  const chart = {
    title: '', artist: '', key: '', capo: '', tempo: '',
    sections: [],
  };
  const source = String(text ?? '');
  if (!source.trim()) return chart;

  let current = null;
  const ensureSection = (label) => {
    if (!current) {
      current = { id: `chord_section_${chart.sections.length}`, label, lines: [] };
      chart.sections.push(current);
    }
    return current;
  };
  const defaultSection = () => {
    if (!current) ensureSection('Verse');
    return current;
  };

  const rawLines = source.split(/\r?\n/);
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      // Blank lines are visual gaps inside the current section, never
      // section breaks — explicit headers/directives start new sections.
      if (current) current.lines.push({ segments: [], gap: true });
      continue;
    }

    const directive = trimmed.match(DIRECTIVE_RE);
    if (directive) {
      const name = directive[1].trim().toLowerCase();
      const value = (directive[2] ?? '').trim();
      if (name === 'title' || name === 't') chart.title = value;
      else if (name === 'artist' || name === 'a') chart.artist = value;
      else if (name === 'key' || name === 'k') chart.key = value;
      else if (name === 'capo') chart.capo = value;
      else if (name === 'tempo' || name === 'time' || name === 'duration') chart.tempo = chart.tempo || value;
      else if (name === 'comment' || name === 'c' || name === 'subtitle' || name === 'st') {
        if (value) defaultSection().lines.push({ comment: value, segments: [] });
      } else if (SECTION_DIRECTIVES[name]) {
        current = { id: `chord_section_${chart.sections.length}`, label: value || SECTION_DIRECTIVES[name], lines: [] };
        chart.sections.push(current);
      } else if (END_DIRECTIVES.has(name)) {
        current = null;
      }
      // `{define: ...}` and unknown directives are intentionally ignored.
      i += 1;
      continue;
    }

    const bracketSection = trimmed.match(BRACKET_SECTION_RE);
    if (bracketSection && !isChordToken(bracketSection[1].trim())) {
      const label = bracketSection[1].trim().replace(/\s+/g, ' ');
      current = { id: `chord_section_${chart.sections.length}`, label, lines: [] };
      chart.sections.push(current);
      i += 1;
      continue;
    }

    // Chords-over-lyrics: chord-only line directly above a lyric line.
    const nextLine = rawLines[i + 1];
    const nextTrimmed = nextLine !== undefined ? nextLine.trim() : '';
    const nextBracketSection = nextTrimmed.match(BRACKET_SECTION_RE);
    if (isChordLine(trimmed)) {
      if (!current && nextBracketSection) {
        i += 1;
        continue;
      }
      const nextIsLyric = nextLine !== undefined
        && nextTrimmed
        && !isChordLine(nextTrimmed)
        && !nextTrimmed.match(DIRECTIVE_RE)
        && !(nextBracketSection && !isChordToken(nextBracketSection[1].trim()));
      if (nextIsLyric) {
        defaultSection().lines.push({ segments: chordLineToSegments(line, nextLine) });
        i += 2;
      } else {
        // Turnaround, vamp, or a chord line before the next section header.
        defaultSection().lines.push({ segments: chordLineToSegments(line, '') });
        i += 1;
      }
      continue;
    }

    const segments = splitInlineChords(line);
    if (segments.length > 0) {
      defaultSection().lines.push({ segments });
    }
    i += 1;
  }

  // Drop sections that ended up with no singable lines (e.g. consecutive
  // headers, or files containing only blank lines).
  chart.sections = chart.sections.filter((s) => s.lines.some((l) => (l.segments && l.segments.length > 0) || l.comment));
  chart.sections.forEach((s, idx) => { s.id = `chord_section_${idx}`; });
  return chart;
}

/** Validate chart objects before they cross socket or persistence boundaries. */
export function isChordChart(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.sections)) return false;
  const metadataIsValid = ['title', 'artist', 'key', 'capo', 'tempo']
    .every((field) => value[field] === undefined || typeof value[field] === 'string');
  if (!metadataIsValid) return false;
  return value.sections.every((section) => (
    section
    && typeof section === 'object'
    && !Array.isArray(section)
    && typeof section.id === 'string'
    && typeof section.label === 'string'
    && Array.isArray(section.lines)
    && section.lines.every((line) => {
      if (!line || typeof line !== 'object' || Array.isArray(line)) return false;
      if (line.comment !== undefined && typeof line.comment !== 'string') return false;
      if (line.segments === undefined) return line.gap === true;
      return Array.isArray(line.segments) && line.segments.every((segment) => (
        segment
        && typeof segment === 'object'
        && !Array.isArray(segment)
        && (segment.chord === null || typeof segment.chord === 'string')
        && typeof segment.text === 'string'
      ));
    })
  ));
}

/** True only when the source contains an actual chord symbol. */
export function hasChordPro(text) {
  const source = String(text ?? '');
  if (!source.trim()) return false;
  const lines = source.split(/\r?\n/);
  for (let idx = 0; idx < lines.length; idx += 1) {
    const trimmed = lines[idx].trim();
    if (!trimmed || trimmed.match(DIRECTIVE_RE)) continue;
    if (isChordLine(trimmed)) return true;
    INLINE_CHORD_RE.lastIndex = 0;
    let match;
    while ((match = INLINE_CHORD_RE.exec(trimmed)) !== null) {
      if (isChordToken(match[1].trim())) return true;
    }
  }
  return false;
}

/** Strip chord symbols and ChordPro metadata, leaving clean lyric text. */
export function stripChordsFromText(text) {
  const source = String(text ?? '');
  if (!source) return '';
  const out = [];
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push('');
      continue;
    }
    const directive = trimmed.match(DIRECTIVE_RE);
    if (directive) {
      const name = directive[1].trim().toLowerCase();
      const sectionHeader = sectionHeaderForDirective(name, directive[2]);
      if (sectionHeader) out.push(sectionHeader);
      continue;
    }
    if (isChordLine(trimmed)) continue;
    const bracketSection = trimmed.match(BRACKET_SECTION_RE);
    if (bracketSection && !isChordToken(bracketSection[1].trim())) {
      out.push(`[${bracketSection[1].trim()}]`);
      continue;
    }
    out.push(line.replace(INLINE_CHORD_RE, (full, inner) => (isChordToken(String(inner).trim()) ? '' : full)).replace(/[ \t]+/g, ' ').replace(/^\s+/, ''));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Parse local ChordPro source and return the operator chart plus clean lyrics.
 * Plain lyric files pass through unchanged with a null chart.
 */
export function parseChordProSource(text) {
  const source = String(text ?? '');
  const hasChords = hasChordPro(source);
  const hasMetadata = source.split(/\r?\n/).some((line) => line.trim().match(DIRECTIVE_RE));
  if (!hasChords && !hasMetadata) {
    return { chart: null, lyricsText: source };
  }
  return {
    chart: hasChords ? parseChordPro(source) : null,
    lyricsText: stripChordsFromText(source),
  };
}

function transposeRoot(root, semitones) {
  const index = NOTE_INDEX[root];
  if (index === undefined) return root;
  const next = (((index + semitones) % 12) + 12) % 12;
  const useFlats = root.includes('b');
  return (useFlats ? FLAT_NOTES : SHARP_NOTES)[next];
}

/** Transpose a single chord symbol by semitones (positive or negative). */
export function transposeChord(chord, semitones = 0) {
  if (!chord || !semitones) return chord || '';
  const match = String(chord).trim().match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return chord;
  let [, root, rest] = match;
  const slashAt = rest.lastIndexOf('/');
  let bass = '';
  if (slashAt !== -1) {
    const maybeBass = rest.slice(slashAt + 1);
    if (/^[A-G](?:#|b)?$/.test(maybeBass)) {
      bass = maybeBass;
      rest = rest.slice(0, slashAt);
    }
  }
  let out = `${transposeRoot(root, semitones)}${rest}`;
  if (bass) out += `/${transposeRoot(bass, semitones)}`;
  return out;
}

/**
 * Lay out one lyric line with its chords into two mono-spaced rows so chords
 * sit above the lyric syllable they belong to. Works with any monospace font.
 *
 * `options.notation` of 'numbers' renders chords as scale degrees against
 * `options.key` instead of letter names. Transposing is deliberately skipped in
 * that mode: a number chart is already key-relative, so moving the song up a
 * step moves the key with it and every degree stays identical. Deriving the
 * label from the untransposed chord also keeps it from flickering to an
 * enharmonic spelling every time the transpose control moves.
 */
export function formatChordLyricLine(segments, semitones = 0, options = {}) {
  const useNumbers = options?.notation === 'numbers';
  const labelFor = (chord) => {
    if (!chord) return '';
    if (useNumbers) return chordToScaleDegree(chord, options.key) ?? transposeChord(chord, semitones);
    return transposeChord(chord, semitones);
  };

  let chordRow = '';
  let lyricRow = '';
  for (const seg of segments || []) {
    const chord = labelFor(seg.chord);
    const text = seg.text ?? '';
    if (chord) {
      while (chordRow.length < lyricRow.length) chordRow += ' ';
      chordRow += chord;
    }
    lyricRow += text;
  }
  while (chordRow.length < lyricRow.length) chordRow += ' ';
  while (lyricRow.length < chordRow.length) lyricRow += ' ';
  return { chords: chordRow.replace(/\s+$/, ''), lyrics: lyricRow.replace(/\s+$/, '') };
}
