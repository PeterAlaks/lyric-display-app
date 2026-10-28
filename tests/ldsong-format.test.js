import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLdsongFromSlides,
  documentFromProcessedLines,
  isLdsongContent,
  ldsongDocumentToLyrics,
  ldsongDocumentToPlainText,
  LDSONG_FORMAT_VERSION,
  parseLdsongContent,
  parseLdsongDocument,
  serializeLdsongDocument,
} from '../shared/lyricsParsing/ldsong.js';
import { parseTxtContent } from '../shared/lyricsParsing/txtParser.js';
import { createLdsongFromImportedText, parseLyricImportContent } from '../shared/documentTextExtraction.js';
import {
  addEditorLine,
  addEditorSection,
  createEditorDocument,
  duplicateEditorLine,
  mapEditorLines,
  moveEditorLine,
  splitEditorSectionAtSlide,
  getEditorPlayOrder,
  getEditorSlideCues,
  getEditorSlideIssues,
  importLyricsIntoEditor,
  insertLiteralLinesIntoEditor,
  isEditorDocumentEmpty,
  isSongSizedPaste,
  mergeEditorSlideWithPrevious,
  removeEditorLine,
  resolveSongEditorKind,
  splitEditorSlide,
  toLdsongDocument,
  updateEditorLine,
} from '../src/utils/songDocumentEditing.js';

const SAMPLE = [
  '#LDSONG 1',
  '# Title: Amazing Grace',
  '# Author: John Newton, Edwin Excell',
  '# Copyright: Public Domain',
  '# CCLI Song Number: 22025',
  '# Arrangement: Verse 1, Chorus, Verse 2, Chorus',
  '',
  '[Verse 1]',
  'Amazing grace how sweet the sound',
  'That saved a wretch like me',
  '',
  'I once was lost but now am found',
  '',
  '[Chorus]',
  'My chains are gone',
  '> Mis cadenas se fueron',
  '',
  '// Band: hold the last chord',
  '',
  '[Verse 2]',
  "'Twas grace that taught my heart to fear",
  '',
].join('\n');

test('ldsong documents parse into sections, slides, and line roles', () => {
  const { document, warnings, error } = parseLdsongDocument(SAMPLE);

  assert.equal(error, null);
  assert.deepEqual(warnings, []);
  assert.equal(document.version, LDSONG_FORMAT_VERSION);
  assert.deepEqual(document.metadata, {
    title: 'Amazing Grace',
    artists: ['John Newton', 'Edwin Excell'],
    copyright: 'Public Domain',
    ccliSongNumber: '22025',
  });
  assert.deepEqual(document.arrangement, ['Verse 1', 'Chorus', 'Verse 2', 'Chorus']);
  assert.deepEqual(document.sections, [
    {
      label: 'Verse 1',
      slides: [
        { lines: [
          { role: 'lyric', text: 'Amazing grace how sweet the sound' },
          { role: 'lyric', text: 'That saved a wretch like me' },
        ] },
        { lines: [{ role: 'lyric', text: 'I once was lost but now am found' }] },
      ],
    },
    {
      label: 'Chorus',
      slides: [
        { lines: [
          { role: 'lyric', text: 'My chains are gone' },
          { role: 'translation', text: 'Mis cadenas se fueron' },
        ] },
        { lines: [{ role: 'stage', text: 'Band: hold the last chord' }] },
      ],
    },
    {
      label: 'Verse 2',
      slides: [{ lines: [{ role: 'lyric', text: "'Twas grace that taught my heart to fear" }] }],
    },
  ]);
});

test('ldsong serialization is canonical and round-trips losslessly', () => {
  const { document } = parseLdsongDocument(SAMPLE);
  const serialized = serializeLdsongDocument(document);

  assert.equal(serialized, SAMPLE);
  assert.deepEqual(parseLdsongDocument(serialized).document, document);
});

