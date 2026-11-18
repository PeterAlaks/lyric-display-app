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
import { createLdsongFromImportedText, parseLyricImportContent, prepareLyricTextImport } from '../shared/documentTextExtraction.js';
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
  layOutPastedLyrics,
  mergeEditorLineWithPrevious,
  mergeEditorSlideWithPrevious,
  removeEditorLine,
  resolveSongEditorKind,
  splitEditorLine,
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

const slideTexts = (doc) => doc.sections.map((section) => [
  section.label,
  section.slides.map((slide) => slide.lines.map((line) => (line.role === 'lyric' ? line.text : `${line.role}: ${line.text}`))),
]);

test('pasted songs fill slides with the chosen number of lines, never across a blank line', () => {
  const song = [
    'Amazing grace how sweet the sound that saved a wretch like me',
    'I once was lost but now am found, was blind but now I see, and I will sing of grace',
    'Through many dangers, toils and snares I have already come',
    '',
    'When we have been there ten thousand years',
    '',
    'Bright shining as the sun',
  ].join('\n');
  // The classic list's grouping limits and long-line splitting must not reshape a paste.
  const parsingOptions = { enableSplitting: true, groupingConfig: { enableAutoLineGrouping: false, enableCrossBlankLineGrouping: true } };

  assert.deepEqual(slideTexts(importLyricsIntoEditor(createEditorDocument(), song, { parsingOptions, linesPerSlide: 2 })), [
    ['', [
      ['Amazing grace how sweet the sound that saved a wretch like me', 'I once was lost but now am found, was blind but now I see, and I will sing of grace'],
      ['Through many dangers, toils and snares I have already come'],
      ['When we have been there ten thousand years'],
      ['Bright shining as the sun'],
    ]],
  ]);

  assert.deepEqual(
    slideTexts(importLyricsIntoEditor(createEditorDocument(), song, { parsingOptions, linesPerSlide: 3 }))[0][1].map((slide) => slide.length),
    [3, 1, 1],
  );
  assert.deepEqual(
    slideTexts(importLyricsIntoEditor(createEditorDocument(), song, { parsingOptions, linesPerSlide: 1 }))[0][1].map((slide) => slide.length),
    [1, 1, 1, 1, 1],
  );
});

test('pasted slide layout keeps sections, translations, and stage notes', () => {
  const song = [
    'Chorus',
    'Hosanna in the highest',
    '(Hosanna en las alturas)',
    'Let our praises rise to You',
    'Hosanna, hosanna',
    'Glory to the King',
    '',
    '// Band: hold the last chord',
    'Hosanna',
  ].join('\n');
  assert.deepEqual(slideTexts(importLyricsIntoEditor(createEditorDocument(), song, { parsingOptions: {}, linesPerSlide: 2 })), [
    ['Chorus', [
      ['Hosanna in the highest', 'translation: Hosanna en las alturas'],
      ['Let our praises rise to You', 'Hosanna, hosanna'],
      ['Glory to the King'],
      ['stage: Band: hold the last chord', 'Hosanna'],
    ]],
  ]);
});

test('short pastes into a line start a new slide once the slide holds the chosen number of lines', () => {
  let { document: doc, lineId } = addEditorSection(createEditorDocument(), { label: 'Verse 1' });
  doc = insertLiteralLinesIntoEditor(doc, lineId, 'One\nTwo\nThree\n\nFour', { linesPerSlide: 2 });
  assert.deepEqual(slideTexts(doc)[0][1], [['One', 'Two'], ['Three'], ['Four']]);

  // Lines already on the slide count toward the limit.
  ({ document: doc, lineId } = addEditorSection(createEditorDocument(), { label: 'Verse 1' }));
  doc = updateEditorLine(doc, lineId, { text: 'Existing' });
  doc = insertLiteralLinesIntoEditor(doc, lineId, 'One\nTwo\nThree', { linesPerSlide: 2 });
  assert.deepEqual(slideTexts(doc)[0][1], [['Existing', 'One'], ['Two', 'Three']]);

  // An empty line on a full slide moves to the next slide instead of overfilling it.
  ({ document: doc, lineId } = addEditorSection(createEditorDocument(), { label: 'Verse 1' }));
  doc = updateEditorLine(doc, lineId, { text: 'A' });
  doc = addEditorLine(doc, { afterLineId: lineId, text: 'B' }).document;
  const added = addEditorLine(doc, { afterLineId: doc.sections[0].slides[0].lines[1].id });
  doc = insertLiteralLinesIntoEditor(added.document, added.lineId, 'C\nD', { linesPerSlide: 2 });
  assert.deepEqual(slideTexts(doc)[0][1], [['A', 'B'], ['C', 'D']]);
});

