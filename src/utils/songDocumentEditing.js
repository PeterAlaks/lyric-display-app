// Editing model for the structured song editor: the .ldsong document plus stable ids so
// React keeps focus while lines move. Every operation returns a new document.

import { createEmptyLdsongDocument, documentFromProcessedLines, ldsongDocumentToLyrics } from '../../shared/lyricsParsing/ldsong.js';
import { isStageOnlyLine } from '../../shared/lyricsParsing/lineClassification.js';
import { parseTxtContent } from '../../shared/lyricsParsing/txtParser.js';
import { readPersistentStorageItem, writePersistentStorageItem } from './persistentStorage.js';

export const SONG_EDITOR_KINDS = ['structured', 'classic'];
export const LINE_ROLES = ['lyric', 'translation', 'stage'];

let idCounter = 0;
const createId = (prefix) => {
  idCounter += 1;
  return `${prefix}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
};

const createLine = (text = '', role = 'lyric') => ({ id: createId('line'), role, text });
const createSlide = (lines = [createLine()]) => ({ id: createId('slide'), lines });
const createSection = (label = '', slides = [createSlide()]) => ({ id: createId('section'), label, slides });

/**
 * Which editor a song opens in. Saved .ldsong songs open structured; other loaded files open
 * in the classic text canvas so saving keeps their format. New songs follow the user's choice.
 */
export function resolveSongEditorKind({ editorParam, mode, origin, lyricsFileType, preferred } = {}) {
  if (SONG_EDITOR_KINDS.includes(editorParam)) return editorParam;
  if (mode === 'compose' || origin === 'lyric-video-studio') return 'classic';
  if (mode === 'edit') return lyricsFileType === 'ldsong' ? 'structured' : 'classic';
  return SONG_EDITOR_KINDS.includes(preferred) ? preferred : 'structured';
}

const PREFERRED_SONG_EDITOR_KEY = 'lyricdisplay-song-editor';

// The editor new songs open in; operators who prefer the classic canvas switch once.
export function readPreferredSongEditor() {
  const stored = readPersistentStorageItem(PREFERRED_SONG_EDITOR_KEY);
  return SONG_EDITOR_KINDS.includes(stored) ? stored : 'structured';
}

export function writePreferredSongEditor(kind) {
  if (SONG_EDITOR_KINDS.includes(kind)) writePersistentStorageItem(PREFERRED_SONG_EDITOR_KEY, kind);
}

export function createEditorDocument(document = null) {
  const source = document || createEmptyLdsongDocument();
  return {
    metadata: { ...(source.metadata || {}) },
    arrangement: Array.isArray(source.arrangement) && source.arrangement.length > 0 ? [...source.arrangement] : null,
    extraHeaders: [...(source.extraHeaders || [])],
    sections: (source.sections || []).map((section) => ({
      ...createSection(section.label || '', (section.slides || []).map((slide) => createSlide(
        (slide.lines || []).map((line) => createLine(line.text, LINE_ROLES.includes(line.role) ? line.role : 'lyric'))
      ))),
      // A section with no lines in a saved song repeats an earlier one of the same name.
      repeat: (section.slides || []).length === 0 && Boolean(section.label),
    })),
  };
}

/** The .ldsong document to save. Blank lines, slides, and unused sections are dropped. */
export function toLdsongDocument(editorDocument) {
  const sections = (editorDocument?.sections || [])
    .map((section) => ({
      label: String(section.label || '').trim(),
      repeat: Boolean(section.repeat),
      slides: (section.slides || [])
        .map((slide) => ({
          lines: (slide.lines || [])
            .map((line) => ({ role: line.role, text: String(line.text || '').replace(/\s+/g, ' ').trim() }))
            .filter((line) => line.text),
        }))
        .filter((slide) => slide.lines.length > 0),
    }))
    .filter((section) => section.slides.length > 0 || (section.repeat && section.label))
    .map(({ label, slides }) => ({ label, slides }));

  const arrangement = (editorDocument?.arrangement || []).map((label) => String(label || '').trim()).filter(Boolean);
  return {
    ...createEmptyLdsongDocument(editorDocument?.metadata || {}),
    arrangement: arrangement.length > 0 ? arrangement : null,
    extraHeaders: [...(editorDocument?.extraHeaders || [])],
    sections,
  };
}

export function isEditorDocumentEmpty(editorDocument) {
  return !(editorDocument?.sections || []).some((section) => (
    section.repeat || section.slides.some((slide) => slide.lines.some((line) => String(line.text || '').trim()))
  ));
}

const findLine = (document, lineId) => {
  for (let sectionIndex = 0; sectionIndex < document.sections.length; sectionIndex += 1) {
    const slides = document.sections[sectionIndex].slides;
    for (let slideIndex = 0; slideIndex < slides.length; slideIndex += 1) {
      const lineIndex = slides[slideIndex].lines.findIndex((line) => line.id === lineId);
      if (lineIndex !== -1) return { sectionIndex, slideIndex, lineIndex };
    }
  }
  return null;
};

const findSlide = (document, slideId) => {
  for (let sectionIndex = 0; sectionIndex < document.sections.length; sectionIndex += 1) {
    const slideIndex = document.sections[sectionIndex].slides.findIndex((slide) => slide.id === slideId);
    if (slideIndex !== -1) return { sectionIndex, slideIndex };
  }
  return null;
};

const replaceSection = (document, sectionIndex, updater) => ({
  ...document,
  sections: document.sections.map((section, index) => (index === sectionIndex ? updater(section) : section)),
});

const replaceSlides = (document, sectionIndex, updater) => replaceSection(document, sectionIndex, (section) => ({
  ...section,
  slides: updater(section.slides),
}));

export function updateEditorMetadata(document, patch) {
  return { ...document, metadata: { ...document.metadata, ...patch } };
}

export function addEditorSection(document, { label = '', afterSectionId = null } = {}) {
  const section = createSection(label);
  const index = afterSectionId ? document.sections.findIndex((entry) => entry.id === afterSectionId) : -1;
  const sections = [...document.sections];
  sections.splice(index === -1 ? sections.length : index + 1, 0, section);
  return {
    document: { ...document, sections },
    sectionId: section.id,
    slideId: section.slides[0].id,
    lineId: section.slides[0].lines[0].id,
  };
}

export function updateEditorSection(document, sectionId, patch) {
  return {
    ...document,
    sections: document.sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)),
  };
}

export function removeEditorSection(document, sectionId) {
  return { ...document, sections: document.sections.filter((section) => section.id !== sectionId) };
}

export function moveEditorSection(document, sectionId, delta) {
  const index = document.sections.findIndex((section) => section.id === sectionId);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= document.sections.length) return document;
  const sections = [...document.sections];
  const [moved] = sections.splice(index, 1);
  sections.splice(target, 0, moved);
  return { ...document, sections };
}

export function addEditorSlide(document, sectionId) {
  const sectionIndex = document.sections.findIndex((section) => section.id === sectionId);
  if (sectionIndex === -1) return { document, lineId: null };
  const slide = createSlide();
  return {
    document: replaceSlides(document, sectionIndex, (slides) => [...slides, slide]),
    lineId: slide.lines[0].id,
  };
}

export function addEditorLine(document, { afterLineId = null, role = 'lyric', text = '' } = {}) {
  const line = createLine(text, role);
  const location = afterLineId ? findLine(document, afterLineId) : null;
  if (!location) {
    if (document.sections.length === 0) {
      const created = addEditorSection(document);
      return { document: updateEditorLine(created.document, created.lineId, { text, role }), lineId: created.lineId };
    }
    const sectionIndex = document.sections.length - 1;
    const slides = document.sections[sectionIndex].slides;
    if (slides.length === 0) {
      return { document: replaceSlides(document, sectionIndex, () => [createSlide([line])]), lineId: line.id };
    }
    return {
      document: replaceSlides(document, sectionIndex, (current) => current.map((slide, index) => (
        index === current.length - 1 ? { ...slide, lines: [...slide.lines, line] } : slide
      ))),
      lineId: line.id,
    };
  }

  const { sectionIndex, slideIndex, lineIndex } = location;
  return {
    document: replaceSlides(document, sectionIndex, (slides) => slides.map((slide, index) => {
      if (index !== slideIndex) return slide;
      const lines = [...slide.lines];
      lines.splice(lineIndex + 1, 0, line);
      return { ...slide, lines };
    })),
    lineId: line.id,
  };
}

export function updateEditorLine(document, lineId, patch) {
  const location = findLine(document, lineId);
  if (!location) return document;
  return replaceSlides(document, location.sectionIndex, (slides) => slides.map((slide, index) => (
    index === location.slideIndex
      ? { ...slide, lines: slide.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)) }
      : slide
  )));
}

export function removeEditorLine(document, lineId) {
  const location = findLine(document, lineId);
  if (!location) return document;
  return replaceSlides(document, location.sectionIndex, (slides) => slides
    .map((slide, index) => (index === location.slideIndex
      ? { ...slide, lines: slide.lines.filter((line) => line.id !== lineId) }
      : slide))
    .filter((slide) => slide.lines.length > 0));
}

/** Start a new slide after the given line, moving any following lines into it. */
export function splitEditorSlide(document, lineId) {
  const location = findLine(document, lineId);
  if (!location) return { document, lineId: null };
  const { sectionIndex, slideIndex, lineIndex } = location;
  const slide = document.sections[sectionIndex].slides[slideIndex];
  const movedLines = slide.lines.slice(lineIndex + 1);
  const nextSlide = createSlide(movedLines.length > 0 ? movedLines : [createLine()]);
  return {
    document: replaceSlides(document, sectionIndex, (slides) => {
      const next = [...slides];
      next.splice(slideIndex, 1, { ...slide, lines: slide.lines.slice(0, lineIndex + 1) }, nextSlide);
      return next;
    }),
    lineId: nextSlide.lines[0].id,
  };
}

export function mergeEditorSlideWithPrevious(document, slideId) {
  const location = findSlide(document, slideId);
  if (!location || location.slideIndex === 0) return document;
  return replaceSlides(document, location.sectionIndex, (slides) => {
    const next = [...slides];
    const [current] = next.splice(location.slideIndex, 1);
    const previous = next[location.slideIndex - 1];
    next[location.slideIndex - 1] = { ...previous, lines: [...previous.lines, ...current.lines] };
    return next;
  });
}

export function removeEditorSlide(document, slideId) {
  const location = findSlide(document, slideId);
  if (!location) return document;
  return replaceSlides(document, location.sectionIndex, (slides) => slides.filter((slide) => slide.id !== slideId));
}

/** A paste big enough to be a whole song (several stanzas), rather than a line or two. */
export function isSongSizedPaste(text) {
  const value = String(text || '');
  const nonEmptyLines = value.split(/\r?\n/).filter((line) => line.trim()).length;
  const blocks = value.split(/\r?\n\s*\r?\n/).filter((block) => block.trim()).length;
  return nonEmptyLines >= 6 || (blocks >= 2 && nonEmptyLines >= 4);
}

/**
 * Lay pasted lyrics out with the user's parsing settings, so they can be reviewed before
 * saving. Replaces an empty song, or is added after the given section.
 */
export function importLyricsIntoEditor(document, text, { parsingOptions = {}, afterSectionId = null } = {}) {
  const parsed = parseTxtContent(String(text || ''), parsingOptions);
  const imported = createEditorDocument(parsed.document || documentFromProcessedLines(parsed.processedLines, {
    songMetadata: parsed.songMetadata,
    sectionTagPhrases: parsingOptions?.groupingConfig?.sectionTagPhrases,
  }));

  if (isEditorDocumentEmpty(document)) {
    return {
      ...imported,
      metadata: { ...imported.metadata, ...Object.fromEntries(Object.entries(document.metadata || {}).filter(([, value]) => (
        Array.isArray(value) ? value.length > 0 : Boolean(value)
      ))) },
    };
  }

  const index = afterSectionId ? document.sections.findIndex((section) => section.id === afterSectionId) : -1;
  const sections = [...document.sections];
  sections.splice(index === -1 ? sections.length : index + 1, 0, ...imported.sections);
  return { ...document, sections };
}

/** Insert pasted lines as typed: lines join the current slide, blank lines start new slides. */
export function insertLiteralLinesIntoEditor(document, lineId, text) {
  const blocks = String(text || '')
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))
    .filter((block) => block.length > 0);
  if (blocks.length === 0 || !findLine(document, lineId)) return document;

  let next = document;
  let cursor = lineId;
  const target = (() => {
    const { sectionIndex, slideIndex, lineIndex } = findLine(document, lineId);
    return document.sections[sectionIndex].slides[slideIndex].lines[lineIndex];
  })();

  blocks.forEach((block, blockIndex) => {
    block.forEach((lineText, lineIndex) => {
      if (blockIndex === 0 && lineIndex === 0 && !String(target.text || '').trim()) {
        next = updateEditorLine(next, cursor, { text: lineText });
        return;
      }
      if (blockIndex > 0 && lineIndex === 0) {
        const split = splitEditorSlide(next, cursor);
        next = updateEditorLine(split.document, split.lineId, { text: lineText });
        cursor = split.lineId;
        return;
      }
      const added = addEditorLine(next, { afterLineId: cursor, text: lineText });
      next = added.document;
      cursor = added.lineId;
    });
  });
  return next;
}

/** The cues a slide plays as on lyric outputs, in order; stage-only notes are left out. */
export function getEditorSlideCues(slide) {
  if (!slide?.lines?.length) return [];
  const { processedLines } = ldsongDocumentToLyrics({ metadata: {}, sections: [{ label: '', slides: [slide] }] });
  return processedLines.filter((cue) => typeof cue !== 'string' || !isStageOnlyLine(cue));
}

/** Plain-language warnings for a slide that may not display well on outputs. */
export function getEditorSlideIssues(slide, { maxLines = 4, longLineLength = 60 } = {}) {
  const shown = (slide?.lines || []).filter((line) => line.role !== 'stage' && String(line.text || '').trim());
  const issues = [];
  if (shown.some((line) => String(line.text).trim().length > longLineLength)) {
    issues.push('A long line may wrap onto two lines on screen.');
  }
  if (shown.length > maxLines) {
    issues.push(`${shown.length} lines on one slide; outputs usually show ${maxLines} or fewer.`);
  }
  return issues;
}

/** Section labels in the order they will play. */
export function getEditorPlayOrder(document) {
  if (Array.isArray(document?.arrangement) && document.arrangement.length > 0) return [...document.arrangement];
  return (document?.sections || []).map((section) => String(section.label || '').trim()).filter(Boolean);
}

/** Apply a line transform to every line, or only to the given line ids. */
export function mapEditorLines(document, transform, { lineIds = null } = {}) {
  const targets = lineIds ? new Set(lineIds) : null;
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      slides: section.slides.map((slide) => ({
        ...slide,
        lines: slide.lines.map((line) => (!targets || targets.has(line.id) ? transform(line) : line)),
      })),
    })),
  };
}

export function duplicateEditorLine(document, lineId) {
  const location = findLine(document, lineId);
  if (!location) return { document, lineId: null };
  const { sectionIndex, slideIndex, lineIndex } = location;
  const source = document.sections[sectionIndex].slides[slideIndex].lines[lineIndex];
  return addEditorLine(document, { afterLineId: lineId, role: source.role, text: source.text });
}

/** Move a line up or down within its slide. */
export function moveEditorLine(document, lineId, delta) {
  const location = findLine(document, lineId);
  if (!location) return document;
  const { sectionIndex, slideIndex, lineIndex } = location;
  const target = lineIndex + delta;
  const lines = document.sections[sectionIndex].slides[slideIndex].lines;
  if (target < 0 || target >= lines.length) return document;
  return replaceSlides(document, sectionIndex, (slides) => slides.map((slide, index) => {
    if (index !== slideIndex) return slide;
    const next = [...slide.lines];
    [next[lineIndex], next[target]] = [next[target], next[lineIndex]];
    return { ...slide, lines: next };
  }));
}

/**
 * Start a section at the given slide: it and the slides after it move into a new section.
 * On a section's first slide this names that section instead.
 */
export function splitEditorSectionAtSlide(document, slideId, label = '') {
  const location = findSlide(document, slideId);
  if (!location) return { document, sectionId: null };
  const { sectionIndex, slideIndex } = location;
  const section = document.sections[sectionIndex];
  if (slideIndex === 0) {
    return {
      document: updateEditorSection(document, section.id, { label, repeat: false }),
      sectionId: section.id,
    };
  }
  const created = { ...createSection(label, section.slides.slice(slideIndex)), repeat: false };
  const sections = [...document.sections];
  sections.splice(sectionIndex, 1, { ...section, slides: section.slides.slice(0, slideIndex) }, created);
  return { document: { ...document, sections }, sectionId: created.id };
}