test('ldsong lyrics follow the arrangement exactly, with no heuristics', () => {
  const { processedLines, sections, lineToSection } = parseLdsongContent(SAMPLE);

  assert.deepEqual(processedLines.map((line) => (typeof line === 'string' ? line : line.type)), [
    '[Verse 1]',
    'normal-group',
    'I once was lost but now am found',
    '[Chorus]',
    'group',
    '// Band: hold the last chord',
    '[Verse 2]',
    "'Twas grace that taught my heart to fear",
    '[Chorus]',
    'group',
    '// Band: hold the last chord',
  ]);
  assert.deepEqual(processedLines[1].lines, ['Amazing grace how sweet the sound', 'That saved a wretch like me']);
  assert.equal(processedLines[4].mainLine, 'My chains are gone');
  assert.equal(processedLines[4].translation, 'Mis cadenas se fueron');
  assert.deepEqual(sections.map((section) => [section.label, section.startLine, section.endLine]), [
    ['Verse 1', 1, 2],
    ['Chorus', 4, 5],
    ['Verse 2', 7, 7],
    ['Chorus', 9, 10],
  ]);
  assert.equal(lineToSection[10], sections[3].id);
});

test('ldsong slides are identical whatever the parsing preferences', async () => {
  const text = [
    '#LDSONG 1',
    '',
    'Oh how He loves us so oh how He loves us how He loves us all and we are His portion and He is our prize',
    '',
    'Hosanna in the highest',
    '(Hosanna)',
    '',
    'You are holy',
    '',
    'You are worthy',
  ].join('\n');
  const strict = parseLdsongContent(text).processedLines;
  const viaImport = await parseLyricImportContent({
    fileType: 'ldsong',
    rawText: text,
    parsingOptions: { enableSplitting: true, groupingConfig: { maxLinesPerGroup: 1 } },
  });

  assert.equal(strict.length, 4);
  assert.equal(typeof strict[0], 'string');
  assert.equal(strict[1].type, 'normal-group');
  assert.deepEqual(strict[1].lines, ['Hosanna in the highest', '(Hosanna)']);
  assert.deepEqual(strict.slice(2), ['You are holy', 'You are worthy']);
  assert.deepEqual(viaImport.processedLines, strict);
});

test('escaped lines keep marker characters as lyric text', () => {
  const text = [
    '#LDSONG 1',
    '',
    '\\[Hallelujah]',
    '\\> not a translation',
    '\\// not stage only',
    '\\\\ starts with a backslash',
    '\\# hashtag lyric',
  ].join('\n');
  const { document } = parseLdsongDocument(text);

  assert.deepEqual(document.sections[0].slides[0].lines.map((line) => line.text), [
    '[Hallelujah]',
    '> not a translation',
    '// not stage only',
    '\\ starts with a backslash',
    '# hashtag lyric',
  ]);
  assert.equal(document.sections[0].slides[0].lines.every((line) => line.role === 'lyric'), true);
  assert.equal(serializeLdsongDocument(document), `${text}\n`);
});

test('empty sections repeat the matching earlier section and custom labels stay sections', () => {
  const { processedLines, sections, warnings } = parseLdsongContent([
    '#LDSONG 1',
    '',
    '[Altar Call]',
    'Come as you are',
    '',
    '[Chorus]',
    'Hallelujah',
    '',
    '[Chorus]',
    '',
    '[Missing]',
  ].join('\n'));

  assert.deepEqual(processedLines, ['[Altar Call]', 'Come as you are', '[Chorus]', 'Hallelujah', '[Chorus]', 'Hallelujah']);
  assert.deepEqual(sections.map((section) => section.label), ['Altar Call', 'Chorus', 'Chorus']);
  assert.equal(warnings.some((warning) => /Missing/.test(warning)), true);
});

test('translations inside a multi-line slide become separate cues with a warning', () => {
  const { processedLines, warnings } = parseLdsongContent([
    '#LDSONG 1',
    '',
    'First line',
    '> Primera linea',
    'Second line',
  ].join('\n'));

  assert.equal(processedLines.length, 2);
  assert.equal(processedLines[0].type, 'group');
  assert.equal(processedLines[1], 'Second line');
  assert.equal(warnings.length, 1);
});

test('songs from newer LyricDisplay versions are refused instead of guessed', () => {
  const { error } = parseLdsongDocument('#LDSONG 2\n\nLine');
  assert.match(error, /newer version/i);
  assert.throws(() => parseLdsongContent('#LDSONG 2\n\nLine'), /newer version/i);
});

test('ldsong content is recognized even inside a .txt file', async () => {
  assert.equal(isLdsongContent('﻿\n#LDSONG 1\n\nLine'), true);
  assert.equal(isLdsongContent('Line\n#LDSONG 1'), false);
  const parsed = await parseLyricImportContent({ fileType: 'txt', rawText: '#LDSONG 1\n\nFirst\nSecond' });
  assert.equal(parsed.processedLines[0].type, 'normal-group');
  assert.equal(parsed.document.version, 1);
});

