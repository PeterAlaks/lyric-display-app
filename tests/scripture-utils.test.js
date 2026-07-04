import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScriptureProjection,
  cleanVerseText,
  compressVerseRanges,
  matchBooks,
  parseScriptureQuery,
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
  assert.equal(projection.content, '16 For God so loved the world…\n17 For God sent not his Son…');
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
  assert.equal(projection.content, '1 The LORD is my shepherd; I shall not want.');
});