const HYMNARY_COUNT_YOUR_BLESSINGS = [
  "1 When upon life's billows you are tempest tossed,",
  'When you are discouraged, thinking all is lost,',
  'Count your many blessings, name them one by one,',
  'And it will surprise you what the Lord hath done.',
  'Refrain:',
  'Count your blessings, name them one by one;',
  'Count your blessings, see what God hath done;',
  'Count your blessings, name them one by one;',
  'Count your many blessings, see what God hath done.',
  '2 Are you ever burdened with a load of care?',
  'Does the cross seem heavy you are called to bear?',
  "Count your many blessings, ev'ry doubt will fly,",
  'And you will be singing as the days go by. [Refrain]',
  '3 When you look at others with their lands and gold,',
  'Think that Christ has promised you His wealth untold;',
  'Count your many blessings, money cannot buy',
  'Your reward in heaven, nor your home on high. [Refrain]',
  '4 So, amid the conflict, whether great or small,',
  'Do not be discouraged, God is over all;',
  'Count your many blessings, angels will attend,',
  "Help and comfort give you to your journey's end. [Refrain]",
].join('\r\n');

const sectionShape = (doc) => doc.sections.map((section) => [
  section.label,
  section.repeat ? 'repeat' : section.slides.map((slide) => slide.lines.length).join('+'),
]);

test('hymnal pastes become numbered verses with one refrain that repeats', () => {
  const doc = importLyricsIntoEditor(createEditorDocument(), HYMNARY_COUNT_YOUR_BLESSINGS, { parsingOptions: {}, linesPerSlide: 2 });

  assert.deepEqual(sectionShape(doc), [
    ['Verse 1', '2+2'],
    ['Refrain', '2+2'],
    ['Verse 2', '2+2'],
    ['Refrain', 'repeat'],
    ['Verse 3', '2+2'],
    ['Refrain', 'repeat'],
    ['Verse 4', '2+2'],
    ['Refrain', 'repeat'],
  ]);
  // Stanza numbers and inline repeat markers are structure, not lyrics.
  assert.equal(doc.sections[0].slides[0].lines[0].text, "When upon life's billows you are tempest tossed,");
  assert.equal(doc.sections[2].slides[1].lines[1].text, 'And you will be singing as the days go by.');
  assert.equal(doc.sections[6].slides[1].lines[1].text, "Help and comfort give you to your journey's end.");

  const lyrics = ldsongDocumentToLyrics(toLdsongDocument(doc));
  assert.deepEqual(lyrics.warnings, []);
  assert.deepEqual(lyrics.sections.map((section) => section.label), getEditorPlayOrder(doc));
  assert.equal(lyrics.sections.filter((section) => section.label === 'Refrain').length, 4);
});

