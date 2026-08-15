import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDocxArchiveMetadata } from '../shared/documentTextExtraction.js';
import {
  MAX_DOCX_ARCHIVE_ENTRIES,
  MAX_DOCX_ENTRY_BYTES,
  assertLyricImportSize,
  getBinaryByteLength,
  getConfiguredLyricImportByteLimit,
} from '../shared/lyricImportLimits.js';

test('lyric import size preference is clamped to the supported 1-10 MB range', () => {
  assert.equal(getConfiguredLyricImportByteLimit(undefined), 2 * 1024 * 1024);
  assert.equal(getConfiguredLyricImportByteLimit(0), 1024 * 1024);
  assert.equal(getConfiguredLyricImportByteLimit(2.5), 2.5 * 1024 * 1024);
  assert.equal(getConfiguredLyricImportByteLimit(50), 10 * 1024 * 1024);
});

test('lyric import byte validation handles buffers, views, and oversized payloads', () => {
  assert.equal(getBinaryByteLength(new Uint8Array(16)), 16);
  assert.equal(getBinaryByteLength(new ArrayBuffer(32)), 32);
  assert.doesNotThrow(() => assertLyricImportSize(1024, 1024));
  assert.throws(() => assertLyricImportSize(1025, 1024), /exceeds/);
  assert.throws(() => assertLyricImportSize(null, 1024), /unavailable/);
});

test('DOCX metadata validation requires document parts and bounded expansion', () => {
  assert.deepEqual(validateDocxArchiveMetadata([
    { name: '[Content_Types].xml', uncompressedSize: 100 },
    { name: 'word/document.xml', uncompressedSize: 500 },
    { name: 'word/media/', directory: true, uncompressedSize: 0 },
  ]), { entries: 3, uncompressedBytes: 600 });

  assert.throws(() => validateDocxArchiveMetadata([
    { name: '[Content_Types].xml', uncompressedSize: 100 },
  ]), /required document parts/);
  assert.throws(() => validateDocxArchiveMetadata([
    { name: '[Content_Types].xml', uncompressedSize: 100 },
    { name: 'word/document.xml', uncompressedSize: MAX_DOCX_ENTRY_BYTES + 1 },
  ]), /entry is too large/);
  assert.throws(() => validateDocxArchiveMetadata(
    Array.from({ length: MAX_DOCX_ARCHIVE_ENTRIES + 1 }, (_, index) => ({
      name: index === 0 ? '[Content_Types].xml' : `word/item-${index}.xml`,
      uncompressedSize: 1,
    }))
  ), /too many entries/);
});