test('documents built from guessed text keep their structure and collapse repeated sections', () => {
  const txt = parseTxtContent([
    '# Title: Example Song',
    '',
    '[Verse 1]',
    'Line one',
    'Line two',
    '',
    '[Chorus]',
    'Chorus line',
    '(Translation)',
    '',
    '[Verse 2]',
    'Verse two line',
    '',
    '[Chorus]',
    'Chorus line',
    '(Translation)',
  ].join('\n'), { enableSplitting: false });
  const document = documentFromProcessedLines(txt.processedLines, { songMetadata: txt.songMetadata });

  assert.equal(document.metadata.title, 'Example Song');
  assert.deepEqual(document.sections.map((section) => section.label), ['Verse 1', 'Chorus', 'Verse 2']);
  assert.deepEqual(document.arrangement, ['Verse 1', 'Chorus', 'Verse 2', 'Chorus']);
  assert.deepEqual(document.sections[1].slides[0].lines, [
    { role: 'lyric', text: 'Chorus line' },
    { role: 'translation', text: 'Translation' },
  ]);

  // Outputs strip a translation's wrapping brackets, so compare what is displayed.
  const displayed = (line) => {
    if (typeof line === 'string') return line;
    if (line.type === 'group') return `${line.mainLine} | ${line.translation.replace(/^[\[({<]\s*|\s*[\])}>]$/g, '')}`;
    return line.displayText;
  };
  const reparsed = ldsongDocumentToLyrics(parseLdsongDocument(serializeLdsongDocument(document)).document);
  assert.deepEqual(reparsed.processedLines.map(displayed), txt.processedLines.map(displayed));
});

