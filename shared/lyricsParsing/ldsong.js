// LyricDisplay Song (.ldsong): plain UTF-8 text whose structure is explicit, so a song
// produces the same slides on every computer regardless of parsing preferences.
// The format is specified in docs/LDSONG_FORMAT.md.

import { createNormalGroup } from './grouping.js';
import { isStageOnlyLine, stripStageOnlyPrefix } from './lineClassification.js';
import {
  lookupRepeatableSection,
  parseRepeatableSectionMarker,
  registerRepeatableSection,
} from './repeatableSections.js';
import {
  assignSongMetadataField,
  formatSongMetadataHeaderLines,
  readSongMetadataHeaderLine,
} from './songMetadata.js';
import { getSectionLabelFromLine, isStructureTag } from './structureTags.js';

export const LDSONG_FILE_TYPE = 'ldsong';
export const LDSONG_FORMAT_VERSION = 1;

const MAGIC_LINE_REGEX = /^#LDSONG\s+(\d+)\s*$/i;
const SECTION_LINE_REGEX = /^\[([^\]]+)\]$/;
const ESCAPED_LYRIC_REGEX = /^(\[|>|\/\/|\\|#)/;
const WRAPPING_BRACKETS_REGEX = /^[\[({<]\s*([\s\S]*?)\s*[\])}>]$/;

const splitLines = (text) => String(text ?? '').replace(/^﻿/, '').split(/\r?\n/);
const normalizeLabel = (label) => String(label || '').toLowerCase().replace(/\s+/g, ' ').trim();
const cleanLabel = (label) => String(label || '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();

/**
 * @returns {number|null} The format version from the `#LDSONG <version>` first line.
 */
export function getLdsongVersion(text) {
  const firstLine = splitLines(text).find((line) => line.trim());
  const match = firstLine?.trim().match(MAGIC_LINE_REGEX);
  return match ? Number(match[1]) : null;
}

export function isLdsongContent(text) {
  return getLdsongVersion(text) !== null;
}

export function createEmptyLdsongDocument(metadata = {}) {
  return {
    version: LDSONG_FORMAT_VERSION,
    metadata: { ...metadata },
    arrangement: null,
    extraHeaders: [],
    sections: [],
  };
}

/**
 * Read .ldsong text into its document model.
 * @returns {{ document: object|null, warnings: string[], error: string|null }}
 */
export function parseLdsongDocument(text) {
  const lines = splitLines(text);
  const warnings = [];
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index += 1;

  let version = LDSONG_FORMAT_VERSION;
  const magic = lines[index]?.trim().match(MAGIC_LINE_REGEX);
  if (magic) {
    version = Number(magic[1]);
    index += 1;
  } else {
    warnings.push('The song has no #LDSONG first line, so it was read as format 1.');
  }

  if (version > LDSONG_FORMAT_VERSION) {
    return {
      document: null,
      warnings,
      error: `This song was saved by a newer version of LyricDisplay (song format ${version}). Update LyricDisplay to open it.`,
    };
  }

  const document = createEmptyLdsongDocument();
  for (; index < lines.length; index += 1) {
    const header = readSongMetadataHeaderLine(lines[index]);
    if (!header) break;
    if (header.key === 'arrangement') {
      const order = header.value.split(',').map(cleanLabel).filter(Boolean);
      document.arrangement = order.length > 0 ? order : null;
    } else if (header.field) {
      assignSongMetadataField(document.metadata, header.field, header.value);
    } else {
      document.extraHeaders.push({ key: header.label, value: header.value.trim() });
    }
  }

  let section = null;
  let slide = null;
  for (; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed) {
      slide = null;
      continue;
    }

    let role = 'lyric';
    let lineText = trimmed;
    const sectionMatch = trimmed.match(SECTION_LINE_REGEX);
    if (trimmed.startsWith('\\')) {
      lineText = trimmed.slice(1).trim();
    } else if (sectionMatch) {
      section = { label: cleanLabel(sectionMatch[1]), slides: [] };
      document.sections.push(section);
      slide = null;
      continue;
    } else if (trimmed.startsWith('//')) {
      role = 'stage';
      lineText = trimmed.slice(2).trim();
    } else if (trimmed.startsWith('>')) {
      role = 'translation';
      lineText = trimmed.slice(1).trim();
    }
    if (!lineText) continue;

    if (!section) {
      section = { label: '', slides: [] };
      document.sections.push(section);
    }
    if (!slide) {
      slide = { lines: [] };
      section.slides.push(slide);
    }
    slide.lines.push({ role, text: lineText });
  }

  return { document, warnings, error: null };
}

const serializeLine = ({ role, text }) => {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (role === 'translation') return `> ${value}`;
  if (role === 'stage') return `// ${value}`;
  return ESCAPED_LYRIC_REGEX.test(value) ? `\\${value}` : value;
};

/**
 * Write a document in canonical form: header, then one blank line before every section,
 * and one blank line between slides.
 */
export function serializeLdsongDocument(document) {
  const source = document || createEmptyLdsongDocument();
  const out = [`#LDSONG ${LDSONG_FORMAT_VERSION}`, ...formatSongMetadataHeaderLines(source.metadata)];
  const arrangement = (source.arrangement || []).map(cleanLabel).filter(Boolean);
  if (arrangement.length > 0) out.push(`# Arrangement: ${arrangement.join(', ')}`);
  for (const { key, value } of source.extraHeaders || []) {
    if (key && value) out.push(`# ${key}: ${String(value).replace(/\s+/g, ' ').trim()}`);
  }

  for (const section of source.sections || []) {
    out.push('');
    const label = cleanLabel(section.label);
    if (label) out.push(`[${label}]`);
    (section.slides || []).forEach((slide, slideIndex) => {
      const slideLines = (slide.lines || []).filter((line) => String(line.text ?? '').trim());
      if (slideLines.length === 0) return;
      if (slideIndex > 0) out.push('');
      slideLines.forEach((line) => out.push(serializeLine(line)));
    });
  }

  return `${out.join('\n')}\n`;
}

function createSlideConverter(warnings) {
  let itemId = 0;

  const translationGroup = (mainLine, translations) => {
    if (translations.length > 1) {
      warnings.push(`"${mainLine}" has more than one translation line; they are shown together.`);
    }
    const translation = translations.join(' / ');
    itemId += 1;
    return {
      type: 'group',
      id: `ldsong_translation_${itemId}`,
      mainLine,
      translation,
      displayText: `${mainLine}\n${translation}`,
      searchText: `${mainLine} ${translation}`,
      originalIndex: itemId,
    };
  };

  return (slide) => {
    const items = [];
    let units = [];

    const flush = () => {
      if (units.length === 0) return;
      if (units.some((unit) => unit.translations.length > 0)) {
        if (units.length > 1) {
          warnings.push('A slide mixes translations with several lines, so each line is shown as its own cue.');
        }
        units.forEach((unit) => items.push(
          unit.translations.length > 0 ? translationGroup(unit.lyric, unit.translations) : unit.lyric
        ));
      } else if (units.length === 1) {
        items.push(units[0].lyric);
      } else {
        itemId += 1;
        items.push(createNormalGroup(units.map((unit) => unit.lyric), 'ldsong_group', itemId));
      }
      units = [];
    };

    for (const line of slide.lines || []) {
      const lineText = String(line.text ?? '').trim();
      if (!lineText) continue;
      if (line.role === 'stage') {
        flush();
        items.push(`// ${lineText}`);
      } else if (line.role === 'translation' && units.length > 0) {
        units[units.length - 1].translations.push(lineText);
      } else {
        if (line.role === 'translation') {
          warnings.push(`Translation "${lineText}" has no lyric line before it, so it is shown as a lyric line.`);
        }
        units.push({ lyric: lineText, translations: [] });
      }
    }
    flush();
    return items;
  };
}

/**
 * Turn a document into the runtime lyric model. Sections play in arrangement order when
 * one is given; otherwise in document order, where a section with no lines repeats the
 * matching earlier section.
 * @returns {{ processedLines: Array, sections: Array, lineToSection: object, warnings: string[] }}
 */
export function ldsongDocumentToLyrics(document) {
  const warnings = [];
  const processedLines = [];
  const sections = [];
  const lineToSection = {};
  const toItems = createSlideConverter(warnings);
  const definitions = (document?.sections || []).filter((section) => section.label && section.slides?.length > 0);
  const repeatRegistry = new Map();
  definitions.forEach((section) => {
    const marker = parseRepeatableSectionMarker(`[${section.label}]`);
    if (marker) registerRepeatableSection(repeatRegistry, marker, section);
  });

  const findDefinition = (label, before = definitions.length) => {
    const key = normalizeLabel(label);
    const candidates = definitions.slice(0, before);
    const exact = candidates.find((section) => normalizeLabel(section.label) === key);
    if (exact) return exact;
    const marker = parseRepeatableSectionMarker(`[${label}]`);
    const repeat = marker ? lookupRepeatableSection(repeatRegistry, marker) : null;
    return repeat && candidates.includes(repeat) ? repeat : null;
  };

  const emit = (label, slides) => {
    let id = null;
    if (label) {
      id = `section_${sections.length}_${processedLines.length}`;
      processedLines.push(`[${label}]`);
    }
    const start = processedLines.length;
    slides.forEach((slide) => processedLines.push(...toItems(slide)));
    if (!id) return;
    const end = Math.max(start, processedLines.length - 1);
    sections.push({ id, label, startLine: start, endLine: end });
    for (let line = start; line < processedLines.length; line += 1) lineToSection[line] = id;
  };

  const allSections = document?.sections || [];
  const arrangement = (document?.arrangement || []).filter(Boolean);
  if (arrangement.length > 0) {
    allSections.filter((section) => !section.label).forEach((section) => emit('', section.slides));
    arrangement.forEach((label) => {
      const definition = findDefinition(label);
      if (definition) emit(definition.label === label ? label : cleanLabel(label), definition.slides);
      else warnings.push(`The arrangement names "${label}", but the song has no section with that name.`);
    });
  } else {
    let definitionsSeen = 0;
    allSections.forEach((section) => {
      if (!section.label || section.slides.length > 0) {
        if (section.label) definitionsSeen += 1;
        emit(section.label, section.slides);
        return;
      }
      const definition = findDefinition(section.label, definitionsSeen);
      if (definition) emit(section.label, definition.slides);
      else warnings.push(`Section "${section.label}" has no lines and no earlier section to repeat.`);
    });
  }

  return { processedLines, sections, lineToSection, warnings };
}

/**
 * Parse .ldsong text into the same result shape as the TXT and LRC parsers.
 * Throws when the song needs a newer LyricDisplay.
 */
export function parseLdsongContent(text) {
  const { document, warnings, error } = parseLdsongDocument(text);
  if (error) throw new Error(error);
  const lyrics = ldsongDocumentToLyrics(document);
  return {
    rawText: String(text ?? ''),
    processedLines: lyrics.processedLines,
    sections: lyrics.sections,
    lineToSection: lyrics.lineToSection,
    songMetadata: Object.keys(document.metadata).length > 0 ? { ...document.metadata } : null,
    document,
    warnings: [...warnings, ...lyrics.warnings],
  };
}

const stripWrappingBrackets = (value) => {
  const match = String(value ?? '').trim().match(WRAPPING_BRACKETS_REGEX);
  return (match ? match[1] : String(value ?? '')).trim();
};

const groupLines = (item) => (Array.isArray(item.lines) && item.lines.length > 0
  ? item.lines
  : [item.line1, item.line2]
).filter((line) => typeof line === 'string' && line.trim());

/**
 * Build a document from already-parsed lyrics (for example a guessed TXT parse) so it can be
 * reviewed and saved as .ldsong. Identical repeated sections become an arrangement.
 */
export function documentFromProcessedLines(processedLines, { songMetadata = null, sectionTagPhrases } = {}) {
  const document = createEmptyLdsongDocument(songMetadata || {});
  let section = null;
  const currentSection = () => {
    if (!section) {
      section = { label: '', slides: [] };
      document.sections.push(section);
    }
    return section;
  };

  for (const item of Array.isArray(processedLines) ? processedLines : []) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (isStructureTag(trimmed, sectionTagPhrases)) {
        section = { label: cleanLabel(getSectionLabelFromLine(trimmed)), slides: [] };
        document.sections.push(section);
      } else if (isStageOnlyLine(trimmed)) {
        currentSection().slides.push({ lines: [{ role: 'stage', text: stripStageOnlyPrefix(trimmed).trim() }] });
      } else {
        currentSection().slides.push({ lines: [{ role: 'lyric', text: trimmed }] });
      }
    } else if (item?.type === 'group') {
      currentSection().slides.push({
        lines: [
          { role: 'lyric', text: String(item.mainLine ?? '').trim() },
          { role: 'translation', text: stripWrappingBrackets(item.translation) },
        ].filter((line) => line.text),
      });
    } else if (item?.type === 'normal-group') {
      const lines = groupLines(item).map((text) => ({ role: 'lyric', text: text.trim() }));
      if (lines.length > 0) currentSection().slides.push({ lines });
    }
  }

  const signature = (entry) => JSON.stringify(entry.slides);
  const unique = [];
  const order = [];
  let repeated = false;
  for (const entry of document.sections) {
    if (!entry.label) {
      unique.push(entry);
      continue;
    }
    const existing = unique.find((candidate) => candidate.label && normalizeLabel(candidate.label) === normalizeLabel(entry.label));
    if (!existing) {
      unique.push(entry);
      order.push(entry.label);
    } else if (signature(existing) === signature(entry)) {
      repeated = true;
      order.push(existing.label);
    } else {
      return document;
    }
  }

  if (repeated) {
    document.sections = unique;
    document.arrangement = order;
  }
  return document;
}

