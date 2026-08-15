import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPortableNavigatorSaveName,
  normalizeNavigatorSaveExtension,
  validateNavigatorSaveName,
} from '../shared/fileNavigatorSave.js';

test('navigator save names are portable across Windows, macOS, and Linux', () => {
  assert.deepEqual(validateNavigatorSaveName('Amazing Grace', 'TXT'), {
    valid: true,
    baseName: 'Amazing Grace',
    extension: 'txt',
    fileName: 'Amazing Grace.txt',
  });
  assert.equal(validateNavigatorSaveName('Amazing Grace.lrc', '.txt').fileName, 'Amazing Grace.txt');

  for (const invalidName of ['bad/name', 'bad\\name', 'bad:name', 'song?', 'CON', 'name.']) {
    assert.equal(validateNavigatorSaveName(invalidName, 'txt').valid, false, invalidName);
  }
});

test('navigator save suggestions clean unsafe title characters without losing Unicode', () => {
  assert.equal(createPortableNavigatorSaveName('  Great: Song?  '), 'Great- Song-');
  assert.equal(createPortableNavigatorSaveName('Ọlọrun.lrc'), 'Ọlọrun');
  assert.equal(createPortableNavigatorSaveName('NUL'), '_NUL');
  assert.equal(normalizeNavigatorSaveExtension('.LRC'), 'lrc');
  assert.equal(normalizeNavigatorSaveExtension('docx'), null);
});

