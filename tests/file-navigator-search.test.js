import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNavigatorMatchSnippet,
  createNavigatorPreview,
  hasNavigatorTextContent,
  parseFileNavigatorQuery,
  prepareNavigatorSearchRecord,
  scoreNavigatorSearchRecord,
} from '../shared/fileNavigatorSearch.js';

const record = (overrides = {}) => prepareNavigatorSearchRecord({
  filePath: 'C:\\Lyrics\\Sunday\\Amazing Grace.lrc',
  rootPath: 'C:\\Lyrics',
  fileName: 'Amazing Grace.lrc',
  fileType: 'lrc',
  relativePath: 'Sunday\\Amazing Grace.lrc',
  parentPath: 'C:\\Lyrics\\Sunday',
  size: 120,
  modifiedMs: 100,
  contentText: '[00:01.00]How sweet the sound\n[00:04.00]That saved a wretch like me',
  ...overrides,
});

test('file navigator query parser supports quoted phrases and extension aliases', () => {
  assert.deepEqual(parseFileNavigatorQuery('"amazing grace" ext:markdown type:lrc'), {
    input: '"amazing grace" ext:markdown type:lrc',
    terms: ['amazing grace'],
    fileTypes: ['md', 'lrc'],
  });
});

test('file navigator search prioritizes titles while retaining content search', () => {
  const titleMatch = scoreNavigatorSearchRecord(record(), 'amazing');
  const contentMatch = scoreNavigatorSearchRecord(record({ fileName: 'Sunday Song.lrc' }), 'sweet sound');

  assert.equal(titleMatch.matchedField, 'name');
  assert.equal(contentMatch.matchedField, 'content');
  assert.ok(titleMatch.score > contentMatch.score);
});

test('file navigator title search tolerates compact queries and small typos', () => {
  assert.ok(scoreNavigatorSearchRecord(record(), 'amzgrc'));
  assert.ok(scoreNavigatorSearchRecord(record(), 'amazin'));
  assert.equal(scoreNavigatorSearchRecord(record(), 'completely unrelated'), null);
});

test('file navigator search applies type filters before scoring', () => {
  assert.ok(scoreNavigatorSearchRecord(record(), 'grace ext:lrc'));
  assert.equal(scoreNavigatorSearchRecord(record(), 'grace ext:txt'), null);
});

test('LRC previews remove timing and metadata while snippets center lyric matches', () => {
  const content = [
    '[ar:Traditional]',
    '[00:01.00]Amazing grace',
    '[00:04.00]How sweet the sound',
    '[00:08.00]That saved a wretch like me',
  ].join('\n');
  const preview = createNavigatorPreview(content, 'lrc');
  const snippet = createNavigatorMatchSnippet(content, 'sweet', 'lrc');

  assert.equal(preview.includes('[00:'), false);
  assert.equal(preview.includes('[ar:'), false);
  assert.match(preview, /Amazing grace/);
  assert.match(snippet, /How sweet the sound/);
});

test('structured songs are indexed, filterable, and previewed as readable lyrics', () => {
  assert.equal(hasNavigatorTextContent('ldsong'), true);
  assert.equal(hasNavigatorTextContent('txt'), true);
  assert.equal(hasNavigatorTextContent('docx'), false);
  assert.deepEqual(parseFileNavigatorQuery('grace type:song ext:ldsong').fileTypes, ['ldsong']);

  const content = '#LDSONG 1\n# Title: Amazing Grace\n\n[Verse 1]\nAmazing grace\n> Gracia admirable\n\[Hallelujah]';
  const preview = createNavigatorPreview(content, 'ldsong');
  assert.equal(preview.includes('#LDSONG'), false);
  assert.match(preview, /^# Title: Amazing Grace/);
  assert.match(preview, /\[Verse 1\]\nAmazing grace\n> Gracia admirable\n\[Hallelujah\]/);
});