/**
 * Plain lyric text for sharing outside LyricDisplay. Sections play in arrangement order,
 * translations are bracketed, and stage notes keep their // prefix.
 */
export function ldsongDocumentToPlainText(document) {
  const { processedLines } = ldsongDocumentToLyrics(document);
  const out = [...formatSongMetadataHeaderLines(document?.metadata)];
  if (out.length > 0) out.push('');

  processedLines.forEach((item, index) => {
    const isSection = typeof item === 'string' && /^\[[^\]]+\]$/.test(item);
    if (index > 0 && isSection) out.push('');
    if (typeof item === 'string') out.push(item);
    else if (item.type === 'group') out.push(item.mainLine, `(${item.translation})`);
    else out.push(...groupLines(item));
    const next = processedLines[index + 1];
    const nextIsSection = typeof next === 'string' && /^\[[^\]]+\]$/.test(next);
    if (!isSection && next !== undefined && !nextIsSection) out.push('');
  });

  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/**
 * Build .ldsong text from presentation slides: each source slide becomes exactly one slide.
 * @param {string[][]} slides - Lines of text per slide.
 * @param {{ songMetadata?: object, provenance?: { key: string, value: string } }} options
 */
export function createLdsongFromSlides(slides, { songMetadata = null, provenance = null } = {}) {
  const document = createEmptyLdsongDocument(songMetadata || {});
  if (provenance?.key && provenance?.value) document.extraHeaders.push(provenance);
  const songSlides = (Array.isArray(slides) ? slides : [])
    .map((lines) => ({
      lines: (Array.isArray(lines) ? lines : [])
        .map((text) => String(text ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .map((text) => ({ role: 'lyric', text })),
    }))
    .filter((slide) => slide.lines.length > 0);
  if (songSlides.length > 0) document.sections.push({ label: '', slides: songSlides });
  return serializeLdsongDocument(document);
}
