import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScriptureProjection,
  cleanVerseText,
  combineOutputTexts,
  compressVerseRanges,
  isScriptureReferenceLine,
  matchBooks,
  parseScriptureQuery,
  toSuperscriptNumber,
} from '../src/utils/scripture.js';
import { BIBLE_BOOKS, SCRIPTURE_TRANSLATIONS, DEFAULT_SCRIPTURE_TRANSLATION } from '../src/constants/scripture.js';

test('scripture constants are well-formed', () => {
  assert.equal(BIBLE_BOOKS.length, 66);
  assert.ok(SCRIPTURE_TRANSLATIONS.length > 0);
  assert.ok(SCRIPTURE_TRANSLATIONS.some((t) => t.id === DEFAULT_SCRIPTURE_TRANSLATION));
});

test('parses book-only queries', () => {
  assert.deepEqual(parseScriptureQuery('John'), {
    bookQuery: 'John',
    chapter: null,
    verseStart: null,
    verseEnd: null,
  });
  assert.equal(parseScriptureQuery(''), null);
  assert.equal(parseScriptureQuery('   '), null);
});

test('parses book and chapter queries', () => {
  const parsed = parseScriptureQuery('John 3');
  assert.equal(parsed.bookQuery, 'John');
  assert.equal(parsed.chapter, 3);
  assert.equal(parsed.verseStart, null);
});

test('parses single verse and verse range queries', () => {
  const single = parseScriptureQuery('John 3:16');
  assert.equal(single.chapter, 3);
  assert.equal(single.verseStart, 16);
  assert.equal(single.verseEnd, 16);

  const range = parseScriptureQuery('John 3:16-20');
  assert.equal(range.verseStart, 16);
  assert.equal(range.verseEnd, 20);

  const reversed = parseScriptureQuery('John 3:20-16');
  assert.equal(reversed.verseStart, 16);
  assert.equal(reversed.verseEnd, 20);
});

test('parses numbered books and compact input', () => {
  const numbered = parseScriptureQuery('1 john 1:9');
  assert.equal(numbered.bookQuery, '1 john');
  assert.equal(numbered.chapter, 1);
  assert.equal(numbered.verseStart, 9);

  const compact = parseScriptureQuery('john3:16');
  assert.equal(compact.bookQuery, 'john');
  assert.equal(compact.chapter, 3);
  assert.equal(compact.verseStart, 16);

  const spaced = parseScriptureQuery('song of solomon 2:1');
  assert.equal(spaced.bookQuery, 'song of solomon');
  assert.equal(spaced.chapter, 2);
});

test('matches books by partial name, alias, and roman ordinal', () => {
  assert.equal(matchBooks('joh')[0].name, 'John');
  assert.equal(matchBooks('John')[0].name, 'John');
  assert.equal(matchBooks('1 jo')[0].name, '1 John');
  assert.equal(matchBooks('ii john')[0].name, '2 John');
  assert.equal(matchBooks('ps')[0].name, 'Psalms');
  assert.equal(matchBooks('psalm 23')[0]?.name, undefined);
  assert.equal(matchBooks('sos')[0].name, 'Song of Solomon');
  assert.equal(matchBooks('gen.')[0].name, 'Genesis');
  assert.deepEqual(matchBooks('zzz'), []);
  assert.deepEqual(matchBooks(''), []);
});

test('book matching ranks exact matches above prefixes', () => {
  const matches = matchBooks('jud');
  assert.ok(matches.length >= 2);
  const names = matches.map((book) => book.name);
  assert.ok(names.includes('Judges'));
  assert.ok(names.includes('Jude'));

  assert.equal(matchBooks('jude')[0].name, 'Jude');
});

test('compresses verse numbers into ranges', () => {
  assert.equal(compressVerseRanges([16, 17, 18, 20]), '16-18,20');
  assert.equal(compressVerseRanges([5]), '5');
  assert.equal(compressVerseRanges([3, 1, 2]), '1-3');
  assert.equal(compressVerseRanges([1, 1, 2]), '1-2');
  assert.equal(compressVerseRanges([]), '');
});

test('cleans verse whitespace', () => {
  assert.equal(cleanVerseText('For God so loved\nthe world  '), 'For God so loved the world');
  assert.equal(cleanVerseText(null), '');
});