test('pasted stanza numbers are read as verses only when they count up from 1', () => {
  const numbered = importLyricsIntoEditor(createEditorDocument(), [
    '1.',
    'Amazing grace how sweet the sound',
    '',
    '2)',
    "'Twas grace that taught my heart to fear",
    '',
    '3. Through many dangers, toils and snares',
  ].join('\n'), { parsingOptions: {}, linesPerSlide: 2 });
  assert.deepEqual(slideTexts(numbered), [
    ['Verse 1', [['Amazing grace how sweet the sound']]],
    ['Verse 2', [["'Twas grace that taught my heart to fear"]]],
    ['Verse 3', [['Through many dangers, toils and snares']]],
  ]);

  const lyricNumbers = importLyricsIntoEditor(createEditorDocument(), [
    'Verse 1',
    '7 days without You',
    'Is a week too long',
    '10,000 reasons for my heart to find',
    '2 hands lifted high',
  ].join('\n'), { parsingOptions: {}, linesPerSlide: 4 });
  assert.deepEqual(slideTexts(lyricNumbers), [
    ['Verse 1', [['7 days without You', 'Is a week too long', '10,000 reasons for my heart to find', '2 hands lifted high']]],
  ]);
});

test('a stanza that calls the chorus is never swallowed into the chorus', () => {
  const doc = importLyricsIntoEditor(createEditorDocument(), [
    'Mine eyes have seen the glory of the coming of the Lord',
    'He is trampling out the vintage where the grapes of wrath are stored',
    'Chorus:',
    'Glory, glory, hallelujah',
    'His truth is marching on',
    '',
    'I have seen Him in the watch-fires of a hundred circling camps',
    'They have builded Him an altar in the evening dews and damps (Chorus)',
    '',
    'He has sounded forth the trumpet that shall never call retreat',
    'He is sifting out the hearts of men before His judgment seat (Chorus)',
  ].join('\n'), { parsingOptions: {}, linesPerSlide: 2 });

  assert.deepEqual(sectionShape(doc), [
    ['Verse 1', '2'],
    ['Chorus', '2'],
    ['Verse 2', '2'],
    ['Chorus', 'repeat'],
    ['Verse 3', '2'],
    ['Chorus', 'repeat'],
  ]);
});

test('chord sheets and SongSelect footers paste as clean lyrics with song credits', () => {
  const doc = importLyricsIntoEditor(createEditorDocument(), [
    'Amazing Grace (My Chains Are Gone)',
    '',
    'Verse 1',
    'G           C/G        G',
    'Amazing grace how sweet the sound',
    '         D7      Em  D',
    'That saved a wretch like me',
    '',
    'Chorus',
    'C        G',
    'My chains are gone',
    '',
    'CCLI Song # 4768151',
    'Chris Tomlin | Louie Giglio',
    '© 2006 sixsteps Music (Admin. by Capitol CMG Publishing)',
    'For use solely with the SongSelect® Terms of Use. All rights reserved. www.ccli.com',
    'CCLI License # 123456',
  ].join('\n'), { parsingOptions: {}, linesPerSlide: 2 });

  assert.deepEqual(slideTexts(doc), [
    ['Verse 1', [['Amazing grace how sweet the sound', 'That saved a wretch like me']]],
    ['Chorus', [['My chains are gone']]],
  ]);
  assert.equal(doc.metadata.title, 'Amazing Grace (My Chains Are Gone)');
  assert.deepEqual(doc.metadata.artists, ['Chris Tomlin', 'Louie Giglio']);
  assert.equal(doc.metadata.copyright, '2006 sixsteps Music (Admin. by Capitol CMG Publishing)');
  assert.equal(doc.metadata.ccliSongNumber, '4768151');
});

test('pasted section names survive when the user strips section tags for display', () => {
  const doc = importLyricsIntoEditor(createEditorDocument(), 'Verse 1\nAmazing grace\n\nChorus\nMy chains are gone', {
    parsingOptions: { groupingConfig: { structureTagMode: 'strip' } },
    linesPerSlide: 2,
  });
  assert.deepEqual(doc.sections.map((section) => section.label), ['Verse 1', 'Chorus']);
});

test('short pastes that name a section are laid out instead of typed in literally', () => {
  assert.equal(isSongSizedPaste('Chorus\nMy chains are gone'), true);
  assert.equal(isSongSizedPaste('1 Amazing grace\n2 Twas grace'), true);
  assert.equal(isSongSizedPaste('Line one\rLine two'), false);
});