test('plain-text export keeps sections, translations, and stage notes readable', () => {
  const { document } = parseLdsongDocument(SAMPLE);
  const text = ldsongDocumentToPlainText(document);

  assert.match(text, /^# Title: Amazing Grace/m);
  assert.match(text, /^\[Chorus\]\nMy chains are gone\n\(Mis cadenas se fueron\)$/m);
  assert.match(text, /^\/\/ Band: hold the last chord$/m);
  assert.doesNotMatch(text, /#LDSONG|Arrangement/);
});

test('imported song text becomes a structured song with credits and provenance', () => {
  const source = createLdsongFromImportedText([
    'Verse 1',
    'Amazing grace how sweet the sound',
    'That saved a wretch like me',
    '',
    'Chorus',
    'My chains are gone',
  ].join('\n'), {
    songMetadata: { title: 'Amazing Grace', artists: ['John Newton'], copyright: 'Public Domain', ccliSongNumber: '22025' },
    provenance: { key: 'Imported from EasyWorship', value: '2026-10-28' },
    parsingOptions: { enableSplitting: false },
  });
  const { document, error } = parseLdsongDocument(source);

  assert.equal(error, null);
  assert.match(source, /^#LDSONG 1\n# Title: Amazing Grace\n# Author: John Newton\n# Copyright: Public Domain\n# CCLI Song Number: 22025\n# Imported from EasyWorship: 2026-10-28\n/);
  assert.deepEqual(document.sections.map((section) => section.label), ['Verse 1', 'Chorus']);
  assert.equal(document.sections[0].slides[0].lines.length, 2);
});

test('imported presentation slides map one-to-one onto song slides', () => {
  const source = createLdsongFromSlides([
    ['Welcome everyone', 'Please stand'],
    ['[Hallelujah]'],
    [],
    ['  Final slide  '],
  ], { songMetadata: { title: 'Opening Slides' } });
  const { document } = parseLdsongDocument(source);
  const { processedLines } = parseLdsongContent(source);

  assert.equal(document.metadata.title, 'Opening Slides');
  assert.deepEqual(document.sections[0].slides.map((slide) => slide.lines.map((line) => line.text)), [
    ['Welcome everyone', 'Please stand'],
    ['[Hallelujah]'],
    ['Final slide'],
  ]);
  assert.equal(processedLines.length, 3);
  assert.equal(processedLines[1], '[Hallelujah]');
});

test('the song editor chooses structured or classic by intent and remembers preference', () => {
  assert.equal(resolveSongEditorKind({ mode: 'new' }), 'structured');
  assert.equal(resolveSongEditorKind({ mode: 'new', preferred: 'classic' }), 'classic');
  assert.equal(resolveSongEditorKind({ mode: 'new', editorParam: 'structured', preferred: 'classic' }), 'structured');
  assert.equal(resolveSongEditorKind({ mode: 'edit', lyricsFileType: 'ldsong', preferred: 'classic' }), 'structured');
  assert.equal(resolveSongEditorKind({ mode: 'edit', lyricsFileType: 'txt' }), 'classic');
  assert.equal(resolveSongEditorKind({ mode: 'edit', lyricsFileType: 'lrc' }), 'classic');
  assert.equal(resolveSongEditorKind({ mode: 'compose' }), 'classic');
  assert.equal(resolveSongEditorKind({ mode: 'new', origin: 'lyric-video-studio' }), 'classic');
});

test('song editor operations keep slides, lines, and roles consistent', () => {
  let doc = createEditorDocument();
  assert.equal(isEditorDocumentEmpty(doc), true);

  let result = addEditorSection(doc, { label: 'Verse 1' });
  doc = result.document;
  const firstLineId = result.lineId;
  doc = updateEditorLine(doc, firstLineId, { text: 'Amazing grace' });
  result = addEditorLine(doc, { afterLineId: firstLineId });
  doc = updateEditorLine(result.document, result.lineId, { text: 'How sweet the sound', role: 'lyric' });
  const secondLineId = result.lineId;
  result = addEditorLine(doc, { afterLineId: secondLineId });
  doc = updateEditorLine(result.document, result.lineId, { text: 'Que dulce el son', role: 'translation' });

  result = splitEditorSlide(doc, secondLineId);
  doc = result.document;
  assert.deepEqual(doc.sections[0].slides.map((slide) => slide.lines.map((line) => line.text)), [
    ['Amazing grace', 'How sweet the sound'],
    ['Que dulce el son'],
  ]);

  doc = mergeEditorSlideWithPrevious(doc, doc.sections[0].slides[1].id);
  assert.equal(doc.sections[0].slides.length, 1);

  doc = removeEditorLine(doc, secondLineId);
  const plain = toLdsongDocument(doc);
  assert.deepEqual(plain.sections, [{
    label: 'Verse 1',
    slides: [{ lines: [
      { role: 'lyric', text: 'Amazing grace' },
      { role: 'translation', text: 'Que dulce el son' },
    ] }],
  }]);
  assert.equal(isEditorDocumentEmpty(doc), false);
});

test('blank editor lines and slides never reach the saved song', () => {
  let { document: doc } = addEditorSection(createEditorDocument(), { label: 'Chorus' });
  assert.deepEqual(toLdsongDocument(doc).sections, []);
  doc = updateEditorLine(doc, doc.sections[0].slides[0].lines[0].id, { text: '  Hallelujah  ' });
  assert.deepEqual(toLdsongDocument(doc).sections[0].slides[0].lines, [{ role: 'lyric', text: 'Hallelujah' }]);
});

test('pasted songs are laid out by the parser while short pastes stay literal', () => {
  const song = [
    'Verse 1',
    'Line one of the verse',
    'Line two of the verse',
    '',
    'Chorus',
    'Chorus line',
  ].join('\n');
  assert.equal(isSongSizedPaste(song), true);
  assert.equal(isSongSizedPaste('Just one line'), false);
  assert.equal(isSongSizedPaste('Line one\nLine two'), false);

  const pasted = importLyricsIntoEditor(createEditorDocument(), song, {
    parsingOptions: { enableSplitting: false },
  });
  assert.deepEqual(pasted.sections.map((section) => section.label), ['Verse 1', 'Chorus']);
  assert.equal(pasted.sections[0].slides[0].lines[0].text, 'Line one of the verse');
  assert.equal(typeof pasted.sections[0].slides[0].lines[0].id, 'string');

  let { document: doc, lineId } = addEditorSection(createEditorDocument(), { label: 'Bridge' });
  doc = insertLiteralLinesIntoEditor(doc, lineId, 'First pasted\nSecond pasted\n\nThird pasted');
  assert.deepEqual(doc.sections[0].slides.map((slide) => slide.lines.map((line) => line.text)), [
    ['First pasted', 'Second pasted'],
    ['Third pasted'],
  ]);
});

test('song editor fit checks flag slides that may not display well', () => {
  const issues = getEditorSlideIssues({
    lines: [
      { role: 'lyric', text: 'A'.repeat(80) },
      { role: 'lyric', text: 'Two' },
      { role: 'lyric', text: 'Three' },
      { role: 'lyric', text: 'Four' },
      { role: 'lyric', text: 'Five' },
    ],
  }, { maxLines: 4 });
  assert.equal(issues.some((issue) => /wrap/i.test(issue)), true);
  assert.equal(issues.some((issue) => /5 lines/.test(issue)), true);
  assert.deepEqual(getEditorSlideIssues({ lines: [{ role: 'lyric', text: 'Short' }] }), []);
});

test('play order follows the arrangement or falls back to document order', () => {
  let doc = createEditorDocument();
  doc = addEditorSection(doc, { label: 'Verse 1' }).document;
  doc = addEditorSection(doc, { label: 'Chorus' }).document;
  assert.deepEqual(getEditorPlayOrder(doc), ['Verse 1', 'Chorus']);
  doc = { ...doc, arrangement: ['Chorus', 'Verse 1', 'Chorus'] };
  assert.deepEqual(getEditorPlayOrder(doc), ['Chorus', 'Verse 1', 'Chorus']);
});

test('a section can start at any slide, so long pasted songs split where they are', () => {
  let doc = importLyricsIntoEditor(createEditorDocument(), 'One\n\nTwo\n\nThree\n\nFour', {
    parsingOptions: { enableSplitting: false, groupingConfig: { enableAutoLineGrouping: false } },
  });
  assert.equal(doc.sections.length, 1);
  const third = doc.sections[0].slides[2];

  let result = splitEditorSectionAtSlide(doc, third.id, 'Chorus');
  doc = result.document;
  assert.deepEqual(doc.sections.map((section) => [section.label, section.slides.length]), [['', 2], ['Chorus', 2]]);
  assert.equal(result.sectionId, doc.sections[1].id);

  result = splitEditorSectionAtSlide(doc, doc.sections[0].slides[0].id, 'Verse 1');
  doc = result.document;
  assert.deepEqual(doc.sections.map((section) => [section.label, section.slides.length]), [['Verse 1', 2], ['Chorus', 2]]);
});

test('line tools transform, duplicate, and move lines within the song', () => {
  let { document: doc, lineId } = addEditorSection(createEditorDocument(), { label: 'Verse 1' });
  doc = updateEditorLine(doc, lineId, { text: 'first line' });
  const added = addEditorLine(doc, { afterLineId: lineId, text: 'second line' });
  doc = added.document;

  doc = mapEditorLines(doc, (line) => ({ ...line, text: line.text.toUpperCase() }), { lineIds: [lineId] });
  assert.deepEqual(doc.sections[0].slides[0].lines.map((line) => line.text), ['FIRST LINE', 'second line']);

  doc = mapEditorLines(doc, (line) => ({ ...line, text: `${line.text}!` }));
  assert.deepEqual(doc.sections[0].slides[0].lines.map((line) => line.text), ['FIRST LINE!', 'second line!']);

  const duplicated = duplicateEditorLine(doc, lineId);
  assert.equal(duplicated.document.sections[0].slides[0].lines[1].text, 'FIRST LINE!');
  assert.notEqual(duplicated.lineId, lineId);

  doc = moveEditorLine(doc, added.lineId, -1);
  assert.deepEqual(doc.sections[0].slides[0].lines.map((line) => line.text), ['second line!', 'FIRST LINE!']);
  assert.equal(moveEditorLine(doc, added.lineId, -1), doc);
});

test('slide preview cues match what outputs show for a slide', () => {
  const slide = {
    id: 'slide',
    lines: [
      { id: 'a', role: 'lyric', text: 'Amazing grace' },
      { id: 'b', role: 'translation', text: 'Gracia' },
      { id: 'c', role: 'lyric', text: 'How sweet' },
      { id: 'd', role: 'stage', text: 'Key change' },
    ],
  };
  const cues = getEditorSlideCues(slide);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].type, 'group');
  assert.equal(cues[0].translation, 'Gracia');
  assert.equal(cues[1], 'How sweet');

  const grouped = getEditorSlideCues({ id: 's', lines: [{ id: 'a', role: 'lyric', text: 'One' }, { id: 'b', role: 'lyric', text: 'Two' }] });
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].displayText, 'One\nTwo');

  assert.deepEqual(getEditorSlideCues({ id: 's', lines: [{ id: 'a', role: 'stage', text: 'Band only' }] }), []);
  assert.deepEqual(getEditorSlideCues(null), []);
});
