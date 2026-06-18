import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLrcContent, parseTxtContent } from '../shared/lyricsParsing.js';

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