test('detects scripture reference lines', () => {
  assert.equal(isScriptureReferenceLine('John 3:16 KJV'), true);
  assert.equal(isScriptureReferenceLine('[John 3:16 KJV]'), true);
  assert.equal(isScriptureReferenceLine('1 Corinthians 13:4 WEBBE'), true);
  assert.equal(isScriptureReferenceLine('Song of Solomon 2:1 OEB'), true);
  assert.equal(isScriptureReferenceLine('For God so loved the world'), false);
  assert.equal(isScriptureReferenceLine('¹⁶ For God so loved the world'), false);
  assert.equal(isScriptureReferenceLine('Meet me at 3:16 KJV cafe today'), false);
});

test('combines output texts keeping only the final reference', () => {
  const combined = combineOutputTexts([
    '⁸ Jesus Christ the same yesterday, and to day, and for ever.\nHebrews 13:8 KJV',
    '⁹ Be not carried about with divers and strange doctrines.\nHebrews 13:9 KJV',
    '¹⁰ We have an altar.\nHebrews 13:10 KJV',
  ]);

  assert.equal(
    combined,
    '⁸ Jesus Christ the same yesterday, and to day, and for ever.\n'
    + '⁹ Be not carried about with divers and strange doctrines.\n'
    + '¹⁰ We have an altar.\nHebrews 13:10 KJV'
  );

  assert.equal(combineOutputTexts(['only one\nJohn 3:16 KJV']), 'only one\nJohn 3:16 KJV');
  assert.equal(combineOutputTexts([]), '');
  assert.equal(combineOutputTexts(['plain line', 'another line']), 'plain line\nanother line');
});

test('converts numbers to unicode superscripts', () => {
  assert.equal(toSuperscriptNumber(16), '¹⁶');
  assert.equal(toSuperscriptNumber(105), '¹⁰⁵');
});

test('builds projection payload for a verse selection', () => {
  const projection = buildScriptureProjection({
    bookName: 'John',
    chapter: 3,
    verses: [
      { verse: 16, text: 'For God so loved the world…' },
      { verse: 17, text: 'For God sent not his Son…' },
    ],
    wholeChapter: false,
    translationId: 'kjv',
    translationName: 'King James Version',
  });

  assert.equal(projection.title, 'John 3:16-17 (KJV)');
  assert.equal(
    projection.content,
    '¹⁶ For God so loved the world…\nJohn 3:16 KJV\n\n¹⁷ For God sent not his Son…\nJohn 3:17 KJV'
  );
  assert.match(projection.origin, /King James Version/);
});

test('builds projection payload for a whole chapter', () => {
  const projection = buildScriptureProjection({
    bookName: 'Psalms',
    chapter: 23,
    verses: [{ verse: 1, text: 'The LORD is my shepherd; I shall not want.' }],
    wholeChapter: true,
    translationId: 'web',
  });

  assert.equal(projection.title, 'Psalms 23 (WEB)');
  assert.equal(projection.content, '¹ The LORD is my shepherd; I shall not want.\nPsalms 23:1 WEB');
});

test('projected verse blocks parse into one line group per verse', async () => {
  const { parseTxtContent } = await import('../shared/lyricsParsing/index.js');
  const { SCRIPTURE_GROUPING_CONFIG } = await import('../src/utils/scripture.js');

  const projection = buildScriptureProjection({
    bookName: 'John',
    chapter: 3,
    verses: [
      { verse: 16, text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
      { verse: 17, text: 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.' },
    ],
    wholeChapter: false,
    translationId: 'kjv',
  });

  const parsed = parseTxtContent(projection.content, {
    enableSplitting: true,
    groupingConfig: SCRIPTURE_GROUPING_CONFIG,
  });

  assert.equal(parsed.processedLines.length, 2);
  for (const line of parsed.processedLines) {
    assert.equal(line.type, 'normal-group');
    assert.ok(line.lines.length >= 2);
  }
  assert.match(parsed.processedLines[0].lines.at(-1), /^John 3:16 KJV$/);
  assert.match(parsed.processedLines[1].lines.at(-1), /^John 3:17 KJV$/);
  assert.ok(parsed.processedLines[0].lines[0].startsWith('¹⁶ '));
});