test('pasting reports what was recognized so the operator can check it', () => {
  const { document: doc, summary } = layOutPastedLyrics(createEditorDocument(), HYMNARY_COUNT_YOUR_BLESSINGS, { parsingOptions: {}, linesPerSlide: 2 });
  assert.equal(doc.sections.length, 8);
  assert.equal(summary.sections, 8);
  assert.equal(summary.slides, 10);
  assert.deepEqual(summary.notes, ['verses numbered', 'Refrain repeats linked']);
});

test('lines split at the caret and join back with Backspace', () => {
  let { document: doc, lineId } = addEditorSection(createEditorDocument(), { label: 'Verse 1' });
  doc = updateEditorLine(doc, lineId, { text: 'Amazing grace how sweet the sound' });

  const split = splitEditorLine(doc, lineId, 'Amazing grace '.length);
  assert.deepEqual(slideTexts(split.document)[0][1], [['Amazing grace', 'how sweet the sound']]);
  assert.equal(split.document.sections[0].slides[0].lines[1].id, split.lineId);

  const merged = mergeEditorLineWithPrevious(split.document, split.lineId);
  assert.deepEqual(slideTexts(merged.document)[0][1], [['Amazing grace how sweet the sound']]);
  assert.equal(merged.lineId, lineId);
  assert.equal(merged.caret, 'Amazing grace '.length);

  // The first line of a slide joins the slide above; the first line of a section stays put.
  const slides = splitEditorSlide(split.document, lineId);
  const joined = mergeEditorLineWithPrevious(slides.document, slides.lineId);
  assert.deepEqual(slideTexts(joined.document)[0][1], [['Amazing grace', 'how sweet the sound']]);
  assert.equal(joined.caret, 0);
  assert.equal(mergeEditorLineWithPrevious(doc, lineId).lineId, null);
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

test('imported song text keeps its sections even when the user strips structure tags for display', () => {
  const source = createLdsongFromImportedText('[Verse 1]\nAmazing grace\n\n[Chorus]\nMy chains are gone\n\n[Verse 2]\nTwas grace\n\n[Chorus]\nMy chains are gone', {
    parsingOptions: { enableSplitting: false, groupingConfig: { structureTagMode: 'strip' } },
  });
  const { document } = parseLdsongDocument(source);

  assert.deepEqual(document.sections.map((section) => section.label), ['Verse 1', 'Chorus', 'Verse 2']);
  assert.deepEqual(document.arrangement, ['Verse 1', 'Chorus', 'Verse 2', 'Chorus']);
});

test('online provider lyrics load as structured songs, while timed LRC lyrics stay LRC', () => {
  const imported = prepareLyricTextImport({
    title: 'Amazing Grace',
    artist: 'John Newton',
    year: 1779,
    content: '[Verse 1]\nAmazing grace how sweet the sound\n\n[Chorus]\nMy chains are gone',
  }, { providerName: 'Open Hymnal', parsingOptions: { enableSplitting: false }, importedOn: '2026-11-07' });

  assert.equal(imported.fileType, 'ldsong');
  assert.equal(isLdsongContent(imported.content), true);
  assert.match(imported.content, /^# Title: Amazing Grace\n# Author: John Newton\n# Year: 1779\n/m);
  assert.match(imported.content, /^# Imported from Open Hymnal: 2026-11-07$/m);
  assert.deepEqual(parseLdsongDocument(imported.content).document.sections.map((section) => section.label), ['Verse 1', 'Chorus']);

  const timed = prepareLyricTextImport({ title: 'Song', content: '[00:01.00]First line\n[00:04.00]Second line' }, { providerName: 'LRCLIB' });
  assert.equal(timed.fileType, 'lrc');
  assert.equal(timed.content, '[00:01.00]First line\n[00:04.00]Second line');

  const structured = prepareLyricTextImport({ title: 'Song', content: SAMPLE }, { providerName: 'Anywhere' });
  assert.equal(structured.fileType, 'ldsong');
  assert.equal(structured.content, SAMPLE);
});
