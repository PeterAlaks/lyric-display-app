import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILE_NAVIGATOR_LIMITS,
  getFileNavigatorRootLimitError,
} from '../shared/fileNavigatorLimits.js';

test('file navigator root limits remain explicitly bounded', () => {
  assert.equal(FILE_NAVIGATOR_LIMITS.maxRoots, 20);
  assert.equal(FILE_NAVIGATOR_LIMITS.maxFilesPerRoot, 25_000);
  assert.equal(FILE_NAVIGATOR_LIMITS.maxSourceBytesPerRoot, 512 * 1024 * 1024);
  assert.equal(FILE_NAVIGATOR_LIMITS.maxSearchableContentBytesPerRoot, 32 * 1024 * 1024);
  assert.equal(FILE_NAVIGATOR_LIMITS.maxSearchableContentBytesTotal, 64 * 1024 * 1024);
});

test('folder limits accept boundary values and reject oversized sources', () => {
  assert.equal(getFileNavigatorRootLimitError({
    fileCount: FILE_NAVIGATOR_LIMITS.maxFilesPerRoot,
    sourceBytes: FILE_NAVIGATOR_LIMITS.maxSourceBytesPerRoot,
  }), null);

  assert.match(getFileNavigatorRootLimitError({
    fileCount: FILE_NAVIGATOR_LIMITS.maxFilesPerRoot + 1,
    sourceBytes: 0,
  }), /supported lyric files/);

  assert.match(getFileNavigatorRootLimitError({
    fileCount: 1,
    sourceBytes: FILE_NAVIGATOR_LIMITS.maxSourceBytesPerRoot + 1,
  }), /512 MB/);
});
