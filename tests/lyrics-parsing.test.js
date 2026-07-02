import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLrcContent, parseTxtContent } from '../shared/lyricsParsing.js';
import { formatLyrics, formatLyricsWithStats } from '../src/utils/lyricsFormat.js';

test('LRC parsing sorts timestamps, strips metadata, and deduplicates repeated timed lines', () => {
  const parsed = parseLrcContent([
    '[ar:Example Artist]',
    '[00:20.00]Second line',
    '[00:10.50]First line',
    '[00:10.50]First line',
    'Untimed refrain',
  ].join('\n'), { enableSplitting: false });

  assert.deepEqual(parsed.processedLines, [
    'First line',
    'Second line',
    'Untimed refrain',
  ]);
  assert.deepEqual(parsed.timestamps, [1050, 2000, null]);
  assert.equal(parsed.rawText, 'First line\nSecond line\nUntimed refrain');
});

test('LRC parsing preserves blank timestamped lines without visible placeholders', () => {
  const parsed = parseLrcContent([
    '[00:01.00]',
    '[00:02.00]First line',
    '[00:03.00]   ',
    '[00:04.00]Second line',
  ].join('\n'));

  assert.deepEqual(parsed.processedLines, [
    '',
    'First line',
    '',
    'Second line',
  ]);
  assert.deepEqual(parsed.timestamps, [100, 200, 300, 400]);
  assert.equal(parsed.rawText, '\nFirst line\n\nSecond line');
});

test('plain text parsing keeps section metadata aligned with processed lines', () => {
  const parsed = parseTxtContent([
    '[Verse 1]',
    'Amazing grace',
    'How sweet the sound',
    '',
    '[Chorus]',
    'I once was lost',
  ].join('\n'), { enableSplitting: false });

  assert.equal(parsed.processedLines[0], '[Verse 1]');
  assert.equal(parsed.processedLines[1].type, 'normal-group');
  assert.deepEqual(parsed.processedLines[1].lines, ['Amazing grace', 'How sweet the sound']);
  assert.equal(parsed.processedLines[2], '[Chorus]');
  assert.equal(parsed.processedLines[3], 'I once was lost');
  assert.equal(parsed.sections.length, 2);
  assert.equal(parsed.sections[0].label, 'Verse 1');
  assert.equal(parsed.sections[1].label, 'Chorus');
  assert.equal(parsed.lineToSection[1], parsed.sections[0].id);
  assert.equal(parsed.lineToSection[3], parsed.sections[1].id);
});

test('formatter splits long lines without inserting blank separators between split segments', () => {
  const formatted = formatLyrics(
    'this is a very long lyric line that should split into multiple display lines without becoming separate lyric blocks',
    {
      enableSplitting: true,
      splitConfig: {
        TARGET_LENGTH: 44,
        MIN_LENGTH: 25,
        MAX_LENGTH: 52,
        OVERFLOW_TOLERANCE: 4,
      },
    }
  );

  assert.equal(formatted.includes('\n\n'), false);
  assert.equal(formatted.split('\n').length > 1, true);
});

test('formatter normalizes spaced metadata tags before lyric cleanup', () => {
  const { text, stats } = formatLyricsWithStats('[ ti : Song ]\nhello lord');

  assert.equal(text, '[ti:Song]\n\nHello Lord');
  assert.equal(stats.metadataTagsNormalized, 1);
});

test('formatter capitalizes lyric text after leading LRC timestamps', () => {
  assert.equal(formatLyrics('[00:01.00] hello god', { enableSplitting: false }), '[00:01.00] Hello God');
});

test('LRC parsing strips enhanced word timestamps from visible lyric text', () => {
  const parsed = parseLrcContent('[ti:Example]\n[00:01.00]Hello <00:01.25>world', { enableSplitting: false });

  assert.deepEqual(parsed.processedLines, ['Hello world']);
  assert.deepEqual(parsed.timestamps, [100]);
  assert.deepEqual(parsed.enhancedTimestamps, [[{ time: 125, text: 'world' }]]);
  assert.equal(parsed.rawText, 'Hello world');
});

test('LRC parsing uses enhanced-only timestamps as line timestamps for autoplay', () => {
  const parsed = parseLrcContent([
    '<00:01.00>Hello <00:01.25>world',
    '<00:03.00>Next <00:03.50>line',
  ].join('\n'), { enableSplitting: false });

  assert.deepEqual(parsed.processedLines, ['Hello world', 'Next line']);
  assert.deepEqual(parsed.timestamps, [100, 300]);
  assert.deepEqual(parsed.enhancedTimestamps, [
    [{ time: 100, text: 'Hello' }, { time: 125, text: 'world' }],
    [{ time: 300, text: 'Next' }, { time: 350, text: 'line' }],
  ]);
});

test('LRC parsing ignores metadata tags with inconsistent spacing', () => {
  const parsed = parseLrcContent('[ ti : Example Song ]\n[00:01.00]First line', { enableSplitting: false });

  assert.deepEqual(parsed.processedLines, ['First line']);
  assert.deepEqual(parsed.timestamps, [100]);
});

test('plain text parser recognizes section descriptors separated by en dash', () => {
  const parsed = parseTxtContent('[Chorus \u2013 Leader]\nSing it again', { enableSplitting: false });

  assert.equal(parsed.processedLines[0], '[Chorus \u2013 Leader]');
  assert.equal(parsed.sections.length, 1);
  assert.equal(parsed.sections[0].label, 'Chorus \u2013 Leader');
});
